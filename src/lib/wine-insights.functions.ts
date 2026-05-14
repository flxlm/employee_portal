import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  name: z.string().min(1).max(200),
  domaine: z.string().max(200).optional().default(""),
  year: z.string().max(20).optional().default(""),
  type: z.string().max(100).optional().default(""),
  colour: z.string().max(50).optional().default(""),
  country: z.string().max(100).optional().default(""),
});

export type WineInsights = {
  description: string;
  varietals: string[];
  sourceUrl?: string;
};

export const getWineInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<WineInsights> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const wineLine = [
      data.name,
      data.domaine && `by ${data.domaine}`,
      data.year,
      data.colour,
      data.type,
      data.country && `from ${data.country}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const systemPrompt = [
      "You are a sommelier and wine reference assistant for restaurant staff.",
      "Always provide a confident, concise answer using your best knowledge — even if the exact bottle is obscure, infer from the producer, region, appellation, vintage, and colour.",
      "Never reply with 'I don't know', 'I'm not sure', 'unable to find', or any refusal. Never include disclaimers or hedging language.",
      "Description: 2-3 short sentences covering style, palate (fruit/acidity/tannin/body), and food pairing notes useful to a server.",
      "Varietals: list the grape varieties in the blend. If a single-varietal wine, return one entry. If unknown for the exact bottle, return the typical varietals for that producer's appellation/region.",
      "Source URL: best public reference page (producer website, appellation page, or reputable wine database like Wine-Searcher / Vivino / CellarTracker / Jancis Robinson). Always provide one.",
    ].join(" ");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Wine: ${wineLine}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_wine",
            description: "Return wine description, varietals, and a source URL.",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string", description: "2-3 sentence sommelier-style description for restaurant staff." },
                varietals: {
                  type: "array",
                  items: { type: "string" },
                  description: "Grape varieties in the blend (or the single varietal).",
                  minItems: 1,
                },
                sourceUrl: { type: "string", description: "Best public reference URL supporting the answer." },
              },
              required: ["description", "varietals", "sourceUrl"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_wine" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no structured output");

    const parsed = JSON.parse(args) as WineInsights;
    return {
      description: parsed.description?.trim() || "",
      varietals: Array.isArray(parsed.varietals) ? parsed.varietals.filter(Boolean) : [],
      sourceUrl: parsed.sourceUrl?.trim() || undefined,
    };
  });
