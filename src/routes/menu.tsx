import { createFileRoute, useRouter } from "@tanstack/react-router";
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";
import {
  getDisplayMenu,
  invalidateDisplayMenuCache,
  type DisplayMenu,
} from "@/lib/menu-display.functions";
import {
  listMenuSchedulePublic,
  listMenuSpecialsPublic,
  pickActiveMenuKey,
  type ScheduleEntry,
  type SpecialEntry,
} from "@/lib/menu-schedule.functions";
import { collectUsedFonts, ensureGoogleFontsLoaded } from "@/lib/menu-fonts";
import savsavLogoSvg from "@/assets/logo.svg";

const MENU_ANIMATION_SRC = "/menu-animation-v2.webm";
const ASTERISK_ANIMATION_SRC = "/asterisk-animation.webm";


export const Route = createFileRoute("/menu")({
  validateSearch: (s: Record<string, unknown>): { debug?: boolean; menu?: MenuFilter; lang?: "fr" | "en" } => {
    const debug = s.debug === true || s.debug === "1" || s.debug === "true";
    const menu = typeof s.menu === "string" && s.menu.length > 0 ? s.menu : undefined;
    const lang = s.lang === "fr" || s.lang === "en" ? s.lang : undefined;
    return { ...(debug ? { debug: true } : {}), ...(menu ? { menu } : {}), ...(lang ? { lang } : {}) };
  },
  loaderDeps: ({ search }) => ({ menu: search.menu }),
  loader: async ({ deps }) => {
    const isAuto = deps.menu === "auto";
    const [formatting, displayMenu, schedule, specials] = await Promise.all([
      getMenuFormatting().catch(() => ({} as MenuFormatting)),
      getDisplayMenu({ data: {} }),
      isAuto
        ? listMenuSchedulePublic().catch(() => ({ entries: [] as ScheduleEntry[] }))
        : Promise.resolve({ entries: [] as ScheduleEntry[] }),
      isAuto
        ? listMenuSpecialsPublic().catch(() => ({ specials: [] as SpecialEntry[] }))
        : Promise.resolve({ specials: [] as SpecialEntry[] }),
    ]);
    return {
      formatting: (formatting ?? {}) as MenuFormatting,
      displayMenu,
      scheduleEntries: schedule.entries,
      specialEntries: specials.specials,
    };
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: "Menu Display" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  pendingComponent: () => (
    <div style={{ height: "100vh", background: "#fff" }} aria-hidden="true" />
  ),
  errorComponent: ({ error }) => (
    <div
      style={{
        height: "100vh",
        background: "#fff",
        color: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Menu unavailable</div>
        <div style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.7 }}>
          {error?.message || "Please try again in a moment."}
        </div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div
      style={{
        height: "100vh",
        background: "#fff",
        color: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        textTransform: "uppercase",
      }}
    >
      Menu not found
    </div>
  ),
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
  hidden?: boolean;
  soldOut?: boolean;
  modifications?: { name: string; price_modifier_cents: number }[];
};
type Subsection = { subsection: string; items: MenuItem[]; hidden?: boolean; soldOut?: boolean };
type Menu = { section: string; subsections: Subsection[]; hidden?: boolean; soldOut?: boolean };
type MenuFilter = string;

function isVisibleOnMenu(visibleMenus: string[], selectedMenu?: MenuFilter) {
  return !selectedMenu || visibleMenus.length === 0 || visibleMenus.includes(selectedMenu);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isSoldOutToday(d?: string | null): boolean {
  return !!d && d === todayISO();
}

function pickText(base: string, en: string | null | undefined, lang?: "fr" | "en"): string {
  if (lang === "en") return (en && en.trim().length > 0) ? en : base;
  return base;
}

function mapDisplayMenuToMenus(displayMenu: DisplayMenu | null, selectedMenu?: MenuFilter, lang?: "fr" | "en"): Menu[] {
  if (!displayMenu) return [];

  return displayMenu.sections
    .filter((section) => isVisibleOnMenu(section.visible_menus, selectedMenu))
    .map((section) => ({
      section: pickText(section.name, section.name_en, lang),
      hidden: section.is_hidden,
      soldOut: isSoldOutToday(section.sold_out_date),
      subsections: section.subsections
        .filter((subsection) => isVisibleOnMenu(subsection.visible_menus, selectedMenu))
        .map((subsection) => ({
          subsection: pickText(subsection.name, subsection.name_en, lang),
          hidden: subsection.is_hidden,
          soldOut: isSoldOutToday(subsection.sold_out_date),
          items: subsection.items.map((item) => ({
            name: pickText(item.title, item.title_en, lang),
            price: item.base_price_cents > 0 ? item.base_price_cents / 100 : undefined,
            description: pickText(item.description, item.description_en, lang),
            hidden: item.is_hidden,
            soldOut: isSoldOutToday(item.sold_out_date),
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

function Price({
  price,
  style,
  supStyle,
}: {
  price: number;
  style?: React.CSSProperties;
  supStyle?: React.CSSProperties;
}) {
  const sign = price < 0 ? "-" : "";
  const abs = Math.abs(price);
  const dollars = Math.floor(abs);
  const cents = Math.round((abs - dollars) * 100);
  return (
    <span style={{ whiteSpace: "nowrap", ...style }}>
      {sign}
      {dollars}
      {cents > 0 && (
        <span
          style={{
            fontSize: "0.55em",
            fontWeight: 700,
            display: "inline-block",
            verticalAlign: "baseline",
            position: "relative",
            top: "-0.5em",
            marginLeft: "0.08em",
            ...supStyle,
          }}
        >
          {cents.toString().padStart(2, "0")}
        </span>
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
:root { --menu-scale: 1; }

.menu-flow {
  column-count: 1;
  column-gap: 2.5rem;
  column-fill: auto;
  overflow: hidden;
  position: relative;
  transform: scale(var(--menu-scale, 1));
  transform-origin: top left;
  width: calc(100% / var(--menu-scale, 1));
  height: calc((100vh - 3rem) / var(--menu-scale, 1));
}
@media (min-width: 600px) { .menu-flow { column-count: 2; } }
@media (min-width: 900px) { .menu-flow { column-count: 3; } }
@media (min-width: 1200px) { .menu-flow { column-count: 4; } }
.menu-flow > .menu-section-group {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  display: block;
  margin-bottom: 1rem;
}
.menu-flow > .menu-section-group.new-column {
  break-before: column;
  -webkit-column-break-before: always;
  page-break-before: always;
}
.menu-section-group > .menu-section-block {
  margin-bottom: 0.5rem;
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
.menu-flow .subsection-title-with-first {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
}
.menu-end-logo {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  width: 100%;
  margin-top: 0.5rem;
}
.menu-end-logo img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}
.menu-section-block {
  position: relative;
  width: 85%;
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
  object-fit: contain;
  object-position: left;
  display: block;
  border: none;
  z-index: 1;
}
.section-title-text {
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  z-index: 2;
  color: #fff;
  font-weight: 900;
  font-size: clamp(2rem, 5vw, 5rem);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin: 0;
  padding: 0;
  text-align: left;
  line-height: 1;
  pointer-events: none;
}

.menu-section-title {
  display: block;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: 2.5px solid #000;
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
  line-height: 1.4;
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
  text-align: justify;
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
.section-asterisk-filler {
  width: 100%;
  min-height: 8vh;
  max-height: 35vh;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
}
.section-asterisk-filler video {
  width: 100%;
  height: 100%;
  max-height: 35vh;
  object-fit: contain;
  object-position: center center;
  display: block;
}
`;

function DisplayPage() {
  const { debug, menu, lang } = Route.useSearch();
  const { formatting, displayMenu, scheduleEntries } = Route.useLoaderData();
  const router = useRouter();
  const invalidateCache = useServerFn(invalidateDisplayMenuCache);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const isAuto = menu === "auto";

  // Load only the Google Fonts actually referenced by the saved formatting.
  useEffect(() => {
    const { families, weights } = collectUsedFonts(formatting, DEFAULT_FORMATTING);
    ensureGoogleFontsLoaded(families, weights);
  }, [formatting]);

  // Re-evaluate active menu every minute when in auto mode
  useEffect(() => {
    if (!isAuto) return;
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isAuto]);

  // Realtime: on broadcast, clear server cache then re-run the loader.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (cancelled) return;
      const channel = supabase
        .channel("menu-display")
        .on("broadcast", { event: "refresh" }, async () => {
          try {
            await invalidateCache();
          } catch (e) {
            console.error("[display] cache invalidation failed", e);
          }
          router.invalidate();
        })
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [router, invalidateCache]);

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
        textAlign: merged.textAlign,
      };
    };
  }, [formatting]);

  const globalFontFamily = useMemo(() => {
    return (
      formatting.global?.fontFamily ?? DEFAULT_FORMATTING.global?.fontFamily
    );
  }, [formatting]);

  const activeMenuKey = useMemo(() => {
    if (!isAuto) return menu;
    const picked = pickActiveMenuKey(scheduleEntries, new Date(nowTick));
    return picked ?? undefined;
  }, [isAuto, menu, scheduleEntries, nowTick]);

  const menus = useMemo(
    () => mapDisplayMenuToMenus(displayMenu, activeMenuKey, lang),
    [displayMenu, activeMenuKey, lang],
  );

  const SOLD_OUT_COLOR = "#e5e5e5";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  type AsteriskPlacement = { top: number; left: number; width: number; height: number };
  const [asteriskPlacements, setAsteriskPlacements] = useState<AsteriskPlacement[]>([]);
  const MIN_GAP_PX = 120;
  const MAX_ASTERISK_PX = 320;

  // Single-pass auto-fit: measure once, calculate scale, apply.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const MIN_SCALE = 0.75;
    let timer: number | null = null;
    let lastScale: number | null = null;
    let lastSignature: string | null = null;

    const computeSignature = () => {
      // Cheap content+viewport fingerprint so we can bail when nothing changed.
      return `${displayMenu?.generated_at ?? ""}|${activeMenuKey ?? ""}|${window.innerWidth}x${window.innerHeight}`;
    };

    const apply = (scale: number) => {
      if (lastScale !== null && Math.abs(scale - lastScale) < 0.001) return;
      lastScale = scale;
      document.documentElement.style.setProperty("--menu-scale", String(scale));
    };

    const fit = (force = false) => {
      const flow = flowRef.current;
      if (!flow) return;
      const sig = computeSignature();
      if (!force && sig === lastSignature) return;
      lastSignature = sig;

      // Reset to natural size, then measure on the next frame so layout settles.
      document.documentElement.style.setProperty("--menu-scale", "1");
      lastScale = 1;
      requestAnimationFrame(() => {
        const flowEl = flowRef.current;
        if (!flowEl) return;

        // Measure natural content extent. With overflow:hidden, scrollWidth/scrollHeight
        // still report the unclipped size of children, which is what we want.
        const naturalWidth = flowEl.scrollWidth;
        const naturalHeight = flowEl.scrollHeight;
        const availableWidth = flowEl.clientWidth;
        const availableHeight = flowEl.clientHeight;

        const widthRatio = availableWidth / Math.max(availableWidth, naturalWidth);
        const heightRatio = availableHeight / Math.max(availableHeight, naturalHeight);
        const ratio = Math.min(widthRatio, heightRatio, 1);

        const scale = Math.max(MIN_SCALE, ratio);
        apply(scale);

        if (scale <= MIN_SCALE + 0.001 && ratio < MIN_SCALE) {
          setIsOverflowing(true);
          const overflowPx = Math.max(0, naturalHeight - availableHeight, naturalWidth - availableWidth);
          setHiddenCount(Math.max(1, Math.ceil(overflowPx / 60)));
          if (import.meta.env.DEV) {
            console.warn("[Menu] Content overflows viewport. Scale floor reached.");
          }
        } else {
          setIsOverflowing(false);
          setHiddenCount(0);
        }
      });
    };

    fit(true);

    // Re-fit once webfonts finish loading (Safari first-load: layout measured with fallback metrics).
    if ((document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
      (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready
        .then(() => fit(true))
        .catch(() => {});
    }

    const onResize = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => fit(false), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) window.clearTimeout(timer);
    };
  }, [menus, displayMenu, activeMenuKey]);

  // Dynamic asterisk placement: measure trailing column gaps and place asterisks
  useEffect(() => {
    const measure = () => {
      const flow = flowRef.current;
      if (!flow) return;
      const flowRect = flow.getBoundingClientRect();
      const cs = getComputedStyle(flow);
      const columnGap = parseFloat(cs.columnGap) || 0;
      const columnCount = parseInt(cs.columnCount) || 1;
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--menu-scale")) || 1;
      const unscaledWidth = flowRect.width / scale;
      const unscaledHeight = flowRect.height / scale;
      const columnWidth = (unscaledWidth - columnGap * (columnCount - 1)) / columnCount;

      const lastElements = flow.querySelectorAll<HTMLElement>(".subsection-last-of-section");
      const placements: AsteriskPlacement[] = [];

      lastElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elBottomUnscaled = (rect.bottom - flowRect.top) / scale;
        const elLeftUnscaled = (rect.left - flowRect.left) / scale;
        const gap = unscaledHeight - elBottomUnscaled;
        if (gap < MIN_GAP_PX) return;

        const columnIndex = Math.max(
          0,
          Math.min(columnCount - 1, Math.floor((elLeftUnscaled + 1) / (columnWidth + columnGap))),
        );
        const columnLeft = columnIndex * (columnWidth + columnGap);
        const height = Math.min(gap - 16, MAX_ASTERISK_PX);
        const top = elBottomUnscaled + 8;
        placements.push({ top, left: columnLeft, width: columnWidth, height });
      });

      setAsteriskPlacements((prev) => {
        if (prev.length !== placements.length) return placements;
        const same = prev.every((p, i) =>
          Math.abs(p.top - placements[i].top) < 1 &&
          Math.abs(p.left - placements[i].left) < 1 &&
          Math.abs(p.width - placements[i].width) < 1 &&
          Math.abs(p.height - placements[i].height) < 1,
        );
        return same ? prev : placements;
      });
    };

    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.setTimeout(measure, 50));
    });

    if ((document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
      (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready
        .then(() => window.setTimeout(measure, 100))
        .catch(() => {});
    }

    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [menus, displayMenu, activeMenuKey]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "none";
      return () => { document.body.style.cursor = prev; };
    }
  }, [isFullscreen]);

  const enterFullscreen = async () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch {
      // silently ignore if fullscreen is blocked or unsupported
    }
  };

  const renderItem = (item: MenuItem, soldOut: boolean) => (
    <div className="menu-item" style={{ ...(item.hidden ? { opacity: 0.35 } : {}), ...(soldOut ? { color: SOLD_OUT_COLOR } : {}) }}>
      <div className="menu-item-row" style={{ ...styleFor("itemTitle"), ...(soldOut ? { color: SOLD_OUT_COLOR } : {}) }}>
        <span className="menu-item-name">{item.name}</span>
        <span className="menu-item-price">
          {item.priceLabel ? (
            <PriceLabel label={item.priceLabel} />
          ) : typeof item.price === "number" ? (
            <Price
              price={item.price}
              style={styleFor("price")}
              supStyle={styleFor("priceSuperscript")}
            />
          ) : null}
        </span>
      </div>
      {item.description && (
        <p className="menu-item-sub" style={{ ...styleFor("itemDescription"), ...(soldOut ? { color: SOLD_OUT_COLOR } : {}) }}>
          {item.description}
        </p>
      )}
      {item.subtext && (
        <p className="menu-item-sub" style={{ ...styleFor("itemDescription"), ...(soldOut ? { color: SOLD_OUT_COLOR } : {}) }}>
          {item.subtext}
        </p>
      )}
      {item.inlineNote && (
        <span className="menu-item-note" style={{ ...styleFor("modification"), ...(soldOut ? { color: SOLD_OUT_COLOR } : {}) }}>
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
        {menus.map((menu, mi) => {
          const renderSubsection = (sub: Subsection, si: number) => {
            const dim = menu.hidden || sub.hidden;
            const soldOut = !!menu.soldOut || !!sub.soldOut;
            const isLast = si === menu.subsections.length - 1;
            const isFinalSection = mi === menus.length - 1;
            const tagAsLast = isLast && !isFinalSection;
            return (
              <section
                key={`${menu.section}-${si}`}
                className={tagAsLast ? "subsection-last-of-section" : undefined}
                data-section-index={mi}
                style={dim ? { opacity: 0.35 } : undefined}
              >
                <div className="subsection-title-with-first">
                  <h2 className="menu-section-title" style={{ ...styleFor("subsection"), ...(soldOut ? { color: SOLD_OUT_COLOR, borderBottomColor: SOLD_OUT_COLOR } : {}) }}>
                    {sub.subsection}
                  </h2>
                  {sub.items[0] && (
                    <div>{renderItem(sub.items[0], soldOut || !!sub.items[0].soldOut)}</div>
                  )}
                </div>
                {sub.items.slice(1).map((item, ii) => (
                  <div key={ii + 1}>{renderItem(item, soldOut || !!item.soldOut)}</div>
                ))}
              </section>
            );
          };
          const [firstSub, ...restSubs] = menu.subsections;
          return (
            <Fragment key={menu.section}>
              <div className={`menu-section-group${mi > 0 ? " new-column" : ""}`}>
                <div className="menu-section-block" aria-label={menu.section} style={menu.hidden ? { opacity: 0.35 } : undefined}>
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
                {firstSub && renderSubsection(firstSub, 0)}
              </div>
              {restSubs.map((sub, idx) => renderSubsection(sub, idx + 1))}
            </Fragment>
          );
        })}
        <div className="menu-end-logo subsection-last-of-section" data-section-index={Math.max(0, menus.length - 1)}>
          <img
            src={savsavLogoSvg}
            alt="SAVSAV"
            onError={(e) => {
              const c = (e.currentTarget as HTMLImageElement).parentElement;
              if (c) c.style.display = "none";
            }}
          />
        </div>
        {asteriskPlacements.map((p, i) => (
          <div
            key={i}
            className="floating-asterisk"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: p.top,
              left: p.left,
              width: p.width,
              height: p.height,
              pointerEvents: "none",
            }}
          >
            <video
              src={ASTERISK_ANIMATION_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
                display: "block",
              }}
              onError={(e) => {
                const parent = (e.currentTarget as HTMLVideoElement).parentElement as HTMLElement | null;
                if (parent) parent.style.display = "none";
              }}
            />
          </div>
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
          {menus.length} sections
        </div>
      )}
      {!isFullscreen && (
        <button
          onClick={enterFullscreen}
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            zIndex: 100,
            background: "#fff",
            color: "#000",
            border: "1px solid #000",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "0.75rem",
            padding: "0.5rem 1rem",
            cursor: "pointer",
            fontFamily: globalFontFamily,
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          }}
        >
          Play Fullscreen
        </button>
      )}
      {import.meta.env.DEV && isOverflowing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "#d00",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            zIndex: 9999,
            textAlign: "center",
          }}
        >
          ⚠ Menu content is overflowing — {hiddenCount} item{hiddenCount === 1 ? "" : "s"} may be hidden. Remove items or increase viewport size.
        </div>
      )}
    </div>
  );
}
