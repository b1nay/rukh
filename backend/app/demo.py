"""Demo dataset: three logins on a platform that already has a year of activity.

Logins (password rukh@123):
  Superadmin       superadmin@rukh.com
  Climate Partner  company@rukh.com   (Everest Horizon Treks)
  Land Partner     landowner@rukh.com (Sita Gurung, Kaski)

The supporting partners (more landowners and Climate Partners) use the same password
and log in by the phone or email listed below. Everything is created through the real
allocation, billing and payout services, so the numbers agree on every page. Dates are
relative to the day the data is built.

Build a fresh demo database:
  RUKH_DATABASE_URL=sqlite:///./demo.db python -m app.demo
"""

import random
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import fmt_sol
from app.api.requests import bill
from app.core.security import hash_password
from app.models import (
    AllocationRequest,
    Field,
    Invoice,
    Itinerary,
    Message,
    Notification,
    Payout,
    TreeGroup,
    Traveler,
    Trip,
    User,
)
from app.services import payouts as payout_service
from app.services.allocation import apply, remaining_tonnes, suggest
from app.services.billing import issue_for_request
from app.services.inventory import sync_summary
from app.services.itinerary import traveler_journey
from app.services.solana import demo_address
from app.services.sequestration import PLANTING_DENSITY_PER_HA

PASSWORD = "rukh@123"
ADMIN_EMAIL = "superadmin@rukh.com"
COMPANY_EMAIL = "company@rukh.com"
LANDOWNER_EMAIL = "landowner@rukh.com"


# --- Land Partners and their fields ---------------------------------------------

@dataclass
class Plot:
    name: str
    district: str
    area_ha: float
    lat: float
    lon: float
    # existing fields: (species, count, age, height_m, dbh_cm); planting land: species to plant
    groups: list[tuple] = field(default_factory=list)
    plant: str | None = None


@dataclass
class Land:
    full_name: str
    display_name: str
    category: str
    phone: str
    profile: dict
    plots: list[Plot]
    email: str | None = None


