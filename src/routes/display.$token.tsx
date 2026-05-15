import { createFileRoute } from "@tanstack/react-router";
import React, { Fragment, useEffect, useMemo, useState } from "react";
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
const MENU_FOOTER_ANIMATION_SRC = "/menu-footer-animation.webm";

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
type Subsection = { subsection: string; items: MenuItem[] };
type Menu = { section: string; subsections: Subsection[] };

const menus: Menu[] = [
  {
    section: "LUNCH",
    subsections: [
      {
        subsection: "PLATS",
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
        subsection: "SPÉCIAL DE LA SEMAINE",
        items: [
          { name: "BOL HALLOUMI", price: 17.75, description: "HALLOUMI GRILLÉ AU MIEL PIQUANT, QUINOA, CONCOMBRES, TOMATES, YOGOURT GREC, ROQUETTE, FINES HERBES" },
        ],
      },
      {
        subsection: "SIDES",
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
    ],
  },
  {
    section: "DRINKS",
    subsections: [
      {
        subsection: "BIÈRES EN FÛT",
        items: [
          { name: "DDC! BLONDE", price: 9 },
          { name: "DDC! IPA", price: 9 },
        ],
      },
      {
        subsection: "COCKTAILS",
        items: [
          { name: "TINTO DE VERANO", price: 9 },
          { name: "MIMOSA", price: 9 },
        ],
      },
      {
        subsection: "VINS AU VERRE",
        items: [
          { name: "BLANC", priceLabel: "PRIX DU MARCHÉ" },
          { name: "ROUGE", priceLabel: "PRIX DU MARCHÉ" },
          { name: "MACÉRATION", priceLabel: "PRIX DU MARCHÉ" },
        ],
      },
      {
        subsection: "CLASSIQUES",
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
        subsection: "SPÉCIALITÉS",
        items: [
          { name: "\"MATCHA CLOUD\"", price: 5, subtext: "EAU DE COCO + MATCHA FOAM" },
          { name: "MATCHA AUX FRAISES", price: 9 },
          { name: "LIMOMATCHA", price: 7 },
          { name: "LATTÉ HCMC", price: 7, subtext: "LAIT CONDENSÉ SUCRÉ" },
          { name: "THÉ THAÏLANDAIS", price: 5, inlineNote: "+ LARGE +2" },
          { name: "COLD BREW!!!", price: 6 },
        ],
      },
    ],
  },
];

function Price({ price }: { price: number }) {
  const sign = price < 0 ? "-" : "";
  const abs = Math.abs(price);
  const dollars = Math.floor(abs);
  const cents = Math.round((abs - dollars) * 100);
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {sign}
      {dollars}
      {cents > 0 && (
        <sup
          style={{
            fontSize: "0.6em",
            fontWeight: 700,
            verticalAlign: "super",
            lineHeight: 0,
            marginLeft: "0.05em",
          }}
        >
          {cents.toString().padStart(2, "0")}
        </sup>
      )}
    </span>
  );
}

function PriceLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "0.7em",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const COLUMN_CSS = `
.menu-flow {
  column-count: 1;
  column-gap: 2.5rem;
  column-fill: auto;
  height: calc(100vh - 3rem);
  overflow: hidden;
}
@media (min-width: 600px) { .menu-flow { column-count: 2; } }
@media (min-width: 900px) { .menu-flow { column-count: 3; } }
@media (min-width: 1200px) { .menu-flow { column-count: 4; } }
.menu-flow > .menu-section-block,
.menu-flow > .menu-footer-block {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  display: block;
  margin-bottom: 1rem;
}
.menu-flow > section {
  display: block;
  margin-bottom: 1rem;
}
.menu-flow .menu-item {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
}
.menu-footer-block {
  width: 100%;
  min-height: 35vh;
  max-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  margin-top: 0.5rem;
}
.menu-footer-block video {
  width: 100%;
  height: 100%;
  max-height: 60vh;
  object-fit: contain;
  object-position: center center;
  display: block;
  border: none;
}
.menu-section-block {
  width: 100%;
  height: 240px;
  background: #000;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 2.75rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.menu-section-title {
  display: inline-block;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  line-height: 1.1;
  break-after: avoid;
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
}
.menu-item { margin-bottom: 0.55rem; }
.menu-item-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  font-size: 0.95rem;
  line-height: 1.15;
}
.menu-item-name { flex: 1; }
.menu-item-price { white-space: nowrap; font-weight: 700; }
.menu-item-sub {
  font-size: 0.72rem;
  font-weight: 300;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1.2;
  margin: 0.1rem 0 0 0;
}
.menu-item-note {
  display: block;
  text-align: right;
  font-size: 0.7rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 0.1rem;
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
    return (key: FormattingKey): React.CSSProperties => {
      const merged: TextStyle = {
        ...DEFAULT_FORMATTING.global,
        ...formatting.global,
        ...DEFAULT_FORMATTING[key],
        ...formatting[key],
      };
      return {
        fontFamily: merged.fontFamily,
        fontSize: merged.fontSize,
        fontWeight: merged.fontWeight as React.CSSProperties["fontWeight"],
        letterSpacing: merged.letterSpacing,
        lineHeight: merged.lineHeight,
        textTransform: merged.textTransform,
        color: merged.color,
        fontStyle: merged.fontStyle,
      };
    };
  }, [formatting]);

  const globalFontFamily = useMemo(() => {
    return (
      formatting.global?.fontFamily ?? DEFAULT_FORMATTING.global?.fontFamily
    );
  }, [formatting]);

  const renderItem = (item: MenuItem) => (
    <div className="menu-item">
      <div className="menu-item-row" style={styleFor("itemTitle")}>
        <span className="menu-item-name">{item.name}</span>
        <span className="menu-item-price">
          {item.priceLabel ? (
            <PriceLabel label={item.priceLabel} />
          ) : typeof item.price === "number" ? (
            <Price price={item.price} />
          ) : null}
        </span>
      </div>
      {item.description && (
        <p className="menu-item-sub" style={styleFor("itemDescription")}>
          {item.description}
        </p>
      )}
      {item.subtext && (
        <p className="menu-item-sub" style={styleFor("itemDescription")}>
          {item.subtext}
        </p>
      )}
      {item.inlineNote && (
        <span className="menu-item-note" style={styleFor("modification")}>
          {item.inlineNote}
        </span>
      )}
    </div>
  );

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        background: "#fff",
        color: "#000",
        fontFamily: globalFontFamily,
        position: "relative",
        padding: "1rem 1rem 2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <style>{`html, body { overflow: hidden; height: 100%; margin: 0; }`}</style>
      <style>{COLUMN_CSS}</style>

      <div className="menu-flow">
        {menus.map((menu) => (
          <Fragment key={menu.section}>
            <div className="menu-section-block">
              <video
                src={MENU_ANIMATION_SRC}
                autoPlay
                muted
                playsInline
                loop
                controls={false}
                preload="metadata"
                aria-hidden="true"
                onError={(e) => {
                  (e.currentTarget as HTMLVideoElement).style.display = "none";
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  border: "none",
                  display: "block",
                  zIndex: 0,
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>{menu.section}</span>
            </div>
            {menu.subsections.map((sub, si) => (
              <section key={`${menu.section}-${si}`}>
                <h2 className="menu-section-title">{sub.subsection}</h2>
                {sub.items.map((item, ii) => (
                  <div key={ii}>{renderItem(item)}</div>
                ))}
              </section>
            ))}
          </Fragment>
        ))}
        <div className="menu-footer-block">
          <video
            src={MENU_FOOTER_ANIMATION_SRC}
            autoPlay
            muted
            playsInline
            loop
            controls={false}
            preload="metadata"
            aria-hidden="true"
            onError={(e) => {
              const c = (e.currentTarget as HTMLVideoElement).parentElement;
              if (c) c.style.display = "none";
            }}
          />
        </div>
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
          {menus.length} sections
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          right: "1.25rem",
          display: "flex",
          alignItems: "baseline",
          gap: "0.4rem",
          color: "#000",
          fontFamily: globalFontFamily,
        }}
      >
        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>✱</span>
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Savsav
        </span>
      </div>
    </div>
  );
}
