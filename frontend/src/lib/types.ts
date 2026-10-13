import type { Side } from "./content";

export type UserSide = Side | "admin";

export type User = {
  id: string;
  side: UserSide;
  category: string;
  status: string;
  display_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan: string | null;
  profile: Record<string, unknown>;
  created_at: string;
};

export type AuthResponse = { token: string; user: User };

export type TripStatus = "uncovered" | "partial" | "covered";

export type LegCategory = "flight" | "helicopter" | "road" | "stay" | "trail" | "activity";

export type LegInput = {
  category: LegCategory;
  mode: string;
  day: number;
  label?: string;
  origin?: string;
  destination?: string;
  round_trip?: boolean;
  distance_km?: number;
  hours?: number;
  nights?: number;
  share?: number;
};

export type Leg = LegInput & { label: string; kg_per_person: number };

export type LegMode = {
  category: LegCategory;
  mode: string;
  label: string;
  basis: "per_traveler" | "pkm" | "fixed_km" | "hour_shared" | "vkm" | "room_night" | "zero" | "per_person";
  factor: number | null;
  default_share: number | null;
};

export type Itinerary = {
  id: number;
  name: string;
  kind: string;
  days: number;
  description: string | null;
  legs: Leg[];
  kg_per_person: number;
  has_international: boolean;
  is_template: boolean;
  times_used: number;
  last_used: string | null;
};

export type TripSummary = {
  id: number;
  name: string;
  kind: string;
  start_date: string;
  travelers: number;
  co2_t: number;
  covered_t: number;
  status: TripStatus;
  itinerary_id: number | null;
};

export type Cabin = "economy" | "premium_economy" | "business" | "first";

export type TravelerInput = {
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  home_airport?: string;
  cabin: Cabin;
};

export type JourneySegment = { origin: string; destination: string; km: number; hours: number; kg: number };

export type Journey = {
  origin: string;
  destination: string;
  segments: JourneySegment[];
  layovers: Record<string, number>;
  carrier: string | null;
  estimated: boolean;
  km_one_way: number;
  hours_one_way: number;
  round_trip: boolean;
  kg: number;
};

export type MajorRoute = {
  code: string;
  city: string;
  via: string[];
  carrier: string | null;
  km_one_way: number;
  hours_one_way: number;
  kg_round_trip_economy: number;
};

export type Traveler = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  home_airport: string | null;
  cabin: Cabin;
  flight_kg: number;
  journey: Journey | null;
  co2_kg: number;
};

export type Allocation = {
  id: number;
  request_id: number | null;
  impact_type: "protect" | "plant";
  year: number;
  tonnes: number;
  trees: number;
  amount_sol: number;
  field_id: number;
  field_name: string;
  district: string;
  species: string;
  landowner: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export type TripDetail = TripSummary & {
  include_non_co2: boolean;
  legs: Leg[];
  shared_kg_per_person: number;
  by_category: { category: LegCategory; kg: number }[];
  traveler_list: Traveler[];
  allocations: Allocation[];
  requests: AllocationRequest[];
  spend_sol: number;
};

export type ClimateSummary = {
  trips: number;
  travelers: number;
  co2_t: number;
  covered_t: number;
  new_trees: number;
  tree_years: number;
  spend_sol: number;
  monthly: { month: string; co2_t: number; covered_t: number }[];
  recent_trips: TripSummary[];
  top_itineraries: Itinerary[];
};

export type Field = {
  id: number;
  name: string;
  kind: "existing" | "planting";
  district: string;
  area_ha: number;
  species: string;
  species_name: string;
  tree_count: number;
  tree_age_years: number;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  capacity_unit: "t" | "trees";
  capacity_total: number;
  capacity_allocated: number;
  capacity_available: number;
  earned_sol: number;
};

export type Earning = {
  id: number;
  field_name: string;
  partner: string;
  trip_name: string;
  impact_type: "protect" | "plant";
  tonnes: number;
  trees: number;
  landowner_sol: number;
  payout_status: PayoutStatus | null;
  created_at: string;
};

export type LandSummary = {
  fields: number;
  trees: number;
  planting_slots: number;
  annual_capacity_t: number;
  allocated_t: number;
  earned_sol: number;
  recent_earnings: Earning[];
};

export type Airport = { code: string; name: string; city: string };
export type NepalAirport = Airport & { international: boolean };
export type Species = { id: string; name: string; kg_per_year: number };

export type RequestStatus = "pending" | "allocated" | "partial" | "rejected" | "cancelled";

export type AllocationRequest = {
  id: number;
  trip_id: number;
  trip_name: string;
  requester: string;
  impact_type: "protect" | "plant";
  year: number;
  tonnes: number;
  price_per_tonne: number;
  subtotal_sol: number;
  fee_rate: number;
  fee_sol: number;
  total_sol: number;
  status: RequestStatus;
  note: string | null;
  admin_note: string | null;
  allocated_tonnes: number;
  messages: number;
  created_at: string;
  decided_at: string | null;
};

export type Message = { id: number; sender: string; from_admin: boolean; mine: boolean; body: string; created_at: string };

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};
export type NotificationList = { unread: number; items: Notification[] };