LANDS = [
    Land(
        "Sita Gurung", "Sita Gurung", "farmer", "9800000001",
        {"district": "Kaski", "municipality": "Pokhara Metropolitan City", "land_area": 64, "land_unit": "Ropani",
         "existing_trees": 1240, "open_to_planting": "Yes", "species": ["Utis (Alnus nepalensis)", "Fruit trees", "Bamboo"]},
        [
            Plot("Upper terrace utis grove", "Kaski", 2.0, 28.2712, 83.9705,
                 [("utis", 520, 14, 16.0, 24.0), ("utis", 280, 6, None, None)]),
            Plot("Orange orchard", "Kaski", 1.2, 28.2655, 83.9832, [("fruit", 260, 11, 5.5, 14.0)]),
            Plot("Bamboo belt by the khola", "Kaski", 0.6, 28.2589, 83.9641, [("bamboo", 180, 8, None, None)]),
            Plot("Lower terrace (new planting)", "Kaski", 1.5, 28.2618, 83.9598, plant="utis"),
        ],
        email=LANDOWNER_EMAIL,
    ),
    Land(
        "Hari Thapa", "Bhumlichowk Community Forest", "community_forest", "9800000002",
        {"cfug_name": "Bhumlichowk Community Forest", "registration_no": "CFUG-GOR-0412", "district": "Gorkha",
         "area_ha": 120, "households": 310, "species": ["Sal (Shorea robusta)", "Chilaune (Schima wallichii)"]},
        [
            Plot("Sal forest block A", "Gorkha", 60.0, 27.9812, 84.6221, [("sal", 16000, 28, 22.0, 38.0), ("sal", 8000, 15, None, None)]),
            Plot("Degraded slope restoration", "Gorkha", 10.0, 27.9935, 84.6012, plant="chilaune"),
        ],
    ),
    Land(
        "Maya Rai", "Ilam Tea Growers Cooperative", "cooperative", "9800000003",
        {"cooperative_name": "Ilam Tea Growers Cooperative", "registration_no": "COOP-ILM-2207", "district": "Ilam",
         "members": 140, "plots": 36, "crops": ["Tea", "Cardamom"]},
        [
            Plot("Tea garden shade trees", "Ilam", 15.0, 26.9105, 87.9268, [("utis", 3600, 9, 11.0, 17.0), ("chilaune", 1600, 12, None, None)]),
            Plot("Kanyam hillside planting", "Ilam", 3.0, 26.8662, 88.0703, plant="utis"),
        ],
    ),
    Land(
        "Ram Bahadur Thapa", "Ram Bahadur Thapa", "farmer", "9800000004",
        {"district": "Lamjung", "land_area": 18, "land_unit": "Ropani", "existing_trees": 220, "open_to_planting": "Maybe"},
        [Plot("Besisahar field-edge trees", "Lamjung", 0.8, 28.2311, 84.3794, [("chilaune", 220, 18, 14.0, 22.0)])],
    ),
    Land(
        "Laxmi Tamang", "Laxmi Tamang", "farmer", "9800000005",
        {"district": "Nuwakot", "land_area": 22, "land_unit": "Ropani", "existing_trees": 300, "open_to_planting": "Yes"},
        [Plot("Bidur sisau rows", "Nuwakot", 1.0, 27.9201, 85.1588, [("sisau", 300, 10, None, None)])],
    ),
    Land(
        "Bishnu Chaudhary", "Sauraha Buffer Zone Community Forest", "community_forest", "9800000006",
        {"cfug_name": "Sauraha Buffer Zone Community Forest", "district": "Chitwan", "area_ha": 85, "households": 540,
         "species": ["Sisau (Dalbergia sissoo)", "Sal (Shorea robusta)"]},
        [
            Plot("Rapti riverine forest", "Chitwan", 40.0, 27.5791, 84.4985, [("sisau", 6000, 20, 18.0, 30.0), ("sal", 3000, 26, None, None)]),
            Plot("Rapti floodplain planting", "Chitwan", 6.0, 27.6012, 84.4598, plant="sisau"),
        ],
    ),
    Land(
        "Pemba Sherpa", "Kalinchowk Community Forest", "community_forest", "9800000007",
        {"cfug_name": "Kalinchowk Community Forest", "district": "Dolakha", "area_ha": 40, "households": 190,
         "species": ["Khote salla (Pinus roxburghii)"]},
        [Plot("Charikot pine forest", "Dolakha", 25.0, 27.6789, 86.0402, [("khote_salla", 9000, 30, 20.0, 32.0)])],
    ),
    Land(
        "Sunita Shrestha", "Sunita Shrestha", "farmer", "9800000008",
        {"district": "Kavrepalanchok", "land_area": 9, "land_unit": "Ropani", "existing_trees": 150},
        [Plot("Dhulikhel fruit and utis plot", "Kavrepalanchok", 0.5, 27.6201, 85.5512, [("fruit", 90, 7, None, None), ("utis", 60, 12, None, None)])],
    ),
    Land(
        "Gopal Pandey", "Tansen Agroforestry Cooperative", "cooperative", "9800000009",
        {"cooperative_name": "Tansen Agroforestry Cooperative", "district": "Palpa", "members": 85, "plots": 22,
         "crops": ["Coffee", "Ginger"]},
        [
            Plot("Tansen agroforestry plots", "Palpa", 8.0, 27.8698, 83.5476, [("other", 2400, 15, None, None)]),
            Plot("Rampur slope planting", "Palpa", 4.0, 27.8512, 83.6011, plant="chilaune"),
        ],
    ),
    Land(
        "Kamala Oli", "Kamala Oli", "farmer", "9800000010",
        {"district": "Dang", "land_area": 4, "land_unit": "Bigha", "existing_trees": 900},
        [Plot("Ghorahi sal patch", "Dang", 3.0, 28.0532, 82.4887, [("sal", 900, 22, None, None)])],
    ),
    Land(
        "Dhan Bahadur Rana", "Mohana Community Forest", "community_forest", "9800000011",
        {"cfug_name": "Mohana Community Forest", "district": "Kailali", "area_ha": 70, "households": 420,
         "species": ["Sal (Shorea robusta)"]},
        [Plot("Mohana sal forest", "Kailali", 50.0, 28.7318, 80.6211, [("sal", 18000, 35, 25.0, 42.0)])],
    ),
    Land(
        "Tek Bahadur KC", "Tek Bahadur KC", "farmer", "9800000012",
        {"district": "Syangja", "land_area": 30, "land_unit": "Ropani", "existing_trees": 400},
        [Plot("Waling coffee shade trees", "Syangja", 1.5, 28.0621, 83.7702, [("other", 400, 9, None, None)])],
    ),
    Land(
        "Anita Lama", "Anita Lama", "farmer", "9800000013",
        {"district": "Makwanpur", "land_area": 40, "land_unit": "Ropani", "existing_trees": 600},
        [Plot("Hetauda bamboo grove", "Makwanpur", 2.0, 27.4295, 85.0322, [("bamboo", 600, 6, None, None)])],
    ),
    Land(
        "Nar Bahadur Limbu", "Hile Community Forest", "community_forest", "9800000014",
        {"cfug_name": "Hile Community Forest", "district": "Dhankuta", "area_ha": 30, "households": 160,
         "species": ["Chilaune (Schima wallichii)"]},
        [Plot("Hile chilaune forest", "Dhankuta", 12.0, 27.0312, 87.3188, [("chilaune", 4200, 24, None, None)])],
    ),
    Land(
        "Ang Dorje Sherpa", "Ang Dorje Sherpa", "farmer", "9800000015",
        {"district": "Solukhumbu", "land_area": 50, "land_unit": "Ropani", "existing_trees": 1800},
        [Plot("Salleri pine woodlot", "Solukhumbu", 6.0, 27.5032, 86.5841, [("khote_salla", 1800, 19, None, None)])],
    ),
    Land(
        "Bhim Pun", "Bhim Pun", "farmer", "9800000016",
        {"district": "Myagdi", "land_area": 26, "land_unit": "Ropani", "open_to_planting": "Yes"},
        [Plot("Beni terrace planting", "Myagdi", 2.0, 28.3502, 83.5688, plant="utis")],
    ),
]


