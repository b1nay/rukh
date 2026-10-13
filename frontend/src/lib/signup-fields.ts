// Category-specific sign-up fields. Field `name`s must match the
// profile schemas in backend/app/schemas/signup.py.

export type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "url" | "tel" | "select" | "chips";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  hint?: string;
  half?: boolean;
  pattern?: string; // HTML pattern for text inputs
};

const DISTRICTS = [
  "Ilam", "Jhapa", "Panchthar", "Dhankuta", "Terhathum", "Kaski", "Lamjung", "Syangja",
  "Tanahun", "Gorkha", "Chitwan", "Nawalparasi", "Makwanpur", "Kavrepalanchok",
  "Sindhupalchok", "Nuwakot", "Dolakha", "Solukhumbu", "Kathmandu", "Lalitpur", "Bhaktapur",
  "Palpa", "Rupandehi", "Dang", "Surkhet", "Kailali", "Kanchanpur", "Mustang", "Myagdi",
];

const SPECIES = [
  "Utis (Alnus nepalensis)",
  "Sal (Shorea robusta)",
  "Khote salla (Pinus roxburghii)",
  "Chilaune (Schima wallichii)",
  "Sisau (Dalbergia sissoo)",
  "Bamboo",
  "Tea (Camellia sinensis)",
  "Fruit trees",
  "Other",
];

// Rukh pays Land Partners in SOL. Any Solana wallet works (Phantom, Solflare, Backpack, …).
const WALLET: Field = {
  name: "solana_wallet",
  label: "Solana wallet address",
  type: "text",
  required: true,
  placeholder: "e.g. 7xKX…n4Qp from Phantom or Solflare",
  hint: "We pay you in SOL here",
  pattern: "[1-9A-HJ-NP-Za-km-z]{32,44}",
};

export const DISTRICT_OPTIONS = DISTRICTS;

export const CATEGORY_FIELDS: Record<string, Field[]> = {
  tour_operator: [
    { name: "company_name", label: "Company name", type: "text", required: true },
    { name: "country", label: "Country of registration", type: "text", required: true, half: true, placeholder: "e.g. United Kingdom" },
    { name: "website", label: "Website", type: "url", half: true, placeholder: "https://" },
    { name: "travelers_per_year", label: "Travelers to Nepal per year", type: "number", required: true, half: true, placeholder: "e.g. 800" },
    {
      name: "booking_system", label: "How do clients book?", type: "select", half: true, required: true,
      options: ["Our own website", "TourRadar or marketplace", "Through agents", "Email / phone"],
    },
    {
      name: "source_markets", label: "Where do your travelers fly from?", type: "chips",
      options: ["UK", "Europe", "North America", "Australia & NZ", "Asia", "India"],
    },
    { name: "nepal_license_no", label: "Nepal tourism license / TAAN no.", type: "text", hint: "Optional, for Nepal-registered agencies" },
  ],
  event_organizer: [
    { name: "organization_name", label: "Organizing body", type: "text", required: true, placeholder: "e.g. ISCA" },
    { name: "event_name", label: "Event name", type: "text", required: true, placeholder: "e.g. Interspeech 2027" },
    { name: "event_start", label: "Start date", type: "date", required: true, half: true },
    { name: "event_city", label: "Host city", type: "text", required: true, half: true },
    { name: "expected_attendees", label: "Expected attendees", type: "number", required: true, half: true },
    {
      name: "registration_platform", label: "Registration platform", type: "select", half: true,
      options: ["Cvent", "Eventbrite", "ConfTool", "Custom", "Other"],
    },
    {
      name: "who_pays", label: "Who covers the cost?", type: "select", required: true,
      options: ["Organizer covers all attendees", "Included in registration fee", "Attendee opt-in"],
    },
  ],
  ngo: [
    { name: "organization_name", label: "Organization name", type: "text", required: true },
    {
      name: "organization_type", label: "Type", type: "select", required: true, half: true,
      options: ["INGO", "National NGO", "UN agency", "Embassy / mission", "Bilateral donor"],
    },
    { name: "staff_in_nepal", label: "Staff in Nepal", type: "number", half: true },
    { name: "flights_per_year", label: "Approx. flights per year", type: "number", half: true },
    { name: "has_climate_policy", label: "Climate or travel policy?", type: "select", half: true, options: ["Yes", "In progress", "No"] },
  ],
  university: [
    { name: "institution_name", label: "Institution", type: "text", required: true },
    { name: "department", label: "Department or research group", type: "text", half: true },
    { name: "country", label: "Country", type: "text", required: true, half: true },
    { name: "has_flight_levy", label: "Internal flight levy?", type: "select", half: true, options: ["Yes", "Planned", "No"] },
    { name: "flights_per_year", label: "Approx. flights per year", type: "number", half: true },
  ],
  hospitality: [
    { name: "property_name", label: "Property name", type: "text", required: true },
    { name: "district", label: "District", type: "select", required: true, half: true, options: DISTRICTS },
    { name: "rooms", label: "Rooms", type: "number", half: true },
    {
      name: "energy_sources", label: "Energy sources", type: "chips",
      options: ["Grid electricity", "Diesel generator", "LPG", "Firewood", "Solar"],
    },
  ],
  individual: [
    { name: "home_country", label: "Where do you usually fly from?", type: "text", half: true },
    { name: "district_interest", label: "District you'd like to support", type: "select", half: true, options: DISTRICTS },
  ],
  farmer: [
    { name: "district", label: "District", type: "select", required: true, half: true, options: DISTRICTS },
    { name: "municipality", label: "Municipality & ward", type: "text", half: true, placeholder: "e.g. Suryodaya-7" },
    { name: "land_area", label: "Land area", type: "number", required: true, half: true },
    { name: "land_unit", label: "Unit", type: "select", required: true, half: true, options: ["Ropani", "Bigha", "Kattha", "Hectare"] },
    { name: "existing_trees", label: "Approx. trees on the land now", type: "number", half: true },
    { name: "open_to_planting", label: "Open to planting new trees?", type: "select", half: true, options: ["Yes", "Maybe", "No"] },
    { name: "species", label: "Tree species on your land", type: "chips", options: SPECIES },
    WALLET,
  ],
  community_forest: [
    { name: "cfug_name", label: "Community forest name", type: "text", required: true },
    { name: "registration_no", label: "Registration no. (DFO)", type: "text", half: true },
    { name: "district", label: "District", type: "select", required: true, half: true, options: DISTRICTS },
    { name: "area_ha", label: "Forest area (hectares)", type: "number", required: true, half: true },
    { name: "households", label: "Member households", type: "number", half: true },
    { name: "species", label: "Main species", type: "chips", options: SPECIES },
    WALLET,
  ],
  cooperative: [
    { name: "cooperative_name", label: "Cooperative or estate name", type: "text", required: true },
    { name: "registration_no", label: "Registration no.", type: "text", half: true },
    { name: "district", label: "District", type: "select", required: true, half: true, options: DISTRICTS },
    { name: "members", label: "Members", type: "number", half: true },
    { name: "plots", label: "Plots to enrol", type: "number", half: true },
    {
      name: "crops", label: "Main crops", type: "chips",
      options: ["Tea", "Cardamom", "Coffee", "Fruit", "Timber", "Other"],
    },
    WALLET,
  ],
};
