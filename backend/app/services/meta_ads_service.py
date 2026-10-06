# ============================================================
# backend/app/services/meta_ads_service.py
#
# MERGED FILE — combines two teammates' versions.
#   Base used: Version B (more advanced — has CTA normalization fix,
#   Advantage+ Audience age_max=65 rule, richer lead-event params).
#   Added back from Version A (missing in B, no conflict):
#     - get_meta_campaign_place_insights()
#     - get_meta_gender_insights()
#   Kept from Version B only (missing in A, no conflict):
#     - update_meta_campaign_name / _status
#     - update_meta_adset_budget / _end_date / _targeting
#     - update_meta_ad_creative
#   Real logic differences resolved (confirmed with you to keep B's version):
#     - CTA text now goes through normalize_meta_cta() (maps "ENQUIRE_NOW" -> "INQUIRE_NOW")
#     - Advantage+ Audience forces age_max=65 when audience_mode != "precise"
#     - send_meta_lead_event() takes extra optional params (fbp, client_ip,
#       user_agent, source_url) for better Meta match quality — backward
#       compatible with old 3-arg calls.
# ============================================================

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.ad import Ad
from facebook_business.exceptions import FacebookRequestError
import os
import hmac
import hashlib
import base64
import requests
import time
from facebook_business.adobjects.adimage import AdImage
from dotenv import load_dotenv


load_dotenv(override=True)

# ─── Config ──────────────────────────────────────────────────
META_APP_ID       = os.getenv("META_APP_ID")
META_APP_SECRET   = os.getenv("META_APP_SECRET")
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
META_AD_ACCOUNT   = os.getenv("META_AD_ACCOUNT_ID")
META_PAGE_ID      = os.getenv("META_PAGE_ID")
META_INSTAGRAM_ACCOUNT_ID = os.getenv("META_INSTAGRAM_ACCOUNT_ID")
META_PIXEL_ID = os.getenv("META_PIXEL_ID")

DEFAULT_LINK = "https://adnexus.co.in"

META_MIN_RADIUS_KM = 1
META_MAX_RADIUS_KM = 80

INDUSTRY_TO_SPECIAL_CATEGORY = {
    "Financial Services":          ["FINANCIAL_PRODUCTS_SERVICES"],
    "Real Estate & Construction":  ["HOUSING"],
}

def get_special_ad_categories(industry: str) -> list:
    return INDUSTRY_TO_SPECIAL_CATEGORY.get(industry, [])

# ── FIX: 'Enquire Now' jaisi labels ko Meta ke sahi enum values mein map karo ──
CTA_LABEL_TO_META = {
    "ENQUIRE_NOW": "INQUIRE_NOW",
    "ENQUIRE":     "INQUIRE_NOW",
}

def normalize_meta_cta(raw_cta: str) -> str:
    cta = (raw_cta or "LEARN_MORE").upper().replace(" ", "_")
    return CTA_LABEL_TO_META.get(cta, cta)

def init_meta_api():
    FacebookAdsApi.init(
        app_id=META_APP_ID,
        app_secret=META_APP_SECRET,
        access_token=META_ACCESS_TOKEN,
        api_version="v21.0"
    )
    return AdAccount(META_AD_ACCOUNT)


def create_meta_campaign(campaign_data: dict) -> dict:
    try:
        account = init_meta_api()
        objective_map = {
            "LEAD_GEN":        "OUTCOME_LEADS",
            "BRAND_AWARENESS": "OUTCOME_AWARENESS",
        }
        objective = objective_map.get(campaign_data.get("goal", "LEAD_GEN"), "OUTCOME_TRAFFIC")
        special_categories = get_special_ad_categories(campaign_data.get("industry", ""))

        campaign = account.create_campaign(fields=[], params={
        "name":                  campaign_data["name"],
        "objective":             objective,
        "status":                "PAUSED",
        "special_ad_categories": special_categories,
        "is_adset_budget_sharing_enabled":False,
})
        return {"campaign_id": campaign["id"], "status": "PAUSED", "platform": "meta"}
    except FacebookRequestError as e:
        raise Exception(f"Meta campaign error: {e.api_error_message()} | Body: {e.body()}")


