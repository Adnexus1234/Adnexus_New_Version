from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import DesignTemplate, UserDesign, User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["designs"])


# ════════════════════════════════════════════════════
# PYDANTIC MODELS
# ════════════════════════════════════════════════════
class UserDesignCreateRequest(BaseModel):
    template_id:      int
    heading_text:     str
    subheading_text:  str
    business_name:    str
    cta_text:         str
    logo_url:         Optional[str] = None
    theme_bg_color:   str
    theme_text_color: str
    final_image_url:  Optional[str] = None


# ════════════════════════════════════════════════════
# 1. GET TEMPLATES (optionally filtered by industry)
# ════════════════════════════════════════════════════
@router.get("/templates")
def get_templates(industry: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DesignTemplate)
    if industry:
        query = query.filter(DesignTemplate.industry == industry)
    templates = query.all()
    return [{
        "id":                    t.id,
        "industry":              t.industry,
        "name":                  t.name,
        "background_image_url":  t.background_image_url,
        "heading_default":       t.heading_default,
        "subheading_default":    t.subheading_default,
        "cta_default":           t.cta_default,
        "theme_bg_color":        t.theme_bg_color,
        "theme_text_color":      t.theme_text_color,
        "image_width":           t.image_width,
        "image_height":          t.image_height,
    } for t in templates]


# ════════════════════════════════════════════════════
# 2. GET SINGLE TEMPLATE
# ════════════════════════════════════════════════════
@router.get("/templates/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(DesignTemplate).filter(DesignTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id":                    t.id,
        "industry":              t.industry,
        "name":                  t.name,
        "background_image_url":  t.background_image_url,
        "heading_default":       t.heading_default,
        "subheading_default":    t.subheading_default,
        "cta_default":           t.cta_default,
        "theme_bg_color":        t.theme_bg_color,
        "theme_text_color":      t.theme_text_color,
        "image_width":           t.image_width,
        "image_height":          t.image_height,
    }


# ════════════════════════════════════════════════════
# 3. POST SAVE USER DESIGN (only for logged-in user)
# ════════════════════════════════════════════════════
@router.post("/designs")
def save_user_design(req: UserDesignCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.query(DesignTemplate).filter(DesignTemplate.id == req.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    design = UserDesign(
        user_id          = current_user.id,
        template_id      = req.template_id,
        heading_text     = req.heading_text,
        subheading_text  = req.subheading_text,
        business_name    = req.business_name,
        cta_text         = req.cta_text,
        logo_url         = req.logo_url,
        theme_bg_color   = req.theme_bg_color,
        theme_text_color = req.theme_text_color,
        final_image_url  = req.final_image_url,
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    return {"message": "Design saved", "id": design.id}


# ════════════════════════════════════════════════════
# 4. GET USER'S SAVED DESIGNS (only own)
# ════════════════════════════════════════════════════
@router.get("/designs")
def get_user_designs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    designs = db.query(UserDesign).filter(UserDesign.user_id == current_user.id).all()
    return [{
        "id":              d.id,
        "template_id":     d.template_id,
        "heading_text":    d.heading_text,
        "subheading_text": d.subheading_text,
        "business_name":   d.business_name,
        "cta_text":        d.cta_text,
        "logo_url":        d.logo_url,
        "final_image_url": d.final_image_url,
        "created_at":      str(d.created_at) if d.created_at else "",
    } for d in designs]