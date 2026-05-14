import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Jotform → Lovable webhook for the Event Inquiry form.
// Configure Jotform Settings → Integrations → Webhooks with this URL plus
// ?token=<JOTFORM_WEBHOOK_SECRET>. Jotform POSTs application/x-www-form-urlencoded
// or multipart/form-data with a "rawRequest" field containing the answers JSON.

function parseDateStr(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); // DD-MM-YYYY
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // MM/DD/YYYY
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function pick(answers: Record<string, any>, ...labels: string[]): string {
  for (const a of Object.values(answers ?? {})) {
    const text = (a?.text ?? a?.name ?? "").toString().trim().toLowerCase();
    if (labels.some((l) => text === l.toLowerCase() || text.startsWith(l.toLowerCase()))) {
      const ans = a?.answer;
      if (ans == null) return "";
      if (typeof ans === "string") return ans;
      if (typeof ans === "object") {
        // composite (date / time / address)
        if ("month" in ans && "day" in ans && "year" in ans) {
          return `${ans.day}-${ans.month}-${ans.year}`;
        }
        if ("hour" in ans && "min" in ans) {
          return `${ans.hour}:${ans.min}${ans.ampm ? " " + ans.ampm : ""}`;
        }
        return JSON.stringify(ans);
      }
      return String(ans);
    }
  }
  return "";
}

export const Route = createFileRoute("/api/public/jotform-event-inquiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env.JOTFORM_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        if (url.searchParams.get("token") !== expected) {
          return new Response("Invalid token", { status: 401 });
        }

        // Jotform posts multipart/form-data or application/x-www-form-urlencoded.
        const form = await request.formData().catch(() => null);
        if (!form) return new Response("Invalid payload", { status: 400 });

        const submissionId = (form.get("submissionID") || form.get("submission_id") || "").toString().trim();
        const rawRequest = form.get("rawRequest")?.toString() || "{}";
        let raw: Record<string, any> = {};
        try { raw = JSON.parse(rawRequest); } catch { /* ignore */ }

        // Jotform "pretty" payload: keys are q1_..., values include the answer text
        // We look up by q.text label using the formAnswers structure if present, else fall back to flat raw.
        const formAnswersRaw = form.get("formAnswers")?.toString();
        let answers: Record<string, any> = {};
        try { answers = formAnswersRaw ? JSON.parse(formAnswersRaw) : {}; } catch { /* ignore */ }

        // Some Jotform integrations send answers under "pretty" keys; normalize from raw if answers empty.
        if (Object.keys(answers).length === 0) {
          for (const [k, v] of Object.entries(raw)) {
            answers[k] = { text: k.replace(/^q\d+_/, "").replace(/_/g, " "), answer: v };
          }
        }

        const eventDateRaw = pick(answers, "Date of the event", "dateOfThe");
        const newDateRaw = pick(answers, "New Date", "newDate");
        const ed = parseDateStr(newDateRaw) ?? parseDateStr(eventDateRaw);

        const row = {
          submission_id: submissionId || `jotform:${Date.now()}`,
          submission_date: new Date().toISOString().replace("T", " ").slice(0, 19),
          email: pick(answers, "Email", "email"),
          event_date_raw: eventDateRaw,
          new_date_raw: newDateRaw,
          event_date: ed,
          guests: pick(answers, "Number of expect guests", "Number of guests", "guests"),
          reservation_type: pick(answers, "What type of event do you want to host?", "type of event"),
          start_time: pick(answers, "At what time do you want to start having access to the space?", "start"),
          arrival_time: pick(answers, "At what time will your guests arrive?", "arrive"),
          end_time: pick(answers, "At what time would you like to end your event?", "end"),
          bar_service: pick(answers, "How would you want the bar service to be handled?", "bar service"),
          food_service: pick(answers, "How would you want the food service to be handled?", "food service"),
          dj: pick(answers, "Please select any extras that Savsav can offer you:", "extras"),
          description: pick(answers, "Is there anything else we should know?", "anything else"),
          budget: pick(answers, "Budget"),
          prepaid: pick(answers, "Food Budget (pp)", "Food Budget"),
          status: "",
        };

        const { error } = await supabaseAdmin
          .from("event_inquiries")
          .upsert(row, { onConflict: "submission_id", ignoreDuplicates: false });
        if (error) {
          console.error("Jotform webhook insert failed:", error);
          return new Response(`Insert failed: ${error.message}`, { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true, submission_id: row.submission_id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
