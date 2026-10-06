# ============================================================
# backend/app/services/google_ads_service.py
# Google Ads API Integration — Test + Production same code
# pip install google-ads
#
# MERGED FILE — combines two teammates' versions of this file.
#   - Sections 1–10: identical in both versions (no conflicts).
#   - Section 11 "GEO + GENDER INSIGHTS": only in Version A.
#   - Section 12 "CAMPAIGN MANAGE / EDIT TOOLKIT": only in Version B.
#   Nothing was overwritten — both additions were purely additive,
#   so both are kept in full below.
# ============================================================

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from datetime import datetime, timedelta
import os
from datetime import datetime
from dotenv import load_dotenv
import requests

load_dotenv()

# ─── Config ──────────────────────────────────────────────────
CUSTOMER_ID       = os.getenv("GOOGLE_ADS_CUSTOMER_ID")
LOGIN_CUSTOMER_ID = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")

CUSTOMER_ID = CUSTOMER_ID.replace("-", "") if CUSTOMER_ID else ""
LOGIN_CUSTOMER_ID = LOGIN_CUSTOMER_ID.replace("-", "") if LOGIN_CUSTOMER_ID else ""


# ─── Client banao ────────────────────────────────────────────
def get_google_ads_client():
    try:
        import os
        yaml_path = os.path.join(os.path.dirname(__file__), '..', '..', 'google-ads.yaml')
        client = GoogleAdsClient.load_from_storage(
            path=yaml_path,
        )
        return client
    except Exception as e:
        raise Exception(f"Google Ads client banane mein error: {e}")

# ════════════════════════════════════════════════════════════
# 1. CAMPAIGN BANAO
# ════════════════════════════════════════════════════════════
def create_google_campaign(campaign_data: dict) -> dict:
    """
    campaign_data = {
        "name": "Loan Goods Q1 2026",
        "budget_amount": 10000,      # rupees mein
        "start_date": "2026-05-27",
        "end_date": "2026-06-27",
        "goal": "LEAD_GEN"           # ya "BRAND_AWARENESS"
    }
    Returns: { "campaign_id": "...", "budget_id": "...", "status": "PAUSED" }
    """
    client = get_google_ads_client()

    # ─── Step 1: Budget banao ─────────────────────────────────
    budget_service     = client.get_service("CampaignBudgetService")
    budget_operation   = client.get_type("CampaignBudgetOperation")
    budget             = budget_operation.create

    budget.name = f"{campaign_data['name']} Budget {datetime.now().strftime('%Y%m%d%H%M%S')}"
    budget.delivery_method         = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget_amount = max(float(campaign_data.get("budget_amount", 1000)), 1.0)
    budget.amount_micros = int(budget_amount * 1_000_000)

    try:
        budget_response = budget_service.mutate_campaign_budgets(
            customer_id=CUSTOMER_ID,
            operations=[budget_operation]
        )
        budget_resource_name = budget_response.results[0].resource_name
    except GoogleAdsException as ex:
        print("========== GOOGLE ADS ERROR ==========")
        print(ex)
        print("======================================")
        raise Exception(str(ex))

    # ─── Step 2: Campaign banao ───────────────────────────────
    campaign_service   = client.get_service("CampaignService")
    campaign_operation = client.get_type("CampaignOperation")
    campaign           = campaign_operation.create

    print(type(campaign))
    print(campaign)
    campaign.name                  = campaign_data["name"]
    campaign.status                = client.enums.CampaignStatusEnum.PAUSED  # TEST mein PAUSED
    campaign.campaign_budget       = budget_resource_name

    campaign.contains_eu_political_advertising = (
    client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    )

    # Bidding strategy — goal ke hisaab se
    campaign.manual_cpc.enhanced_cpc_enabled = False

    # Search campaign
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH

    # Dates
    start = datetime.strptime(campaign_data["start_date"], "%Y-%m-%d")
    end   = datetime.strptime(campaign_data["end_date"], "%Y-%m-%d")
    campaign.start_date_time = start.strftime("%Y-%m-%d 00:00:00")
    campaign.end_date_time   = end.strftime("%Y-%m-%d 23:59:59")

    # Network settings
    campaign.network_settings.target_google_search   = True
    campaign.network_settings.target_search_network  = True
    campaign.network_settings.target_content_network = False
    campaign.manual_cpc = client.get_type("ManualCpc")

    try:
        campaign_response = campaign_service.mutate_campaigns(
            customer_id=CUSTOMER_ID,
            operations=[campaign_operation]
        )
        campaign_resource = campaign_response.results[0].resource_name
        campaign_id = campaign_resource.split("/")[-1]

    except GoogleAdsException as ex:
        print("======== GOOGLE ADS ERROR ========")
        print(f"Request ID: {ex.request_id}")
        print(f"Status Code: {ex.error.code().name}")

        for error in ex.failure.errors:
            print("Message :", error.message)
            print("Location:", error.location)

        print("==================================")
        raise

    return {
        "campaign_id": campaign_id,
        "campaign_resource": campaign_resource,
        "budget_resource": budget_resource_name,
        "status": "PAUSED",
        "platform": "google"
    }

