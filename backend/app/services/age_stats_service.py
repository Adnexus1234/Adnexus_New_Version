# ============================================================
# backend/app/services/age_stats_service.py
#
# Campaign ke liye age-wise distribution — Google Ads + Meta (FB+IG)
# ka real data merge karke ek combined list deta hai.
# Ye function kabhi exception raise nahi karta — kisi platform ka
# call fail ho to baaki ka data phir bhi dikhta hai.
# ============================================================

AGE_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "Undetermined"]


def get_campaign_age_stats(campaign) -> dict:
    combined = {b: {"impressions": 0, "clicks": 0} for b in AGE_BUCKETS}
    sources = []

    # ── Google Ads ──
    if getattr(campaign, "google_campaign_id", None):
        try:
            from app.services.google_ads_service import get_google_campaign_age_insights
            google_data = get_google_campaign_age_insights(campaign.google_campaign_id)
            if google_data:
                for bucket, vals in google_data.items():
                    if bucket in combined:
                        combined[bucket]["impressions"] += vals.get("impressions", 0)
                        combined[bucket]["clicks"]      += vals.get("clicks", 0)
                sources.append("Google Ads")
        except Exception as e:
            print(f"[age_stats] Google failed: {e}")

    # ── Meta (Facebook + Instagram — single ad set, combined) ──
    if getattr(campaign, "meta_adset_id", None) or getattr(campaign, "meta_campaign_id", None):
        try:
            from app.services.meta_ads_service import get_meta_age_insights
            meta_data = get_meta_age_insights(
                adset_id=campaign.meta_adset_id,
                campaign_id=campaign.meta_campaign_id,
            )
            if meta_data:
                for bucket, vals in meta_data.items():
                    if bucket in combined:
                        combined[bucket]["impressions"] += vals.get("impressions", 0)
                        combined[bucket]["clicks"]      += vals.get("clicks", 0)
                sources.append("Meta")
        except Exception as e:
            print(f"[age_stats] Meta failed: {e}")

    buckets = [
        {
            "age_group":   b,
            "impressions": combined[b]["impressions"],
            "clicks":      combined[b]["clicks"],
        }
        for b in AGE_BUCKETS
    ]
    print(f"[age_stats] campaign={campaign.id} sources={sources} total_impr={sum(b['impressions'] for b in buckets)}")
    return {
        "buckets":           buckets,
        "total_impressions": sum(b["impressions"] for b in buckets),
        "total_clicks":      sum(b["clicks"] for b in buckets),
        "sources":           sources,
    }