export type InvoiceStatus = "unpaid" | "paid" | "overdue" | "void";

export type Invoice = {
  id: number;
  number: string;
  client: string;
  trip_id: number | null;
  trip_name: string | null;
  request_id: number | null;
  description: string;
  lines: { description: string; quantity: number; unit: string; unit_price: number; amount: number }[];
  subtotal_sol: number;
  fee_sol: number;
  total_sol: number;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null; // Solana transaction signature
  payer_wallet: string | null;
};

export type InvoiceList = {
  totals: { count: number; billed_sol: number; paid_sol: number; outstanding_sol: number; overdue_sol: number };
  items: Invoice[];
};

export type FieldOption = {
  id: number;
  name: string;
  landowner: string;
  district: string;
  species_name: string;
  unit: "t" | "trees";
  available: number;
  total: number;
  suggested: number;
  t_per_tree: number;
  available_trees: number;
  suggested_trees: number;
};

export type RequestDetail = {
  request: AllocationRequest;
  trip: TripDetail;
  requester_email: string | null;
  requester_category: string;
  open_tonnes: number;
  fields: FieldOption[];
  shortfall: number;
  trees_needed: number;
  area_needed_ha: number;
};

export type MapField = {
  id: number;
  name: string;
  landowner: string;
  district: string;
  kind: "existing" | "planting";
  species_name: string;
  area_ha: number;
  latitude: number;
  longitude: number;
  approximate: boolean;
  trees_total: number;
  trees_allocated: number;
  trees_free: number;
  t_per_tree: number;
};

export type FieldMapData = {
  totals: { fields: number; trees_free: number; trees_allocated: number; barren_slots: number; area_ha: number };
  fields: MapField[];
};

export type PayoutStatus = "pending" | "paid";

export type Payout = {
  id: number;
  number: string;
  landowner: string;
  landowner_phone: string | null;
  request_id: number | null;
  client: string | null;
  trip_name: string | null;
  invoice_number: string | null;
  invoice_status: InvoiceStatus | null;
  lines: { field_id: number; field_name: string; trees: number; tonnes: number; amount: number }[];
  trees: number;
  amount_sol: number;
  status: PayoutStatus;
  method: string | null;
  reference: string | null; // Solana transaction signature
  wallet: string | null; // landowner's Solana address
  created_at: string;
  paid_at: string | null;
};

export type PayoutList = {
  totals: { pending_count: number; pending_sol: number; paid_sol: number; landowners: number };
  items: Payout[];
};

export type AllocateResult = { status: string; invoice_number: string; invoice_total_sol: number; payout_ids: number[] };

export type AdminSummary = {
  pending_requests: number;
  pending_sol: number;
  climate_partners: number;
  land_partners: number;
  fields: number;
  protect_available_t: number;
  plant_available_trees: number;
  allocated_t: number;
  billed_sol: number;
  outstanding_sol: number;
  fees_sol: number;
  recent_requests: AllocationRequest[];
};

export type TreeGroup = {
  id: number | null; // null: read from the enrollment summary, not saved yet
  species: string;
  species_name: string;
  count: number;
  age_years: number;
  height_m: number | null;
  dbh_cm: number | null;
  planted_on: string | null;
  note: string | null;
  stored_kg_per_tree: number;
  stored_t: number;
  annual_t: number;
  method: "measured" | "age";
};

export type TreeGroupInput = {
  species: string;
  count: number;
  age_years: number;
  height_m: number | null;
  dbh_cm: number | null;
  planted_on: string | null;
  note: string | null;
};

export type FieldAllocation = {
  id: number;
  partner: string;
  trip_name: string;
  impact_type: "protect" | "plant";
  year: number;
  tonnes: number;
  trees: number;
  landowner_sol: number;
  payout_number: string | null;
  payout_status: PayoutStatus | null;
  created_at: string;
};

export type FieldDetail = Field & {
  inventory_saved: boolean;
  planted: number;
  groups: TreeGroup[];
  carbon: { stored_t: number; annual_gross_t: number; annual_sellable_t: number; measured_share: number };
  projection: {
    years: number;
    total_t: number;
    sellable_t: number;
    earnings_sol: number;
    unplanted_trees: number;
    rows: { year: number; gross_t: number; sellable_t: number; cumulative_t: number }[];
  };
  allocations: FieldAllocation[];
  sold_by_year: { year: number; tonnes: number; trees: number; landowner_sol: number }[];
};

export type ReceivedPayout = Omit<Payout, "landowner" | "landowner_phone" | "request_id" | "invoice_number" | "invoice_status"> & {
  tonnes: number;
};

export type LandPayments = {
  totals: {
    received_sol: number;
    received_count: number;
    pending_sol: number;
    pending_count: number;
    last_paid_at: string | null;
    wallet: string | null;
  };
  items: ReceivedPayout[];
};

export type SolanaConfig = { cluster: string; rpc_url: string; treasury: string | null };

/** A payment for the browser wallet to sign, built by the API. Amounts are lamports. */
export type SolanaIntent = {
  cluster: string;
  memo: string;
  transfers: { to: string; lamports: number; amount_sol: number; label: string }[];
};
