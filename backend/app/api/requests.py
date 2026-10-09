"""Allocation requests (Climate Partner -> superadmin) and their correspondence."""

from datetime import date

from fastapi import APIRouter, HTTPException, status

from app.catalog import IMPACT_TYPES, PLANS
from app.deps import DB, ClimatePartner, CurrentUser
from app.models import AllocationRequest, Message, Trip, User
from app.schemas.requests import MessageIn, MessageOut, RequestIn, RequestOut
from app.services.allocation import EPSILON_T, remaining_tonnes
from app.services.notify import admin_ids, notify

router = APIRouter(tags=["allocation requests"])

OPEN = "pending"


def request_out(r: AllocationRequest) -> RequestOut:
    return RequestOut(
        id=r.id,
        trip_id=r.trip_id,
        trip_name=r.trip.name,
        requester=r.requester.display_name,
        impact_type=r.impact_type,
        year=r.year,
        tonnes=r.tonnes,
        price_per_tonne=r.price_per_tonne,
        subtotal_usd=r.subtotal_usd,
        fee_rate=r.fee_rate,
        fee_usd=r.fee_usd,
        total_usd=r.total_usd,
        status=r.status,
        note=r.note,
        admin_note=r.admin_note,
        allocated_tonnes=r.allocated_tonnes,
        messages=len(r.messages),
        created_at=r.created_at,
        decided_at=r.decided_at,
    )


def bill(user: User, impact_type: str, tonnes: float) -> dict:
    price = IMPACT_TYPES[impact_type]["price_per_tonne_usd"]
    fee_rate = PLANS.get(user.plan or "starter", PLANS["starter"])["platform_fee_rate"] or 0.0
    subtotal = round(tonnes * price, 2)
    fee = round(subtotal * fee_rate, 2)
    return {"price_per_tonne": price, "subtotal_usd": subtotal, "fee_rate": fee_rate, "fee_usd": fee, "total_usd": round(subtotal + fee, 2)}


@router.post("/climate/trips/{trip_id}/requests", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
def create_request(trip_id: int, payload: RequestIn, user: ClimatePartner, db: DB) -> RequestOut:
    trip = db.get(Trip, trip_id)
    if trip is None or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if any(r.status == OPEN for r in trip.requests):
        raise HTTPException(status.HTTP_409_CONFLICT, "This trip already has a request waiting for allocation")
    tonnes = round(remaining_tonnes(trip), 3)
    if tonnes < EPSILON_T:
        raise HTTPException(status.HTTP_409_CONFLICT, "This trip is already fully covered")

    req = AllocationRequest(
        trip_id=trip.id,
        requester_id=user.id,
        impact_type=payload.impact_type,
        year=date.today().year,
        tonnes=tonnes,
        note=payload.note,
        **bill(user, payload.impact_type, tonnes),
    )
    db.add(req)
    db.flush()
    notify(
        db,
        admin_ids(db),
        "request.new",
        f"New allocation request from {user.display_name}",
        f"{trip.name} · {tonnes:g} t {IMPACT_TYPES[payload.impact_type]['name']} · ${req.total_usd:,.2f}",
        f"/dashboard/requests/{req.id}",
    )
    db.commit()
    db.refresh(req)
    return request_out(req)


def _visible_request(db: DB, user: User, request_id: int) -> AllocationRequest:
    req = db.get(AllocationRequest, request_id)
    if req is None or (user.side != "admin" and req.requester_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return req


@router.post("/climate/requests/{request_id}/cancel", response_model=RequestOut)
def cancel_request(request_id: int, user: ClimatePartner, db: DB) -> RequestOut:
    req = _visible_request(db, user, request_id)
    if req.status != OPEN:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pending requests can be cancelled")
    req.status = "cancelled"
    notify(db, admin_ids(db), "request.cancelled", f"{user.display_name} cancelled a request", req.trip.name, f"/dashboard/requests/{req.id}")
    db.commit()
    return request_out(req)


def _message_out(m: Message, viewer: User) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender="Rukh" if m.sender.side == "admin" else m.sender.display_name,
        from_admin=m.sender.side == "admin",
        mine=m.sender_id == viewer.id,
        body=m.body,
        created_at=m.created_at,
    )


@router.get("/requests/{request_id}/messages", response_model=list[MessageOut])
def list_messages(request_id: int, user: CurrentUser, db: DB) -> list[MessageOut]:
    return [_message_out(m, user) for m in _visible_request(db, user, request_id).messages]


@router.post("/requests/{request_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(request_id: int, payload: MessageIn, user: CurrentUser, db: DB) -> MessageOut:
    req = _visible_request(db, user, request_id)
    msg = Message(request_id=req.id, sender_id=user.id, body=payload.body.strip())
    db.add(msg)
    preview = payload.body.strip()[:140]
    if user.side == "admin":
        notify(db, [req.requester_id], "message", f"Rukh replied about {req.trip.name}", preview, f"/dashboard/trips/{req.trip_id}#messages")
    else:
        notify(db, admin_ids(db), "message", f"Message from {user.display_name}", preview, f"/dashboard/requests/{req.id}#messages")
    db.commit()
    db.refresh(msg)
    return _message_out(msg, user)
