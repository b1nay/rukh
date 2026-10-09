from fastapi import APIRouter
from sqlalchemy import func, select, update

from app.deps import DB, CurrentUser
from app.models import Notification
from app.schemas.requests import NotificationList, NotificationOut, ReadIn

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
def list_notifications(user: CurrentUser, db: DB) -> NotificationList:
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(30)
    ).all()
    unread = db.scalar(
        select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read.is_(False))
    )
    return NotificationList(unread=unread or 0, items=[NotificationOut.model_validate(n) for n in items])


@router.post("/read", response_model=NotificationList)
def mark_read(payload: ReadIn, user: CurrentUser, db: DB) -> NotificationList:
    stmt = update(Notification).where(Notification.user_id == user.id).values(read=True)
    if payload.ids is not None:
        stmt = stmt.where(Notification.id.in_(payload.ids))
    db.execute(stmt)
    db.commit()
    return list_notifications(user, db)
