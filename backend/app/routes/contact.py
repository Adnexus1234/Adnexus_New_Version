from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Campaign, ClickTracking
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ── Public landing page — ad click hone par yahan aata hai.
#    Koi login/auth nahi chahiye — koi bhi visitor dekh sake. ──
@router.get("/{campaign_id}", response_class=HTMLResponse)
def contact_landing_page(campaign_id: int, platform: str = "", utm_source: str = "", db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign or not campaign.contact_method or not campaign.contact_value:
        raise HTTPException(status_code=404, detail="Page not found")

    method = campaign.contact_method
    value  = campaign.contact_value
    company = campaign.company_name or campaign.name
    resolved_platform = platform or utm_source or "direct"

    if method == "call":
        action_href  = f"tel:{value}"
        button_label = f"📞 Call {value}"
    elif method == "email":
        action_href  = f"mailto:{value}"
        button_label = f"✉️ Email {value}"
    elif method == "whatsapp":
        digits = "".join(ch for ch in value if ch.isdigit())
        action_href  = f"https://wa.me/{digits}"
        button_label = "💬 Chat on WhatsApp"
    else:
        raise HTTPException(status_code=404, detail="Page not found")

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{company}</title>
      <style>
        body {{ font-family:'DM Sans',Arial,sans-serif; background:#f0f2f8; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }}
        .card {{ background:#fff; border-radius:20px; padding:40px 32px; text-align:center; box-shadow:0 8px 32px rgba(26,26,46,0.12); max-width:360px; }}
        h1 {{ font-size:20px; color:#1a1a2e; margin-bottom:8px; }}
        p {{ font-size:13px; color:#8892b0; margin-bottom:24px; }}
        a.btn {{ display:inline-block; padding:16px 32px; border-radius:14px; background:#1A73E8; color:#fff; font-size:16px; font-weight:700; text-decoration:none; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>{company}</h1>
        <p>Tap below to get in touch with us directly</p>
        <a class="btn" id="actionBtn" href="{action_href}">{button_label}</a>
      </div>
      <script>
        document.getElementById('actionBtn').addEventListener('click', function() {{
          try {{
            fetch('/api/contact/{campaign_id}/track', {{
              method: 'POST',
              headers: {{ 'Content-Type': 'application/json' }},
              body: JSON.stringify({{ platform: '{resolved_platform}' }}),
              keepalive: true
            }});
          }} catch (e) {{}}
        }});
      </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# ── NAYA: click record karne ke liye — landing page ka button
#    dabate hi is endpoint ko ek beacon-style POST jaata hai ──
def detect_device(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        return "mobile"
    if "ipad" in ua or "tablet" in ua:
        return "tablet"
    return "desktop"


class TrackClickRequest(BaseModel):
    platform: Optional[str] = "direct"


@router.post("/{campaign_id}/track")
def track_contact_click(campaign_id: int, req: TrackClickRequest, request: Request, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    user_agent = request.headers.get("user-agent", "")
    click = ClickTracking(
        campaign_id = campaign_id,
        platform    = req.platform or "direct",
        city        = "",
        device      = detect_device(user_agent),
        utm_source  = req.platform or "direct",
    )
    db.add(click)
    db.commit()

    return JSONResponse({"success": True})