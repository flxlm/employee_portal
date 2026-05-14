import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusBucket =
  | "NEW"
  | "ONGOING"
  | "AWAITING PAYMENT"
  | "CONFIRMED"
  | "DECLINED"
  | "PAST";

export type EventInquiry = {
  id: string;
  rowNumber: number;
  status: string;
  rawStatus: string;
  bucket: StatusBucket;
  timestamp: string;
  email: string;
  eventDate: string;
  eventDateParsed: string | null;
  guests: string;
  reservationType: string;
  startTime: string;
  arrivalTime: string;
  endTime: string;
  barService: string;
  foodService: string;
  foodServiceTime: string;
  foodRestrictions: string;
  dj: string;
  description: string;
  budget: string;
  foodBudget: string;
  premiumDrinks: string;
  premiumDrinksDetails: string;
  weddingSections: string;
  referralSource: string;
  prepaid: string;
};

function bucketFor(rawStatus: string, eventDate: Date | null): StatusBucket {
  const s = (rawStatus || "").trim().toUpperCase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isPast = eventDate ? eventDate.getTime() < todayStart.getTime() : false;

  if (s === "" || s === "NEW") return "NEW";
  if (s === "CONFIRMED") return isPast ? "PAST" : "CONFIRMED";
  if (s === "AWAITING PAYMENT") return "AWAITING PAYMENT";
  if (s === "DECLINED" || s === "REFUSED, LOW BUDGET" || s.startsWith("REFUSED")) return "DECLINED";
  if (s === "FORM FILLED" || s === "ESTIMATE SENT" || s === "REMINDER SENT") return "ONGOING";
  return "ONGOING";
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  // DD-MM-YYYY (Jotform format e.g. "08-08-2025")
  const dmyDash = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const d = new Date(Date.UTC(Number(dmyDash[3]), Number(dmyDash[2]) - 1, Number(dmyDash[1])));
    return isNaN(d.getTime()) ? null : d;
  }
  // MM/DD/YYYY
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const d = new Date(Date.UTC(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2])));
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO YYYY-MM-DD
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}


type InquiryRow = {
  id: string;
  submission_id: string | null;
  submission_date: string;
  email: string;
  event_date_raw: string;
  event_date: string | null;
  new_date_raw: string;
  guests: string;
  reservation_type: string;
  start_time: string;
  arrival_time: string;
  end_time: string;
  bar_service: string;
  food_service: string;
  food_service_time: string;
  food_restrictions: string;
  dj: string;
  description: string;
  budget: string;
  food_budget: number | string | null;
  premium_drinks: string;
  premium_drinks_details: string;
  wedding_sections: string;
  referral_source: string;
  prepaid: string;
  status: string;
};

function rowToInquiry(r: InquiryRow): EventInquiry {
  const eventDate =
    parseDate(r.new_date_raw) ?? (r.event_date ? new Date(r.event_date) : parseDate(r.event_date_raw));
  return {
    id: r.id,
    rowNumber: 0, // legacy, unused
    status: (r.status || "").trim() || "NEW",
    rawStatus: r.status || "",
    bucket: bucketFor(r.status || "", eventDate),
    timestamp: r.submission_date,
    email: r.email,
    eventDate: r.event_date_raw,
    eventDateParsed: eventDate ? eventDate.toISOString() : null,
    guests: r.guests,
    reservationType: r.reservation_type,
    startTime: r.start_time,
    arrivalTime: r.arrival_time,
    endTime: r.end_time,
    barService: r.bar_service,
    foodService: r.food_service,
    foodServiceTime: r.food_service_time ?? "",
    foodRestrictions: r.food_restrictions ?? "",
    dj: r.dj,
    description: r.description,
    budget: r.budget,
    premiumDrinks: r.premium_drinks ?? "",
    premiumDrinksDetails: r.premium_drinks_details ?? "",
    weddingSections: r.wedding_sections ?? "",
    referralSource: r.referral_source ?? "",
    prepaid: r.prepaid,
  };
}

export const getEventInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EventInquiry[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("event_inquiries")
      .select("*")
      .order("submission_date", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToInquiry(r as InquiryRow));
  });

const FIELD_TO_COLUMN: Record<string, string> = {
  rawStatus: "status",
  email: "email",
  eventDate: "event_date_raw",
  guests: "guests",
  reservationType: "reservation_type",
  startTime: "start_time",
  arrivalTime: "arrival_time",
  endTime: "end_time",
  barService: "bar_service",
  foodService: "food_service",
  foodServiceTime: "food_service_time",
  foodRestrictions: "food_restrictions",
  dj: "dj",
  description: "description",
  budget: "budget",
  premiumDrinks: "premium_drinks",
  premiumDrinksDetails: "premium_drinks_details",
  weddingSections: "wedding_sections",
  referralSource: "referral_source",
  prepaid: "prepaid",
};

