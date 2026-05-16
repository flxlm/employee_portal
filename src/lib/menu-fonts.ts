export type FontOption = {
  label: string;
  // CSS font-family value (with fallbacks)
  value: string;
  // Google Fonts family name (URL-encoded with + for spaces). Omit for system stacks.
  google?: string;
  // Weights to load from Google Fonts.
  weights?: number[];
};

export const FONT_OPTIONS: FontOption[] = [
  {
    label: "PP Neue Montreal Mono",
    value:
      '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  // PP Neue Corp Condensed
  { label: "PP Neue Corp Condensed Ultralight", value: '"PP Neue Corp Condensed Ultralight", sans-serif' },
  { label: "PP Neue Corp Condensed Ultralight Italic", value: '"PP Neue Corp Condensed Ultralight Italic", sans-serif' },
  { label: "PP Neue Corp Condensed Thin", value: '"PP Neue Corp Condensed Thin", sans-serif' },
  { label: "PP Neue Corp Condensed Thin Italic", value: '"PP Neue Corp Condensed Thin Italic", sans-serif' },
  { label: "PP Neue Corp Condensed Medium", value: '"PP Neue Corp Condensed Medium", sans-serif' },
  { label: "PP Neue Corp Condensed Medium Italic", value: '"PP Neue Corp Condensed Medium Italic", sans-serif' },
  { label: "PP Neue Corp Condensed Ultrabold", value: '"PP Neue Corp Condensed Ultrabold", sans-serif' },
  { label: "PP Neue Corp Condensed Ultrabold Italic", value: '"PP Neue Corp Condensed Ultrabold Italic", sans-serif' },
  { label: "PP Neue Corp Condensed Black", value: '"PP Neue Corp Condensed Black", sans-serif' },
  { label: "PP Neue Corp Condensed Black Italic", value: '"PP Neue Corp Condensed Black Italic", sans-serif' },
  { label: "System sans-serif", value: "system-ui, -apple-system, sans-serif" },
  { label: "System serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "System monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },

  // Sans
  { label: "Inter", value: '"Inter", sans-serif', google: "Inter", weights: [400, 500, 600, 700, 800] },
  { label: "Manrope", value: '"Manrope", sans-serif', google: "Manrope", weights: [400, 500, 600, 700, 800] },
  { label: "Work Sans", value: '"Work Sans", sans-serif', google: "Work+Sans", weights: [400, 500, 600, 700] },
  { label: "DM Sans", value: '"DM Sans", sans-serif', google: "DM+Sans", weights: [400, 500, 700] },
  { label: "Plus Jakarta Sans", value: '"Plus Jakarta Sans", sans-serif', google: "Plus+Jakarta+Sans", weights: [400, 500, 600, 700, 800] },
  { label: "Outfit", value: '"Outfit", sans-serif', google: "Outfit", weights: [400, 500, 600, 700] },
  { label: "Figtree", value: '"Figtree", sans-serif', google: "Figtree", weights: [400, 500, 600, 700] },
  { label: "Sora", value: '"Sora", sans-serif', google: "Sora", weights: [400, 500, 600, 700] },
  { label: "Urbanist", value: '"Urbanist", sans-serif', google: "Urbanist", weights: [400, 500, 600, 700, 800] },
  { label: "Epilogue", value: '"Epilogue", sans-serif', google: "Epilogue", weights: [400, 500, 600, 700] },
  { label: "Space Grotesk", value: '"Space Grotesk", sans-serif', google: "Space+Grotesk", weights: [400, 500, 600, 700] },
  { label: "Syne", value: '"Syne", sans-serif', google: "Syne", weights: [400, 500, 600, 700, 800] },
  { label: "Archivo", value: '"Archivo", sans-serif', google: "Archivo", weights: [400, 500, 600, 700, 800] },
  { label: "Archivo Black", value: '"Archivo Black", sans-serif', google: "Archivo+Black", weights: [400] },
  { label: "Bebas Neue", value: '"Bebas Neue", sans-serif', google: "Bebas+Neue", weights: [400] },
  { label: "Barlow", value: '"Barlow", sans-serif', google: "Barlow", weights: [400, 500, 600, 700] },
  { label: "Hind", value: '"Hind", sans-serif', google: "Hind", weights: [400, 500, 600, 700] },
  { label: "Cabin", value: '"Cabin", sans-serif', google: "Cabin", weights: [400, 500, 600, 700] },
  { label: "Karla", value: '"Karla", sans-serif', google: "Karla", weights: [400, 500, 600, 700] },
  { label: "Nunito Sans", value: '"Nunito Sans", sans-serif', google: "Nunito+Sans", weights: [400, 600, 700, 800] },
  { label: "IBM Plex Sans", value: '"IBM Plex Sans", sans-serif', google: "IBM+Plex+Sans", weights: [400, 500, 600, 700] },
  { label: "Fira Sans", value: '"Fira Sans", sans-serif', google: "Fira+Sans", weights: [400, 500, 600, 700] },
  { label: "Rubik", value: '"Rubik", sans-serif', google: "Rubik", weights: [400, 500, 600, 700] },

  // Serif
  { label: "Playfair Display", value: '"Playfair Display", serif', google: "Playfair+Display", weights: [400, 500, 600, 700, 800] },
  { label: "Cormorant Garamond", value: '"Cormorant Garamond", serif', google: "Cormorant+Garamond", weights: [400, 500, 600, 700] },
  { label: "Lora", value: '"Lora", serif', google: "Lora", weights: [400, 500, 600, 700] },
  { label: "Libre Baskerville", value: '"Libre Baskerville", serif', google: "Libre+Baskerville", weights: [400, 700] },
  { label: "Instrument Serif", value: '"Instrument Serif", serif', google: "Instrument+Serif", weights: [400] },
  { label: "DM Serif Display", value: '"DM Serif Display", serif', google: "DM+Serif+Display", weights: [400] },
  { label: "Abril Fatface", value: '"Abril Fatface", serif', google: "Abril+Fatface", weights: [400] },

  // Mono
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace', google: "JetBrains+Mono", weights: [400, 500, 600, 700] },
  { label: "Space Mono", value: '"Space Mono", monospace', google: "Space+Mono", weights: [400, 700] },
  { label: "IBM Plex Mono", value: '"IBM Plex Mono", monospace', google: "IBM+Plex+Mono", weights: [400, 500, 600, 700] },
  { label: "Fira Code", value: '"Fira Code", monospace', google: "Fira+Code", weights: [400, 500, 600, 700] },
];

/** Extract the first quoted family name from a CSS font-family value, e.g. `'"Inter", sans-serif'` → `Inter`. */
function firstFamilyName(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.match(/"([^"]+)"|'([^']+)'/);
  if (m) return (m[1] || m[2]).trim();
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Build a Google Fonts URL for ONLY the families/weights actually used.
 * Returns null if nothing Google-hosted is needed.
 */
export function buildGoogleFontsHref(usedFamilies: string[], usedWeights: Record<string, Set<number>>): string | null {
  const families: string[] = [];
  for (const familyName of usedFamilies) {
    const opt = FONT_OPTIONS.find((f) => f.label === familyName);
    if (!opt?.google) continue;
    const supported = new Set(opt.weights ?? [400, 700]);
    const wanted = Array.from(usedWeights[familyName] ?? new Set<number>())
      .filter((w) => supported.has(w))
      .sort((a, b) => a - b);
    const weights = wanted.length > 0 ? wanted : (opt.weights ?? [400, 700]);
    families.push(`family=${opt.google}:wght@${weights.join(";")}`);
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

const LINK_ID = "menu-google-fonts";

/**
 * Inject a stylesheet for only the Google Fonts referenced by the given formatting.
 * Pass families/weights extracted from the saved MenuFormatting. Safe to call repeatedly;
 * it will replace the previous link tag if the URL changed.
 */
export function ensureGoogleFontsLoaded(
  usedFamilies: string[] = [],
  usedWeights: Record<string, Set<number>> = {},
) {
  if (typeof document === "undefined") return;
  const href = buildGoogleFontsHref(usedFamilies, usedWeights);
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!href) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Walk a MenuFormatting-shaped record and return the set of family names + per-family weights
 * referenced. Family names are matched against FONT_OPTIONS labels (the part before the comma).
 */
export function collectUsedFonts(
  formatting: Record<string, { fontFamily?: string; fontWeight?: number | string } | undefined> | null | undefined,
  defaults: Record<string, { fontFamily?: string; fontWeight?: number | string } | undefined> = {},
): { families: string[]; weights: Record<string, Set<number>> } {
  const families = new Set<string>();
  const weights: Record<string, Set<number>> = {};
  const allKeys = new Set([...Object.keys(defaults), ...Object.keys(formatting ?? {})]);
  for (const key of allKeys) {
    const merged = { ...(defaults[key] ?? {}), ...((formatting?.[key]) ?? {}) };
    const fam = firstFamilyName(merged.fontFamily);
    if (!fam) continue;
    // Map family back to a FONT_OPTIONS label
    const opt = FONT_OPTIONS.find((f) => f.label === fam || f.value.startsWith(`"${fam}"`));
    if (!opt) continue;
    families.add(opt.label);
    const w = typeof merged.fontWeight === "number"
      ? merged.fontWeight
      : typeof merged.fontWeight === "string" && /^\d+$/.test(merged.fontWeight)
        ? Number(merged.fontWeight)
        : 400;
    if (!weights[opt.label]) weights[opt.label] = new Set();
    weights[opt.label].add(w);
  }
  return { families: Array.from(families), weights };
}