# --- Climate Partners -----------------------------------------------------------

COMPANY = {
    "email": COMPANY_EMAIL, "category": "tour_operator", "plan": "operator",
    "display_name": "Everest Horizon Treks", "full_name": "Aarati Sharma",
    "profile": {"company_name": "Everest Horizon Treks", "country": "Nepal", "website": "https://everesthorizon.example.com",
                "travelers_per_year": 1200, "booking_system": "Our own website",
                "source_markets": ["United Kingdom", "United States", "Australia", "Germany"], "nepal_license_no": "TAAN-2081-1123"},
}

OTHER_PARTNERS = [
    {
        "key": "forum", "email": "events@himalayanclimateforum.example.com", "category": "event_organizer", "plan": "starter",
        "display_name": "Himalayan Climate Forum", "full_name": "Rojina Karki",
        "profile": {"organization_name": "Himalayan Climate Forum", "event_name": "Kathmandu Climate Summit 2026",
                    "event_start": "2026-11-16", "event_city": "Kathmandu", "expected_attendees": 450,
                    "who_pays": "Included in registration fee"},
    },
    {
        "key": "uni", "email": "fieldtrips@geos.example.ac.uk", "category": "university", "plan": "institution",
        "display_name": "University of Edinburgh · GeoSciences", "full_name": "Dr. Fiona MacLeod",
        "profile": {"institution_name": "University of Edinburgh", "department": "School of GeoSciences",
                    "country": "United Kingdom", "has_flight_levy": "Yes", "flights_per_year": 60},
    },
    {
        "key": "ngo", "email": "nepal@greenearth.example.org", "category": "ngo", "plan": "starter",
        "display_name": "Green Earth Nepal", "full_name": "Prakash Adhikari",
        "profile": {"organization_name": "Green Earth Nepal", "organization_type": "INGO", "staff_in_nepal": 35,
                    "flights_per_year": 80, "has_climate_policy": "Yes"},
    },
]

FIRST = ["Oliver", "Amelia", "Jack", "Isla", "Noah", "Ava", "Liam", "Mia", "Lucas", "Emma", "Leon", "Hannah", "Ethan",
         "Chloe", "Mason", "Sophie", "Lena", "Felix", "Grace", "Hugo", "Yuki", "Min-jun", "Priya", "Arjun", "Sara", "Tom"]
LAST = ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Müller", "Schmidt", "Dubois", "Martin", "Johnson", "Williams",
        "Kim", "Tanaka", "Patel", "Singh", "Rossi", "Jansen", "Nguyen", "O'Brien", "Walsh", "Fischer", "Clarke"]