# ════════════════════════════════════════════════════════════
# HELPER: Daily budget ke hisaab se CPC bid nikaalo
# ════════════════════════════════════════════════════════════
def calculate_cpc_bid(daily_budget: float) -> float:
    """
    Fixed ₹50 bid ki jagah — budget ke proportion mein bid nikaalte hain,
    taaki chhoti budget pe bid bhi chhoti ho (auction mein pura din chale)
    aur badi budget pe bid competitive ho sake.

    Formula: daily_budget ka 3%, min ₹15, max ₹200 (safety cap taaki
    bhoolse bahut zyada bid na chali jaaye).
    """
    bid = daily_budget * 0.03
    return round(max(15, min(bid, 200)), 2)


# ════════════════════════════════════════════════════════════
# 2. AD GROUP BANAO
# ════════════════════════════════════════════════════════════
def create_ad_group(campaign_resource: str, ad_group_data: dict) -> dict:
    """
    ad_group_data = {
        "name": "Loan Goods - Working Capital",
        "cpc_bid": 50,     # rupees mein
        "keywords": ["working capital loan", "business loan", "machinery loan"]
    }
    Returns: { "ad_group_id": "...", "ad_group_resource": "..." }
    """
    client = get_google_ads_client()

    # ─── Ad Group banao ───────────────────────────────────────
    ag_service   = client.get_service("AdGroupService")
    ag_operation = client.get_type("AdGroupOperation")
    ag           = ag_operation.create

    ag.name                = ad_group_data["name"]
    ag.campaign            = campaign_resource
    ag.status              = client.enums.AdGroupStatusEnum.ENABLED
    ag.type_               = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ag.cpc_bid_micros      = int(ad_group_data.get("cpc_bid", 50)) * 1_000_000

    try:
        ag_response        = ag_service.mutate_ad_groups(
            customer_id=CUSTOMER_ID,
            operations=[ag_operation]
        )
        ag_resource        = ag_response.results[0].resource_name
        ag_id              = ag_resource.split("/")[-1]
    except GoogleAdsException as ex:
        raise Exception(f"Ad Group error: {ex.error.code().name}")

    # ─── Keywords add karo ────────────────────────────────────
    keyword_service    = client.get_service("AdGroupCriterionService")
    keyword_operations = []

    for keyword_text in ad_group_data.get("keywords", []):
        kw_op              = client.get_type("AdGroupCriterionOperation")
        kw                 = kw_op.create
        kw.ad_group        = ag_resource
        kw.status          = client.enums.AdGroupCriterionStatusEnum.ENABLED
        kw.keyword.text    = keyword_text
        kw.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        keyword_operations.append(kw_op)

    if keyword_operations:
        try:
            keyword_service.mutate_ad_group_criteria(
                customer_id=CUSTOMER_ID,
                operations=keyword_operations
            )
        except GoogleAdsException as ex:
            raise Exception(f"Keywords error: {ex.error.code().name}")

    return {
        "ad_group_id":       ag_id,
        "ad_group_resource": ag_resource,
        "keywords_added":    len(ad_group_data.get("keywords", []))
    }


