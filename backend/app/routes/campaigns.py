from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import (
    Campaign, Platform, PlatformStat, AdContent, TargetingRule, User,
    Lead, LeadForm, FormSubmission, ClickTracking,
    AudienceProfile, PlatformTargeting,
)
from app.services.gender_stats_service import get_campaign_gender_stats
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from app.routes.leads import generate_lead_form_url
from app.services.place_stats_service import get_campaign_place_stats
import os
import json
from app.services.age_stats_service import get_campaign_age_stats

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://api.adnexus.co.in")

def generate_contact_landing_url(campaign_id: int) -> str:
    return f"{BACKEND_BASE_URL}/api/contact/{campaign_id}"

# Google + Meta imports
try:
    from app.services.google_ads_service import (
        submit_campaign_to_google,
        get_campaign_status as get_google_status,
        get_google_campaign_insights,
        get_google_campaign_status,
    )
    GOOGLE_AVAILABLE = True
except Exception:
    GOOGLE_AVAILABLE = False

try:
    from app.services.meta_ads_service import submit_campaign_to_meta, get_meta_campaign_status, get_meta_campaign_insights, get_meta_adset_insights
    META_AVAILABLE = True
except Exception:
    META_AVAILABLE = False
try:
    from app.services.audience_ai_service import generate_audience_profile
    from app.services.platform_mapping.meta_mapper import map_to_meta
    AUDIENCE_AI_AVAILABLE = True
except Exception:
    AUDIENCE_AI_AVAILABLE = False

router = APIRouter(tags=["campaigns"])


# ════════════════════════════════════════════════════
# PYDANTIC MODELS
# ════════════════════════════════════════════════════

# ── NAYA: ek city ka lat/lng bhi carry karta hai, taaki Meta/Google
# custom-location (proximity) targeting kar sakein, na ki sirf naam ═
class LocationDetail(BaseModel):
    name:  str
    lat:   float
    lng:   float
    state: str = ""


class TargetingData(BaseModel):
    locations:        List[str]            = ["Delhi", "Mumbai"]
    # ── NAYA: frontend se city ka naam + lat/lng dono aate hain ab ──
    location_details: List[LocationDetail]  = []
    radius_km:        int                   = 25
    age_min:          int                   = 25
    age_max:          int                   = 55
    genders:          List[int]             = [1, 2]
    audience_mode:    str                   = "broad"

class AdContentData(BaseModel):
    headlines:    List[str]     = []
    descriptions: List[str]     = []
    final_url:    Optional[str] = ""
    display_url:  Optional[str] = ""
    primary_text: Optional[str] = ""
    headline:     Optional[str] = ""
    description:  Optional[str] = ""
    cta:          Optional[str] = "LEARN_MORE"
    link_url:     Optional[str] = ""
    image_url:    Optional[str] = ""
    # ── NAYA: Carousel Ad support (Facebook/Instagram) — jab is_carousel true
    #    ho aur carousel_images mein 2+ URLs hon, Meta service single-image
    #    ki jagah multi-card "child_attachments" creative banayega. ──
    is_carousel:      Optional[bool]      = False
    carousel_images:  Optional[List[str]] = []

class CampaignCreateRequest(BaseModel):
    name:           str
    goal:           str             = "LEAD_GEN"
    industry:       Optional[str]   = ""
    sub_category:   Optional[str]   = ""
    business_niche: str             = ""
    budget:         float           = 10000      # daily budget ₹/day
    budget_amount:  Optional[float] = None       # total budget (daily × days) — sent from frontend
    start_date:     str             = "2026-06-01"
    end_date:       str             = "2026-06-30"
    status:         str             = "active"
    platforms:      List[str]       = []
    keywords:       List[str]       = []
    targeting:      Optional[TargetingData]  = None
    ad_content:     Optional[AdContentData] = None

    # ── NAYA: Business Profile / Targeting Suggestion fields (Step 6) ──
    company_name:    Optional[str] = ""
    company_email:   Optional[str] = ""
    company_phone:   Optional[str] = ""
    company_pincode: Optional[str] = ""
    contact_method: Optional[str] = ""
    contact_value:  Optional[str] = ""
    budget_split:    Optional[dict]  = None   # ← {"meta": 60, "google": 40} — agar manual chahiye


# ════════════════════════════════════════════════════
# MANAGE / EDIT — Campaign Update Request
# NAYA (Manage feature): saari fields optional hain, sirf jo bheji
# jaayengi wahi update hongi. Kuch fields sirf DB update karti hain
# (goal, industry, sub_category, start_date) kyunki inka koi real
# platform-level mutate possible/meaningful nahi hai. Baaki fields
# (name, business_niche[google-only], budget, status, end_date,
# targeting) DB ke saath-saath real Google/Meta mutate call bhi
# trigger karti hain — dekho update_campaign() ke andar.
# ════════════════════════════════════════════════════
class CampaignUpdateRequest(BaseModel):
    name:           Optional[str]   = None   # ✅ editable — Google + Meta dono pe real push
    goal:           Optional[str]   = None   # 🔒 DB-only — locked after launch (Meta objective immutable)
    industry:       Optional[str]   = None   # 🔒 DB-only — informational, sirf AI targeting suggestion ka input
    sub_category:   Optional[str]   = None   # 🔒 DB-only — informational
    business_niche: Optional[str]   = None   # ⚠️ conditional — sirf Google Ads keywords ke roop mein push hota hai
    budget:         Optional[float] = None   # ✅ editable — Google CampaignBudget + Meta AdSet daily_budget
    start_date:     Optional[str]   = None   # 🔒 DB-only — launch ho chuka campaign ka start date badalna meaningless hai
    end_date:       Optional[str]   = None   # ✅ editable — Google Campaign end_date_time + Meta AdSet end_time
    status:         Optional[str]   = None   # ✅ editable — Google/Meta Campaign status (active/paused)
    targeting:      Optional[TargetingData] = None   # ✅ editable — locations/radius/age (+ audience_mode Meta-only)


# ════════════════════════════════════════════════════
# MANAGE / EDIT — Ad Content Update Request
# NAYA (Manage feature): Google/Meta dono pe creative "in-place edit"
# nahi hota — dono jagah naya creative/ad banta hai (purana pause/point-away
# hota hai). Yeh request model isi flow ko trigger karta hai.
# ════════════════════════════════════════════════════
class AdContentUpdateRequest(BaseModel):
    headline:       Optional[str] = None
    description:    Optional[str] = None
    primary_text:   Optional[str] = None
    image_url:      Optional[str] = None
    cta_button:     Optional[str] = None


