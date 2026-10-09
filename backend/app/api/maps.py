"""Field maps for each role: every field (superadmin), your own fields (Land Partner),
and the fields holding your trees (Climate Partner)."""

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import DB, Admin, ClimatePartner, LandPartner
from app.models import Allocation, Field, Trip
from app.schemas.admin import FieldMap, MapField, MapTotals
from app.services.fieldmap import field_state, position, tonnes_per_tree
from app.services.sequestration import SPECIES

router = APIRouter(tags=["maps"])


def build_map(db: DB, fields: list[Field], mine: dict[int, int] | None = None) -> FieldMap:
    """Trees split into allocated (red), free (green) and bare land (yellow).

    With `mine` (field id -> trees), "allocated" means a Climate Partner's own trees instead.
    """
    year = datetime.now(timezone.utc).year
    out = []
    for f in fields:
        _, trees = field_state(db, f, year)
        allocated = trees.allocated if mine is None else min(trees.total, mine.get(f.id, 0))
        lat, lon, approx = position(f)
        out.append(MapField(
            id=f.id,
            name=f.name,
            landowner=f.owner.display_name,
            district=f.district,
            kind=f.kind,
            species_name=SPECIES[f.species]["name"],
            area_ha=f.area_ha,
            latitude=lat,
            longitude=lon,
            approximate=approx,
            trees_total=trees.total,
            trees_allocated=allocated,
            trees_free=max(0, trees.total - allocated),
            t_per_tree=tonnes_per_tree(f),
        ))
    return FieldMap(
        totals=MapTotals(
            fields=len(out),
            trees_free=sum(f.trees_free for f in out if f.kind == "existing"),
            trees_allocated=sum(f.trees_allocated for f in out),
            barren_slots=sum(f.trees_free for f in out if f.kind == "planting"),
            area_ha=round(sum(f.area_ha for f in out), 2),
        ),
        fields=out,
    )


@router.get("/admin/map", response_model=FieldMap)
def admin_map(user: Admin, db: DB) -> FieldMap:
    return build_map(db, list(db.scalars(select(Field).where(Field.status == "verified").order_by(Field.id))))


@router.get("/land/map", response_model=FieldMap)
def land_map(user: LandPartner, db: DB) -> FieldMap:
    return build_map(db, list(db.scalars(select(Field).where(Field.owner_id == user.id).order_by(Field.id))))


@router.get("/climate/map", response_model=FieldMap)
def climate_map(user: ClimatePartner, db: DB, trip_id: int | None = None) -> FieldMap:
    """Fields holding this partner's trees; red dots are the partner's own trees."""
    stmt = select(Allocation).join(Trip).where(Trip.owner_id == user.id)
    if trip_id is not None:
        trip = db.get(Trip, trip_id)
        if trip is None or trip.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
        stmt = stmt.where(Allocation.trip_id == trip_id)
    mine: dict[int, int] = defaultdict(int)
    fields: dict[int, Field] = {}
    for a in db.scalars(stmt):
        mine[a.field_id] += a.trees or round(a.tonnes / tonnes_per_tree(a.field))
        fields[a.field_id] = a.field
    return build_map(db, sorted(fields.values(), key=lambda f: f.id), mine)