# ════════════════════════════════════════════════════════════
# 3. RESPONSIVE SEARCH AD BANAO
# ════════════════════════════════════════════════════════════
def create_responsive_search_ad(ag_resource: str, ad_content: dict) -> dict:
    """
    ad_content = {
        "headlines":     ["Working Capital Loan", "Fast Business Loan", "Apply in 5 Minutes"],
        "descriptions":  ["Get ₹10L-₹5Cr instantly. Apply now.", "No collateral needed. Quick approval."],
        "final_url":     "https://yourdomain.com/apply",
        "display_url":   "yourdomain.com/loan"
    }
    Returns: { "ad_id": "..." }
    """

    print(f"DEBUG Headlines: {len(ad_content.get('headlines', []))}, Descriptions: {len(ad_content.get('descriptions', []))}")
    print(f"DEBUG Content: {ad_content}")

    client       = get_google_ads_client()
    ad_service   = client.get_service("AdGroupAdService")
    ad_operation = client.get_type("AdGroupAdOperation")
    ad_group_ad  = ad_operation.create

    ad_group_ad.ad_group = ag_resource
    ad_group_ad.status   = client.enums.AdGroupAdStatusEnum.PAUSED

    # Responsive Search Ad
    # Responsive Search Ad
    rsa = ad_group_ad.ad.responsive_search_ad

    # ── Safety net: Google ko min 3 headlines, min 2 descriptions chahiye ──
    headlines_list = list(ad_content.get("headlines", []))
    descriptions_list = list(ad_content.get("descriptions", []))

    base_headline = ad_content.get("headline") or (headlines_list[0] if headlines_list else "Apply Now")
    base_desc = ad_content.get("description") or ad_content.get("primary_text") or "Apply now for quick approval."
    cta_text = ad_content.get("cta", "Apply Now")

    # Extra headlines/descriptions isi ad ke apne text se banao — koi bahar ka text nahi
    desc_first_part = base_desc.split(".")[0].strip()[:30] or base_headline[:30]
    fallback_headlines = [
        base_headline,
        desc_first_part,
        cta_text,
    ]
    for fh in fallback_headlines:
        if len(headlines_list) >= 3:
            break
        if fh and fh not in headlines_list:
            headlines_list.append(fh)

    combined_desc = f"{base_headline}. {cta_text}."[:90]
    fallback_descriptions = [
        base_desc,
        combined_desc,
    ]
    for fd in fallback_descriptions:
        if len(descriptions_list) >= 2:
            break
        if fd and fd not in descriptions_list:
            descriptions_list.append(fd)

    ad_content["headlines"] = headlines_list
    ad_content["descriptions"] = descriptions_list
    print(f"DEBUG AFTER FALLBACK — Headlines: {len(headlines_list)}, Descriptions: {len(descriptions_list)}")
    print(f"DEBUG Headlines list: {headlines_list}")
    print(f"DEBUG Descriptions list: {descriptions_list}")

    pinned_headline_fields = [
        client.enums.ServedAssetFieldTypeEnum.HEADLINE_1,
        client.enums.ServedAssetFieldTypeEnum.HEADLINE_2,
        client.enums.ServedAssetFieldTypeEnum.HEADLINE_3,
    ]
    for i, headline_text in enumerate(ad_content["headlines"][:3]):
        headline      = client.get_type("AdTextAsset")
        headline.text = headline_text
        headline.pinned_field = pinned_headline_fields[i]
        rsa.headlines.append(headline)

    # Descriptions — sabko pin karo taaki fixed order mein hi dikhein
    pinned_desc_fields = [
        client.enums.ServedAssetFieldTypeEnum.DESCRIPTION_1,
        client.enums.ServedAssetFieldTypeEnum.DESCRIPTION_2,
    ]
    for i, desc_text in enumerate(ad_content["descriptions"][:2]):
        desc      = client.get_type("AdTextAsset")
        desc.text = desc_text
        desc.pinned_field = pinned_desc_fields[i]
        rsa.descriptions.append(desc)

    # URLs
    ad_group_ad.ad.final_urls.append(ad_content["final_url"])
    rsa.path1 = ad_content.get("display_url", "").split("/")[0]
    rsa.path2 = "/".join(ad_content.get("display_url", "").split("/")[1:]) if "/" in ad_content.get("display_url", "") else ""

    try:
        ad_response = ad_service.mutate_ad_group_ads(
            customer_id=CUSTOMER_ID,
            operations=[ad_operation]
        )
        ad_resource = ad_response.results[0].resource_name
        ad_id       = ad_resource.split("/")[-1]
    except GoogleAdsException as ex:
        raise Exception(f"Ad create error: {ex.error.code().name}")

    return {
        "ad_id":       ad_id,
        "ad_resource": ad_resource,
        "status":      "PAUSED"
    }


