import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SPREADSHEET_ID = "1I6quIaAQuMpLk97WVRtDys1mZ53d2Ys5Xj8YI3Zw10A";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function fetchRange(range: string): Promise<string[][]> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

  const encodedRange = range.replace(/ /g, "%20");
  const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
}

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
  dj: string;
  description: string;
  budget: string;
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

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

const SHEET_NAME = "Event Inquiries (Jotform)";
const SHEET_RANGE = `'${SHEET_NAME}'`;

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
  dj: string;
  description: string;
  budget: string;
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
    dj: r.dj,
    description: r.description,
    budget: r.budget,
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
  dj: "dj",
  description: "description",
  budget: "budget",
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

export const getWineList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WineEntry[]> => {
    const rows = await fetchRange("Wine List!A1:L");
    const objs = rowsToObjects(rows);
    return objs
      .map((o, idx) => ({
        id: `${idx}-${o["Name"]}`,
        rowNumber: idx + 2,
        name: o["Name"] ?? "",
        domaine: o["Domaine"] ?? "",
        year: o["Year"] ?? "",
        type: o["Type"] ?? "",
        country: o["Country"] ?? "",
        inventory: o["Inventory"] ?? "",
        colour: o["Colour"] ?? "",
        cost: o["Cost"] ?? "",
        glass: o["Glass"] ?? "",
        bottle: o["Bottle"] ?? "",
        togo: o["To-go price"] ?? "",
      }))
      .filter((o) => o.name.trim());
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
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    const claims = (context as { claims?: { email?: string } }).claims;
    const addedBy = claims?.email ?? "";
    const addedOn = new Date().toISOString().replace("T", " ").slice(0, 19);

    const headerRows = await fetchRange("Wine List!A1:Z1");
    const headers = [...(headerRows[0] ?? [])];

    const cost = data.bottle / data.markup;
    const togo = data.bottle * (1 - data.togoDiscountPct / 100);
    const fmt = (n: number) => `$${n.toFixed(2)}`;

    const valueByHeader: Record<string, string> = {
      "Name": data.name.trim(),
      "Domaine": data.domaine.trim(),
      "Year": data.year?.trim() ?? "",
      "Type": data.type?.trim() ?? "",
      "Country": data.country?.trim() ?? "",
      "Inventory": String(data.inventory),
      "Colour": data.colour.trim(),
      "Cost": fmt(cost),
      "Bottle": fmt(data.bottle),
      "Glass": "",
      "To-go price": fmt(togo),
      "Added On": addedOn,
      "Added By": addedBy,
    };

    // Ensure "Added On" and "Added By" columns exist; create them if missing
    const ensureHeader = (name: string) => {
      if (!headers.includes(name)) headers.push(name);
    };
    const hadAddedOn = headers.includes("Added On");
    const hadAddedBy = headers.includes("Added By");
    ensureHeader("Added On");
    ensureHeader("Added By");

    if (!hadAddedOn || !hadAddedBy) {
      const headerRange = `Wine List!A1:${colLetter(headers.length)}1`;
      const encodedHeaderRange = headerRange.replace(/ /g, "%20");
      const headerUrl = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${encodedHeaderRange}?valueInputOption=USER_ENTERED`;
      const headerRes = await fetch(headerUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [headers] }),
      });
      if (!headerRes.ok) {
        const body = await headerRes.text();
        throw new Error(`Sheets API (header) ${headerRes.status}: ${body}`);
      }
    }

    const row = headers.map((h) => valueByHeader[h] ?? "");

    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/Wine%20List!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API ${res.status}: ${body}`);
    }
    return { added: true, addedOn, addedBy };
  });

export const updateWineStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rowNumber: number; inventory: number }) => {
    if (!Number.isFinite(data.rowNumber) || data.rowNumber < 2) throw new Error("Invalid rowNumber");
    if (!Number.isFinite(data.inventory) || data.inventory < 0) throw new Error("Invalid inventory");
    return data;
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    const headerRows = await fetchRange("Wine List!A1:L1");
    const headers = headerRows[0] ?? [];
    const colIdx = headers.findIndex((h) => h === "Inventory");
    if (colIdx < 0) throw new Error("Inventory column not found");
    const range = `Wine List!${colLetter(colIdx + 1)}${data.rowNumber}`;
    const encoded = range.replace(/ /g, "%20");
    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[String(data.inventory)]] }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API ${res.status}: ${body}`);
    }
    return { updated: true };
  });