NATIONALITY = {
    "LHR": "British", "MAN": "British", "EDI": "British", "FRA": "German", "MUC": "German", "AMS": "Dutch",
    "CDG": "French", "JFK": "American", "BOS": "American", "SYD": "Australian", "MEL": "Australian",
    "DEL": "Indian", "BOM": "Indian", "DXB": "Emirati", "DOH": "Qatari", "SIN": "Singaporean", "ICN": "South Korean",
    "NRT": "Japanese", "HKG": "Hong Konger", "BKK": "Thai", "KTM": "Nepali",
}

PAY_METHOD = "solana"


class Demo:
    def __init__(self, db: Session, today: date | None = None):
        self.db = db
        self.today = today or date.today()
        self.rng = random.Random(2026)
        self.year = self.today.year
        self.admins: list[str] = []

    # -- helpers --------------------------------------------------------------

    def at(self, days_ago: float, hour: int = 10) -> datetime:
        d = self.today - timedelta(days=int(days_ago))
        return datetime.combine(d, time(hour, self.rng.randint(0, 59)), timezone.utc)

    def reference(self) -> str:
        # Demo payments never touched the chain, so they carry no transaction signature.
        return f"DEMO-{self.rng.getrandbits(32):08X}"

    def note(self, user_ids, kind: str, title: str, body: str | None, link: str | None, when: datetime) -> None:
        read = (datetime.now(timezone.utc) - when).days > 6
        for uid in dict.fromkeys(user_ids):
            self.db.add(Notification(user_id=uid, kind=kind, title=title, body=body, link=link, created_at=when, read=read))

    def user(self, *, side, category, display_name, full_name, profile, email=None, phone=None, plan=None, joined=360) -> User:
        u = User(
            id=str(uuid.uuid4()), side=side, category=category, status="active", display_name=display_name,
            full_name=full_name, email=email, phone=phone, password_hash=hash_password(PASSWORD), plan=plan,
            profile=profile, created_at=self.at(joined),
        )
        self.db.add(u)
        return u

    # -- people and land ------------------------------------------------------

    def admin(self) -> None:
        existing = self.db.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if existing is None:
            existing = self.user(side="admin", category="superadmin", display_name="Rukh Admin", full_name="Rukh Admin",
                                 profile={}, email=ADMIN_EMAIL, joined=400)
        self.db.flush()
        self.admins = list(self.db.scalars(select(User.id).where(User.side == "admin")))

    def lands(self) -> None:
        self.landowner: User | None = None
        for i, land in enumerate(LANDS):
            joined = 350 - i * 12
            profile = {**land.profile, "solana_wallet": demo_address(land.phone)}
            u = self.user(side="landowner", category=land.category, display_name=land.display_name, full_name=land.full_name,
                          profile=profile, email=land.email, phone=land.phone, joined=joined)
            if land.email == LANDOWNER_EMAIL:
                self.landowner = u
            for j, p in enumerate(land.plots):
                f = Field(
                    owner_id=u.id, name=p.name, kind="planting" if p.plant else "existing", district=p.district,
                    area_ha=p.area_ha, species=p.plant or p.groups[0][0], tree_count=0, tree_age_years=0,
                    latitude=p.lat, longitude=p.lon, status="verified", created_at=self.at(joined - 2 - j * 5),
                )
                if p.plant:
                    f.tree_count = round(p.area_ha * PLANTING_DENSITY_PER_HA)
                else:
                    for species, count, age, height, dbh in p.groups:
                        f.tree_groups.append(TreeGroup(species=species, count=count, age_years=age, height_m=height,
                                                       dbh_cm=dbh, created_at=f.created_at, updated_at=f.created_at))
                    sync_summary(f)
                self.db.add(f)
        self.db.flush()

    # -- Climate Partners and trips -------------------------------------------

    def partners(self) -> None:
        c = COMPANY
        self.company = self.user(side="organization", category=c["category"], display_name=c["display_name"],
                                 full_name=c["full_name"], profile=c["profile"], email=c["email"], plan=c["plan"], joined=340)
        self.others = {
            p["key"]: self.user(side="organization", category=p["category"], display_name=p["display_name"],
                                full_name=p["full_name"], profile=p["profile"], email=p["email"], plan=p["plan"], joined=200 - i * 30)
            for i, p in enumerate(OTHER_PARTNERS)
        }
        self.db.flush()
        self.templates = {it.name: it for it in self.db.scalars(select(Itinerary).where(Itinerary.owner_id.is_(None)))}
        # the company's own variant of a starter itinerary
        base = self.templates["Annapurna Base Camp Trek"]
        self.custom = Itinerary(
            owner_id=self.company.id, name="Annapurna Sanctuary · Horizon Premium", kind="trek", days=base.days,
            description="Our signature ABC trek with private lodges and a Pokhara rest day.",
            legs=base.legs, kg_per_person=base.kg_per_person, created_at=self.at(300),
        )
        self.db.add(self.custom)
        self.db.flush()

    def trip(self, owner: User, itinerary: str | Itinerary, start_in: int, origins: list[tuple[str, int]], name: str | None = None) -> Trip:
        it = itinerary if isinstance(itinerary, Itinerary) else self.templates[itinerary]
        start = self.today + timedelta(days=start_in)
        trip = Trip(
            owner_id=owner.id, itinerary_id=it.id, name=name or f"{it.name} · {start:%b %Y}", kind=it.kind,
            start_date=start, pax=sum(n for _, n in origins), legs=it.legs, shared_kg_per_person=it.kg_per_person,
            created_at=self.at(max(1, -start_in + 45)),
        )
        for origin, count in origins:
            for _ in range(count):
                first, last = self.rng.choice(FIRST), self.rng.choice(LAST)
                cabin = "business" if self.rng.random() < 0.12 else "economy"
                j = traveler_journey(it.legs, origin, cabin, False)
                flight = j.kg if j else 0.0
                trip.travelers.append(Traveler(
                    name=f"{first} {last}", email=f"{first}.{last}{self.rng.randint(1, 99)}@example.com".lower().replace("'", ""),
                    nationality=NATIONALITY.get(origin), home_airport=origin, cabin=cabin, flight_kg=round(flight, 2),
                    journey=j.to_dict() if j else None, co2_kg=round(flight + it.kg_per_person, 2),
                ))
        trip.co2_kg = round(sum(t.co2_kg for t in trip.travelers), 2)
        self.db.add(trip)
        self.db.flush()
        return trip

    # -- request lifecycle ----------------------------------------------------

    def request(self, trip: Trip, impact: str, days_ago: float, note: str | None = None) -> AllocationRequest:
        owner = self.db.get(User, trip.owner_id)
        tonnes = round(remaining_tonnes(trip), 3)
        req = AllocationRequest(
            trip_id=trip.id, requester_id=owner.id, impact_type=impact, year=self.year, tonnes=tonnes, note=note,
            created_at=self.at(days_ago, 9), **bill(owner, impact, tonnes),
        )
        self.db.add(req)
        self.db.flush()
        self.note(self.admins, "request.new", f"New allocation request from {owner.display_name}",
                  f"{trip.name} · {tonnes:g} t {impact.title()} · {fmt_sol(req.total_sol)}", f"/dashboard/requests/{req.id}", req.created_at)
        return req

    def allocate(self, req: AllocationRequest, days_ago: float, share: float = 1.0, admin_note: str | None = None) -> tuple[Invoice, list[Payout]]:
        when = self.at(days_ago, 14)
        plan, _ = suggest(self.db, req.impact_type, req.tonnes * share, req.year)
        created = apply(self.db, req.trip, req.impact_type, req.year, plan, request_id=req.id)
        for a in created:
            a.created_at = when
        allocated = round(sum(a.tonnes for a in created), 3)
        req.allocated_tonnes = allocated
        req.status = "allocated" if allocated >= req.tonnes - 0.001 else "partial"
        req.admin_note = admin_note
        req.decided_at = when
        self.db.flush()
        inv = issue_for_request(self.db, req, created)
        inv.issued_at, inv.due_at = when, when + timedelta(days=14)
        self.db.flush()
        owed = payout_service.issue_for_request(self.db, req, created, inv)
        for p in owed:
            p.created_at = when

        owner = req.requester
        trees = sum(a.trees for a in created)
        self.note([owner.id], "request.allocated", f"Trees allocated for {req.trip.name}",
                  f"{allocated:g} t" + (f" · {trees} new trees" if trees else "") + f" · invoice {inv.number} {fmt_sol(inv.total_sol)}",
                  f"/dashboard/trips/{req.trip_id}", when)
        for a in created:
            self.note([a.field.owner_id], "field.funded", f"{owner.display_name} funded your trees",
                      f"{a.field.name}: " + (f"{a.trees} new trees" if a.trees else f"{a.tonnes:g} t protected"), "/dashboard/earnings", when)
        self.note(self.admins, "payout.new", f"{len(owed)} landowner payment{'s' if len(owed) != 1 else ''} to send",
                  f"{fmt_sol(sum(p.amount_sol for p in owed))} for {req.trip.name}", f"/dashboard/payouts?request={req.id}", when)
        return inv, owed

    def client_pays(self, inv: Invoice, days_ago: float, method: str = PAY_METHOD) -> None:
        inv.status = "paid"
        inv.paid_at = self.at(days_ago, 16)
        inv.payment_method = method
        inv.payment_reference = self.reference()
        self.note(self.admins, "invoice.paid", f"{inv.user.display_name} paid {inv.number}", f"{fmt_sol(inv.total_sol)}",
                  "/dashboard/invoices", inv.paid_at)

    def pay_landowners(self, owed: list[Payout], days_ago: float) -> None:
        for p in owed:
            p.status = "paid"
            p.paid_at = self.at(days_ago, 11)
            p.reference = self.reference()
            p.wallet = p.owner.profile.get("solana_wallet")
            self.note([p.owner_id], "payout.paid", f"Payment sent: {fmt_sol(p.amount_sol)}",
                      f"{p.number} on Solana", "/dashboard/payments", p.paid_at)

    def plant(self, owed: list[Payout], days_after: int) -> None:
        """Record new trees as planted on the land a Plant request reserved."""
        for p in owed:
            for line in p.lines:
                f = self.db.get(Field, line["field_id"])
                if f.kind != "planting":
                    continue
                planted = p.created_at.date() + timedelta(days=days_after)
                f.tree_groups.append(TreeGroup(
                    species=f.species, count=line["trees"], age_years=0, planted_on=planted,
                    note=f"Planted for {p.request.trip.name}" if p.request else None,
                    created_at=self.at((self.today - planted).days), updated_at=self.at((self.today - planted).days),
                ))

    def thread(self, req: AllocationRequest, lines: list[tuple[str, str, float]]) -> None:
        """lines: (who, body, days_ago) with who = 'client' or 'admin'."""
        admin_id = self.admins[0]
        for who, body, days_ago in lines:
            sender = admin_id if who == "admin" else req.requester_id
            when = self.at(days_ago, 12)
            self.db.add(Message(request_id=req.id, sender_id=sender, body=body, created_at=when))
            if who == "admin":
                self.note([req.requester_id], "message", f"Rukh replied about {req.trip.name}", body[:140],
                          f"/dashboard/trips/{req.trip_id}#messages", when)
            else:
                self.note(self.admins, "message", f"Message from {req.requester.display_name}", body[:140],
                          f"/dashboard/requests/{req.id}#messages", when)

    # -- the story --------------------------------------------------------------

    def activity(self) -> None:
        co, o = self.company, self.others

        # Everest Horizon Treks: a year of departures, each further along the pipeline
        t1 = self.trip(co, "Annapurna Base Camp Trek", -300, [("LHR", 6), ("MAN", 3), ("FRA", 2)])
        r = self.request(t1, "protect", 292)
        inv, owed = self.allocate(r, 290, admin_note="Smallholder groves in Kaski first.")
        self.client_pays(inv, 284)
        self.pay_landowners(owed, 280)

        t2 = self.trip(co, "Everest Base Camp Trek", -240, [("LHR", 8), ("AMS", 4)])
        r = self.request(t2, "plant", 233, note="Our spring group asked for new trees this time.")
        inv, owed = self.allocate(r, 230)
        self.client_pays(inv, 221)
        self.pay_landowners(owed, 218)
        self.plant(owed, 45)

        t3 = self.trip(co, "Kathmandu · Chitwan · Pokhara Tour", -180, [("SYD", 5), ("MEL", 4)])
        r = self.request(t3, "protect", 174)
        inv, owed = self.allocate(r, 172)
        self.client_pays(inv, 165)
        self.pay_landowners(owed, 160)

        t4 = self.trip(co, "Everest Base Camp Trek", -150, [("NRT", 3), ("ICN", 2)])
        r = self.request(t4, "plant", 146, note="Can we plant in Solukhumbu specifically?")
        r.status, r.decided_at = "rejected", self.at(143)
        r.admin_note = "No planting land in Solukhumbu yet. Please resend as Protect or let us choose the district."
        self.thread(r, [("client", "Can the trees be in Solukhumbu, on the trek route?", 145.5),
                        ("admin", "Not yet: our Solukhumbu partner only has standing pine. Protect would fund those trees.", 144)])
        self.note([co.id], "request.rejected", f"Request declined for {t4.name}", r.admin_note, f"/dashboard/trips/{t4.id}", r.decided_at)

        t5 = self.trip(co, "Langtang Valley Trek", -120, [("JFK", 4), ("BOS", 3), ("CDG", 2)])
        r = self.request(t5, "plant", 115)
        inv, owed = self.allocate(r, 112)
        self.client_pays(inv, 100)
        self.pay_landowners(owed, 96)
        self.plant(owed, 30)

        t6 = self.trip(co, self.custom, -75, [("LHR", 6), ("DEL", 2)])
        r = self.request(t6, "protect", 20)
        inv, owed = self.allocate(r, 10)  # invoice open, not yet due; landowners still to be paid

        t7 = self.trip(co, "Annapurna Base Camp Trek", -40, [("FRA", 5), ("MUC", 4)])
        r = self.request(t7, "protect", 33)
        inv, owed = self.allocate(r, 30, share=0.6, admin_note="Part allocated now; the rest after the next field survey.")
        self.client_pays(inv, 22)

        t8 = self.trip(co, "Everest Base Camp Trek", -18, [("DXB", 3), ("DOH", 2), ("SIN", 3)])
        r = self.request(t8, "protect", 6, note="Group back safely. Please cover the whole trip.")
        self.thread(r, [("client", "Could you include the Lukla flights in the allocation too?", 5.5),
                        ("admin", "They're already in the total: the domestic legs are counted per person.", 5),
                        ("client", "Perfect, thank you!", 4.8)])

        self.trip(co, "Langtang Valley Trek", 25, [("LHR", 5), ("ICN", 3)])
        self.trip(co, "Kathmandu · Chitwan · Pokhara Tour", 60, [("HKG", 4), ("BKK", 4), ("KTM", 2)])

        # other Climate Partners
        u1 = self.trip(o["uni"], "Langtang Valley Trek", -90, [("EDI", 10), ("LHR", 2)], name="Langtang glacier field course")
        r = self.request(u1, "plant", 64)
        self.allocate(r, 60)  # overdue: issued 60 days ago, unpaid

        n1 = self.trip(o["ngo"], "Annapurna Base Camp Trek", -50, [("DXB", 3), ("DEL", 3)], name="Annapurna watershed monitoring")
        r = self.request(n1, "protect", 45)
        inv, owed = self.allocate(r, 44)
        self.client_pays(inv, 30)
        self.pay_landowners(owed, 28)

        n2 = self.trip(o["ngo"], "Kathmandu · Chitwan · Pokhara Tour", -8, [("BOM", 4), ("DEL", 2)], name="Terai community visit")
        self.request(n2, "plant", 3)

        f1 = self.trip(o["forum"], "Kathmandu · Chitwan · Pokhara Tour", 39,
                       [("LHR", 6), ("JFK", 5), ("FRA", 4), ("SIN", 4), ("DEL", 6), ("SYD", 3)], name="Kathmandu Climate Summit 2026 · speakers")
        r = self.request(f1, "protect", 1, note="Speakers' travel for the summit. Happy to split across several forests.")
        self.thread(r, [("client", "Could the certificate name each forest? We'd like to show it on stage.", 0.6)])

    def build(self) -> None:
        self.admin()
        self.lands()
        self.partners()
        self.activity()
        self.db.commit()


def build(db: Session, today: date | None = None) -> bool:
    """Load the demo into an empty platform. Returns False if partner accounts already exist."""
    if db.scalar(select(User).where(User.side != "admin").limit(1)):
        return False
    Demo(db, today).build()
    return True


if __name__ == "__main__":
    from app.core.config import settings
    from app.db import Base, SessionLocal, engine
    from app.migrate import add_missing_columns
    from app.seed import seed_admin, seed_templates

    Base.metadata.create_all(engine)
    add_missing_columns(engine)
    with SessionLocal() as session:
        seed_admin(session, settings.admin_email, settings.admin_password)
        seed_templates(session)
        print("Demo data loaded." if build(session) else "Partner accounts already exist; demo data not loaded.")