# ════════════════════════════════════════════════════════════
# 4. CAMPAIGN STATUS CHECK
# ════════════════════════════════════════════════════════════
def get_campaign_status(campaign_id: str) -> dict:
    """
    Google se latest campaign status fetch karo
    Returns: { "status": "PAUSED/ENABLED/REMOVED", "impressions": 0, "clicks": 0, "cost": 0 }
    """
    client          = get_google_ads_client()
    ga_service      = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros
        FROM campaign
        WHERE campaign.id = {campaign_id}
    """

    try:
        response = ga_service.search(customer_id=CUSTOMER_ID, query=query)
        for row in response:
            return {
                "campaign_id": str(row.campaign.id),
                "name":        row.campaign.name,
                "status":      row.campaign.status.name,
                "impressions": row.metrics.impressions,
                "clicks":      row.metrics.clicks,
                "cost":        row.metrics.cost_micros / 1_000_000  # rupees mein
            }
    except GoogleAdsException as ex:
        raise Exception(f"Status fetch error: {ex.error.code().name}")

    return {"status": "NOT_FOUND"}


# ════════════════════════════════════════════════════════════
# 5. AGE TARGETING SET KARO
# ════════════════════════════════════════════════════════════
def set_age_targeting(ad_group_resource: str, age_min: int, age_max: int):

    client = get_google_ads_client()
    criterion_service = client.get_service("AdGroupCriterionService")

    age_ranges = []

    if age_min <= 24:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_18_24)

    if age_min <= 34 and age_max >= 25:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_25_34)

    if age_min <= 44 and age_max >= 35:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_35_44)

    if age_min <= 54 and age_max >= 45:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_45_54)

    if age_min <= 64 and age_max >= 55:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_55_64)

    if age_max >= 65:
        age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_65_UP)


    operations = []
    for age_range in age_ranges:
           op = client.get_type("AdGroupCriterionOperation")
           crit = op.create
           crit.ad_group = ad_group_resource
           crit.age_range.type_ = age_range
           operations.append(op)

    if operations:
        criterion_service.mutate_ad_group_criteria(
            customer_id=CUSTOMER_ID,
            operations=operations
        )
# ════════════════════════════════════════════════════════════
# 6. LOCATION TARGETING SET KARO (NAYA)
# ════════════════════════════════════════════════════════════
def set_location_targeting(campaign_resource: str, locations: list, radius_km: float):
    """
    Google Ads mein city+radius targeting "proximity" criterion se hoti hai
    (CampaignCriterion.proximity) — ek criterion per city, radius sabke
    liye same rehta hai (jaisa frontend se aata hai).

    locations = [{"name": "Delhi", "lat": 28.6139, "lng": 77.2090}, ...]
    radius_km = 25  (frontend ka radiusKm)

    Agar locations khaali hai, function kuch nahi karta (campaign poore
    India pe hi chalega, jo Google ka account-level default hai).
    """
    if not locations:
        return

    client = get_google_ads_client()
    criterion_service = client.get_service("CampaignCriterionService")

    operations = []
    for loc in locations:
        if loc.get("lat") is None or loc.get("lng") is None:
            continue
        op   = client.get_type("CampaignCriterionOperation")
        crit = op.create
        crit.campaign = campaign_resource
        crit.proximity.radius = radius_km
        crit.proximity.radius_units = client.enums.ProximityRadiusUnitsEnum.KILOMETERS
        crit.proximity.geo_point.latitude_in_micro_degrees  = int(loc["lat"] * 1_000_000)
        crit.proximity.geo_point.longitude_in_micro_degrees = int(loc["lng"] * 1_000_000)
        operations.append(op)

    if operations:
        criterion_service.mutate_campaign_criteria(
            customer_id=CUSTOMER_ID,
            operations=operations
        )


# ════════════════════════════════════════════════════════════
# 7. MAIN FUNCTION — campaigns.py se yeh call karo
# ════════════════════════════════════════════════════════════
def submit_campaign_to_google(campaign_data: dict, ad_content_data: dict) -> dict:
    """
    Ek hi function call — poora campaign Google pe submit ho jaata hai
    campaigns.py route se ise call karo

    campaign_data mein ab "location_details" (list of {name,lat,lng}) aur
    "radius_km" bhi expect kiye jaate hain — campaigns.py router se aate hain.

    Returns: {
        "success": True,
        "google_campaign_id": "...",
        "google_ad_group_id": "...",
        "google_ad_id": "...",
        "status": "PAUSED"
    }
    """
    try:
# Step 1: Campaign banao
        campaign_result = create_google_campaign(campaign_data)

        # ── Location (city + radius) targeting — campaign level pe hi sahi hai ──
        try:
            set_location_targeting(
                campaign_result["campaign_resource"],
                campaign_data.get("location_details", []),
                campaign_data.get("radius_km", 25)
            )
        except Exception as e:
            print(f"Location targeting warning: {e}")  # non-fatal, campaign phir bhi chalega

        # Step 2: Ad group banao
        suggested_cpc = calculate_cpc_bid(campaign_data.get("budget_amount", 1000))
        
        ag_result = create_ad_group(
            campaign_result["campaign_resource"],
            {
                "name":     f"{campaign_data['name']} - Ad Group",
                "cpc_bid":  suggested_cpc,
                "keywords": campaign_data.get("keywords", ["business loan", "working capital"])
            }
        )

        # ── Age targeting ab Ad Group level pe (ad group banne ke baad) ──
        try:
            set_age_targeting(
                ag_result["ad_group_resource"],
                campaign_data.get("age_min", 18),
                campaign_data.get("age_max", 65)
            )
        except Exception as e:
            print(f"Age targeting warning: {e}")  # non-fatal, campaign phir bhi chalega

        # Step 3: Ad banao
# Step 3: Ad banao
        ad_result = create_responsive_search_ad(
            ag_result["ad_group_resource"],
            ad_content_data
        )

        # ── Image Extension add karo (agar image_url diya gaya hai) ──
        if ad_content_data.get("image_url"):
            try:
                asset_resource = upload_image_asset(
                    ad_content_data["image_url"],
                    f"{campaign_data['name']} Image {datetime.now().strftime('%Y%m%d%H%M%S')}"
                )
                add_image_extension(campaign_result["campaign_resource"], asset_resource)
            except Exception as e:
                print(f"Image extension warning: {e}")  # non-fatal, campaign phir bhi chalega

        return {
            "success":             True,
            "google_campaign_id":  campaign_result["campaign_id"],
            "google_ad_group_id":  ag_result["ad_group_id"],
            "google_ad_id":        ad_result["ad_id"],
            "status":              "PAUSED",
            "platform":            "google"
        }

    except Exception as e:
        return {
            "success": False,
            "error":   str(e),
            "platform": "google"
        }

# ════════════════════════════════════════════════════════════
# 8. INSIGHTS + STATUS — Meta ke saath consistent shape mein wrap
#    (sync_platform_stats router mein generic dicts ke liye use hote hain)
# ════════════════════════════════════════════════════════════
def get_google_campaign_insights(campaign_id: str) -> dict:
    """
    get_campaign_status() already ek hi query mein status + metrics
    laata hai — bas yahan sirf metrics wala hissa Meta jaisi shape
    (impressions, clicks, spend, reach) mein return karo.
    """
    data = get_campaign_status(campaign_id)
    return {
        "impressions": data.get("impressions", 0),
        "clicks":      data.get("clicks", 0),
        "spend":       data.get("cost", 0),
        "reach":       0,  # Google Search campaigns unique reach report nahi karte jaise Meta karta hai
    }


def get_google_campaign_status(campaign_id: str) -> dict:
    """
    Sirf status field chahiye router ke PLATFORM_STATUS_FETCHERS ke liye —
    Meta ke get_meta_campaign_status() jaisi hi shape.
    """
    data = get_campaign_status(campaign_id)
    return {"campaign_id": campaign_id, "status": data.get("status")}    


# ════════════════════════════════════════════════════════════
# 9. IMAGE EXTENSION — campaign ke saath image dikhane ke liye
# ════════════════════════════════════════════════════════════
def upload_image_asset(image_url: str, asset_name: str) -> str:
    """
    Image URL se image download karke Google Ads mein "Asset" banata hai.
    Returns: asset resource name (jaise 'customers/123/assets/456')
    """
    client = get_google_ads_client()
    asset_service = client.get_service("AssetService")

    # ── Fix: agar base64 data-URI hai (user-uploaded image), pehle
    #    Cloudinary pe upload karke real URL banao, taaki requests.get()
    #    kaam kar sake — wo base64 handle nahi kar sakta ──
    if image_url.startswith("data:image"):
        from app.services.upload_to_cloudinary import upload_base64_to_cloudinary
        image_url = upload_base64_to_cloudinary(image_url)

    image_response = requests.get(image_url, timeout=15)
    image_response.raise_for_status()

    asset_operation = client.get_type("AssetOperation")
    asset = asset_operation.create
    asset.name = asset_name
    asset.type_ = client.enums.AssetTypeEnum.IMAGE
    asset.image_asset.data = image_response.content

    response = asset_service.mutate_assets(
        customer_id=CUSTOMER_ID,
        operations=[asset_operation]
    )
    return response.results[0].resource_name


def add_image_extension(campaign_resource: str, asset_resource: str):
    """
    Uploaded image asset ko campaign ke saath link karta hai —
    isse search results mein ad ke saath chhota image thumbnail dikhta hai.
    """
    client = get_google_ads_client()
    campaign_asset_service = client.get_service("CampaignAssetService")

    op = client.get_type("CampaignAssetOperation")
    ca = op.create
    ca.campaign = campaign_resource
    ca.asset = asset_resource
    ca.field_type = client.enums.AssetFieldTypeEnum.AD_IMAGE

    campaign_asset_service.mutate_campaign_assets(
        customer_id=CUSTOMER_ID,
        operations=[op]
    )

def delete_google_campaign(campaign_resource: str) -> dict:
    """Rollback: agar dusra platform fail ho jaaye to Google campaign remove karo."""
    try:
        client = get_google_ads_client()
        campaign_service = client.get_service("CampaignService")
        from google.protobuf import field_mask_pb2

        op = client.get_type("CampaignOperation")
        op.update.resource_name = campaign_resource
        op.update.status = client.enums.CampaignStatusEnum.REMOVED
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["status"]))

        campaign_service.mutate_campaigns(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except Exception as e:
        print(f"[rollback] Google campaign remove failed: {e}")
        return {"success": False, "error": str(e)}        

# ════════════════════════════════════════════════════════════
# 10. GOOGLE LEAD CONVERSION UPLOAD (NAYA)
# Jab koi lead form submit karta hai aur uske paas gclid ho,
# Google Ads ko batata hai "ye click convert hua" — isse Google
# ka Smart Bidding seekhta hai kaunsa click lead banata hai.
# Fails silently — form-submission kabhi iski wajah se fail
# nahi honi chahiye.
# ════════════════════════════════════════════════════════════
GOOGLE_CONVERSION_ACTION_ID = os.getenv("GOOGLE_CONVERSION_ACTION_ID")

def send_google_lead_conversion(gclid: str = None, conversion_time: str = None) -> dict:
    """
    gclid: URL se capture kiya gaya Google Click ID (?gclid=...)
    conversion_time: ISO format string, agar nahi diya to abhi ka time use hoga
    """
    if not gclid:
        print("[google_lead_conversion] gclid missing — skip kar rahe hain")
        return {"success": False, "error": "gclid missing"}

    if not GOOGLE_CONVERSION_ACTION_ID:
        print("[google_lead_conversion] GOOGLE_CONVERSION_ACTION_ID missing — skip kar rahe hain")
        return {"success": False, "error": "Conversion action not configured"}

    try:
        client = get_google_ads_client()
        conversion_upload_service = client.get_service("ConversionUploadService")

        click_conversion = client.get_type("ClickConversion")
        click_conversion.gclid = gclid
        click_conversion.conversion_action = (
            f"customers/{CUSTOMER_ID}/conversionActions/{GOOGLE_CONVERSION_ACTION_ID}"
        )

        if conversion_time:
            ct = conversion_time
        else:
            ct = datetime.now().strftime("%Y-%m-%d %H:%M:%S+05:30")
        click_conversion.conversion_date_time = ct

        request = client.get_type("UploadClickConversionsRequest")
        request.customer_id = CUSTOMER_ID
        request.conversions.append(click_conversion)
        request.partial_failure = True

        response = conversion_upload_service.upload_click_conversions(request=request)
        return {"success": True, "response": str(response)}

    except Exception as e:
        print(f"[google_lead_conversion] Failed: {e}")
        return {"success": False, "error": str(e)}    


# ════════════════════════════════════════════════════════════
# 11. GEO + GENDER INSIGHTS   ── ADDED IN VERSION A ONLY ──
# (Not present in Version B — kept here since it doesn't conflict
#  with anything Version B added.)
# ════════════════════════════════════════════════════════════
def get_google_campaign_geo_insights(campaign_id: str) -> list:
    """
    Google ka geographic_view report city-level data deta hai.
    City ka naam ek resource name ki form mein aata hai
    (e.g. 'geoTargetConstants/1023191') — usko resolve karna padta hai.
    """
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            segments.geo_target_city,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros
        FROM geographic_view
        WHERE campaign.id = {campaign_id}
          AND segments.geo_target_city IS NOT NULL
    """
    try:
        rows = list(ga_service.search(customer_id=CUSTOMER_ID, query=query))
    except GoogleAdsException as ex:
        print(f"[google_geo_insights] Query failed: {ex.error.code().name}")
        return []

    if not rows:
        return []

    resource_names = list({row.segments.geo_target_city for row in rows})
    quoted = ",".join(f"'{rn}'" for rn in resource_names)
    name_query = f"""
        SELECT geo_target_constant.resource_name, geo_target_constant.name
        FROM geo_target_constant
        WHERE geo_target_constant.resource_name IN ({quoted})
    """
    name_map = {}
    try:
        for row in ga_service.search(customer_id=CUSTOMER_ID, query=name_query):
            name_map[row.geo_target_constant.resource_name] = row.geo_target_constant.name
    except GoogleAdsException as ex:
        print(f"[google_geo_insights] Name resolve failed: {ex.error.code().name}")

    results = []
    for row in rows:
        rn = row.segments.geo_target_city
        results.append({
            "place":        name_map.get(rn, rn),
            "impressions":  row.metrics.impressions,
            "clicks":       row.metrics.clicks,
            "budget_spent": row.metrics.cost_micros / 1_000_000,
        })
    return results

