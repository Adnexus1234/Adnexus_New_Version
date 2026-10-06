# ════════════════════════════════════════════════════
# app/routes/notifications.py
#
# User ke apne notifications (targeted + broadcast dono)
# dekhne, unread count, aur read-mark karne ke routes.
# ════════════════════════════════════════════════════
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import get_db
from app.models.models import User, Notification, NotificationRead
from app.core.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dismissed_ids = {
        r.notification_id
        for r in db.query(NotificationRead.notification_id).filter(
            NotificationRead.user_id == current_user.id,
            NotificationRead.dismissed_at.isnot(None),
        ).all()
    }

    notifs = (
        db.query(Notification)
        .filter(or_(Notification.user_id == current_user.id, Notification.user_id.is_(None)))
        .filter(~Notification.id.in_(dismissed_ids) if dismissed_ids else True)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    read_ids = {
        r.notification_id
        for r in db.query(NotificationRead.notification_id).filter(
            NotificationRead.user_id == current_user.id
        ).all()
    }

    return {
        "notifications": [
            {
                "id": n.id, "title": n.title, "message": n.message,
                "type": n.type, "created_at": n.created_at,
                "is_read": n.id in read_ids,
            }
            for n in notifs
        ]
    }

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dismissed_ids_subq = db.query(NotificationRead.notification_id).filter(
        NotificationRead.user_id == current_user.id,
        NotificationRead.dismissed_at.isnot(None),
    )
    read_ids_subq = db.query(NotificationRead.notification_id).filter(
        NotificationRead.user_id == current_user.id
    )
    count = (
        db.query(Notification)
        .filter(or_(Notification.user_id == current_user.id, Notification.user_id.is_(None)))
        .filter(~Notification.id.in_(dismissed_ids_subq))
        .filter(~Notification.id.in_(read_ids_subq))
        .count()
    )
    return {"count": count}
# ════════════════════════════════════════════════════
# PATCH /api/notifications/{notification_id}/read
# Ek notification ko read mark karo (row insert, agar already nahi hai)
# ════════════════════════════════════════════════════
@router.patch("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(NotificationRead).filter(
        NotificationRead.user_id == current_user.id,
        NotificationRead.notification_id == notification_id,
    ).first()

    if not existing:
        db.add(NotificationRead(user_id=current_user.id, notification_id=notification_id))
        db.commit()

    return {"status": "ok"}


# ════════════════════════════════════════════════════
# PATCH /api/notifications/read-all
# Saare unread (targeted + broadcast) ek saath read mark
# ════════════════════════════════════════════════════
@router.patch("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    read_ids_subq = db.query(NotificationRead.notification_id).filter(
        NotificationRead.user_id == current_user.id
    )
    unread_ids = [
        row[0]
        for row in db.query(Notification.id)
        .filter(or_(Notification.user_id == current_user.id, Notification.user_id.is_(None)))
        .filter(~Notification.id.in_(read_ids_subq))
        .all()
    ]

    for nid in unread_ids:
        db.add(NotificationRead(user_id=current_user.id, notification_id=nid))
    db.commit()

    return {"status": "ok", "marked_count": len(unread_ids)}

# ════════════════════════════════════════════════════
# DELETE /api/notifications/{notification_id}
# User apni list se ek notification hata sakta hai (sirf khud ke liye —
# broadcast wale doosre users ko dikhte rehte hain)
# ════════════════════════════════════════════════════
@router.delete("/{notification_id}")
def dismiss_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(NotificationRead).filter(
        NotificationRead.user_id == current_user.id,
        NotificationRead.notification_id == notification_id,
    ).first()

    if existing:
        existing.dismissed_at = func.now()
        if not existing.read_at:
            existing.read_at = func.now()
    else:
        db.add(NotificationRead(
            user_id=current_user.id,
            notification_id=notification_id,
            dismissed_at=func.now(),
        ))

    db.commit()
    return {"status": "ok"}