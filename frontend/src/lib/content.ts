// Static marketing content and placeholder commercial numbers.
// Prices and factors here are illustrative until the pricing and
// sequestration models in the backend are finalised.

export type Side = "organization" | "landowner";

export type Category = {
  id: string;
  side: Side;
  title: string;
  blurb: string;
  scale: string;
  fit: "Best fit" | "Good fit" | "Pilot" | "Coming soon";
};

export const ORGANIZATION_CATEGORIES: Category[] = [
  {
    id: "tour_operator",
    side: "organization",
    title: "Tour & trekking operator",
    blurb:
      "Your clients fly to Nepal. Fund trees on the trails they walk and show them on a map.",
    scale: "1.5–3 t CO₂ per traveler",
    fit: "Best fit",
  },
  {
    id: "event_organizer",
    side: "organization",
    title: "Conference & event",
    blurb:
      "Turn attendee travel into a verified, tree-level contribution that sponsors can point to.",
    scale: "1,000–5,000 t per event",
    fit: "Best fit",
  },
  {
    id: "ngo",
    side: "organization",
    title: "NGO, UN agency or embassy",
    blurb:
      "Account for staff and consultant flights while paying Nepali communities directly.",
    scale: "Hundreds to thousands of t / yr",
    fit: "Good fit",
  },
  {
    id: "university",
    side: "organization",
    title: "University or research group",
    blurb:
      "Spend your internal flight levy somewhere credible and auditable.",
    scale: "Varies with travel policy",
    fit: "Good fit",
  },
  {
    id: "hospitality",
    side: "organization",
    title: "Hotel or eco-lodge",
    blurb:
      "Cover generators, LPG and guest transfers, and give guests something real to see.",
    scale: "Tens to hundreds of t / yr",
    fit: "Pilot",
  },
  {
    id: "individual",
    side: "organization",
    title: "Individual traveler",
    blurb:
      "Fund trees in your home district or along your trek route, one trip at a time.",
    scale: "1–3 t per trip",
    fit: "Coming soon",
  },
];

export const LANDOWNER_CATEGORIES: Category[] = [
  {
    id: "farmer",
    side: "landowner",
    title: "Farmer or private landowner",
    blurb: "Trees on your own land, including shade trees in tea or cardamom.",
    scale: "Any size",
    fit: "Best fit",
  },
  {
    id: "community_forest",
    side: "landowner",
    title: "Community Forest User Group",
    blurb: "Enrol a community forest and share income across members.",
    scale: "Usually 10–1,000+ ha",
    fit: "Best fit",
  },
  {
    id: "cooperative",
    side: "landowner",
    title: "Cooperative or tea estate",
    blurb: "Register many plots at once and manage payouts for members.",
    scale: "Multiple plots",
    fit: "Good fit",
  },
];

export const ALL_CATEGORIES = [...ORGANIZATION_CATEGORIES, ...LANDOWNER_CATEGORIES];

// The two roles people sign up as. Internal ids stay "organization" and
// "landowner"; these are the names shown to users.
export const ROLES: Record<Side, { name: string; tagline: string; points: string[]; icon: string }> = {
  organization: {
    name: "Climate Partner",
    tagline: "I want to offset travel emissions",
    points: ["Measure flight CO₂ for your travelers", "Fund verified trees in Nepal", "Share tree maps and certificates"],
    icon: "🌍",
  },
  landowner: {
    name: "Land Partner",
    tagline: "I own trees or land in Nepal",
    points: ["Enrol your field or forest", "Get matched with Climate Partners", "Earn 60% of every tonne absorbed"],
    icon: "🌳",
  },
};

// Great-circle distance to Kathmandu (KTM), km.
export const ORIGINS = [
  { city: "London", km: 7359 },
  { city: "Frankfurt", km: 6773 },
  { city: "Paris", km: 7221 },
  { city: "New York", km: 12117 },
  { city: "Sydney", km: 9744 },
  { city: "Tokyo", km: 5214 },
  { city: "Delhi", km: 815 },
] as const;

export const FACTORS = {
  routingUplift: 1.08, // connections and non-direct routing
  longHaulKgPerPkm: 0.085, // economy, CO₂ only
  shortHaulKgPerPkm: 0.13,
  nonCo2Multiplier: 1.7, // contrails and NOx, optional
  treeKgPerYear: 20, // average growing tree
  treeLifetimeTonnes: 0.5, // one new tree protected for 30 years
};

export function roundTripTonnes(km: number, includeNonCo2: boolean) {
  const perPkm = km > 1500 ? FACTORS.longHaulKgPerPkm : FACTORS.shortHaulKgPerPkm;
  const kg = 2 * km * FACTORS.routingUplift * perPkm;
  return (includeNonCo2 ? kg * FACTORS.nonCo2Multiplier : kg) / 1000;
}

export const IMPACT_TYPES = {
  protect: {
    name: "Protect",
    pricePerTonne: 18,
    tagline: "Pay for this year's measured growth of standing trees",
    points: [
      "Existing trees, verified by satellite",
      "Landowner commits not to fell for 30 years",
      "Delivered within the billing period",
      "Claim: “contribution to Nepali forests”",
    ],
  },
  plant: {
    name: "Plant",
    pricePerTonne: 34,
    tagline: "New trees planted for you, absorbing CO₂ over 30 years",
    points: [
      "New native trees on rented or enrolled land",
      "Survival checks in years 1, 3 and 5",
      "Absorption tracked along a growth curve",
      "Claim: “funded verified carbon removal”",
    ],
  },
} as const;

export type ImpactType = keyof typeof IMPACT_TYPES;

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    cadence: "pay per tonne",
    platformFee: "12% platform fee",
    for: "Small operators and one-off trips",
    features: [
      "Upload travelers by CSV",
      "Tree allocation per trip",
      "Shareable tree maps",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    id: "operator",
    name: "Operator",
    price: "$79",
    cadence: "per month",
    platformFee: "7% platform fee",
    for: "Tour operators with steady bookings",
    features: [
      "Everything in Starter",
      "Booking widget and API",
      "Branded certificates",
    ],
    cta: "Choose Operator",
    highlight: true,
  },
  {
    id: "institution",
    name: "Institution",
    price: "Custom",
    cadence: "annual agreement",
    platformFee: "Volume pricing",
    for: "Conferences, NGOs and universities",
    features: [
      "Everything in Operator",
      "Event registration import",
      "Audit-ready reports",
    ],
    cta: "Talk to us",
    highlight: false,
  },
];

export const PACKAGES = [
  {
    name: "Trek Package",
    unit: "per traveler",
    detail: "London ↔ Kathmandu via Doha, about 1.6 t CO₂",
    trees: "4 new trees",
    from: "$54",
  },
  {
    name: "Event Package",
    unit: "per 100 attendees",
    detail: "Mixed long-haul travel, about 180 t CO₂",
    trees: "9,000 tree-years protected",
    from: "$3,240",
  },
  {
    name: "Office Package",
    unit: "per year",
    detail: "Staff flights for a 20-person team, about 60 t CO₂",
    trees: "120 new trees",
    from: "$2,040",
  },
];

// Mirrors backend/app/catalog.py PLANS platform_fee_rate (Institution: custom terms).
export const FEE_RATES: Record<string, number> = { starter: 0.12, operator: 0.07, institution: 0 };

export const FARMER_SHARE = 0.6;
export const BUFFER_SHARE = 0.15;
