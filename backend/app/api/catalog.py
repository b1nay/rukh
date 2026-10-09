from fastapi import APIRouter

from app.catalog import BUFFER_SHARE, CATEGORIES, IMPACT_TYPES, LANDOWNER_SHARE, PLANS

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("")
def get_catalog() -> dict:
    return {
        "categories": CATEGORIES,
        "impact_types": IMPACT_TYPES,
        "plans": PLANS,
        "landowner_share": LANDOWNER_SHARE,
        "buffer_share": BUFFER_SHARE,
    }
