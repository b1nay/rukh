"""A field's tree inventory: the groups of trees on it and what they absorb.

Existing fields: the groups are the standing trees, so they set the yearly capacity
that can be sold. A field enrolled before groups existed is read as one group built
from its enrollment summary (species, tree count, average age) until it is edited.
Planting land: the groups are trees planted so far; capacity stays the reserved slots.
"""

from collections import Counter
from datetime import date

from app.catalog import BUFFER_SHARE
from app.models import Field, TreeGroup
from app.services.sequestration import TreeStand, stands_annual_tonnes


def group_age(g: TreeGroup, today: date | None = None) -> int:
    """Age from the planting date when known, so it keeps up with time; otherwise as entered."""
    if g.planted_on:
        today = today or date.today()
        return max(0, today.year - g.planted_on.year - ((today.month, today.day) < (g.planted_on.month, g.planted_on.day)))
    return g.age_years


def stand(g: TreeGroup) -> TreeStand:
    return TreeStand(g.species, g.count, group_age(g), g.height_m, g.dbh_cm)


def summary_group(field: Field) -> TreeGroup:
    """The enrollment summary as an (unsaved) group."""
    return TreeGroup(field_id=field.id, species=field.species, count=field.tree_count, age_years=field.tree_age_years)


def groups(field: Field) -> list[TreeGroup]:
    if field.tree_groups or field.kind == "planting":
        return list(field.tree_groups)
    return [summary_group(field)]


def stands(field: Field) -> list[TreeStand]:
    return [stand(g) for g in groups(field)]


def sellable_tonnes(field: Field) -> float:
    """Yearly sellable growth of an existing field's trees, after the buffer."""
    return stands_annual_tonnes(stands(field)) * (1 - BUFFER_SHARE)


def planted_count(field: Field) -> int:
    return sum(g.count for g in field.tree_groups) if field.kind == "planting" else 0


def materialize(field: Field) -> None:
    """Save the enrollment summary as a real group before the first inventory edit."""
    if field.kind == "existing" and not field.tree_groups:
        field.tree_groups.append(summary_group(field))


def sync_summary(field: Field) -> None:
    """Keep the field's headline numbers (used by lists and the map) in step with its groups."""
    if field.kind != "existing" or not field.tree_groups:
        return
    total = sum(g.count for g in field.tree_groups)
    field.tree_count = total
    field.species = _by_species(field.tree_groups).most_common(1)[0][0]
    field.tree_age_years = round(sum(group_age(g) * g.count for g in field.tree_groups) / total)


def _by_species(gs: list[TreeGroup]) -> Counter:
    c: Counter = Counter()
    for g in gs:
        c[g.species] += g.count
    return c
