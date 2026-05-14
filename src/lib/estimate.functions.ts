import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DOC_ID = "1H3-xE0iZZFBleQrU1_uFBn4-MNB8KztYCb6CZliBPag";
const DOCS_GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function fetchDocText(): Promise<string> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_DOCS_API_KEY = process.env.GOOGLE_DOCS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GOOGLE_DOCS_API_KEY) throw new Error("GOOGLE_DOCS_API_KEY missing");

  const res = await fetch(`${DOCS_GATEWAY}/documents/${DOC_ID}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DOCS_API_KEY,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Docs API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
  };
  const parts: string[] = [];
  for (const el of data.body?.content ?? []) {
    for (const e of el.paragraph?.elements ?? []) {
      if (e.textRun?.content) parts.push(e.textRun.content);
    }
  }
  return parts.join("");
}

export const draftEstimateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { language: "english" | "french"; inquiry: Record<string, string> }) =>
    z
      .object({
        language: z.enum(["english", "french"]),
        inquiry: z.record(z.string(), z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const docText = await fetchDocText();
    const langLabel = data.language === "french" ? "French" : "English";

    const inquiryLines = Object.entries(data.inquiry)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const systemPrompt = `You are drafting an event estimate email on behalf of the Savsav management team. Use the instructions, tone, structure, pricing rules, and any latest examples from the reference document below. Always prefer the most recent guidance/examples in the document if there is any conflict. Write the email in ${langLabel}. Return ONLY a JSON object with two string keys: "subject" and "body". The "body" should be plain text (no markdown), ready to paste into an email client. Do not include greetings to/from the management team beyond what the reference document instructs.

REFERENCE DOCUMENT (latest content first matters most — scan the whole document and prioritize the newest examples/instructions):
"""
${docText}
"""`;

    const userPrompt = `Draft a ${langLabel} estimate email for this event inquiry:\n\n${inquiryLines}`;

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { subject: "", body: content };
    }
    return {
      subject: parsed.subject ?? "",
      body: parsed.body ?? "",
    };
  });
