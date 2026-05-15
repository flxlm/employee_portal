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
    label: "System default (PP Neue Montreal Mono)",
    value:
      '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  { label: "PP Neue Montreal Mono Light", value: '"PP Neue Montreal Mono Light", ui-monospace, monospace' },
  { label: "PP Neue Montreal Mono Book", value: '"PP Neue Montreal Mono Book", ui-monospace, monospace' },
  { label: "PP Neue Montreal Mono Regular", value: '"PP Neue Montreal Mono Regular", ui-monospace, monospace' },
  { label: "PP Neue Montreal Mono Medium", value: '"PP Neue Montreal Mono Medium", ui-monospace, monospace' },
  { label: "PP Neue Montreal Mono Bold", value: '"PP Neue Montreal Mono Bold", ui-monospace, monospace' },

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

/**
 * Build a single Google Fonts URL that loads every Google-hosted family above.
 */
export function buildGoogleFontsHref(): string {
  const families = FONT_OPTIONS.filter((f) => f.google).map((f) => {
    const weights = (f.weights || [400, 700]).join(";");
    return `family=${f.google}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

const LINK_ID = "menu-google-fonts";

export function ensureGoogleFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = buildGoogleFontsHref();
  document.head.appendChild(link);
}
