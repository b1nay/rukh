"""Commercial catalog: categories, impact types and plans.

Prices are launch placeholders and mirror frontend/src/lib/content.ts.
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
    "protect": {"name": "Protect", "price_per_tonne_usd": 18},
    "plant": {"name": "Plant", "price_per_tonne_usd": 34},
}

PLANS = {
    "starter": {"name": "Starter", "monthly_fee_usd": 0, "platform_fee_rate": 0.12},
    "operator": {"name": "Operator", "monthly_fee_usd": 79, "platform_fee_rate": 0.07},
    "institution": {"name": "Institution", "monthly_fee_usd": None, "platform_fee_rate": None},
}

LANDOWNER_SHARE = 0.60
BUFFER_SHARE = 0.15

USD_TO_NPR = 135.0
