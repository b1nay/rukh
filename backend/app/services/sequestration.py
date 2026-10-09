"""Tree absorption model.

Per-species yearly CO2 uptake for a tree in its main growth phase, scaled by
age. Placeholder values to be replaced with Nepal DFRS allometric equations
and IPCC AFOLU defaults.

Carbon already stored in a tree comes from the Chave et al. (2014) pantropical
equation when trunk diameter and height are measured, otherwise from adding up
the yearly uptake over the tree's age.
"""

from dataclasses import dataclass

from app.catalog import BUFFER_SHARE

# kg CO2 per tree per year in the main growth phase.
# wood_density in g/cm3 (Global Wood Density Database); None where the trunk equation doesn't apply.
SPECIES: dict[str, dict] = {
    "utis": {"name": "Utis (Alnus nepalensis)", "kg_per_year": 25, "wood_density": 0.38},
    "sal": {"name": "Sal (Shorea robusta)", "kg_per_year": 18, "wood_density": 0.72},
    "khote_salla": {"name": "Khote salla (Pinus roxburghii)", "kg_per_year": 20, "wood_density": 0.49},
    "chilaune": {"name": "Chilaune (Schima wallichii)", "kg_per_year": 18, "wood_density": 0.58},
    "sisau": {"name": "Sisau (Dalbergia sissoo)", "kg_per_year": 22, "wood_density": 0.68},
    "bamboo": {"name": "Bamboo (per clump)", "kg_per_year": 30, "wood_density": None},
    "fruit": {"name": "Fruit trees", "kg_per_year": 10, "wood_density": 0.55},
    "tea": {"name": "Tea (Camellia sinensis)", "kg_per_year": 2, "wood_density": None},
    "other": {"name": "Other native trees", "kg_per_year": 15, "wood_density": 0.55},
}

ROOT_TO_SHOOT = 0.24  # IPCC default for tropical/subtropical forest
CARBON_FRACTION = 0.47  # IPCC default share of dry biomass that is carbon
CO2_PER_C = 44 / 12

# Tonnes CO2 one newly planted tree absorbs over a 30-year commitment.
NEW_TREE_LIFETIME_TONNES = 0.5
# New trees that fit on one hectare of planting land.
PLANTING_DENSITY_PER_HA = 400


def age_factor(age_years: int) -> float:
    """Young trees absorb less; growth slows after ~40 years."""
    if age_years < 8:
        return max(0.15, (age_years + 1) / 9)
    if age_years > 40:
        return 0.6
    return 1.0


def annual_tonnes(species: str, tree_count: int, age_years: int) -> float:
    """Gross yearly CO2 uptake of standing trees, in tonnes."""
    rate = SPECIES[species]["kg_per_year"]
    return tree_count * rate * age_factor(age_years) / 1000


def sellable_tonnes(species: str, tree_count: int, age_years: int) -> float:
    """Yearly uptake minus the non-permanence buffer."""
    return annual_tonnes(species, tree_count, age_years) * (1 - BUFFER_SHARE)


@dataclass
class TreeStand:
    """A group of trees of one species and roughly one size."""

    species: str
    count: int
    age_years: int
    height_m: float | None = None
    dbh_cm: float | None = None


def stored_kg_per_tree(stand: TreeStand) -> tuple[float, str]:
    """CO2 already held in one tree (above and below ground), and the method used."""
    density = SPECIES[stand.species]["wood_density"]
    if density and stand.dbh_cm and stand.height_m:
        agb = 0.0673 * (density * stand.dbh_cm**2 * stand.height_m) ** 0.976  # kg dry biomass
        return agb * (1 + ROOT_TO_SHOOT) * CARBON_FRACTION * CO2_PER_C, "measured"
    rate = SPECIES[stand.species]["kg_per_year"]
    return sum(rate * age_factor(a) for a in range(stand.age_years)), "age"


def stored_tonnes(stands: list[TreeStand]) -> float:
    return sum(s.count * stored_kg_per_tree(s)[0] for s in stands) / 1000


def stands_annual_tonnes(stands: list[TreeStand], years_ahead: int = 0) -> float:
    """Gross uptake of all stands in the year `years_ahead` from now."""
    return sum(annual_tonnes(s.species, s.count, s.age_years + years_ahead) for s in stands)


@dataclass
class ProjectionYear:
    year: int
    gross_t: float
    sellable_t: float
    cumulative_t: float


def project(stands: list[TreeStand], start_year: int, years: int) -> list[ProjectionYear]:
    """Year-by-year CO2 the stands absorb as they age, starting this year."""
    rows: list[ProjectionYear] = []
    cumulative = 0.0
    for i in range(years):
        gross = stands_annual_tonnes(stands, i)
        cumulative += gross
        rows.append(ProjectionYear(start_year + i, round(gross, 3), round(gross * (1 - BUFFER_SHARE), 3), round(cumulative, 3)))
    return rows
