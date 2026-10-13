"""Solana payments: addresses, amounts and on-chain verification.

Clients pay invoices and the superadmin pays landowners from their own wallets in
the browser. The browser sends the transaction; the API only checks it on chain
through JSON-RPC before marking anything paid. No private key lives on the server.

Every payment carries a memo naming what it pays (see `invoice_memo`,
`payout_memo`), so a transaction can't be reused for another bill.
"""

import hashlib
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.catalog import fmt_sol
from app.core.config import settings
from app.models import PlatformSetting

LAMPORTS_PER_SOL = 1_000_000_000
TREASURY_KEY = "solana_treasury"

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


class PaymentError(Exception):
    """The transaction doesn't prove the payment. The message is shown to the user."""


def b58decode(s: str) -> bytes:
    n = 0
    for ch in s:
        i = _B58.find(ch)
        if i < 0:
            raise ValueError(f"invalid base58 character {ch!r}")
        n = n * 58 + i
    body = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    return b"\0" * (len(s) - len(s.lstrip("1"))) + body


def b58encode(raw: bytes) -> str:
    n = int.from_bytes(raw, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    return "1" * (len(raw) - len(raw.lstrip(b"\0"))) + out


def is_address(s: str) -> bool:
    try:
        return 32 <= len(s) <= 44 and len(b58decode(s)) == 32
    except ValueError:
        return False


def is_signature(s: str | None) -> bool:
    try:
        return bool(s) and 64 <= len(s) <= 88 and len(b58decode(s)) == 64
    except ValueError:
        return False


def demo_address(seed: str) -> str:
    """A stable, valid address for demo accounts. Nobody holds its key."""
    return b58encode(hashlib.sha256(f"rukh-demo:{seed}".encode()).digest())


def lamports(amount_sol: float) -> int:
    return round(amount_sol * LAMPORTS_PER_SOL)


def invoice_memo(number: str) -> str:
    return f"Rukh invoice {number}"


def payout_memo(numbers: list[str]) -> str:
    return "Rukh payouts " + " ".join(sorted(numbers))


def treasury(db: Session) -> str | None:
    row = db.get(PlatformSetting, TREASURY_KEY)
    return (row.value if row else None) or settings.solana_treasury


def set_treasury(db: Session, address: str) -> None:
    row = db.get(PlatformSetting, TREASURY_KEY)
    if row is None:
        db.add(PlatformSetting(key=TREASURY_KEY, value=address))
    else:
        row.value = address


@dataclass
class Proof:
    signature: str
    payer: str
    slot: int
    block_time: datetime | None


def _rpc(method: str, params: list) -> dict | None:
    try:
        for attempt in range(4):
            res = httpx.post(
                settings.solana_rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                timeout=15,
            )
            # The public endpoints rate-limit hard; a dedicated RPC URL avoids this.
            if res.status_code != 429 or attempt == 3:
                break
            time.sleep(min(float(res.headers.get("retry-after") or 2), 5))
        if res.status_code == 429:
            raise PaymentError("The Solana RPC is rate-limiting requests. Try again in a few seconds.")
        res.raise_for_status()
        body = res.json()
    except (httpx.HTTPError, ValueError):
        raise PaymentError("Couldn't reach the Solana network. Try again in a moment.") from None
    if body.get("error"):
        raise PaymentError(f"Solana RPC error: {body['error'].get('message', 'unknown')}")
    return body.get("result")


def _fetch_transaction(signature: str) -> dict:
    # The wallet waits for confirmation, but the RPC node we ask may lag a few slots behind.
    for attempt in range(6):
        tx = _rpc("getTransaction", [signature, {
            "encoding": "jsonParsed", "commitment": "confirmed", "maxSupportedTransactionVersion": 1,
        }])
        if tx:
            return tx
        time.sleep(min(1 + attempt, 3))
    raise PaymentError("This transaction isn't confirmed on Solana yet. Wait a few seconds and try again.")


def verify_payment(signature: str, transfers: dict[str, int], memo: str) -> Proof:
    """Check that `signature` is a successful transaction that sends at least
    `transfers[address]` lamports to each address and carries exactly `memo`."""
    if not is_signature(signature):
        raise PaymentError("That isn't a Solana transaction signature")
    tx = _fetch_transaction(signature)
    if (tx.get("meta") or {}).get("err") is not None:
        raise PaymentError("This transaction failed on chain")

    message = tx["transaction"]["message"]
    received: dict[str, int] = {}
    memos: list[str] = []
    for ix in message.get("instructions", []):
        parsed = ix.get("parsed")
        if ix.get("program") == "system" and isinstance(parsed, dict) and parsed.get("type") == "transfer":
            info = parsed["info"]
            received[info["destination"]] = received.get(info["destination"], 0) + int(info["lamports"])
        elif ix.get("program") == "spl-memo" and isinstance(parsed, str):
            memos.append(parsed)

    if memo not in memos:
        raise PaymentError(f'The transaction memo must be "{memo}"')
    for address, amount in transfers.items():
        if received.get(address, 0) < amount:
            got = received.get(address, 0) / LAMPORTS_PER_SOL
            raise PaymentError(
                f"Expected {fmt_sol(amount / LAMPORTS_PER_SOL)} to {address[:4]}…{address[-4:]}, "
                f"the transaction sends {fmt_sol(got)}"
            )

    keys = message.get("accountKeys", [])
    payer = keys[0]["pubkey"] if keys and isinstance(keys[0], dict) else (keys[0] if keys else "")
    block_time = datetime.fromtimestamp(tx["blockTime"], timezone.utc) if tx.get("blockTime") else None
    return Proof(signature=signature, payer=payer, slot=tx.get("slot", 0), block_time=block_time)
