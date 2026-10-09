from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuthToken, User

DB = Annotated[Session, Depends(get_db)]


def current_user(db: DB, authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    token = db.get(AuthToken, authorization[7:].strip())
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please sign in again")
    return token.user


CurrentUser = Annotated[User, Depends(current_user)]


def _require(side: str):
    def dep(user: CurrentUser) -> User:
        if user.side != side:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not available for your account type")
        return user

    return dep


ClimatePartner = Annotated[User, Depends(_require("organization"))]
Admin = Annotated[User, Depends(_require("admin"))]
LandPartner = Annotated[User, Depends(_require("landowner"))]
