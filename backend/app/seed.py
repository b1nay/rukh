"""Starter itineraries (always) and optional demo data (RUKH_SEED_DEMO_DATA=true, see app/demo.py)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.data.itinerary_templates import TEMPLATES
from app.demo import build
from app.models import Itinerary, User
from app.services.itinerary import price_legs


def seed_admin(db: Session, email: str, password: str) -> None:
    if db.scalar(select(User).where(User.email == email.lower()).limit(1)):
        return
    db.add(User(
        id=str(uuid.uuid4()), side="admin", category="superadmin", status="active",
        display_name="Rukh Admin", full_name="Rukh Admin", email=email.lower(),
        password_hash=hash_password(password), profile={},
    ))
    db.commit()


def seed_templates(db: Session) -> None:
    if db.scalar(select(Itinerary).where(Itinerary.owner_id.is_(None)).limit(1)):
        return
    for t in TEMPLATES:
        legs, per_person = price_legs(t["legs"])
        db.add(Itinerary(
            owner_id=None, name=t["name"], kind=t["kind"], days=t["days"],
            description=t["description"], legs=legs, kg_per_person=per_person,
        ))
    db.commit()


def seed(db: Session) -> None:
    """Load the demo platform (app/demo.py) into an empty database."""
    build(db)
