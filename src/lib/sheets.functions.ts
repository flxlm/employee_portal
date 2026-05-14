import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SPREADSHEET_ID = "1I6quIaAQuMpLk97WVRtDys1mZ53d2Ys5Xj8YI3Zw10A";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function fetchRange(range: string): Promise<string[][]> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

  const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueRenderOption=FORMATTED_VALUE`;
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
  | "FORM FILLED"
  | "ESTIMATE SENT"
  | "REMINDER SENT"
  | "AWAITING PAYMENT"
  | "CONFIRMED"
  | "DECLINED"
  | "REFUSED, LOW BUDGET"
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

const KNOWN_STATUSES: StatusBucket[] = [
  "FORM FILLED",
  "ESTIMATE SENT",
  "REMINDER SENT",
  "AWAITING PAYMENT",
  "CONFIRMED",
  "DECLINED",
  "REFUSED, LOW BUDGET",
];

function bucketFor(rawStatus: string, eventDate: Date | null): StatusBucket {
  const s = (rawStatus || "").trim().toUpperCase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isPast = eventDate ? eventDate.getTime() < todayStart.getTime() : false;

  if (s === "CONFIRMED" && isPast) return "PAST";
  const match = KNOWN_STATUSES.find((k) => k === s);
  if (match) return match;
  // empty / unknown => FORM FILLED
  return "FORM FILLED";
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  // MM/DD/YYYY or M/D/YYYY (Google Sheets default US locale)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const d = new Date(Date.UTC(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2])));
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const getEventInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EventInquiry[]> => {
    const rows = await fetchRange("Event Inquiries!A1:Z");
    const objs = rowsToObjects(rows);
    return objs
      .map((o, idx) => {
        const eventDate = parseDate(o["Date of your event"] ?? "");
        const rawStatus = o["Status"] ?? "";
        return {
          id: `${idx}-${o["Timestamp"] || o["Email Address"]}`,
          rowNumber: idx + 2,
          status: rawStatus.trim() || "FORM FILLED",
          rawStatus,
          bucket: bucketFor(rawStatus, eventDate),
          timestamp: o["Timestamp"] ?? "",
          email: o["Email Address"] ?? "",
          eventDate: o["Date of your event"] ?? "",
          eventDateParsed: eventDate,
          guests: o["Number of expected guests"] ?? "",
          reservationType: o["Type of reservation needed"] ?? "",
          startTime: o["Start time of your event"] ?? "",
          arrivalTime: o["Guest arrival time"] ?? "",
          endTime: o["Event end time"] ?? "",
          barService: o["What type of bar service do you require?"] ?? "",
          foodService: o["What type of food service do you require?"] ?? "",
          dj: o["Do you require a DJ/DJ equipment?"] ?? "",
          description: o["Anything else we should know? / Event Description"] ?? "",
          budget: o["Budget?"] ?? "",
          prepaid: o['If you chose "Prepaid bar", what amount do you want to prepay for drinks per person?'] ?? "",
        };
      })
      .filter((o) => o.email || o.timestamp);
  });

const FIELD_TO_HEADER: Record<string, string> = {
  timestamp: "Timestamp",
  email: "Email Address",
  eventDate: "Date of your event",
  guests: "Number of expected guests",
  reservationType: "Type of reservation needed",
  startTime: "Start time of your event",
  arrivalTime: "Guest arrival time",
  endTime: "Event end time",
  barService: "What type of bar service do you require?",
  foodService: "What type of food service do you require?",
  dj: "Do you require a DJ/DJ equipment?",
  description: "Anything else we should know? / Event Description",
  budget: "Budget?",
  prepaid: 'If you chose "Prepaid bar", what amount do you want to prepay for drinks per person?',
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
    const headerRows = await fetchRange("Event Inquiries!A1:Z1");
    const headers = headerRows[0] ?? [];

    // Build per-cell updates
    const dataUpdates: { range: string; values: string[][] }[] = [];
    for (const [field, value] of Object.entries(data.updates)) {
      const headerName = FIELD_TO_HEADER[field];
      if (!headerName) continue;
      const colIdx = headers.findIndex((h) => h === headerName);
      if (colIdx < 0) continue;
      const range = `Event Inquiries!${colLetter(colIdx + 1)}${data.rowNumber}`;
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
      .filter((o) => (o["Name"] ?? "").trim())
      .map((o, idx) => ({
        id: `${idx}-${o["Name"]}`,
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
      }));
  });