def get_google_campaign_gender_insights(campaign_id: str) -> dict:
    """
    Google Ads ka gender_view resource use karta hai. Search campaigns
    mein agar demographics observation/targeting off hai to data sparse
    ya empty aa sakta hai — ye normal hai, code fir bhi safe rahega.
    Google gender values: MALE, FEMALE, UNDETERMINED
    Returns: {"male": {...}, "female": {...}, "unknown": {...}}
    """
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            ad_group_criterion.gender.type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros
        FROM gender_view
        WHERE campaign.id = {campaign_id}
    """

    GENDER_MAP = {
        "MALE": "male",
        "FEMALE": "female",
        "UNDETERMINED": "unknown",
    }

    result = {"male": {"impressions": 0, "clicks": 0, "spend": 0},
              "female": {"impressions": 0, "clicks": 0, "spend": 0},
              "unknown": {"impressions": 0, "clicks": 0, "spend": 0}}

    try:
        rows = ga_service.search(customer_id=CUSTOMER_ID, query=query)
        for row in rows:
            raw_gender = row.ad_group_criterion.gender.type.name
            key = GENDER_MAP.get(raw_gender, "unknown")
            result[key]["impressions"] += row.metrics.impressions
            result[key]["clicks"]      += row.metrics.clicks
            result[key]["spend"]       += row.metrics.cost_micros / 1_000_000
    except GoogleAdsException as ex:
        print(f"[google_gender_insights] Query failed: {ex.error.code().name}")
    except Exception as e:
        print(f"[google_gender_insights] Failed: {e}")

    return result    


# ════════════════════════════════════════════════════════════
# 12. CAMPAIGN MANAGE / EDIT TOOLKIT   ── ADDED IN VERSION B ONLY ──
# (Not present in Version A — kept here since it doesn't conflict
#  with anything Version A added.)
# ════════════════════════════════════════════════════════════

# ── 12.1 Update campaign name ──
def update_google_campaign_name(google_campaign_id: str, new_name: str) -> dict:
    """
    Existing live campaign ka naam update karta hai — real Google Ads mutate call.
    campaign_resource format: customers/{customer_id}/campaigns/{campaign_id}
    """
    try:
        client = get_google_ads_client()
        campaign_service = client.get_service("CampaignService")
        from google.protobuf import field_mask_pb2

        campaign_resource = f"customers/{CUSTOMER_ID}/campaigns/{google_campaign_id}"

        op = client.get_type("CampaignOperation")
        op.update.resource_name = campaign_resource
        op.update.name = new_name
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["name"]))

        campaign_service.mutate_campaigns(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 12.2 Update keywords (business_niche edit ke liye) ──
def get_existing_keywords(ad_group_resource: str) -> dict:
    """
    Returns { keyword_text: criterion_resource_name } for currently
    active (non-removed) keywords in this ad group.
    """
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    ad_group_id = ad_group_resource.split("/")[-1]

    query = f"""
        SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
               ad_group_criterion.resource_name, ad_group_criterion.status
        FROM ad_group_criterion
        WHERE ad_group_criterion.ad_group = '{ad_group_resource}'
          AND ad_group_criterion.type = KEYWORD
          AND ad_group_criterion.status != 'REMOVED'
    """
    result = {}
    try:
        response = ga_service.search(customer_id=CUSTOMER_ID, query=query)
        for row in response:
            result[row.ad_group_criterion.keyword.text.lower()] = row.ad_group_criterion.resource_name
    except GoogleAdsException as ex:
        print(f"[get_existing_keywords] error: {ex.error.code().name}")
    return result


def update_google_keywords(ad_group_resource: str, new_keywords: list) -> dict:
    """
    new_keywords = ["business loan", "machinery loan", ...] (updated business_niche se aaya)
    Diff karta hai existing vs new — jo naye hain unhe add karta hai,
    jo hata diye gaye hain unhe remove karta hai. Yeh sab ek hi
    mutate_ad_group_criteria call mein batch ho sakta hai.
    """
    client = get_google_ads_client()
    criterion_service = client.get_service("AdGroupCriterionService")

    existing = get_existing_keywords(ad_group_resource)   # { text_lower: resource_name }
    new_set = {kw.strip().lower() for kw in new_keywords if kw.strip()}
    existing_set = set(existing.keys())

    to_add    = new_set - existing_set
    to_remove = existing_set - new_set

    operations = []

    for kw_text in to_add:
        op = client.get_type("AdGroupCriterionOperation")
        crit = op.create
        crit.ad_group = ad_group_resource
        crit.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        crit.keyword.text = kw_text
        crit.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        operations.append(op)

    for kw_text in to_remove:
        op = client.get_type("AdGroupCriterionOperation")
        op.remove = existing[kw_text]
        operations.append(op)

    if not operations:
        return {"success": True, "added": [], "removed": []}

    try:
        criterion_service.mutate_ad_group_criteria(
            customer_id=CUSTOMER_ID,
            operations=operations
        )
        return {"success": True, "added": list(to_add), "removed": list(to_remove)}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}    

# ── 12.3 Update campaign budget ──
def get_campaign_budget_resource(google_campaign_id: str) -> str:
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    query = f"SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = {google_campaign_id}"
    for row in ga_service.search(customer_id=CUSTOMER_ID, query=query):
        return row.campaign.campaign_budget
    return None

def update_google_campaign_budget(google_campaign_id: str, new_daily_budget: float) -> dict:
    try:
        client = get_google_ads_client()
        budget_resource = get_campaign_budget_resource(google_campaign_id)
        if not budget_resource:
            return {"success": False, "error": "Budget resource not found"}

        from google.protobuf import field_mask_pb2
        budget_service = client.get_service("CampaignBudgetService")
        op = client.get_type("CampaignBudgetOperation")
        op.update.resource_name = budget_resource
        op.update.amount_micros = int(max(new_daily_budget, 1.0) * 1_000_000)
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["amount_micros"]))

        budget_service.mutate_campaign_budgets(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 12.4 Update campaign status (active/paused) ──
def update_google_campaign_status(google_campaign_id: str, status: str) -> dict:
    """status = 'active' | 'paused'"""
    try:
        client = get_google_ads_client()
        from google.protobuf import field_mask_pb2
        campaign_service = client.get_service("CampaignService")
        campaign_resource = f"customers/{CUSTOMER_ID}/campaigns/{google_campaign_id}"

        status_enum = client.enums.CampaignStatusEnum.ENABLED if status == "active" else client.enums.CampaignStatusEnum.PAUSED

        op = client.get_type("CampaignOperation")
        op.update.resource_name = campaign_resource
        op.update.status = status_enum
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["status"]))

        campaign_service.mutate_campaigns(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 12.5 Update campaign end date ──
def update_google_campaign_end_date(google_campaign_id: str, new_end_date: str) -> dict:
    try:
        client = get_google_ads_client()
        from google.protobuf import field_mask_pb2
        campaign_service = client.get_service("CampaignService")
        campaign_resource = f"customers/{CUSTOMER_ID}/campaigns/{google_campaign_id}"

        end = datetime.strptime(new_end_date, "%Y-%m-%d")
        op = client.get_type("CampaignOperation")
        op.update.resource_name = campaign_resource
        op.update.end_date_time = end.strftime("%Y-%m-%d 23:59:59")
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["end_date_time"]))

        campaign_service.mutate_campaigns(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}    

# ── 12.6 Update location targeting (remove old proximity + add new) ──
def get_existing_location_criteria(campaign_resource: str) -> list:
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT campaign_criterion.resource_name
        FROM campaign_criterion
        WHERE campaign_criterion.campaign = '{campaign_resource}'
          AND campaign_criterion.type = PROXIMITY
          AND campaign_criterion.negative = FALSE
    """
    resources = []
    try:
        for row in ga_service.search(customer_id=CUSTOMER_ID, query=query):
            resources.append(row.campaign_criterion.resource_name)
    except GoogleAdsException as ex:
        print(f"[get_existing_location_criteria] {ex.error.code().name}")
    return resources