export const updateEventInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; rowNumber?: number; updates: Record<string, string> }) => {
    if (!data || !data.updates || typeof data.updates !== "object") {
      throw new Error("Invalid updates");
    }
    if (!data.id || typeof data.id !== "string") {
      throw new Error("Invalid id");
    }
    return data as { id: string; updates: Record<string, string> };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(data.updates)) {
      const col = FIELD_TO_COLUMN[field];
      if (!col) continue;
      patch[col] = value ?? "";
    }
    if (data.updates["eventDate"] != null) {
      const parsed = parseDate(data.updates["eventDate"]);
      patch["event_date"] = parsed ? parsed.toISOString().slice(0, 10) : null;
    }
    if (Object.keys(patch).length === 0) return { updated: 0 };
    const { error } = await (supabase.from("event_inquiries") as any)
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { updated: Object.keys(patch).length };
  });

export type WineEntry = {
  id: string;
  rowNumber: number;
  name: string;
  domaine: string;
  year: string;
  type: string;
  country: string;
  inventory: string;
  colour: string;
  cost: string;
  glass: string;
  bottle: string;
  togo: string;
};

type WineRow = {
  id: string;
  name: string;
  domaine: string;
  year: string;
  type: string;
  country: string;
  inventory: number;
  colour: string;
  cost: number;
  markup: number;
  glass: number;
  bottle: number;
  togo: number;
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "";
  return `$${n.toFixed(2)}`;
}

function rowToWine(r: WineRow): WineEntry {
  return {
    id: r.id,
    rowNumber: 0,
    name: r.name ?? "",
    domaine: r.domaine ?? "",
    year: r.year ?? "",
    type: r.type ?? "",
    country: r.country ?? "",
    inventory: String(r.inventory ?? 0),
    colour: r.colour ?? "",
    cost: fmtMoney(Number(r.cost)),
    glass: Number.isFinite(Number(r.glass)) ? String(r.glass) : "",
    bottle: fmtMoney(Number(r.bottle)),
    togo: fmtMoney(Number(r.togo)),
  };
}

export const getWineList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WineEntry[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("wines")
      .select("*")
      .order("colour", { ascending: true })
      .order("bottle", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToWine(r as unknown as WineRow));
  });

export const addWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string;
    domaine: string;
    colour: string;
    inventory: number;
    bottle: number;
    markup: number;
    togoDiscountPct: number;
    year?: string;
    type?: string;
    country?: string;
  }) => {
    if (!data.name?.trim()) throw new Error("Name is required");
    if (!data.domaine?.trim()) throw new Error("Domaine is required");
    if (!data.colour?.trim()) throw new Error("Colour is required");
    if (!Number.isFinite(data.bottle) || data.bottle <= 0) throw new Error("Bottle price must be > 0");
    if (!Number.isFinite(data.markup) || data.markup <= 0) throw new Error("Markup must be > 0");
    if (!Number.isFinite(data.togoDiscountPct) || data.togoDiscountPct < 0 || data.togoDiscountPct >= 100) {
      throw new Error("To-go discount must be 0-99");
    }
    if (!Number.isFinite(data.inventory) || data.inventory < 0) throw new Error("Inventory must be >= 0");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const claims = (context as { claims?: { email?: string } }).claims;
    const addedBy = claims?.email ?? "";
    const cost = data.bottle / data.markup;
    const togo = data.bottle * (1 - data.togoDiscountPct / 100);

    const { error } = await (supabase.from("wines") as any).insert({
      name: data.name.trim(),
      domaine: data.domaine.trim(),
      year: data.year?.trim() ?? "",
      type: data.type?.trim() ?? "",
      country: data.country?.trim() ?? "",
      inventory: Math.floor(data.inventory),
      colour: data.colour.trim(),
      cost,
      markup: data.markup,
      glass: 0,
      bottle: data.bottle,
      togo,
      added_by: addedBy,
    });
    if (error) throw new Error(error.message);
    return { added: true, addedBy };
  });

export const updateWineStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; inventory: number }) => {
    if (!data.id || typeof data.id !== "string") throw new Error("Invalid id");
    if (!Number.isFinite(data.inventory) || data.inventory < 0) throw new Error("Invalid inventory");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase.from("wines") as any)
      .update({ inventory: Math.floor(data.inventory) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { updated: true };
  });