def create_meta_ad_set(campaign_id: str, ad_set_data: dict) -> dict:
    try:
        account = init_meta_api()

        daily_budget_rupees = ad_set_data.get("daily_budget_rupees", 100)
        daily_budget_paise  = max(int(daily_budget_rupees * 100), 5000)

        locations = ad_set_data.get("locations", [])
        radius_km = ad_set_data.get("radius_km", 25)
        radius_km_clamped = max(META_MIN_RADIUS_KM, min(radius_km, META_MAX_RADIUS_KM))

        if locations:
            custom_locations = [
                {
                    "latitude":      loc["lat"],
                    "longitude":     loc["lng"],
                    "radius":        radius_km_clamped,
                    "distance_unit": "kilometer",
                }
                for loc in locations
                if loc.get("lat") is not None and loc.get("lng") is not None
            ]
            geo_locations = {"custom_locations": custom_locations} if custom_locations else {"countries": ["IN"]}
        else:
            geo_locations = {"countries": ["IN"]}

        targeting = {
            "geo_locations": geo_locations,
            "age_min": ad_set_data.get("age_min", 18),
            "age_max": ad_set_data.get("age_max", 65),
        }

        interests = ad_set_data.get("interests", [])
        valid_interests = [
            {"id": i["id"], "name": i["name"]}
            for i in interests
            if i.get("id")
        ]
        if valid_interests:
            targeting["flexible_spec"] = [{"interests": valid_interests}]

        # ── CHANGE 1 (merged from AdNexus fix): Advantage+ Audience — ab user ke audience_mode choice pe depend karta hai ──
        use_advantage_audience = ad_set_data.get("audience_mode") != "precise"
        targeting["targeting_automation"] = {"advantage_audience": 1 if use_advantage_audience else 0}
        # Meta rule: Advantage+ audience ON hote hue age_max 65 se kam nahi ho sakta
        if use_advantage_audience:
            targeting["age_max"] = 65

        if ad_set_data.get("publisher_platforms"):
            targeting["publisher_platforms"] = ad_set_data["publisher_platforms"]
        elif ad_set_data.get("instagram_selected"):
            targeting["publisher_platforms"] = ["facebook", "instagram"]
        else:
            targeting["publisher_platforms"] = ["facebook"]

        from datetime import datetime as dt

        is_lead_pixel_ready = ad_set_data.get("goal") == "LEAD_GEN" and META_PIXEL_ID

        adset_params = {
            "name":              ad_set_data["name"],
            "campaign_id":       campaign_id,
            "daily_budget":      daily_budget_paise,
            "billing_event":     "IMPRESSIONS",
            "optimization_goal": "OFFSITE_CONVERSIONS" if is_lead_pixel_ready else "REACH",
            "promoted_object": (
                {"pixel_id": META_PIXEL_ID, "custom_event_type": "LEAD"}
                if is_lead_pixel_ready
                else {"page_id": META_PAGE_ID}
            ),
            "bid_strategy":      "LOWEST_COST_WITHOUT_CAP",
            "targeting":         targeting,
            "status":            "PAUSED"
        }
        start_date = ad_set_data.get("start_date")
        end_date   = ad_set_data.get("end_date")
        if start_date:
            adset_params["start_time"] = dt.strptime(start_date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00+05:30")
        if end_date:
            adset_params["end_time"] = dt.strptime(end_date, "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59+05:30")

        adset = account.create_ad_set(fields=[], params=adset_params)

        return {"adset_id": adset["id"], "status": "PAUSED", "targeting_used": targeting}
    except Exception as e:
        raise Exception(f"Meta ad set error: {str(e)}")


# ════════════════════════════════════════════════════════════
# NAYA: Direct Contact (Call/WhatsApp/Email) ke liye link + CTA
# banane wala helper. Meta ke rule ke hisaab se: outer link_data.link
# HAMESHA ek normal https:// URL hona chahiye — sirf call_to_action
# ke andar hi tel: / wa.me jaisa special link jaata hai. Yeh Meta ke
# apne developer forum examples se confirm hua hai.
# ════════════════════════════════════════════════════════════
def format_phone_international(value: str) -> str:
    """
    Meta ko tel:/wa.me links mein hamesha country code ke saath number
    chahiye (E.164 format), warna 'Invalid Phone Number' error deta hai.
    Agar 10-digit Indian number diya hai (bina country code ke), to
    aage 91 laga dete hain. Agar already country code hai (11+ digits),
    to usko waisa hi rehne dete hain.
    """
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def get_contact_cta_override(contact_method: str, contact_value: str, fallback_link: str) -> dict:
    """
    Returns: { "outer_link": "...", "cta_link": "...", "cta_type": "..." }
    outer_link -> link_data.link mein jaata hai (hamesha valid https URL)
    cta_link   -> sirf call_to_action.value.link ke andar jaata hai
    """
    if not contact_method or not contact_value:
        return None

    if contact_method == "call":
        phone = format_phone_international(contact_value)
        return {
            "outer_link": fallback_link,           # normal URL — Meta yahi expect karta hai
            "cta_link":   f"tel:+{phone}",          # sirf CTA ke andar, country code ke saath
            "cta_type":   "CALL_NOW",
        }

    if contact_method == "whatsapp":
        digits = format_phone_international(contact_value)
        wa_link = f"https://wa.me/{digits}"
        return {
            "outer_link": wa_link,   # wa.me khud valid https URL hai
            "cta_link":   wa_link,
            "cta_type":   "WHATSAPP_MESSAGE",
        }

    if contact_method == "email":
        return {
            "outer_link": fallback_link,
            "cta_link":   fallback_link,
            "cta_type":   "CONTACT_US",
        }

    return None


def create_meta_ad_creative(ad_content: dict, instagram_selected: bool = False) -> dict:
    try:
        account = init_meta_api()

        link_url = (
            ad_content.get("link_url") or
            ad_content.get("final_url") or
            ad_content.get("website_url") or
            DEFAULT_LINK
        )
        if not link_url or not link_url.strip():
            link_url = DEFAULT_LINK

        print("LINK URL =", link_url)
        print("PAGE_ID =", META_PAGE_ID)

        # ── NAYA: Direct Contact override check — carousel se bhi pehle,
        #    kyunki call/whatsapp ads ke liye carousel ka koi matlab nahi ──
        contact_override = get_contact_cta_override(
            ad_content.get("contact_method"),
            ad_content.get("contact_value"),
            link_url,
        )

        if contact_override:
            link_data = {
                "message":     ad_content.get("primary_text") or "Get in touch with us today",
                "link":        contact_override["outer_link"],   # hamesha valid https URL
                "name":        ad_content.get("headline") or "Contact Us",
                "description": ad_content.get("description") or "Tap to get in touch instantly.",
                "call_to_action": {
                    "type":  contact_override["cta_type"],
                    "value": {"link": contact_override["cta_link"]}   # tel:/wa.me sirf yahan
                }
            }
            image_result = upload_meta_image(account, ad_content.get("image_url"))
            if image_result:
                if image_result["type"] == "url":
                    link_data["picture"] = image_result["value"]
                elif image_result["type"] == "hash":
                    link_data["image_hash"] = image_result["value"]

            print(f"DIRECT CONTACT CREATIVE — method={ad_content.get('contact_method')}, cta={contact_override['cta_type']}")

        else:
            # ── NAYA: Carousel Ad support ──
            # Jab ad_content mein is_carousel=True aur carousel_images list
            # mein 2+ image URLs ho, to Meta ka multi-card "child_attachments"
            # format use karte hain (Facebook/Instagram par ek hi ad post
            # mein swipeable cards dikhte hain) — instead of normal single
            # "picture" wale link_data. Headline/Description/CTA/Link sabhi
            # cards par SAME rehta hai (jaisa discuss hua tha), sirf image
            # har card mein alag hoti hai.
            carousel_images = ad_content.get("carousel_images") or []
            is_carousel = bool(ad_content.get("is_carousel")) and len(carousel_images) >= 2

            if is_carousel:
                child_attachments = []
                for img_url in carousel_images[:5]:  # AdNexus max 5 rakhta hai (Meta khud max 10 tak allow karta hai)
                    card_image_result = upload_meta_image(account, img_url)
                    card = {
                        "link":        link_url,
                        "name":        (ad_content.get("headline")    or "Business Loan")[:80],
                        "description": (ad_content.get("description") or "Apply Now")[:80],
                    }
                    if card_image_result:
                        if card_image_result["type"] == "url":
                            card["picture"] = card_image_result["value"]
                        elif card_image_result["type"] == "hash":
                            card["image_hash"] = card_image_result["value"]
                    child_attachments.append(card)

                link_data = {
                    "message": ad_content.get("primary_text") or "Get Business Loan Today",
                    "link":    link_url,
                    "child_attachments": child_attachments,
                    "call_to_action": {
                        "type":  normalize_meta_cta(ad_content.get("cta")),
                        "value": {"link": link_url}
                    },
                    "multi_share_optimized": True,
                }
                print(f"CAROUSEL CREATIVE — {len(child_attachments)} cards")
            else:
                link_data = {
                    "message":     ad_content.get("primary_text") or "Get Business Loan Today",
                    "link":        link_url,
                    "name":        ad_content.get("headline") or "Business Loan",
                    "description": ad_content.get("description") or "Apply Now",
                    "call_to_action": {
                        "type":  normalize_meta_cta(ad_content.get("cta")),
                        "value": {"link": link_url}
                    }
                }

                image_result = upload_meta_image(account, ad_content.get("image_url"))
                print("IMAGE_URL RECEIVED =", ad_content.get("image_url"))
                print("IMAGE_RESULT =", image_result)
                if image_result:
                    if image_result["type"] == "url":
                        link_data["picture"] = image_result["value"]
                    elif image_result["type"] == "hash":
                        link_data["image_hash"] = image_result["value"]

        object_story_spec = {
            "page_id": META_PAGE_ID,
            "link_data": link_data
        }
        if instagram_selected and META_INSTAGRAM_ACCOUNT_ID:
           object_story_spec["instagram_user_id"] = META_INSTAGRAM_ACCOUNT_ID

        creative = account.create_ad_creative(fields=[], params={
            "name": ad_content.get("name", "AdNexus Creative"),
            "object_story_spec": object_story_spec
        })
        return {"creative_id": creative["id"]}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise Exception(f"Meta creative error: {str(e)}")


def create_meta_ad(adset_id: str, creative_id: str, ad_name: str) -> dict:
    try:
        account = init_meta_api()
        ad = account.create_ad(fields=[], params={
            Ad.Field.name:     ad_name,
            Ad.Field.adset_id: adset_id,
            Ad.Field.creative: {"creative_id": creative_id},
            Ad.Field.status:   Ad.Status.paused,
        })
        return {"ad_id": ad["id"], "status": "PAUSED"}
    except FacebookRequestError as e:
        raise Exception(f"Meta ad error: {e.api_error_message()} | Body: {e.body()}")


def get_meta_campaign_status(campaign_id: str) -> dict:
    try:
        init_meta_api()
        campaign = Campaign(campaign_id)
        data = campaign.api_get(fields=[Campaign.Field.name, Campaign.Field.status])
        return {"campaign_id": campaign_id, "status": data.get("status")}
    except FacebookRequestError as e:
        raise Exception(f"Meta status error: {e.api_error_message()}")


def submit_campaign_to_meta(campaign_data: dict, ad_content_data: dict, audience_targeting: dict = None, campaign_id: int = None) -> dict:
    """
    UPDATED: Facebook aur Instagram dono selected hone par bhi ab EK HI
    ad set banate hain (Advantage+ Placements ke through) — overlap aur
    Learning Phase issue khatam karne ke liye. Per-lead platform tracking
    Meta ke {{site_source_name}} URL macro se milti hai.

    NAYA: agar campaign_data mein contact_method/contact_value hai
    (Direct Contact goal), wo ad_content mein daal diya jaata hai taaki
    create_meta_ad_creative() usse native Call/WhatsApp CTA bana sake.
    """
    try:
        if not ad_content_data.get("link_url") and not ad_content_data.get("final_url"):
            ad_content_data["link_url"] = DEFAULT_LINK

        campaign_result = create_meta_campaign(campaign_data)
        print("STEP 1 CAMPAIGN =", campaign_result)

        interests = (audience_targeting or {}).get("interests", [])

        facebook_selected  = campaign_data.get("facebook_selected", False)
        instagram_selected = campaign_data.get("instagram_selected", False)

        # ── CHANGE 2: Single ad set, combined budget + platforms ──
        if facebook_selected and instagram_selected:
            combined_budget = (
                campaign_data.get("facebook_budget", 0)
                + campaign_data.get("instagram_budget", 0)
            ) or campaign_data.get("budget_amount", 300)
            publisher_platforms = ["facebook", "instagram"]
        elif instagram_selected:
            combined_budget = campaign_data.get("instagram_budget", campaign_data.get("budget_amount", 300))
            publisher_platforms = ["instagram"]
        else:
            combined_budget = campaign_data.get("facebook_budget", campaign_data.get("budget_amount", 300))
            publisher_platforms = ["facebook"]

        result = {
            "success":          True,
            "meta_campaign_id": campaign_result["campaign_id"],
            "status":           "PAUSED",
            "platform":         "meta",
        }

        # ── CHANGE 3: dynamic Meta macro instead of hardcoded platform_key ──
        def build_ad_content(platform_key):
            content = dict(ad_content_data)
            if campaign_id and campaign_data.get("goal") == "LEAD_GEN":
                try:
                    from app.routes.leads import generate_lead_form_url
                    url = generate_lead_form_url(campaign_id, platform_key)
                    content["final_url"] = url
                    content["link_url"]  = url
                except Exception as e:
                    print(f"[submit_campaign_to_meta] lead URL build failed: {e}")
            # ── NAYA: Direct Contact fields aage ad_content tak pahunchao ──
            if campaign_data.get("goal") == "DIRECT_CONTACT":
                content["contact_method"] = campaign_data.get("contact_method", "")
                content["contact_value"]  = campaign_data.get("contact_value", "")
            return content

        adset_result = create_meta_ad_set(
            campaign_result["campaign_id"],
            {
                "name": f"{campaign_data['name']} - Ad Set",
                "goal": campaign_data.get("goal", "LEAD_GEN"),
                "daily_budget_rupees": combined_budget,
                "interests": interests,
                "age_min": campaign_data.get("age_min", 18),
                "age_max": campaign_data.get("age_max", 65),
                "start_date": campaign_data.get("start_date"),
                "end_date": campaign_data.get("end_date"),
                "locations": campaign_data.get("location_details", []),
                "radius_km": campaign_data.get("radius_km", 25),
                "publisher_platforms": publisher_platforms,
                "audience_mode": campaign_data.get("audience_mode", "broad"),
            }
        )
        print("STEP 2 ADSET =", adset_result)

        ad_content = build_ad_content("{{site_source_name}}")
        creative_result = create_meta_ad_creative(ad_content, instagram_selected=instagram_selected)
        print("STEP 3 CREATIVE =", creative_result)

        ad_result = create_meta_ad(adset_result["adset_id"], creative_result["creative_id"], f"{campaign_data['name']} - Ad")
        print("STEP 4 AD =", ad_result)

        result.update({
            "meta_adset_id":    adset_result["adset_id"],
            "meta_ad_id":       ad_result["ad_id"],
            "meta_creative_id": creative_result["creative_id"],
            "targeting_used":   adset_result.get("targeting_used"),
        })

        return result

    except Exception as e:
        print("META ERROR =", str(e))
        return {"success": False, "error": str(e), "platform": "meta"}


def get_meta_campaign_insights(campaign_id: str) -> dict:
    try:
        init_meta_api()
        campaign = Campaign(campaign_id)
        insights = campaign.get_insights(fields=[
            "impressions", "clicks", "spend", "reach", "ctr", "cpc", "cpm"
        ], params={"date_preset": "maximum"})

        if insights:
            data = insights[0]
            return {
                "impressions": int(data.get("impressions", 0)),
                "clicks":      int(data.get("clicks", 0)),
                "spend":       float(data.get("spend", 0)),
                "reach":       int(data.get("reach", 0)),
                "ctr":         float(data.get("ctr", 0)),
                "cpc":         float(data.get("cpc", 0)),
                "cpm":         float(data.get("cpm", 0)),
            }
        return {"impressions": 0, "clicks": 0, "spend": 0, "reach": 0, "ctr": 0, "cpc": 0, "cpm": 0}
    except FacebookRequestError as e:
        raise Exception(f"Meta insights error: {e.api_error_message()}")
    except Exception as e:
        raise Exception(f"Meta insights error: {str(e)}")

def upload_meta_image(account, image_url_or_data: str):
    if not image_url_or_data:
        return None

    if image_url_or_data.startswith("http://") or image_url_or_data.startswith("https://"):
        return {"type": "url", "value": image_url_or_data}

    if image_url_or_data.startswith("data:image"):
        try:
            from app.services.upload_to_cloudinary import upload_base64_to_cloudinary
            cloud_url = upload_base64_to_cloudinary(image_url_or_data)
            return {"type": "url", "value": cloud_url}
        except Exception as e:
            print(f"Meta image upload warning: {e}")
            return None
    return None

def delete_meta_campaign(campaign_id: str) -> dict:
    try:
        init_meta_api()
        campaign = Campaign(campaign_id)
        campaign.api_delete()
        return {"success": True}
    except FacebookRequestError as e:
        print(f"[rollback] Meta campaign delete failed: {e.api_error_message()}")
        return {"success": False, "error": e.api_error_message()}



def send_meta_lead_event(
    email: str = "",
    phone: str = "",
    fbclid: str = None,
    fbp: str = None,
    client_ip: str = None,
    user_agent: str = None,
    source_url: str = None,
) -> dict:
    if not META_PIXEL_ID or not META_ACCESS_TOKEN:
        print("[meta_lead_event] Pixel ID ya Access Token missing — skip kar rahe hain")
        return {"success": False, "error": "Pixel not configured"}

    try:
        user_data = {}
        if email:
            user_data["em"] = [hashlib.sha256(email.strip().lower().encode()).hexdigest()]
        if phone:
            clean_phone = "".join(filter(str.isdigit, phone))
            user_data["ph"] = [hashlib.sha256(clean_phone.encode()).hexdigest()]
        if fbclid:
            user_data["fbc"] = f"fb.1.{int(time.time())}.{fbclid}"
        # ── FIX: fbp, client_ip, user_agent add kiye — ye Meta ke match quality ke liye zaroori hain ──
        if fbp:
            user_data["fbp"] = fbp
        if client_ip:
            user_data["client_ip_address"] = client_ip
        if user_agent:
            user_data["client_user_agent"] = user_agent

        event = {
            "event_name": "Lead",
            "event_time": int(time.time()),
            "action_source": "website",
            "user_data": user_data,
        }
        # ── FIX: event_source_url add kiya (Meta strongly recommends ise CAPI events ke saath bhejna) ──
        if source_url:
            event["event_source_url"] = source_url

        payload = {"data": [event]}

        resp = requests.post(
            f"https://graph.facebook.com/v19.0/{META_PIXEL_ID}/events",
            params={"access_token": META_ACCESS_TOKEN},
            json=payload,
            timeout=5,
        )
        return {"success": resp.ok, "response": resp.json()}
    except Exception as e:
        print(f"[meta_lead_event] Failed: {e}")
        return {"success": False, "error": str(e)}


def get_meta_adset_insights(adset_id: str) -> dict:
    """
    UPDATED: ab breakdowns=publisher_platform ke saath — single ad set
    se bhi Facebook aur Instagram ka spend/performance ALAG-ALAG milta
    hai. Response ab EK dict ki jagah ek "breakdown" list return karta
    hai (har platform ke liye ek entry).
    """
    try:
        init_meta_api()
        from facebook_business.adobjects.adset import AdSet
        adset = AdSet(adset_id)
        insights = adset.get_insights(fields=[
            "impressions", "clicks", "spend", "reach", "ctr", "cpc", "cpm"
        ], params={"date_preset": "maximum", "breakdowns": ["publisher_platform"]})

        if insights:
            results = []
            for data in insights:
                results.append({
                    "publisher_platform": data.get("publisher_platform", "unknown"),
                    "impressions": int(data.get("impressions", 0)),
                    "clicks":      int(data.get("clicks", 0)),
                    "spend":       float(data.get("spend", 0)),
                    "reach":       int(data.get("reach", 0)),
                    "ctr":         float(data.get("ctr", 0)),
                    "cpc":         float(data.get("cpc", 0)),
                    "cpm":         float(data.get("cpm", 0)),
                })
            return {"breakdown": results}
        return {"breakdown": []}
    except FacebookRequestError as e:
        raise Exception(f"Meta adset insights error: {e.api_error_message()}")


# ════════════════════════════════════════════════════════════
# MERGED FROM VERSION A — place + gender insights
# (Not present in Version B — kept here since it doesn't conflict
#  with anything Version B added.)
# ════════════════════════════════════════════════════════════
def get_meta_campaign_place_insights(campaign_id: str) -> list:
    """
    Meta India mein city-level breakdown nahi deta — sirf region (state)
    level milta hai. Isliye "place" field mein state-name aayega
    (e.g. "Uttar Pradesh"), city-name nahi.
    """
    try:
        init_meta_api()
        campaign = Campaign(campaign_id)
        insights = campaign.get_insights(fields=[
            "impressions", "clicks", "spend"
        ], params={"date_preset": "maximum", "breakdowns": ["region"]})

        results = []
        for data in insights:
            results.append({
                "place":        data.get("region", "Unknown"),
                "impressions":  int(data.get("impressions", 0)),
                "clicks":       int(data.get("clicks", 0)),
                "budget_spent": float(data.get("spend", 0)),
            })
        return results
    except FacebookRequestError as e:
        print(f"[meta_place_insights] Failed: {e.api_error_message()}")
        return []
    except Exception as e:
        print(f"[meta_place_insights] Failed: {e}")
        return []

def get_meta_gender_insights(adset_id: str) -> dict:
    """
    NAYA: Meta demographic breakdown (gender) delivery breakdown
    (publisher_platform) ke saath combine nahi ho sakta — Meta API
    hard restriction (single ad set FB+IG dono cover karta hai,
    isliye split possible nahi). Sirf COMBINED (FB+IG mila ke)
    gender data milega.
    Returns: {"male": {...}, "female": {...}, "unknown": {...}}
    """
    try:
        init_meta_api()
        from facebook_business.adobjects.adset import AdSet
        adset = AdSet(adset_id)
        insights = adset.get_insights(fields=[
            "impressions", "clicks", "spend"
        ], params={
            "date_preset": "maximum",
            "breakdowns": ["gender"]
        })

        result = {}
        for data in insights:
            gender = data.get("gender", "unknown")
            result[gender] = {
                "impressions": int(data.get("impressions", 0)),
                "clicks":      int(data.get("clicks", 0)),
                "spend":       float(data.get("spend", 0)),
            }
        return result
    except FacebookRequestError as e:
        print(f"[meta_gender_insights] Failed: {e.api_error_message()}")
        return {}
    except Exception as e:
        print(f"[meta_gender_insights] Failed: {e}")
        return {}

# ════════════════════════════════════════════════════════════
# NAYA: UPDATE CAMPAIGN NAME (Manage/Edit feature ke liye)
# ════════════════════════════════════════════════════════════
def update_meta_campaign_name(campaign_id: str, new_name: str) -> dict:
    """
    Existing live Meta campaign ka naam update karta hai — real Graph API
    mutate call (POST /{campaign_id} with name field).
    """
    try:
        init_meta_api()
        campaign = Campaign(campaign_id)
        campaign.api_update(params={"name": new_name})
        return {"success": True}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_meta_campaign_status(campaign_id: str, status: str) -> dict:
    """status = 'active' | 'paused'"""
    try:
        init_meta_api()
        meta_status = "ACTIVE" if status == "active" else "PAUSED"
        Campaign(campaign_id).api_update(params={"status": meta_status})
        return {"success": True}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_meta_adset_budget(adset_id: str, new_daily_budget_rupees: float) -> dict:
    try:
        init_meta_api()
        paise = max(int(new_daily_budget_rupees * 100), 5000)
        AdSet(adset_id).api_update(params={"daily_budget": paise})
        return {"success": True}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_meta_adset_end_date(adset_id: str, new_end_date: str) -> dict:
    try:
        init_meta_api()
        from datetime import datetime as dt
        end_time = dt.strptime(new_end_date, "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59+05:30")
        AdSet(adset_id).api_update(params={"end_time": end_time})
        return {"success": True}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_meta_adset_targeting(adset_id: str, locations: list, radius_km: float, age_min: int, age_max: int, audience_mode: str = "broad") -> dict:
    try:
        init_meta_api()
        radius_km_clamped = max(META_MIN_RADIUS_KM, min(radius_km, META_MAX_RADIUS_KM))

        if locations:
            custom_locations = [
                {"latitude": loc["lat"], "longitude": loc["lng"], "radius": radius_km_clamped, "distance_unit": "kilometer"}
                for loc in locations if loc.get("lat") is not None and loc.get("lng") is not None
            ]
            geo_locations = {"custom_locations": custom_locations} if custom_locations else {"countries": ["IN"]}
        else:
            geo_locations = {"countries": ["IN"]}

        targeting = {"geo_locations": geo_locations, "age_min": age_min, "age_max": age_max}
        use_advantage_audience = audience_mode != "precise"
        targeting["targeting_automation"] = {"advantage_audience": 1 if use_advantage_audience else 0}
        if use_advantage_audience:
            targeting["age_max"] = 65

        AdSet(adset_id).api_update(params={"targeting": targeting})
        return {"success": True}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_meta_ad_creative(ad_id: str, new_ad_content: dict, instagram_selected: bool = False) -> dict:
    """
    Meta creative immutable — naya creative banao aur existing Ad ko
    naye creative se point kara do. ad_id same rehta hai, stats continue rehti hain.
    """
    try:
        creative_result = create_meta_ad_creative(new_ad_content, instagram_selected=instagram_selected)
        init_meta_api()
        Ad(ad_id).api_update(params={"creative": {"creative_id": creative_result["creative_id"]}})
        return {"success": True, "new_creative_id": creative_result["creative_id"]}
    except FacebookRequestError as e:
        return {"success": False, "error": e.api_error_message()}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_meta_age_insights(adset_id: str = None, campaign_id: str = None) -> dict:
    """
    Meta age breakdown (FB+IG combined). Returns same shape as Google's.
    """
    try:
        init_meta_api()
        obj = AdSet(adset_id) if adset_id else Campaign(campaign_id)
        insights = obj.get_insights(
            fields=["impressions", "clicks"],
            params={"date_preset": "maximum", "breakdowns": ["age"]},
        )
        result = {}
        for data in insights:
            key = data.get("age", "Undetermined")
            if key not in ("18-24", "25-34", "35-44", "45-54", "55-64", "65+"):
                key = "Undetermined"
            slot = result.setdefault(key, {"impressions": 0, "clicks": 0})
            slot["impressions"] += int(data.get("impressions", 0))
            slot["clicks"]      += int(data.get("clicks", 0))
        return result
    except FacebookRequestError as e:
        print(f"[meta_age_insights] Failed: {e.api_error_message()}")
        return {}
    except Exception as e:
        print(f"[meta_age_insights] Failed: {e}")
        return {}