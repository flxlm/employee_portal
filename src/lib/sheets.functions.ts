import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SPREADSHEET_ID = "1I6quIaAQuMpLk97WVRtDys1mZ53d2Ys5Xj8YI3Zw10A";
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

  if (s === "") return "NEW";
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

const SHEET_NAME = "Event Inquiries (Jotform)";
const SHEET_RANGE = `'${SHEET_NAME}'`;

export const getEventInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EventInquiry[]> => {
    const rows = await fetchRange(`${SHEET_RANGE}!A1:AG`);
    const objs = rowsToObjects(rows);
    return objs
      .map((o, idx) => {
        const eventDateRaw = o["Date of the event"] ?? "";
        const newDateRaw = o["New Date"] ?? "";
        const eventDate = parseDate(newDateRaw) ?? parseDate(eventDateRaw);
        const rawStatus = o["Status"] ?? "";
        return {
          id: `${idx}-${o["Submission ID"] || o["Submission Date"] || o["Email"]}`,
          rowNumber: idx + 2,
          status: rawStatus.trim() || "NEW",
          rawStatus,
          bucket: bucketFor(rawStatus, eventDate),
          timestamp: o["Submission Date"] ?? "",
          email: o["Email"] ?? "",
          eventDate: eventDateRaw,
          eventDateParsed: eventDate ? eventDate.toISOString() : null,
          guests: o["Number of expect guests"] ?? "",
          reservationType: o["What type of event do you want to host?"] ?? "",
          startTime: o["At what time do you want to start having access to the space?"] ?? "",
          arrivalTime: o["At what time will your guests arrive?"] ?? "",
          endTime: o["At what time would you like to end your event?"] ?? "",
          barService: o["How would you want the bar service to be handled?"] ?? "",
          foodService: o["How would you want the food service to be handled?"] ?? "",
          dj: o["Please select any extras that Savsav can offer you:"] ?? "",
          description: o["Is there anything else we should know?"] ?? "",
          budget: o["Budget"] ?? "",
          prepaid: o["Food Budget (pp)"] ?? "",
        };
      })
      .filter((o) => o.email || o.timestamp);
  });

const FIELD_TO_HEADER: Record<string, string> = {
  timestamp: "Submission Date",
  email: "Email",
  eventDate: "Date of the event",
  guests: "Number of expect guests",
  reservationType: "What type of event do you want to host?",
  startTime: "At what time do you want to start having access to the space?",
  arrivalTime: "At what time will your guests arrive?",
  endTime: "At what time would you like to end your event?",
  barService: "How would you want the bar service to be handled?",
  foodService: "How would you want the food service to be handled?",
  dj: "Please select any extras that Savsav can offer you:",
  description: "Is there anything else we should know?",
  budget: "Budget",
  prepaid: "Food Budget (pp)",
  rawStatus: "Status",
};

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

export const updateEventInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rowNumber: number; updates: Record<string, string> }) => {
    if (!data || typeof data.rowNumber !== "number" || data.rowNumber < 2) {
      throw new Error("Invalid rowNumber");
    }
    if (!data.updates || typeof data.updates !== "object") {
      throw new Error("Invalid updates");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    // Fetch headers to map field -> column index
    const headerRows = await fetchRange(`${SHEET_RANGE}!A1:AG1`);
    const headers = headerRows[0] ?? [];

    // Build per-cell updates
    const dataUpdates: { range: string; values: string[][] }[] = [];
    for (const [field, value] of Object.entries(data.updates)) {
      const headerName = FIELD_TO_HEADER[field];
      if (!headerName) continue;
      const colIdx = headers.findIndex((h) => h === headerName);
      if (colIdx < 0) continue;
      const range = `${SHEET_RANGE}!${colLetter(colIdx + 1)}${data.rowNumber}`;
      dataUpdates.push({ range, values: [[value ?? ""]] });
    }

    if (dataUpdates.length === 0) return { updated: 0 };

    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: dataUpdates,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API ${res.status}: ${body}`);
    }
    return { updated: dataUpdates.length };
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
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    const headerRows = await fetchRange("Wine List!A1:L1");
    const headers = headerRows[0] ?? [];

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
    };

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
    return { added: true };
  });

