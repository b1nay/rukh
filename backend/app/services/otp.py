"""Dummy OTP for contact verification.

Nothing is actually sent: every code is settings.otp_dummy_code ("1234").
Swap `_deliver` for an SMS gateway (e.g. Sparrow SMS / Aakash SMS in Nepal)
or an email provider to go live; the rest of the flow stays the same.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import OtpChallenge

MAX_ATTEMPTS = 5


class OtpError(Exception):
    pass


def normalize(channel: str, destination: str) -> str:
    destination = destination.strip()
    return destination.lower() if channel == "email" else destination.replace(" ", "").replace("-", "")


def _deliver(channel: str, destination: str, code: str) -> None:
    # Dummy: no delivery. Real gateways plug in here.
    return None


def send(db: Session, channel: str, destination: str) -> OtpChallenge:
    dest = normalize(channel, destination)
    challenge = OtpChallenge(
        destination=dest,
        channel=channel,
        code=settings.otp_dummy_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.otp_ttl_minutes),
    )
    db.add(challenge)
    db.commit()
    _deliver(channel, dest, challenge.code)
    return challenge


def verify(db: Session, channel: str, destination: str, code: str) -> str:
    """Check the latest code for a destination; returns a one-use verification token."""
    dest = normalize(channel, destination)
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.destination == dest, OtpChallenge.channel == channel, OtpChallenge.used.is_(False))
        .order_by(OtpChallenge.id.desc())
    )
    if challenge is None:
        raise OtpError("Request a code first")
    if challenge.expires_at < datetime.now(timezone.utc):
        raise OtpError("This code has expired. Request a new one")
    if challenge.attempts >= MAX_ATTEMPTS:
        raise OtpError("Too many attempts. Request a new code")
    if code.strip() != challenge.code:
        challenge.attempts += 1
        db.commit()
        raise OtpError("Incorrect code")
    challenge.verified_token = challenge.verified_token or secrets.token_urlsafe(24)
    db.commit()
    return challenge.verified_token


def consume(db: Session, token: str, destination: str) -> bool:
    """Mark a verification token as used if it was issued for this destination."""
    challenge = db.scalar(select(OtpChallenge).where(OtpChallenge.verified_token == token))
    if challenge is None or challenge.used:
        return False
    if challenge.destination != normalize(challenge.channel, destination):
        return False
    challenge.used = True
    return True
