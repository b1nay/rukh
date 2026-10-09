from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, User


def admin_ids(db: Session) -> list[str]:
    return list(db.scalars(select(User.id).where(User.side == "admin")))


def notify(
    db: Session, user_ids: Iterable[str], kind: str, title: str, body: str | None = None, link: str | None = None
) -> None:
    """Queue notifications; the caller commits."""
    for uid in dict.fromkeys(user_ids):  # de-duplicate, keep order
        db.add(Notification(user_id=uid, kind=kind, title=title, body=body, link=link))
