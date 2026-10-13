"""Commercial catalog: categories, impact types and plans.

Prices are in SOL, are launch placeholders and mirror frontend/src/lib/content.ts.
"""

from typing import Literal

Side = Literal["organization", "landowner"]

CATEGORIES: dict[str, Side] = {
    "tour_operator": "organization",
    "event_organizer": "organization",
    "ngo": "organization",
    "university": "organization",
    "hospitality": "organization",
    "individual": "organization",
    "farmer": "landowner",
    "community_forest": "landowner",
    "cooperative": "landowner",
}

WAITLIST_CATEGORIES = {"individual"}

IMPACT_TYPES = {
    "protect": {"name": "Protect", "price_per_tonne_sol": 0.1},
    "plant": {"name": "Plant", "price_per_tonne_sol": 0.19},
}

PLANS = {
    "starter": {"name": "Starter", "monthly_fee_sol": 0, "platform_fee_rate": 0.12},
    "operator": {"name": "Operator", "monthly_fee_sol": 0.45, "platform_fee_rate": 0.07},
    "institution": {"name": "Institution", "monthly_fee_sol": None, "platform_fee_rate": None},
}

LANDOWNER_SHARE = 0.60
BUFFER_SHARE = 0.15

# Amounts are rounded to this many decimals (1 = 1000 lamports at 6).
SOL_DECIMALS = 6


def sol(amount: float) -> float:
    """Round a SOL amount for storage and display."""
    return round(amount, SOL_DECIMALS)


def fmt_sol(amount: float) -> str:
    places = 4 if amount == 0 or abs(amount) >= 0.0001 else 9  # down to one lamport
    return f"{amount:,.{places}f}".rstrip("0").rstrip(".") + " SOL"
