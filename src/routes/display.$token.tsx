import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";
import { getDisplayMenu, type DisplayMenu } from "@/lib/menu-display.functions";
import { ensureGoogleFontsLoaded } from "@/lib/menu-fonts";
import savsavLogoSvg from "@/assets/logo.svg";

const MENU_ANIMATION_SRC = "/menu-animation.webm";
const MENU_FOOTER_ANIMATION_SRC = "/menu-footer-animation.webm";

export const Route = createFileRoute("/display/$token")({
  validateSearch: (s: Record<string, unknown>): { debug?: boolean; menu?: MenuFilter } => {
    const debug = s.debug === true || s.debug === "1" || s.debug === "true";
    const menu = isMenuFilter(s.menu) ? s.menu : undefined;
    return { ...(debug ? { debug: true } : {}), ...(menu ? { menu } : {}) };
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
  modifications?: { name: string; price_modifier_cents: number }[];
};
type Subsection = { subsection: string; items: MenuItem[] };
type Menu = { section: string; subsections: Subsection[] };
type MenuFilter = "breakfast" | "lunch" | "dinner";

function isMenuFilter(value: unknown): value is MenuFilter {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

function isVisibleOnMenu(visibleMenus: string[], selectedMenu?: MenuFilter) {
  return !selectedMenu || visibleMenus.length === 0 || visibleMenus.includes(selectedMenu);
}

function mapDisplayMenuToMenus(displayMenu: DisplayMenu | null, selectedMenu?: MenuFilter): Menu[] {
  if (!displayMenu) return [];

  return displayMenu.sections
    .filter((section) => isVisibleOnMenu(section.visible_menus, selectedMenu))
    .map((section) => ({
      section: section.name,
      subsections: section.subsections
        .filter((subsection) => isVisibleOnMenu(subsection.visible_menus, selectedMenu))
        .map((subsection) => ({
          subsection: subsection.name,
          items: subsection.items.map((item) => ({
            name: item.title,
            price: item.base_price_cents / 100,
            description: item.description,
            modifications: item.modifications.map((modification) => ({
              name: modification.name,
              price_modifier_cents: modification.price_modifier_cents,
            })),
          })),
        }))
        .filter((subsection) => subsection.items.length > 0),
    }))
    .filter((section) => section.subsections.length > 0);
}

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
  position: relative;
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
.menu-flow > .menu-section-block {
  break-after: avoid;
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
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
.trailing-block {
  position: absolute;
  left: var(--trailing-left, 0px);
  top: var(--trailing-top, 65%);
  bottom: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  width: var(--trailing-width, 100%);
  height: auto;
  min-height: 0;
  gap: 0.5rem;
  margin-top: 0;
  padding-bottom: 0.5rem;
  box-sizing: border-box;
  pointer-events: none;
}
.trailing-asterisk {
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.trailing-asterisk video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
  display: block;
}
.trailing-logo {
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: clamp(3.5rem, 11vh, 6.5rem);
  padding-bottom: 0;
  overflow: visible;
}
.trailing-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  display: block;
}
.menu-section-block {
  position: relative;
  width: 75%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 0;
  margin-right: auto;
}
.section-title-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  display: block;
  border: none;
  z-index: 1;
}
.section-title-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  color: #fff;
  font-weight: 900;
  font-size: clamp(2rem, 5vw, 5rem);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin: 0;
  padding: 0;
  text-align: center;
  line-height: 1;
  pointer-events: none;
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
  const { token } = Route.useParams();
  const { debug, menu } = Route.useSearch();
  const fetchFormatting = useServerFn(getMenuFormatting);
  const fetchDisplayMenu = useServerFn(getDisplayMenu);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const [formatting, setFormatting] = useState<MenuFormatting>({});
  const [displayMenu, setDisplayMenu] = useState<DisplayMenu | null>(null);
  const [refreshKey, setRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    ensureGoogleFontsLoaded();
  }, []);

  useEffect(() => {
    fetchFormatting({}).then((f) => setFormatting(f || {})).catch(() => {});
    fetchDisplayMenu({ data: { token, refreshKey } })
      .then(setDisplayMenu)
      .catch((error) => console.error("[display] failed to load menu", error));
  }, [fetchFormatting, fetchDisplayMenu, token, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel("menu-display")
      .on("broadcast", { event: "refresh" }, () => setRefreshKey(Date.now()))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let frameIds: number[] = [];
    const updateTrailingColumn = () => {
      const flow = flowRef.current;
      if (!flow) return;

      const flowRect = flow.getBoundingClientRect();
      const sections = Array.from(flow.querySelectorAll<HTMLElement>("section"));
      const computed = window.getComputedStyle(flow);
      const columnCount = Math.max(1, Number.parseInt(computed.columnCount, 10) || 1);
      const columnGap = Number.parseFloat(computed.columnGap) || 0;
      const columnWidth = (flowRect.width - columnGap * (columnCount - 1)) / columnCount;
      const lastColumnLeft = (columnWidth + columnGap) * (columnCount - 1);
      const lastColumnStart = flowRect.left + lastColumnLeft - 1;
      const lastColumnEnd = lastColumnStart + columnWidth + 2;
      const lastVisibleInLastColumn = sections
        .map((section) => section.getBoundingClientRect())
        .filter((rect) => rect.left >= lastColumnStart && rect.right <= lastColumnEnd)
        .sort((a, b) => b.bottom - a.bottom)[0];
      const measuredTop = lastVisibleInLastColumn
        ? lastVisibleInLastColumn.bottom - flowRect.top + 10
        : flowRect.height * 0.65;
      const top = Math.max(0, Math.min(measuredTop, flowRect.height - 128));

      const styleTarget = flow.parentElement ?? flow;
      styleTarget.style.setProperty("--trailing-left", `${lastColumnLeft}px`);
      styleTarget.style.setProperty("--trailing-width", `${columnWidth}px`);
      styleTarget.style.setProperty("--trailing-top", `${top}px`);
    };
    const scheduleUpdate = () => {
      frameIds.forEach((id) => cancelAnimationFrame(id));
      const timeoutIds = [80, 250, 600].map((delay) => window.setTimeout(updateTrailingColumn, delay));
      frameIds = [
        requestAnimationFrame(updateTrailingColumn),
        requestAnimationFrame(() => requestAnimationFrame(updateTrailingColumn)),
      ];
      return timeoutIds;
    };

    const timeoutIds = scheduleUpdate();
    document.fonts?.ready.then(scheduleUpdate).catch(() => {});
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      frameIds.forEach((id) => cancelAnimationFrame(id));
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [formatting]);

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

  const menus = useMemo(() => mapDisplayMenuToMenus(displayMenu, menu), [displayMenu, menu]);

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
          + {item.inlineNote.replace(/^\s*\+\s*/, "").replace(/\+\s*(\d+(?:[.,]\d+)?)\s*$/, "$1").trim()}
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

      <div className="menu-flow" ref={flowRef}>
        {menus.map((menu) => (
          <Fragment key={menu.section}>
            <div className="menu-section-block" aria-label={menu.section}>
              <video
                className="section-title-video"
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
              />
              <h2 className="section-title-text" style={styleFor("section")}>
                {menu.section}
              </h2>
            </div>
            {menu.subsections.map((sub, si) => (
              <section key={`${menu.section}-${si}`}>
                <h2 className="menu-section-title" style={styleFor("subsection")}>
                  {sub.subsection}
                </h2>
                {sub.items.map((item, ii) => (
                  <div key={ii}>{renderItem(item)}</div>
                ))}
              </section>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="trailing-block">
        <div className="trailing-asterisk">
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
        <div className="trailing-logo">
          <img
            src={savsavLogoSvg}
            alt="SAVSAV"
            onError={(e) => {
              const c = (e.currentTarget as HTMLImageElement).parentElement;
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
    </div>
  );
}