def update_google_location_targeting(google_campaign_id: str, locations: list, radius_km: float) -> dict:
    try:
        client = get_google_ads_client()
        campaign_resource = f"customers/{CUSTOMER_ID}/campaigns/{google_campaign_id}"
        criterion_service = client.get_service("CampaignCriterionService")

        operations = []
        for r in get_existing_location_criteria(campaign_resource):
            op = client.get_type("CampaignCriterionOperation")
            op.remove = r
            operations.append(op)

        for loc in locations:
            if loc.get("lat") is None or loc.get("lng") is None:
                continue
            op = client.get_type("CampaignCriterionOperation")
            crit = op.create
            crit.campaign = campaign_resource
            crit.proximity.radius = radius_km
            crit.proximity.radius_units = client.enums.ProximityRadiusUnitsEnum.KILOMETERS
            crit.proximity.geo_point.latitude_in_micro_degrees  = int(loc["lat"] * 1_000_000)
            crit.proximity.geo_point.longitude_in_micro_degrees = int(loc["lng"] * 1_000_000)
            operations.append(op)

        if operations:
            criterion_service.mutate_campaign_criteria(customer_id=CUSTOMER_ID, operations=operations)
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 12.7 Update age targeting (remove old age-range criteria + add new) ──
def get_existing_age_criteria(ad_group_resource: str) -> list:
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT ad_group_criterion.resource_name
        FROM ad_group_criterion
        WHERE ad_group_criterion.ad_group = '{ad_group_resource}'
          AND ad_group_criterion.type = AGE_RANGE
    """
    resources = []
    try:
        for row in ga_service.search(customer_id=CUSTOMER_ID, query=query):
            resources.append(row.ad_group_criterion.resource_name)
    except GoogleAdsException as ex:
        print(f"[get_existing_age_criteria] {ex.error.code().name}")
    return resources


def update_google_age_targeting(ad_group_resource: str, age_min: int, age_max: int) -> dict:
    try:
        client = get_google_ads_client()
        criterion_service = client.get_service("AdGroupCriterionService")

        operations = []
        for r in get_existing_age_criteria(ad_group_resource):
            op = client.get_type("AdGroupCriterionOperation")
            op.remove = r
            operations.append(op)

        age_ranges = []
        if age_min <= 24: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_18_24)
        if age_min <= 34 and age_max >= 25: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_25_34)
        if age_min <= 44 and age_max >= 35: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_35_44)
        if age_min <= 54 and age_max >= 45: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_45_54)
        if age_min <= 64 and age_max >= 55: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_55_64)
        if age_max >= 65: age_ranges.append(client.enums.AgeRangeTypeEnum.AGE_RANGE_65_UP)

        for age_range in age_ranges:
            op = client.get_type("AdGroupCriterionOperation")
            crit = op.create
            crit.ad_group = ad_group_resource
            crit.age_range.type_ = age_range
            operations.append(op)

        if operations:
            criterion_service.mutate_ad_group_criteria(customer_id=CUSTOMER_ID, operations=operations)
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 12.8 Update ad content: pause old ad, create new RSA (creative immutable hai) ──
def pause_google_ad(ad_group_resource: str, ad_id: str) -> dict:
    try:
        client = get_google_ads_client()
        from google.protobuf import field_mask_pb2
        ad_group_id = ad_group_resource.split("/")[-1]
        ad_resource = f"customers/{CUSTOMER_ID}/adGroupAds/{ad_group_id}~{ad_id}"

        ad_service = client.get_service("AdGroupAdService")
        op = client.get_type("AdGroupAdOperation")
        op.update.resource_name = ad_resource
        op.update.status = client.enums.AdGroupAdStatusEnum.PAUSED
        op.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["status"]))

        ad_service.mutate_ad_group_ads(customer_id=CUSTOMER_ID, operations=[op])
        return {"success": True}
    except GoogleAdsException as ex:
        return {"success": False, "error": ex.error.code().name}


def replace_google_ad_content(ad_group_resource: str, old_ad_id: str, new_ad_content_data: dict) -> dict:
    """
    Google ad creative immutable — purana ad pause karo, naya RSA banao
    same ad group mein. Returns naya ad_id — DB mein update karna zaroori.
    """
    pause_result = pause_google_ad(ad_group_resource, old_ad_id)
    if not pause_result.get("success"):
        return pause_result
    try:
        new_ad_result = create_responsive_search_ad(ad_group_resource, new_ad_content_data)
        return {"success": True, "new_ad_id": new_ad_result["ad_id"]}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_google_campaign_age_insights(campaign_id: str) -> dict:
    """
    Google ka age_range_view. Returns: {"25-34": {"impressions": .., "clicks": ..}, ...}
    """
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            ad_group_criterion.age_range.type,
            metrics.impressions,
            metrics.clicks
        FROM age_range_view
        WHERE campaign.id = {campaign_id}
    """

    AGE_MAP = {
        "AGE_RANGE_18_24": "18-24",
        "AGE_RANGE_25_34": "25-34",
        "AGE_RANGE_35_44": "35-44",
        "AGE_RANGE_45_54": "45-54",
        "AGE_RANGE_55_64": "55-64",
        "AGE_RANGE_65_UP": "65+",
        "AGE_RANGE_UNDETERMINED": "Undetermined",
    }

    result = {}
    try:
        for row in ga_service.search(customer_id=CUSTOMER_ID, query=query):
            key = AGE_MAP.get(row.ad_group_criterion.age_range.type_.name, "Undetermined")
            slot = result.setdefault(key, {"impressions": 0, "clicks": 0})
            slot["impressions"] += row.metrics.impressions
            slot["clicks"]      += row.metrics.clicks
    except GoogleAdsException as ex:
        print(f"[google_age_insights] Query failed: {ex.error.code().name}")
    except Exception as e:
        print(f"[google_age_insights] Failed: {e}")
    return result