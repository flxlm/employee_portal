import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";
import { ensureGoogleFontsLoaded } from "@/lib/menu-fonts";

const MENU_ANIMATION_SRC = "/menu-animation.webm";

export const Route = createFileRoute("/display/$token")({
  validateSearch: (s: Record<string, unknown>): { debug?: boolean } => {
    const debug = s.debug === true || s.debug === "1" || s.debug === "true";
    return debug ? { debug: true } : {};
  },
  head: () => ({
    meta: [
      { title: "Menu Display" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DisplayPage,
});

const NUM_COLUMNS = 4;

// ----------------------------------------------------------------------------
// Single source of truth for menu content
// ----------------------------------------------------------------------------
type MenuItem = {
  name: string;
  price?: number;
  priceLabel?: string;
  description?: string;
  subtext?: string;
  inlineNote?: string;
};
type MenuSection = { section: string; items: MenuItem[] };

const menu: MenuSection[] = [
  {
    section: "PLATS",
    items: [
      { name: "GRILLED CHEESE", price: 10.75, description: "PAIN PULLMAN, MÉLANGE QUATRES-FROMAGES" },
      { name: "BREAKY SANDO", price: 12.75, description: "SAUCISSE MAISON, OEUF CARRÉ, ICEBERG, FROMAGE ORANGE, AIOLI ÉPICÉ" },
      { name: "ASSIETTE DU MATIN", price: 13.75, description: "ŒUF MOLLET, LÉGUMES DE SAISON, CAROTTES MARINÉES, PURÉE D'AVOCAT, RICOTTA MAISON, TOAST" },
      { name: "TARTINE SAUMON & AVO", price: 15.75, description: "PAIN AU LEVAIN, AVOCAT, CÂPRES, GRAVLAX DE SAUMON, OIGNONS ROUGES MARINÉS, ANETH, FROMAGE À LA CRÈME" },
      { name: "BAGEL HUMMOUS", price: 14.75, description: "HOUMOUS À L'AIL, POIS CHICHES RÔTIS, JALAPENOS MARINÉS, OIGNONS ROUGES MARINÉS, ROQUETTE" },
      { name: "SALADE DE POULET SUR BAGEL", price: 13.75, description: "POULET, AÏOLI, POMMES, NOIX DE GRENOBLE, OIGNONS VERTS, BAGEL" },
      { name: "\"TUNA MELT\"", price: 13.75, description: "THON, PROVOLONE (GRATINÉ), RADIS, ROQUETTE, FETA, HERBES" },
      { name: "BAGEL CLASSICO + SAUMON", price: 9.5, description: "FROMAGE À LA CRÈME FOUETTÉ, ASSAISONNEMENT EVERYTHING BAGEL" },
      { name: "SALADE ROQUETTE", price: 14.75, description: "VINAIGRETTE À LA LEVURE ALIMENTAIRE, CRAQUELIN AUX GRAINS, PARMESAN" },
      { name: "SALADE PRESQUE CÉSAR", price: 16.75, description: "POULET MARINÉ, ROMAINE, HERBES FRAÎCHES, AVOCAT, CROÛTONS AU PARMESAN, VINAIGRETTE AU BABEURRE" },
    ],
  },
  {
    section: "SPÉCIAL DE LA SEMAINE",
    items: [
      { name: "BOL HALLOUMI", price: 17.75, description: "HALLOUMI GRILLÉ AU MIEL PIQUANT, QUINOA, CONCOMBRES, TOMATES, YOGOURT GREC, ROQUETTE, FINES HERBES" },
    ],
  },
  {
    section: "SIDES",
    items: [
      { name: "TOAST / BAGEL", price: 3, inlineNote: "+ BAGEL +2" },
      { name: "DEMI AVOCAT", price: 3 },
      { name: "SCOOP DE SALADE DE POULET", price: 6 },
      { name: "OEUF MOLLET", price: 2 },
      { name: "GRAVLAX DE SAUMON", price: 5.75, subtext: "100G" },
      { name: "SOUPE AUX TOMATES", price: 4 },
      { name: "SALADE VERTE", price: 5 },
    ],
  },
  {
    section: "BIÈRES EN FÛT",
    items: [
      { name: "DDC! BLONDE", price: 9 },
      { name: "DDC! IPA", price: 9 },
    ],
  },
  {
    section: "COCKTAILS",
    items: [
      { name: "TINTO DE VERANO", price: 9 },
      { name: "MIMOSA", price: 9 },
    ],
  },
  {
    section: "VINS AU VERRE",
    items: [
      { name: "BLANC", priceLabel: "PRIX DU MARCHÉ" },
      { name: "ROUGE", priceLabel: "PRIX DU MARCHÉ" },
      { name: "MACÉRATION", priceLabel: "PRIX DU MARCHÉ" },
    ],
  },
  {
    section: "CLASSIQUES",
    items: [
      { name: "NOIR", price: 3 },
      { name: "PETIT BLANC", price: 4.5 },
      { name: "BLANC", price: 6 },
      { name: "THÉ", price: 3 },
      { name: "MATCHA / ESPRESSO TONIC", price: 6 },
      { name: "MOCHA", price: 7 },
      { name: "MATCHA / HOJICHA / CHAI", price: 6.5 },
      { name: "\"FRESH PRESSED OJ\"", price: 4 },
    ],
  },
  {
    section: "SPÉCIALITÉS",
    items: [
      { name: "\"MATCHA CLOUD\"", price: 5, subtext: "EAU DE COCO + MATCHA FOAM" },
      { name: "MATCHA AUX FRAISES", price: 9 },
      { name: "LIMOMATCHA", price: 7 },
      { name: "LATTÉ HCMC", price: 7, subtext: "LAIT CONDENSÉ SUCRÉ" },
      { name: "THÉ THAÏLANDAIS", price: 5, inlineNote: "+ LARGE +2" },
      { name: "COLD BREW!!!", price: 6 },
    ],
  },
];

function FormattedPrice({ price }: { price: number }) {
  if (!price) return null;
  const sign = price < 0 ? "-" : "";
  const abs = Math.abs(price);
  const dollars = Math.floor(abs);
  const c = Math.round((abs - dollars) * 100);
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {sign}
      {dollars}
      {c > 0 && (
        <sup style={{ fontSize: "0.55em", fontWeight: 700, marginLeft: "0.04em" }}>
          {c.toString().padStart(2, "0")}
        </sup>
      )}
    </span>
  );
}

const COLUMN_CSS = `
.menu-flow { column-count: 1; column-gap: 2.5rem; column-fill: balance; }
@media (min-width: 600px) { .menu-flow { column-count: 2; } }
@media (min-width: 900px) { .menu-flow { column-count: 3; } }
@media (min-width: 1200px) { .menu-flow { column-count: 4; } }
.menu-flow > section {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  display: block;
}
`;

function DisplayPage() {
  const { debug } = Route.useSearch();
  const fetchFormatting = useServerFn(getMenuFormatting);
  const [formatting, setFormatting] = useState<MenuFormatting>({});

  useEffect(() => {
    ensureGoogleFontsLoaded();
    fetchFormatting({}).then((f) => setFormatting(f || {})).catch(() => {});
  }, [fetchFormatting]);

  const styleFor = useMemo(() => {
    return (key: FormattingKey, extra?: React.CSSProperties): React.CSSProperties => {
      const merged: TextStyle = {
        ...DEFAULT_FORMATTING.global,
        ...DEFAULT_FORMATTING[key],
        ...formatting.global,
        ...formatting[key],
      };
      return {
        fontFamily: merged.fontFamily,
        fontSize: merged.fontSize,
        fontWeight: merged.fontWeight as React.CSSProperties["fontWeight"],
        letterSpacing: merged.letterSpacing,
        lineHeight: merged.lineHeight as React.CSSProperties["lineHeight"],
        textTransform: merged.textTransform,
        color: merged.color,
        fontStyle: merged.fontStyle,
        ...extra,
      };
    };
  }, [formatting]);

  const renderSectionHeader = (section: MenuSection) => (
    <h2
      style={styleFor("section", {
        position: "relative",
        aspectRatio: "1 / 1",
        width: "75%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        margin: "0 0 0.4vw 0",
        padding: "0.3vw",
        overflow: "hidden",
        isolation: "isolate",
        boxSizing: "border-box",
      })}
    >
      <video
        src={MENU_ANIMATION_SRC}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
      <span style={{ position: "relative" }}>{section.section}</span>
    </h2>
  );

  const renderItem = (item: MenuItem) => (
    <div style={{ marginBottom: "0.3vw" }}>
      <div
        style={styleFor("itemTitle", {
          display: "flex",
          justifyContent: "space-between",
          gap: "0.4vw",
        })}
      >
        <span>{item.name}</span>
        <span style={{ whiteSpace: "nowrap" }}>
          {item.priceLabel
            ? item.priceLabel
            : typeof item.price === "number"
              ? <FormattedPrice price={item.price} />
              : null}
          {item.inlineNote && (
            <span style={{ marginLeft: "0.4vw", opacity: 0.75 }}>{item.inlineNote}</span>
          )}
        </span>
      </div>
      {item.subtext && (
        <p style={styleFor("itemDescription", { margin: "0.05vw 0 0 0", opacity: 0.75 })}>
          {item.subtext}
        </p>
      )}
      {item.description && (
        <p style={styleFor("itemDescription", { margin: "0.1vw 0 0 0" })}>
          {item.description}
        </p>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        ...styleFor("global"),
        position: "relative",
        padding: "0.8vw 0.8vw 3vw 0.8vw",
        boxSizing: "border-box",
      }}
    >
      <style>{COLUMN_CSS}</style>
      <div className="menu-flow">
        {menu.map((sec, si) => (
          <section key={si} style={{ marginBottom: "1rem" }}>
            {renderSectionHeader(sec)}
            {sec.items.map((item, ii) => (
              <div key={ii}>{renderItem(item)}</div>
            ))}
          </section>
        ))}
      </div>

      {debug && (
        <div
          style={{
            position: "fixed",
            top: "0.5vw",
            right: "0.5vw",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "0.4vw 0.8vw",
            borderRadius: "0.3vw",
            fontSize: "0.7vw",
            zIndex: 50,
            fontFamily: "monospace",
          }}
        >
          {menu.length} sections
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: "0.6vw",
          right: "0.8vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.3vw",
          lineHeight: 1,
        }}
      >
        <span style={styleFor("brand", { fontSize: "2.4vw", fontStyle: "normal" })}>✱</span>
        <span style={styleFor("brand")}>Savsav</span>
      </div>
    </div>
  );
}
