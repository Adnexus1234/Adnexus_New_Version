# ============================================================
# backend/app/services/place_stats_service.py
# Google (city-level, exact) + Meta (state-level, needs split)
# ka data combine karke, sirf USER-SELECTED places ke rows banata hai.
# Koi fake/guessed number nahi — agar kisi state ka Meta data hamare
# paas ratio banane ke liye Google data hi nahi hai, us state ka Meta
# hissa skip kar diya jaata hai (add hi nahi hota) — split ya guess
# nahi karte.
# ============================================================

from app.services.google_ads_service import get_google_campaign_geo_insights
from app.services.meta_ads_service import get_meta_campaign_place_insights


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def _match_google_place(google_place_name: str, candidate_names) -> str:
    """
    Google kabhi-kabhi 'Meerut, Uttar Pradesh, India' jaisa poora naam
    deta hai — humein sirf city naam se match karna hai.
    """
    g = _normalize(google_place_name)
    for name in candidate_names:
        if _normalize(name) in g:
            return name
    return None


def get_campaign_place_stats(campaign, location_details: list) -> list:
    """
    location_details: [{"name": "Varanasi", "state": "Uttar Pradesh", "lat":.., "lng":..}, ...]
    (campaign create karte waqt jo cities select ki thi, wahi)

    Returns: [{"place": "Varanasi", "impressions":.., "clicks":.., "budget_spent":..}, ...]
    — sirf in hi selected places ke liye, aur koi extra row nahi.
    """
    if not location_details:
        return []

    place_map = {
        loc["name"]: {
            "place":        loc["name"],
            "state":        loc.get("state", ""),
            "impressions":  0,
            "clicks":       0,
            "budget_spent": 0,
        }
        for loc in location_details
    }

    # ── Step 1: Google — exact city match, real data ──
    if getattr(campaign, "google_campaign_id", None):
        try:
            google_rows = get_google_campaign_geo_insights(campaign.google_campaign_id)
        except Exception as e:
            print(f"[place_stats] Google fetch failed: {e}")
            google_rows = []

        for row in google_rows:
            matched = _match_google_place(row["place"], place_map.keys())
            if matched:
                place_map[matched]["impressions"]  += row["impressions"]
                place_map[matched]["clicks"]       += row["clicks"]
                place_map[matched]["budget_spent"] += row["budget_spent"]

    # ── Step 2: Meta — state-level, attribute/split using Google's real ratio ──
    if getattr(campaign, "meta_campaign_id", None):
        try:
            meta_rows = get_meta_campaign_place_insights(campaign.meta_campaign_id)
        except Exception as e:
            print(f"[place_stats] Meta fetch failed: {e}")
            meta_rows = []

        for row in meta_rows:
            state_name = row["place"]
            cities_in_state = [
                loc["name"] for loc in location_details
                if _normalize(loc.get("state", "")) == _normalize(state_name)
            ]
            if not cities_in_state:
                continue  # is state ka koi selected city nahi — is Meta row ko skip karo

            if len(cities_in_state) == 1:
                # Sirf ek hi selected city us state mein — poora attribute karo, exact hai
                city = cities_in_state[0]
                place_map[city]["impressions"]  += row["impressions"]
                place_map[city]["clicks"]       += row["clicks"]
                place_map[city]["budget_spent"] += row["budget_spent"]
            else:
                # 2+ cities same state mein — Google ke REAL ratio se split karo
                total_google_impr = sum(place_map[c]["impressions"] for c in cities_in_state)
                if total_google_impr > 0:
                    for city in cities_in_state:
                        ratio = place_map[city]["impressions"] / total_google_impr
                        place_map[city]["impressions"]  += round(row["impressions"] * ratio)
                        place_map[city]["clicks"]       += round(row["clicks"] * ratio)
                        place_map[city]["budget_spent"] += round(row["budget_spent"] * ratio, 2)
                else:
                    # Google ka koi ratio-base hi nahi hai — guess nahi karenge,
                    # is state ka Meta data yahan skip ho jaayega
                    print(f"[place_stats] Skipping Meta split for {state_name} — no Google ratio data available")

    return list(place_map.values())
