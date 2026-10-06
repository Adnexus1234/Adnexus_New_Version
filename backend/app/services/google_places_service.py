# backend/app/services/google_places_service.py
# Google Places API (New) — Autocomplete + Place Details
# Isi key ka use hota hai jo Google Maps/Places ke liye already setup hai.
# CONSOLE mein "Places API (New)" enable hona chahiye (purani Places API se alag hai).

import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Agar aapki existing key ka env var naam kuch aur hai, ise us naam se replace kar dena
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")

AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
DETAILS_URL_BASE = "https://places.googleapis.com/v1/places"


def autocomplete_places(query: str, country: str = "in") -> list:
    """
    query = "Delh"
    Returns: [{"place_id": "...", "description": "Delhi, India"}, ...]
    """
    if not GOOGLE_PLACES_API_KEY:
        raise Exception("GOOGLE_PLACES_API_KEY configured nahi hai (.env check karo)")

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    }
    body = {
        "input": query,
        "includedRegionCodes": [country],
        # ── Sirf city-level results chahiye, poori address nahi ──
        "includedPrimaryTypes": ["locality", "administrative_area_level_3"],
    }

    resp = requests.post(AUTOCOMPLETE_URL, json=body, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    results = []
    for s in data.get("suggestions", []):
        pred = s.get("placePrediction")
        if not pred:
            continue
        results.append({
            "place_id":    pred.get("placeId"),
            "description": pred.get("text", {}).get("text", ""),
        })
    return results


def get_place_details(place_id: str) -> dict:
    """
    place_id se lat/lng + state nikaalta hai — ye Google/Meta dono ke
    proximity/custom_location targeting ke liye required hain.
    Returns: {"name", "lat", "lng", "state", "formatted_address"}
    """
    if not GOOGLE_PLACES_API_KEY:
        raise Exception("GOOGLE_PLACES_API_KEY configured nahi hai (.env check karo)")

    headers = {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "location,displayName,formattedAddress,addressComponents",
    }
    url = f"{DETAILS_URL_BASE}/{place_id}"
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    location = data.get("location", {})
    name = data.get("displayName", {}).get("text", "")

    state = ""
    for comp in data.get("addressComponents", []):
        if "administrative_area_level_1" in comp.get("types", []):
            state = comp.get("longText", "")
            break

    return {
        "name": name,
        "lat":  location.get("latitude"),
        "lng":  location.get("longitude"),
        "state": state,
        "formatted_address": data.get("formattedAddress", ""),
    }