# ════════════════════════════════════════════════════
# HELPER: Calculate duration days from dates
# ════════════════════════════════════════════════════
def get_duration_days(start_date: str, end_date: str) -> int:
    try:
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date,   "%Y-%m-%d")
        delta = (end - start).days
        return max(delta, 1)  # minimum 1 day
    except Exception:
        return 30  # default fallback


# ════════════════════════════════════════════════════
# HELPER: Fetch a campaign but only if it belongs to current_user.
# Returns 404 (not 403) if it doesn't exist OR belongs to someone
# else — this avoids leaking whether an ID exists at all.
# ════════════════════════════════════════════════════
def get_owned_campaign_or_404(campaign_id: int, current_user: User, db: Session) -> Campaign:
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


# ════════════════════════════════════════════════════
# HELPER: Google Ads customer id, cleaned (bina dashes)
# ════════════════════════════════════════════════════
def _google_customer_id() -> str:
    return os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")


# ════════════════════════════════════════════════════
# 1. GET ALL CAMPAIGNS (only the logged-in user's own)
# ════════════════════════════════════════════════════
@router.get("/")
def get_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).all()
        result = []
        for c in campaigns:
            result.append({
                "id":             c.id,
                "name":           c.name,
                "goal":           c.goal,
                "industry":       c.industry       or "",
                "sub_category":   c.sub_category   or "",
                "business_niche": c.business_niche or "",
                "budget":         c.budget,           # daily budget
                "total_budget":   c.total_budget or 0, # total budget
                "start_date":     str(c.start_date) if c.start_date else "",
                "end_date":       str(c.end_date)   if c.end_date   else "",
                "status":         c.status,
                "created_at":     str(c.created_at) if c.created_at else "",
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════
# 2. GET SINGLE CAMPAIGN (only if owned by current_user)
# ════════════════════════════════════════════════════
@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)
    return {
        "id":             campaign.id,
        "name":           campaign.name,
        "goal":           campaign.goal,
        "industry":       campaign.industry       or "",
        "sub_category":   campaign.sub_category   or "",
        "business_niche": campaign.business_niche or "",
        "budget":         campaign.budget,            # daily budget
        "total_budget":   campaign.total_budget or 0, # total budget
        "start_date":     str(campaign.start_date) if campaign.start_date else "",
        "end_date":       str(campaign.end_date)   if campaign.end_date   else "",
        "status":         campaign.status,
    }


# ════════════════════════════════════════════════════
# 3. POST CREATE CAMPAIGN
# FIX: budget and total_budget stored separately
# daily budget = budget field
# total budget = daily × duration days
# Also: campaign is now tagged with the creating user's id
# ════════════════════════════════════════════════════
@router.post("/")
def create_campaign(req: CampaignCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    # ── FIX: Separate daily budget from total budget ──
    # Frontend sends budget_amount = daily × days (inflated)
    # We store budget = daily, total_budget = daily × days
    daily_budget = req.budget or 10000
    duration     = get_duration_days(req.start_date, req.end_date)
    total_budget = req.budget_amount or (daily_budget * duration)

    # ── Save campaign to DB, tagged to the logged-in user ──
    db_campaign = Campaign(
        user_id        = current_user.id,
        name           = req.name,
        goal           = req.goal,
        industry       = req.industry       or "",
        sub_category   = req.sub_category   or "",
        business_niche = req.business_niche or "",
        budget         = daily_budget,   # FIX: always store daily budget here
        total_budget   = total_budget,   # FIX: store total budget separately
        start_date     = req.start_date,
        end_date       = req.end_date,
        status         = req.status or "active",
        # ── NAYA: Business Profile fields ──
        company_name    = req.company_name    or "",
        company_email   = req.company_email   or "",
        company_phone   = req.company_phone   or "",
        company_pincode = req.company_pincode or "",
                # ── NAYA: Direct Contact fields ──
        contact_method  = req.contact_method or "",
        contact_value   = req.contact_value  or "",

    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    campaign_id = db_campaign.id
    db_campaign.website_url = req.ad_content.link_url or req.ad_content.final_url or "" if req.ad_content else ""
    db.commit()

    # ── Save targeting rule if provided ──
    if req.targeting:
        t = req.targeting
        targeting_rule = TargetingRule(
            campaign_id       = campaign_id,
            audience_type     = "custom",
            locations         = ",".join(t.locations),
            location_details  = json.dumps([loc.dict() for loc in t.location_details]),
            industries        = req.industry or "",
            age_min           = t.age_min,
            age_max           = t.age_max,
            radius_km         = t.radius_km,
        )
        db.add(targeting_rule)
        db.commit()

        # ── Platform data ──
    platform_keys = req.platforms or []
    platform_budgets = calculate_platform_budgets(daily_budget, platform_keys, req.budget_split)

    results = {
        "campaign_id": campaign_id,
        "id":          campaign_id,
        "campaign":    {"id": campaign_id, "name": req.name},
        "name":        req.name,
        "budget":      daily_budget,
        "total_budget":total_budget,
        "platform_budgets": platform_budgets,
        "platforms":   {},
    }


    campaign_data = {
        "name":          req.name,
        "goal":          req.goal,
        "budget_amount": daily_budget,
        "industry":      req.industry or "",
        "start_date":    req.start_date,
        "end_date":      req.end_date,
        "keywords": req.keywords or ([req.business_niche] if req.business_niche.strip() else []) or ["business loan"],
        "targeting":     req.targeting.dict() if req.targeting else {
            "locations": ["Delhi", "Mumbai"],
            "age_min":   25,
            "age_max":   55,
            "radius_km": 25,
        }
    }

       # ── Age targeting + Location targeting bhi campaign_data mein
    #    daalo (Meta/Google service tak pahunchane ke liye, top-level
    #    keys ke roop mein — nested "targeting" dict ke bharose nahi
    #    rehna, taaki services simple .get() se access kar sakein) ──
    if req.targeting:
        campaign_data["age_min"]         = req.targeting.age_min
        campaign_data["age_max"]         = req.targeting.age_max
        campaign_data["radius_km"]       = req.targeting.radius_km
        # ── NAYA: lat/lng wali location list — Meta custom_locations
        #    aur Google proximity criterion dono isi se banenge ──
        campaign_data["location_details"] = [loc.dict() for loc in req.targeting.location_details]
        campaign_data["audience_mode"]    = req.targeting.audience_mode
    else:
        campaign_data["age_min"]          = 25
        campaign_data["age_max"]          = 55
        campaign_data["radius_km"]        = 25
        campaign_data["location_details"] = []
        campaign_data["audience_mode"]    = "broad"

            # ── NAYA: Direct Contact fields — Meta/Google service tak pahunchane ke liye ──
    campaign_data["contact_method"] = req.contact_method or ""
    campaign_data["contact_value"]  = req.contact_value  or ""

        # ── NAYA: user ne Step 2 mein Instagram select kiya tha ya nahi —
    #    isi se Meta service decide karega ki ad set mein Instagram
    #    placement include karni hai ya sirf Facebook pe rehna hai. ──
    campaign_data["instagram_selected"] = "instagram" in platform_keys
    campaign_data["facebook_selected"]  = "meta" in platform_keys

    ad_content_data = req.ad_content.dict() if req.ad_content else {}

    # ── Fix: Lead Generation campaigns ka click-through link hamesha
    #    lead form hona chahiye — na ki adnexus.co.in homepage. Same
    #    URL jo ad-content save ke waqt bhi generate hota hai. ──
    if req.goal == "DIRECT_CONTACT":
        # Website URL nahi chahiye — final_url hamesha generated
        # contact-landing-page URL hoga (call/email/whatsapp button wala)
        contact_url = generate_contact_landing_url(campaign_id)
        ad_content_data["final_url"] = contact_url
        ad_content_data["link_url"]  = contact_url
    elif req.goal != "LEAD_GEN":
        # Brand Awareness — agar URL khali hai to apna domain fallback use karo
        if not ad_content_data.get("final_url"):
            ad_content_data["final_url"] = "https://adnexus.co.in"
        if not ad_content_data.get("link_url"):
            ad_content_data["link_url"] = "https://adnexus.co.in"

    # ── Fix: base64 image (user-uploaded) ko Cloudinary URL mein convert karo —
    #    warna DB save crash hota hai (column limit) aur Google/Meta bhi reject karte hain ──
    if ad_content_data.get("image_url", "").startswith("data:image"):
        try:
            from app.services.upload_to_cloudinary import upload_base64_to_cloudinary
            ad_content_data["image_url"] = upload_base64_to_cloudinary(ad_content_data["image_url"])
        except Exception as e:
            print(f"[create_campaign] Image upload to Cloudinary failed: {e}")
            ad_content_data["image_url"] = ""
 # ── Google Ads ──
    if "google" in platform_keys and GOOGLE_AVAILABLE:
        google_campaign_data = dict(campaign_data)   # ← naya, alag copy
        google_campaign_data["budget_amount"] = platform_budgets.get("google", daily_budget)

        # NAYA — Google ka apna platform-specific lead URL
        google_ad_content_data = dict(ad_content_data)
        if req.goal == "LEAD_GEN":
            google_url = generate_lead_form_url(campaign_id, "google")
            google_ad_content_data["final_url"] = google_url
            google_ad_content_data["link_url"]  = google_url

        try:
          google_result = submit_campaign_to_google(google_campaign_data, google_ad_content_data)
          print("========== GOOGLE RESULT ==========")
          print(google_result)
          print("===================================")
        except Exception as e:
            google_result = {"success": False, "error": str(e), "platform": "google"}
        results["platforms"]["google"] = google_result

        # ── Google IDs DB mein save karo, taaki baad mein stats/status sync ke liye use ho sakein ──
        if google_result.get("success"):
            db_campaign.google_campaign_id = google_result.get("google_campaign_id")
            db_campaign.google_ad_group_id  = google_result.get("google_ad_group_id")
            db_campaign.google_ad_id        = google_result.get("google_ad_id")
            db.commit()
    elif "google" in platform_keys:
        results["platforms"]["google"] = {
            "success":  False,
            "error":    "Google Ads integration not configured",
            "platform": "google"
        }


# ── Meta Ads (Instagram bhi isi Meta Ad Account se chalta hai) ──
    if ("meta" in platform_keys or "instagram" in platform_keys) and META_AVAILABLE:
        # ── FIX: Meta ke liye alag copy banao, taaki Google ka budget_amount
        #    change Meta ko affect na kare (dono same dict share kar rahe the) ──
        meta_campaign_data = dict(campaign_data)
        # ── FIX: pehle sirf "meta" key dhoondta tha — agar sirf Instagram
        #    selected ho (Facebook nahi), to galat fallback (poora
        #    daily_budget) le leta tha. Ab dono ke exact split budgets
        #    alag-alag pass ho rahe hain, taaki Facebook/Instagram ke
        #    alag ad sets apna-apna sahi budget use karein. ──
        meta_campaign_data["facebook_budget"]  = platform_budgets.get("meta", 0)
        meta_campaign_data["instagram_budget"] = platform_budgets.get("instagram", 0)
        # Fallback safety — agar dono hi 0 hain (edge case), purana bhaav rakho
        meta_campaign_data["budget_amount"] = (
            meta_campaign_data["facebook_budget"] + meta_campaign_data["instagram_budget"]
        ) or daily_budget

        # Generate AI audience targeting first (if available), so the real
        # Meta Ad Set uses AI-resolved interests instead of just geo-only.
        audience_targeting_for_meta = None
        if AUDIENCE_AI_AVAILABLE:
            try:
                ai_profile = generate_audience_profile(
                    ad_title=ad_content_data.get("headline") or req.name,
                    ad_description=(
                        ad_content_data.get("primary_text")
                        or ad_content_data.get("description")
                        or req.business_niche
                    ),
                    industry=req.industry or "",
                    sub_category=req.sub_category or "",
                )
                audience_targeting_for_meta = map_to_meta(ai_profile)
            except Exception as e:
                # Non-fatal — Meta submission still proceeds with geo-only targeting
                print(f"[create_campaign] Audience targeting generation failed: {e}")

        try:
            meta_result = submit_campaign_to_meta(
                meta_campaign_data,
                ad_content_data,
                audience_targeting=audience_targeting_for_meta,
                campaign_id=campaign_id,
            )
        except Exception as e:
            meta_result = {"success": False, "error": str(e), "platform": "meta"}
        results["platforms"]["meta"] = meta_result
        if "instagram" in platform_keys:
            results["platforms"]["instagram"] = meta_result

        # ── Meta IDs DB mein save karo, taaki baad mein stats sync ke liye use ho sakein ──
        if meta_result.get("success"):
            db_campaign.meta_campaign_id = meta_result.get("meta_campaign_id")
            db_campaign.meta_adset_id    = meta_result.get("meta_adset_id")
            db_campaign.meta_ad_id       = meta_result.get("meta_ad_id")
            # ── NAYA: agar Facebook+Instagram dono select the, Instagram
            #    ka apna alag adset/ad ID bhi save karo (Step 1 ke naye
            #    columns) — taaki baad mein alag se stats sync ho sakein ──
            db_campaign.instagram_adset_id = meta_result.get("instagram_adset_id")
            db_campaign.instagram_ad_id    = meta_result.get("instagram_ad_id")
            db.commit()
    # ── NAYA: Agar koi bhi platform pe launch successful nahi hua,
    #    to status "active" na rahe — asli situation reflect ho ──
    # ── NAYA: All-or-nothing — sabhi selected platforms successful
    #    hone chahiye, warna kuch bhi persist nahi hona chahiye. ──
    all_success = all(
        p.get("success") for p in results["platforms"].values()
    ) if results["platforms"] else False

    if all_success:
        db_campaign.status = "active"
        db.commit()
        return results

    # ── Kisi bhi ek platform ka launch fail hua — rollback karo ──
    from app.services.google_ads_service import CUSTOMER_ID as GOOGLE_CUSTOMER_ID
    for key, result in results["platforms"].items():
        if result.get("success"):
            if key == "google" and result.get("google_campaign_id"):
                try:
                    from app.services.google_ads_service import delete_google_campaign
                    delete_google_campaign(f"customers/{GOOGLE_CUSTOMER_ID}/campaigns/{result['google_campaign_id']}")
                except Exception as e:
                    print(f"[create_campaign] Rollback Google failed: {e}")
            elif key == "meta" and result.get("meta_campaign_id"):
                try:
                    from app.services.meta_ads_service import delete_meta_campaign
                    delete_meta_campaign(result["meta_campaign_id"])
                except Exception as e:
                    print(f"[create_campaign] Rollback Meta failed: {e}")

    # ── DB se bhi campaign hata do — kuch bhi save nahi rehna chahiye ──
    if req.targeting:
        db.query(TargetingRule).filter(TargetingRule.campaign_id == campaign_id).delete()
    db.delete(db_campaign)
    db.commit()

# ── Clear English error message banao — pattern match karke
    #    simple message + related step number nikalo ──
    def parse_platform_error(raw_error: str):
        e = raw_error.lower()
        if "too few" in e or "headline" in e or "description" in e:
            return "Your ad needs more headlines or descriptions.", 7
        if "invalid_customer_id" in e or "customer id" in e:
            return "There's a configuration issue with the connected ad account. Please contact support.", None
        if "budget" in e or ("invalid_argument" in e and "amount" in e):
            return "There's an issue with your budget — please check the daily budget you entered.", 3
        if "image" in e or "cloudinary" in e or "picture" in e:
            return "There's an issue with your ad image — please try a different image or remove it.", 7
        if "final_url" in e or "link" in e or "url" in e:
            return "There's an issue with the website or form link — please check it.", 5
        if "duplicate_campaign_name" in e or "duplicate campaign name" in e:
            return "A campaign with this name already exists — please use a different name.", 1
        return "This platform rejected the campaign for an unspecified reason.", None

    platform_errors = []
    problem_steps = set()
    for key, result in results["platforms"].items():
        if key == "instagram":
            continue
        if result.get("success"):
            platform_errors.append({
                "platform": key.capitalize(),
                "message": "This succeeded but was rolled back because another platform failed.",
                "step": None,
            })
        else:
            simple_msg, step = parse_platform_error(result.get("error", ""))
            platform_errors.append({
                "platform": key.capitalize(),
                "message": simple_msg,
                "step": step,
            })
            if step:
                problem_steps.add(step)

    detail_payload = {
        "message": "Campaign could not be launched. Nothing was saved — please fix the issue below and try again.",
        "platform_errors": platform_errors,
        "problem_steps": sorted(problem_steps),
    }
    raise HTTPException(status_code=400, detail=detail_payload)


# ════════════════════════════════════════════════════
# 4. PUT UPDATE CAMPAIGN (MANAGE / EDIT feature)
# NAYA: Ab yeh sirf DB update nahi karta — jahan real platform-level
# effect possible hai (name, budget, status, end_date, targeting,
# aur conditionally business_niche keywords for Google), wahan
# Google Ads / Meta dono ki real mutate API bhi call hoti hai.
#
# Fields jo SIRF DB mein update hoti hain (koi platform push nahi):
#   - goal            → Meta pe objective immutable hai; Google mein
#                        bhi is form mein koi separate "objective" nahi
#   - industry         → sirf AI audience-suggestion ka input, koi
#   - sub_category       real ad-serving effect nahi
#   - start_date       → already-launched campaign ka start date
#                        badalna meaningless hai
#
# Response mein "platform_sync_errors" dict hota hai — agar koi bhi
# platform-push fail hui to us specific key ke andar error string
# milegi, baaki sab (DB update) phir bhi save ho chuka hoga.
# ════════════════════════════════════════════════════
@router.put("/{campaign_id}")
def update_campaign(campaign_id: int, req: CampaignUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    platform_sync_errors = {}

    # ── name: DB update + REAL platform push (Google + Meta dono) ──
    if req.name is not None and req.name != campaign.name:
        campaign.name = req.name

        if campaign.google_campaign_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_campaign_name
            result = update_google_campaign_name(campaign.google_campaign_id, req.name)
            if not result.get("success"):
                platform_sync_errors["google_name"] = result.get("error")

        if campaign.meta_campaign_id and META_AVAILABLE:
            from app.services.meta_ads_service import update_meta_campaign_name
            result = update_meta_campaign_name(campaign.meta_campaign_id, req.name)
            if not result.get("success"):
                platform_sync_errors["meta_name"] = result.get("error")

    # ── business_niche (keywords): DB update + REAL platform push
    #    (Google ONLY — Meta interest-based hai, keywords ka concept
    #    hi nahi hai wahan) ──
    if req.business_niche is not None and req.business_niche != campaign.business_niche:
        campaign.business_niche = req.business_niche

        if campaign.google_campaign_id and campaign.google_ad_group_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_keywords
            new_keywords = [k.strip() for k in req.business_niche.split(",") if k.strip()]
            ad_group_resource = f"customers/{_google_customer_id()}/adGroups/{campaign.google_ad_group_id}"
            result = update_google_keywords(ad_group_resource, new_keywords)
            if not result.get("success"):
                platform_sync_errors["google_keywords"] = result.get("error")

    # ── status: DB update + REAL platform push (Google + Meta dono) ──
    if req.status is not None and req.status != campaign.status:
        campaign.status = req.status

        if campaign.google_campaign_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_campaign_status
            result = update_google_campaign_status(campaign.google_campaign_id, req.status)
            if not result.get("success"):
                platform_sync_errors["google_status"] = result.get("error")

        if campaign.meta_campaign_id and META_AVAILABLE:
            from app.services.meta_ads_service import update_meta_campaign_status
            result = update_meta_campaign_status(campaign.meta_campaign_id, req.status)
            if not result.get("success"):
                platform_sync_errors["meta_status"] = result.get("error")

    # ── end_date: DB update + REAL platform push (Google Campaign +
    #    Meta AdSet dono) ──
    if req.end_date is not None and req.end_date != str(campaign.end_date or ""):
        campaign.end_date = req.end_date

        if campaign.google_campaign_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_campaign_end_date
            result = update_google_campaign_end_date(campaign.google_campaign_id, req.end_date)
            if not result.get("success"):
                platform_sync_errors["google_end_date"] = result.get("error")

        if campaign.meta_adset_id and META_AVAILABLE:
            from app.services.meta_ads_service import update_meta_adset_end_date
            result = update_meta_adset_end_date(campaign.meta_adset_id, req.end_date)
            if not result.get("success"):
                platform_sync_errors["meta_end_date"] = result.get("error")

    # ── budget: DB update (+ total_budget recalculation) + REAL
    #    platform push (Google CampaignBudget + Meta AdSet daily_budget) ──
    if req.budget is not None and req.budget != campaign.budget:
        campaign.budget = req.budget
        start = str(campaign.start_date) if campaign.start_date else req.start_date or "2026-06-01"
        end   = str(campaign.end_date)   if campaign.end_date   else req.end_date   or "2026-06-30"
        campaign.total_budget = req.budget * get_duration_days(start, end)

        if campaign.google_campaign_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_campaign_budget
            result = update_google_campaign_budget(campaign.google_campaign_id, req.budget)
            if not result.get("success"):
                platform_sync_errors["google_budget"] = result.get("error")

        if campaign.meta_adset_id and META_AVAILABLE:
            from app.services.meta_ads_service import update_meta_adset_budget
            result = update_meta_adset_budget(campaign.meta_adset_id, req.budget)
            if not result.get("success"):
                platform_sync_errors["meta_budget"] = result.get("error")

    # ── DB-only fields — kabhi platform tak nahi jaate ──
    if req.goal         is not None: campaign.goal         = req.goal
    if req.industry     is not None: campaign.industry     = req.industry
    if req.sub_category is not None: campaign.sub_category = req.sub_category
    if req.start_date   is not None: campaign.start_date   = req.start_date

    # ── NAYA: targeting upsert — agar row already hai toh update, warna
    #    naya banao. PLUS: real Google/Meta targeting mutate calls. ──
    if req.targeting is not None:
        t = req.targeting
        targeting_rule = db.query(TargetingRule).filter(
            TargetingRule.campaign_id == campaign_id
        ).first()
        if targeting_rule:
            targeting_rule.locations         = ",".join(t.locations)
            targeting_rule.location_details  = json.dumps([loc.dict() for loc in t.location_details])
            targeting_rule.age_min           = t.age_min
            targeting_rule.age_max           = t.age_max
            targeting_rule.radius_km         = t.radius_km
        else:
            targeting_rule = TargetingRule(
                campaign_id       = campaign_id,
                audience_type     = "custom",
                locations         = ",".join(t.locations),
                location_details  = json.dumps([loc.dict() for loc in t.location_details]),
                industries        = campaign.industry or "",
                age_min           = t.age_min,
                age_max           = t.age_max,
                radius_km         = t.radius_km,
            )
            db.add(targeting_rule)

        # ── Real platform push (Google + Meta) ──
        loc_details = [loc.dict() for loc in t.location_details]

        if campaign.google_campaign_id and campaign.google_ad_group_id and GOOGLE_AVAILABLE:
            from app.services.google_ads_service import update_google_location_targeting, update_google_age_targeting

            r1 = update_google_location_targeting(campaign.google_campaign_id, loc_details, t.radius_km)
            if not r1.get("success"):
                platform_sync_errors["google_location"] = r1.get("error")

            ad_group_resource = f"customers/{_google_customer_id()}/adGroups/{campaign.google_ad_group_id}"
            r2 = update_google_age_targeting(ad_group_resource, t.age_min, t.age_max)
            if not r2.get("success"):
                platform_sync_errors["google_age"] = r2.get("error")

        if campaign.meta_adset_id and META_AVAILABLE:
            from app.services.meta_ads_service import update_meta_adset_targeting

            r3 = update_meta_adset_targeting(
                campaign.meta_adset_id, loc_details, t.radius_km, t.age_min, t.age_max, t.audience_mode
            )
            if not r3.get("success"):
                platform_sync_errors["meta_targeting"] = r3.get("error")

    db.commit()
    db.refresh(campaign)
    return {
        "message": "Campaign updated",
        "id": campaign_id,
        "platform_sync_errors": platform_sync_errors,   # ← frontend isko dikha sakta hai agar platform push fail hui
    }


# ════════════════════════════════════════════════════
# 4B. PUT UPDATE AD CONTENT (MANAGE / EDIT feature — per platform)
# NAYA: Google/Meta dono pe ek existing ad ka creative "in-place edit"
# nahi hota:
#   - Google: purane RSA ko pause karo, naya RSA banao same ad group mein
#             (naya ad_id milta hai, DB mein update karna zaroori hai)
#   - Meta:   naya creative banao, existing Ad object ko naye creative
#             se point kara do (ad_id same rehta hai, stats continue)
# ════════════════════════════════════════════════════
@router.put("/{campaign_id}/ad-content/{platform_id}")
def update_campaign_ad_content(campaign_id: int, platform_id: int, req: AdContentUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    ad_content = db.query(AdContent).filter(
        AdContent.campaign_id == campaign_id,
        AdContent.platform_id == platform_id,
    ).first()
    if not ad_content:
        raise HTTPException(status_code=404, detail="Ad content not found for this platform")

    platform_name = (ad_content.platform.name if ad_content.platform else "").lower()

    if req.headline    is not None: ad_content.headline    = req.headline
    if req.description is not None: ad_content.description = req.description
    if req.image_url   is not None: ad_content.image_url   = req.image_url
    if req.cta_button  is not None: ad_content.cta_button  = req.cta_button

    sync_error = None
    new_ad_content_data = {
        "headline":     ad_content.headline or "",
        "description":  ad_content.description or "",
        "primary_text": req.primary_text or ad_content.description or "",
        "image_url":    ad_content.image_url or "",
        "cta":          ad_content.cta_button or "LEARN_MORE",
        "final_url":    campaign.website_url or "",
        "link_url":     campaign.website_url or "",
    }

    if platform_name == "google ads" and campaign.google_ad_group_id and campaign.google_ad_id and GOOGLE_AVAILABLE:
        from app.services.google_ads_service import replace_google_ad_content
        ad_group_resource = f"customers/{_google_customer_id()}/adGroups/{campaign.google_ad_group_id}"
        result = replace_google_ad_content(ad_group_resource, campaign.google_ad_id, new_ad_content_data)
        if result.get("success"):
            campaign.google_ad_id = result["new_ad_id"]
        else:
            sync_error = result.get("error")

    elif platform_name in ("facebook", "instagram", "meta") and campaign.meta_ad_id and META_AVAILABLE:
        from app.services.meta_ads_service import update_meta_ad_creative
        result = update_meta_ad_creative(
            campaign.meta_ad_id, new_ad_content_data, instagram_selected=(platform_name == "instagram")
        )
        if not result.get("success"):
            sync_error = result.get("error")

    db.commit()
    db.refresh(ad_content)
    return {"message": "Ad content updated", "platform_sync_error": sync_error}


# ════════════════════════════════════════════════════
# 5. DELETE CAMPAIGN (only if owned by current_user)
# ════════════════════════════════════════════════════
@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    # ── AudienceProfile ke andar PlatformTargeting bhi hai — pehle usse clear karo ──
    profile_ids = [
        row[0] for row in
        db.query(AudienceProfile.id).filter(AudienceProfile.campaign_id == campaign_id).all()
    ]
    if profile_ids:
        db.query(PlatformTargeting).filter(
            PlatformTargeting.audience_profile_id.in_(profile_ids)
        ).delete(synchronize_session=False)

    # ── LeadForm ke andar FormSubmission bhi hai — pehle usse clear karo ──
    form_ids = [
        row[0] for row in
        db.query(LeadForm.id).filter(LeadForm.campaign_id == campaign_id).all()
    ]
    if form_ids:
        db.query(FormSubmission).filter(
            FormSubmission.form_id.in_(form_ids)
        ).delete(synchronize_session=False)

    # ── Ab campaign se seedhe linked sab tables clear karo ──
    db.query(TargetingRule).filter(TargetingRule.campaign_id == campaign_id).delete()
    db.query(AdContent).filter(AdContent.campaign_id == campaign_id).delete()
    db.query(PlatformStat).filter(PlatformStat.campaign_id == campaign_id).delete()
    db.query(Lead).filter(Lead.campaign_id == campaign_id).delete()
    db.query(LeadForm).filter(LeadForm.campaign_id == campaign_id).delete()
    db.query(FormSubmission).filter(FormSubmission.campaign_id == campaign_id).delete()
    db.query(ClickTracking).filter(ClickTracking.campaign_id == campaign_id).delete()
    db.query(AudienceProfile).filter(AudienceProfile.campaign_id == campaign_id).delete()

    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted"}


# ════════════════════════════════════════════════════
# 6. GET CAMPAIGN DETAIL WITH STATS (only if owned by current_user)
# ════════════════════════════════════════════════════
@router.get("/{campaign_id}/detail")
def get_campaign_detail(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    # ── Platform Stats ──
    try:
        stats = db.query(PlatformStat).filter(PlatformStat.campaign_id == campaign_id).all()
        stats_data = [{
            "platform_id":   s.platform_id,
            "platform_name": s.platform.name if s.platform else "",
            "impressions":   s.impressions   or 0,
            "clicks":        s.clicks        or 0,
            "leads":         s.leads         or 0,
            "cpl":           s.cpl           or 0,
            "budget_spent":  s.budget_spent  or 0,
            "reach":         s.reach         or 0,   
        } for s in stats]
    except Exception:
        stats_data = []

    # ── Targeting Rules ──
    try:
        targeting = db.query(TargetingRule).filter(
            TargetingRule.campaign_id == campaign_id
        ).first()
        targeting_data = {
            "locations": targeting.locations or "" if targeting else "",
            "location_details": json.loads(targeting.location_details) if (targeting and targeting.location_details) else [],
            "age_min":   targeting.age_min   or 25  if targeting else 25,
            "age_max":   targeting.age_max   or 55  if targeting else 55,
            "radius_km": targeting.radius_km or 25  if targeting else 25,
        } if targeting else {}
    except Exception:
        targeting_data = {}

    # ── Ad Contents ──
    try:
        ad_contents = db.query(AdContent).filter(
            AdContent.campaign_id == campaign_id
        ).all()
        ad_contents_data = [{
            "platform_id":      a.platform_id,
            "platform_name":    a.platform.name if a.platform else "",
            "headline":         a.headline         or "",
            "description":      a.description      or "",
            "image_url":        a.image_url        or "",
            "cta_button":       a.cta_button       or "",
            "target_audience":  a.target_audience  or "",
            "target_age_min":   a.target_age_min   or 25,
            "target_age_max":   a.target_age_max   or 55,
            "creative_score":   a.creative_score   or 0,
            "lead_form_url":    a.lead_form_url    or "",
        } for a in ad_contents]
    except Exception:
        ad_contents_data = []

    # ── Click Tracking (Direct Contact ke liye) ──
    try:
        clicks = db.query(ClickTracking).filter(
            ClickTracking.campaign_id == campaign_id
        ).order_by(ClickTracking.clicked_at.desc()).all()

        click_tracking_data = [{
            "id":         c.id,
            "platform":   c.platform or "direct",
            "device":     c.device or "",
            "city":       c.city or "",
            "clicked_at": str(c.clicked_at) if c.clicked_at else "",
        } for c in clicks]
    except Exception:
        click_tracking_data = []

    return {
        # Campaign Info
        "id":             campaign.id,
        "name":           campaign.name,
        "goal":           campaign.goal           or "",
        "industry":       campaign.industry       or "",
        "sub_category":   campaign.sub_category   or "",
        "business_niche": campaign.business_niche or "",
        "budget":         campaign.budget         or 0,
        "total_budget":   campaign.total_budget   or 0,
        "start_date":     str(campaign.start_date) if campaign.start_date else "",
        "end_date":       str(campaign.end_date)   if campaign.end_date   else "",
        "status":         campaign.status          or "active",
        "created_at":     str(campaign.created_at) if campaign.created_at else "",

        # ── NAYA: Business Profile fields bhi detail response mein ──
        "company_name":     campaign.company_name    or "",
        "company_email":    campaign.company_email   or "",
        "company_phone":    campaign.company_phone   or "",
        "company_pincode":  campaign.company_pincode or "",
        "website_url":      campaign.website_url     or "",

        # ── NAYA: Manage/Edit feature ke liye — batata hai campaign
        #    kis-kis platform pe actually live hai, taaki frontend
        #    conditional-locked fields (jaise business_niche,
        #    audience_mode) sahi dikha sake ──
        "has_google": bool(campaign.google_campaign_id),
        "has_meta":   bool(campaign.meta_campaign_id),

        # Related Data
        "platform_stats": stats_data,
        "targeting":      targeting_data,
        "ad_contents":    ad_contents_data,
        "place_stats":    get_campaign_place_stats(campaign, targeting_data.get("location_details", [])),
        "gender_stats":   get_campaign_gender_stats(campaign),
        "age_stats":      get_campaign_age_stats(campaign),

        "contact_method": campaign.contact_method or "",
        "contact_value":  campaign.contact_value  or "",

        # ── NAYA: Click tracking (Direct Contact ke liye) ──
        "click_tracking": click_tracking_data,
    }

# ════════════════════════════════════════════════════
# 7. POST PLATFORMS ATTACH (only if campaign owned by current_user)
# ════════════════════════════════════════════════════
@router.post("/{campaign_id}/platforms")
def add_platforms(campaign_id: int, platform_ids: List[int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)
    return {"message": "Platforms noted", "campaign_id": campaign_id, "platforms": platform_ids}


# ════════════════════════════════════════════════════
# 8. GET PLATFORM STATS (only if campaign owned by current_user)
# ════════════════════════════════════════════════════
@router.get("/{campaign_id}/stats")
def get_campaign_stats(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Ownership check first — throws 404 if this isn't the user's campaign
    get_owned_campaign_or_404(campaign_id, current_user, db)
    try:
        stats = db.query(PlatformStat).filter(PlatformStat.campaign_id == campaign_id).all()
        stats_data = [{
            "platform_id":   s.platform_id,
            "platform_name": s.platform.name if s.platform else "",
            "impressions":   s.impressions   or 0,
            "clicks":        s.clicks        or 0,
            "leads":         s.leads         or 0,
            "cpl":           s.cpl           or 0,
            "spend":         s.budget_spent  or 0,   # frontend "spend" expect karta hai
            "budget_spent":  s.budget_spent  or 0,   # backward-compat
            "reach":         s.reach         or 0,   # 🆕

        } for s in stats]
        return {"campaign_id": campaign_id, "stats": stats_data}
    except Exception as e:
        return {"campaign_id": campaign_id, "stats": [], "error": str(e)}


# ════════════════════════════════════════════════════
# 9. GET PLATFORM STATUS (only if campaign owned by current_user)
# ════════════════════════════════════════════════════
@router.get("/{campaign_id}/platform-status")
def get_platform_status(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_campaign_or_404(campaign_id, current_user, db)
    status = {}
    if GOOGLE_AVAILABLE:
        try:
            status["google"] = get_google_status(str(campaign_id))
        except Exception as e:
            status["google"] = {"error": str(e)}
    if META_AVAILABLE:
        try:
            status["meta"] = get_meta_campaign_status(str(campaign_id))
        except Exception as e:
            status["meta"] = {"error": str(e)}
    return {"campaign_id": campaign_id, "platform_status": status}


# ════════════════════════════════════════════════════
# 10. POST SUBMIT TO PLATFORMS (only if campaign owned by current_user)
# ════════════════════════════════════════════════════
@router.post("/{campaign_id}/submit-to-platforms")
def submit_to_platforms(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    campaign_data = {
        "name":          campaign.name,
        "goal":          campaign.goal,
        "budget_amount": campaign.budget,  # daily budget
        "start_date":    str(campaign.start_date),
        "end_date":      str(campaign.end_date),
        "keywords":      [campaign.business_niche] if campaign.business_niche else ["business loan"],
    }
    results = {}
    if GOOGLE_AVAILABLE:
        try:
            results["google"] = submit_campaign_to_google(campaign_data, {})
        except Exception as e:
            results["google"] = {"success": False, "error": str(e)}
    if META_AVAILABLE:
        try:
            results["meta"] = submit_campaign_to_meta(campaign_data, {})
        except Exception as e:
            results["meta"] = {"success": False, "error": str(e)}

    return {"campaign_id": campaign_id, "results": results}

# ════════════════════════════════════════════════════
# 11. POST SYNC PLATFORM STATS (only if campaign owned by current_user)
# Generic, platform-agnostic sync — works for any connected platform.
# Jab naya platform add ho (Google, LinkedIn), bas PLATFORM_INSIGHT_FETCHERS
# aur PLATFORM_STATUS_FETCHERS dict mein ek line add karni hogi — baaki
# sab code same rahega.
# ════════════════════════════════════════════════════

# ── NAYA HELPER — get_meta_adset_insights ab {"breakdown": [...]} return
#    karta hai (ek row per publisher_platform, kyunki ab single ad set
#    FB+IG dono cover karta hai). Ye helper us list mein se ek specific
#    platform (facebook/instagram) ka row nikaal ke deta hai.
#    Agar "breakdown" key hi nahi hai (jaise Google ke insights, jo
#    purane format mein aate hain), to insights ko waisa hi return
#    kar do — kuch nahi todna.
def extract_platform_insight(insights: dict, platform_name: str) -> dict:
    if "breakdown" not in insights:
        return insights
    for row in insights["breakdown"]:
        if row.get("publisher_platform") == platform_name:
            return row
    # Us platform ka koi data nahi mila (abhi tak koi spend/impression nahi hua)
    return {"impressions": 0, "clicks": 0, "spend": 0, "reach": 0}


PLATFORM_INSIGHT_FETCHERS = {}
PLATFORM_STATUS_FETCHERS  = {}

# ── AB: single ad set ki wajah se dono "meta" aur "instagram" ab SAME
#    meta_adset_id se data lenge, bas breakdown list mein se apna-apna
#    platform ka row nikaalenge ──
if META_AVAILABLE:
    PLATFORM_INSIGHT_FETCHERS["meta"] = lambda campaign: (
        extract_platform_insight(get_meta_adset_insights(campaign.meta_adset_id), "facebook")
        if campaign.meta_adset_id
        else get_meta_campaign_insights(campaign.meta_campaign_id)
    )
    PLATFORM_STATUS_FETCHERS["meta"]  = lambda campaign: get_meta_campaign_status(campaign.meta_campaign_id)

    PLATFORM_INSIGHT_FETCHERS["instagram"] = lambda campaign: (
        extract_platform_insight(get_meta_adset_insights(campaign.meta_adset_id), "instagram")
        if campaign.meta_adset_id
        else None
    )

if GOOGLE_AVAILABLE:
    PLATFORM_INSIGHT_FETCHERS["google"] = lambda campaign: get_google_campaign_insights(campaign.google_campaign_id)
    PLATFORM_STATUS_FETCHERS["google"]  = lambda campaign: get_google_campaign_status(campaign.google_campaign_id)


# ── Har platform ka apna status vocabulary hota hai — inko apne
#    unified status (active | paused | ended | error) mein map karo.
META_STATUS_MAP = {
    "ACTIVE":          "active",
    "PAUSED":          "paused",
    "CAMPAIGN_PAUSED": "paused",
    "ARCHIVED":        "ended",
    "DELETED":         "ended",
    "WITH_ISSUES":     "error",
    "IN_PROCESS":      "paused",
}

GOOGLE_STATUS_MAP = {
    "ENABLED": "active",
    "PAUSED":  "paused",
    "REMOVED": "ended",
}

PLATFORM_STATUS_MAPS = {
    "meta":   META_STATUS_MAP,
    "google": GOOGLE_STATUS_MAP,
}

# Agar campaign multiple platforms pe live hai, priority order decide karo
# ki final unified status kisko maana jaye (sabse "healthy" status jeetega)
STATUS_PRIORITY = ["active", "paused", "error", "ended"]


@router.post("/{campaign_id}/sync-stats")
def sync_platform_stats(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = get_owned_campaign_or_404(campaign_id, current_user, db)

    synced = {}
    errors = {}
    resolved_statuses = []  # unified statuses collected across all platforms this campaign runs on

    for platform_key, fetch_fn in PLATFORM_INSIGHT_FETCHERS.items():
        # ── FIX: Instagram ab apna alag adset_id nahi rakhta — single ad
        #    set hai, isliye Instagram ke liye bhi meta_adset_id /
        #    meta_campaign_id hi check karo ──
        if platform_key == "instagram":
            id_field = "meta_adset_id" if campaign.meta_adset_id else "meta_campaign_id"
        else:
            id_field = f"{platform_key}_campaign_id"
        if not getattr(campaign, id_field, None):
            continue  # yeh campaign is platform pe launch hi nahi hua

        try:
            insights = fetch_fn(campaign)
            if insights is None:
                continue

            platform_row = db.query(Platform).filter(Platform.name.ilike(platform_key)).first()
            if not platform_row:
                platform_row = Platform(name=platform_key, icon="")
                db.add(platform_row)
                db.commit()
                db.refresh(platform_row)

            stat = db.query(PlatformStat).filter(
                PlatformStat.campaign_id == campaign_id,
                PlatformStat.platform_id == platform_row.id,
            ).first()

            if stat:
                stat.impressions  = insights.get("impressions", 0)
                stat.clicks       = insights.get("clicks", 0)
                stat.budget_spent = insights.get("spend", 0)
                stat.reach        = insights.get("reach", 0)
            else:
                stat = PlatformStat(
                    campaign_id  = campaign_id,
                    platform_id  = platform_row.id,
                    impressions  = insights.get("impressions", 0),
                    clicks       = insights.get("clicks", 0),
                    budget_spent = insights.get("spend", 0),
                    reach        = insights.get("reach", 0),
                )
                db.add(stat)

            db.commit()
            synced[platform_key] = insights

        except Exception as e:
            errors[platform_key] = str(e)

        # ── Platform se actual campaign status bhi fetch karo ──
        if platform_key in PLATFORM_STATUS_FETCHERS:
            try:
                status_result = PLATFORM_STATUS_FETCHERS[platform_key](campaign)
                raw_status = (status_result.get("status") or "").upper()
                status_map = PLATFORM_STATUS_MAPS.get(platform_key, {})
                mapped_status = status_map.get(raw_status)

                if mapped_status:
                    resolved_statuses.append(mapped_status)
                    synced.setdefault(platform_key, {})["platform_status"] = mapped_status
                else:
                    errors[f"{platform_key}_status"] = f"Unrecognized status: {raw_status}"

            except Exception as e:
                errors[f"{platform_key}_status"] = str(e)

    # ── Unified status decide karo aur DB mein save karo ──
    if resolved_statuses:
        for candidate in STATUS_PRIORITY:
            if candidate in resolved_statuses:
                campaign.status = candidate
                break
        db.commit()

    if not synced and not errors:
        raise HTTPException(status_code=400, detail="Yeh campaign kisi bhi platform pe launch nahi hua hai")

    return {
        "message":         "Sync complete",
        "synced":          synced,
        "errors":          errors,
        "campaign_status": campaign.status,
    }
def calculate_platform_budgets(daily_budget: float, platform_keys: List[str], budget_split: Optional[dict] = None) -> dict:
    if not platform_keys:
        return {}

    if budget_split:
        total_pct = sum(budget_split.get(p, 0) for p in platform_keys)
        if total_pct > 0:
            return {
                p: round(daily_budget * (budget_split.get(p, 0) / total_pct), 2)
                for p in platform_keys
            }

    per_platform = round(daily_budget / len(platform_keys), 2)
    return {p: per_platform for p in platform_keys}