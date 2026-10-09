from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, description="Email or mobile number")
    password: str


class UserOut(BaseModel):
    id: str
    side: Literal["organization", "landowner", "admin"]
    category: str
    status: str
    display_name: str
    full_name: str
    email: str | None
    phone: str | None
    plan: str | None
    profile: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class OtpSendRequest(BaseModel):
    channel: Literal["phone", "email"]
    destination: str = Field(min_length=5, max_length=254)


class OtpSendResponse(BaseModel):
    sent: bool
    channel: str
    destination: str
    expires_in_seconds: int
    demo_code: str | None = Field(default=None, description="Only returned while OTP is a dummy")


class OtpVerifyRequest(OtpSendRequest):
    code: str = Field(min_length=4, max_length=8)


class OtpVerifyResponse(BaseModel):
    otp_token: str
