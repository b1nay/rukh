import secrets
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.catalog import CATEGORIES, WAITLIST_CATEGORIES
from app.core.security import hash_password, verify_password
from app.deps import DB, CurrentUser
from app.models import AuthToken, User
from app.core.config import settings
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    UserOut,
)
from app.services import otp
from app.schemas.signup import SignupRequest

router = APIRouter(tags=["auth"])

_NAME_FIELDS = (
    "company_name", "event_name", "organization_name", "institution_name",
    "property_name", "cfug_name", "cooperative_name",
)


def _status(category: str, side: str) -> str:
    if category in WAITLIST_CATEGORIES:
        return "waitlisted"
    # Landowners stay pending until their first field is enrolled and verified.
    return "pending_verification" if side == "landowner" else "active"


def issue_token(db: DB, user: User) -> AuthResponse:
    token = AuthToken(token=secrets.token_urlsafe(32), user_id=user.id)
    db.add(token)
    db.commit()
    return AuthResponse(token=token.token, user=UserOut.model_validate(user))


@router.post("/auth/otp/send", response_model=OtpSendResponse)
def send_otp(payload: OtpSendRequest, db: DB) -> OtpSendResponse:
    challenge = otp.send(db, payload.channel, payload.destination)
    return OtpSendResponse(
        sent=True,
        channel=challenge.channel,
        destination=challenge.destination,
        expires_in_seconds=settings.otp_ttl_minutes * 60,
        demo_code=challenge.code,
    )


@router.post("/auth/otp/verify", response_model=OtpVerifyResponse)
def verify_otp(payload: OtpVerifyRequest, db: DB) -> OtpVerifyResponse:
    try:
        return OtpVerifyResponse(otp_token=otp.verify(db, payload.channel, payload.destination, payload.code))
    except otp.OtpError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DB) -> AuthResponse:
    side = CATEGORIES[payload.category]
    profile = payload.profile.model_dump(mode="json", exclude_none=True)
    email = payload.account.email.lower() if payload.account.email else None
    phone = payload.account.phone

    contact = []
    if email:
        contact.append(User.email == email)
    if phone:
        contact.append(User.phone == phone)
    if db.scalar(select(User).where(or_(*contact))):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email or phone already exists")

    primary = phone if side == "landowner" else email
    if not otp.consume(db, payload.otp_token, primary or ""):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verify your phone or email with the code we sent")

    user = User(
        id=str(uuid.uuid4()),
        side=side,
        category=payload.category,
        status=_status(payload.category, side),
        display_name=next((profile[f] for f in _NAME_FIELDS if f in profile), payload.account.full_name),
        full_name=payload.account.full_name,
        email=email,
        phone=phone,
        password_hash=hash_password(payload.account.password),
        plan=payload.plan,
        profile=profile,
    )
    db.add(user)
    db.commit()
    return issue_token(db, user)


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DB) -> AuthResponse:
    ident = payload.identifier.strip()
    user = db.scalar(select(User).where(or_(User.email == ident.lower(), User.phone == ident)))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email/phone or password")
    return issue_token(db, user)


@router.get("/auth/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser, db: DB) -> None:
    for t in db.scalars(select(AuthToken).where(AuthToken.user_id == user.id)):
        db.delete(t)
    db.commit()
