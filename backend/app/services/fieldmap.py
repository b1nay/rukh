"""Fields as trees on a map: what each field holds, what is allocated, and how much land a request needs.

Existing fields: allocated trees are the share of this year's sellable growth already sold.
Planting land: allocated trees are slots reserved for new trees; the rest is still bare land.
"""

from dataclasses import dataclass
from math import ceil, cos, pi, sin

from sqlalchemy.orm import Session

from app.data.districts import DISTRICT_CENTROIDS, NEPAL_CENTER
from app.models import Field
from app.services.allocation import Capacity, Pick, field_capacity
from app.services.inventory import sellable_tonnes as field_sellable_tonnes
from app.services.sequestration import NEW_TREE_LIFETIME_TONNES, PLANTING_DENSITY_PER_HA, sellable_tonnes


@dataclass
class TreeCounts:
    total: int
    allocated: int

    @property
    def free(self) -> int:
        return max(0, self.total - self.allocated)


def tonnes_per_tree(field: Field) -> float:
    """Tonnes one tree covers: a year of sellable growth (Protect) or a new tree's lifetime (Plant)."""
    if field.kind == "planting":
        return NEW_TREE_LIFETIME_TONNES
    return field_sellable_tonnes(field) / field.tree_count if field.tree_count else 0.0


def trees_per_ha(field: Field) -> float:
    return field.tree_count / field.area_ha if field.area_ha > 0 else PLANTING_DENSITY_PER_HA


def tree_counts(field: Field, cap: Capacity) -> TreeCounts:
    if field.kind == "planting":
        return TreeCounts(field.tree_count, min(field.tree_count, int(cap.allocated)))
    share = cap.allocated / cap.total if cap.total > 0 else 0
    return TreeCounts(field.tree_count, min(field.tree_count, round(field.tree_count * share)))


def position(field: Field) -> tuple[float, float, bool]:
    """(lat, lon, approximate). Fields without GPS sit near their district HQ, spread so they don't overlap."""
    if field.latitude is not None and field.longitude is not None:
        return field.latitude, field.longitude, False
    lat, lon = DISTRICT_CENTROIDS.get(field.district, NEPAL_CENTER)
    angle = field.id * 2.399963  # golden angle, so neighbours spread evenly
    r = 0.012 * (1 + (field.id % 5))
    return round(lat + r * sin(angle), 5), round(lon + r * cos(angle) / cos(lat * pi / 180), 5), True


def pick_trees(pick: Pick) -> int:
    return pick.trees if pick.field.kind == "planting" else ceil(pick.tonnes / tonnes_per_tree(pick.field) - 1e-9)


def requirement(impact_type: str, plan: list[Pick], shortfall: float) -> tuple[int, float]:
    """Trees and hectares a request needs: the suggested fields, plus a new-planting estimate for any shortfall."""
    trees = sum(pick_trees(p) for p in plan)
    area = sum(pick_trees(p) / trees_per_ha(p.field) for p in plan)
    if shortfall > 0:
        if impact_type == "plant":
            extra = ceil(shortfall / NEW_TREE_LIFETIME_TONNES)
        else:  # a typical mature native tree: 15 kg a year, less the buffer
            extra = ceil(shortfall / sellable_tonnes("other", 1, 20))
        trees += extra
        area += extra / PLANTING_DENSITY_PER_HA
    return trees, round(area, 2)


def field_state(db: Session, field: Field, year: int) -> tuple[Capacity, TreeCounts]:
    cap = field_capacity(db, field, year)
    return cap, tree_counts(field, cap)
