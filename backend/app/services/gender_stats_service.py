# ============================================================
# backend/app/services/gender_stats_service.py
# Campaign ke connected platforms ke hisaab se gender-wise
# breakdown fetch karta hai — sirf un platforms ke liye jo
# campaign par actually connected/launched hain.
# ============================================================

def get_campaign_gender_stats(campaign) -> dict:
    """
    Returns: {
        "meta":      {"male": {...}, "female": {...}, "unknown": {...}} | None,
        "instagram": {"male": {...}, "female": {...}, "unknown": {...}} | None,
        "google":    {"male": {...}, "female": {...}, "unknown": {...}} | None,
    }
    Sirf wahi keys honge jo campaign par connected hain (baaki None
    ya missing rahenge — frontend unhe skip kar dega).
    """
    result = {}

    # ── Meta / Instagram — dono same adset se ate hain ──
    if campaign.meta_adset_id:
        try:
            from app.services.meta_ads_service import get_meta_gender_insights
            meta_gender = get_meta_gender_insights(campaign.meta_adset_id)
            result["meta"]      = meta_gender.get("facebook") or {}
            result["instagram"] = meta_gender.get("instagram") or {}
        except Exception as e:
            print(f"[gender_stats] Meta fetch failed: {e}")
            result["meta"]      = {}
            result["instagram"] = {}

    # ── Google ──
    if campaign.google_campaign_id:
        try:
            from app.services.google_ads_service import get_google_campaign_gender_insights
            result["google"] = get_google_campaign_gender_insights(campaign.google_campaign_id)
        except Exception as e:
            print(f"[gender_stats] Google fetch failed: {e}")
            result["google"] = {}

    return result
