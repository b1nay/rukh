"""Solana network settings and the treasury wallet."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.deps import DB, Admin
from app.services import solana

router = APIRouter(tags=["solana"])


class SolanaConfig(BaseModel):
    cluster: str
    rpc_url: str
    treasury: str | None  # receives Climate Partner payments


class TreasuryIn(BaseModel):
    address: str


@router.get("/solana/config", response_model=SolanaConfig)
def config(db: DB) -> SolanaConfig:
    return SolanaConfig(cluster=settings.solana_cluster, rpc_url=settings.solana_rpc_url, treasury=solana.treasury(db))


@router.put("/admin/solana/treasury", response_model=SolanaConfig)
def set_treasury(payload: TreasuryIn, user: Admin, db: DB) -> SolanaConfig:
    address = payload.address.strip()
    if not solana.is_address(address):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That isn't a Solana wallet address")
    solana.set_treasury(db, address)
    db.commit()
    return config(db)
