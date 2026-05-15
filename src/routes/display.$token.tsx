import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getDisplayMenu,
  type DisplayMenu,
  type DisplaySection,
  type DisplaySubsection,
} from "@/lib/menu-display.functions";
import {
  getMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";
import { ensureGoogleFontsLoaded } from "@/lib/menu-fonts";
import { supabase } from "@/integrations/supabase/client";

const MENU_ANIMATION_SRC = "/menu-animation.webm";

type MenuType = "breakfast" | "lunch" | "dinner";
const MENU_TYPES: MenuType[] = ["breakfast", "lunch", "dinner"];

export const Route = createFileRoute("/display/$token")({
  validateSearch: (s: Record<string, unknown>): { menu?: MenuType; debug?: boolean } => {
    const m = typeof s.menu === "string" ? s.menu.toLowerCase() : "";
    const debug = s.debug === true || s.debug === "1" || s.debug === "true";
    return {
      ...(MENU_TYPES.includes(m as MenuType) ? { menu: m as MenuType } : {}),
      ...(debug ? { debug: true } : {}),
    };
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

function FormattedPrice({ cents }: { cents: number }) {
  if (!cents) return null;
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
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

type Atom =
  | {
      kind: "section-header";
      key: string;
      sectionId: string;
      section: DisplaySection;
      continued?: boolean;
    }
  | {
      kind: "subsection";
      key: string;
      sectionId: string;
      section: DisplaySection;
      sub: DisplaySubsection;
    };

function DisplayPage() {
  const { token } = Route.useParams();
  const { menu: menuFilter, debug } = Route.useSearch();
  const fetchMenu = useServerFn(getDisplayMenu);
  const fetchFormatting = useServerFn(getMenuFormatting);
  const [menu, setMenu] = useState<DisplayMenu | null>(null);
  const [formatting, setFormatting] = useState<MenuFormatting>({});
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const [columnHeight, setColumnHeight] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});

  const load = async () => {
    try {
      const [m, f] = await Promise.all([
        fetchMenu({ data: { token } }),
        fetchFormatting({}).catch(() => ({})),
      ]);
      setMenu(m);
      setFormatting(f || {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    }
  };

  useEffect(() => {
    ensureGoogleFontsLoaded();
    load();
    const channel = supabase
      .channel("menu-display")
      .on("broadcast", { event: "refresh" }, () => {
        load();
      })
      .subscribe();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const globalMerged: TextStyle = {
    ...DEFAULT_FORMATTING.global,
    ...formatting.global,
  };

  const baseShell: React.CSSProperties = {
    minHeight: "100vh",
    background: "#fff",
    color: globalMerged.color,
    fontFamily: globalMerged.fontFamily,
    textTransform: globalMerged.textTransform,
    fontWeight: globalMerged.fontWeight as React.CSSProperties["fontWeight"],
  };

  const filteredSections = useMemo(() => {
    if (!menu) return [];
    return menuFilter
      ? menu.sections
          .filter((s) => s.visible_menus.includes(menuFilter))
          .map((s) => ({
            ...s,
            subsections: s.subsections.filter((sub) =>
              sub.visible_menus.includes(menuFilter),
            ),
          }))
          .filter((s) => s.subsections.length > 0)
      : menu.sections;
  }, [menu, menuFilter]);

  const atoms = useMemo<Atom[]>(() => {
    const out: Atom[] = [];
    filteredSections.forEach((sec) => {
      out.push({
        kind: "section-header",
        key: `h-${sec.id}`,
        sectionId: sec.id,
        section: sec,
      });
      sec.subsections.forEach((sub) => {
        out.push({
          kind: "subsection",
          key: `s-${sub.id}`,
          sectionId: sec.id,
          section: sec,
          sub,
        });
      });
    });
    return out;
  }, [filteredSections]);

  // Measure container/column geometry
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.columnGap || cs.gap || "0");
      const w =
        (el.clientWidth - padX - gap * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
      const h = el.clientHeight - padY;
      setColumnWidth(Math.max(0, w));
      setColumnHeight(Math.max(0, h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [menu]);

  // Measure each atom block height
  useLayoutEffect(() => {
    if (!measureRef.current || !columnWidth) return;
    const next: Record<string, number> = {};
    measureRef.current
      .querySelectorAll<HTMLElement>("[data-measure-key]")
      .forEach((node) => {
        const k = node.dataset.measureKey!;
        next[k] = node.getBoundingClientRect().height;
      });
    setHeights((prev) => {
      // shallow compare to avoid render loops
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((k) => Math.abs((prev[k] ?? -1) - next[k]) < 0.5)
      ) {
        return prev;
      }
      return next;
    });
  }, [columnWidth, atoms, formatting]);

  // Pack atoms greedily into columns
  const packed = useMemo(() => {
    if (!columnHeight || atoms.length === 0) return null;
    if (Object.keys(heights).length === 0) return null;
    const cols: { items: Atom[]; used: number }[] = [{ items: [], used: 0 }];
    let overflow = false;
    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      const h = heights[atom.key] ?? 0;
      const cur = cols[cols.length - 1];
      const fits = cur.used + h <= columnHeight;
      if (!fits && cur.items.length > 0) {
        if (cols.length >= NUM_COLUMNS) {
          // No more columns — accept overflow into last column
          overflow = true;
          cur.items.push(atom);
          cur.used += h;
          continue;
        }
        // Start a new column
        cols.push({ items: [], used: 0 });
        const newCol = cols[cols.length - 1];
        if (atom.kind === "subsection") {
          const headerHeight = heights[`h-${atom.sectionId}`] ?? 0;
          newCol.items.push({
            kind: "section-header",
            key: `cont-${atom.sectionId}-${cols.length}`,
            sectionId: atom.sectionId,
            section: atom.section,
            continued: true,
          });
          newCol.used += headerHeight;
        }
        newCol.items.push(atom);
        newCol.used += h;
      } else {
        cur.items.push(atom);
        cur.used += h;
      }
    }
    while (cols.length < NUM_COLUMNS) cols.push({ items: [], used: 0 });
    return { cols, overflow };
  }, [atoms, heights, columnHeight]);

  // ---------- block renderers ----------
  const renderSectionHeader = (
    section: DisplaySection,
    continued?: boolean,
    measuring?: boolean,
  ) => (
    <h2
      style={styleFor("section", {
        position: "relative",
        aspectRatio: "1 / 1",
        width: "75%",
        marginInline: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        margin: "0 auto 0.4vw auto",
        padding: "0.3vw",
        overflow: "hidden",
        isolation: "isolate",
        boxSizing: "border-box",
      })}
    >
      {!measuring && (
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
      )}
      <span style={{ position: "relative" }}>
        {continued ? `${section.name} (CONT.)` : section.name}
      </span>
    </h2>
  );

  const renderSubsection = (sub: DisplaySubsection, withTopGap: boolean) => {
    const compact =
      sub.items.length >= 3 &&
      sub.items.every(
        (it) => !it.description && it.modifications.length === 0,
      );
    return (
      <div style={{ marginBottom: "0.5vw" }}>
        {withTopGap && <div style={{ height: "0.4vw" }} />}
        {sub.name && (
          <h3 style={styleFor("subsection", { margin: "0 0 0.25vw 0" })}>
            {sub.name}
          </h3>
        )}
        {compact ? (
          <ul
            style={styleFor("itemTitle", {
              listStyle: "none",
              padding: 0,
              margin: 0,
              lineHeight: 1.35,
            })}
          >
            {sub.items.map((item) => (
              <li key={item.id}>
                {item.title} <FormattedPrice cents={item.base_price_cents} />
              </li>
            ))}
          </ul>
        ) : (
          sub.items.map((item) => (
            <div key={item.id} style={{ marginBottom: "0.3vw" }}>
              <div style={styleFor("itemTitle")}>
                {item.title} <FormattedPrice cents={item.base_price_cents} />
              </div>
              {item.description && (
                <p
                  style={styleFor("itemDescription", {
                    margin: "0.1vw 0 0 0",
                  })}
                >
                  {item.description}
                </p>
              )}
              {item.modifications.length > 0 && (
                <ul
                  style={styleFor("modification", {
                    listStyle: "none",
                    padding: 0,
                    margin: "0.3vw 0 0 0",
                  })}
                >
                  {item.modifications.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.4vw",
                      }}
                    >
                      <span>+ {m.name}</span>
                      <span>
                        {m.price_modifier_cents >= 0 ? "+" : ""}
                        <FormattedPrice cents={m.price_modifier_cents} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div style={{ ...baseShell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>{error}</p>
      </div>
    );
  }
  if (!menu) {
    return (
      <div style={{ ...baseShell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading menu…</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#fff",
        ...styleFor("global"),
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(${NUM_COLUMNS}, 1fr)`,
        padding: "2vw 1.6vw 7vw 1.6vw",
        gap: "1.6vw",
        boxSizing: "border-box",
      }}
    >
      {/* Hidden measurement layer */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: columnWidth || 1,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {atoms.map((atom) =>
          atom.kind === "section-header" ? (
            <div key={atom.key} data-measure-key={atom.key}>
              {renderSectionHeader(atom.section, false, true)}
            </div>
          ) : (
            <div key={atom.key} data-measure-key={atom.key}>
              {renderSubsection(atom.sub, false)}
            </div>
          ),
        )}
      </div>

      {(packed?.cols ?? Array.from({ length: NUM_COLUMNS }, () => ({ items: [] as Atom[] }))).map(
        (col, ci) => {
          // Track which section we're currently inside to decide subsection top-gap
          let currentSectionId: string | null = null;
          let subIndexInSection = 0;
          return (
            <div
              key={ci}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                paddingRight: ci < NUM_COLUMNS - 1 ? "1.6vw" : 0,
                overflow: "hidden",
              }}
            >
              {col.items.map((atom) => {
                if (atom.kind === "section-header") {
                  currentSectionId = atom.sectionId;
                  subIndexInSection = 0;
                  return (
                    <section key={atom.key}>
                      {renderSectionHeader(atom.section, atom.continued)}
                    </section>
                  );
                }
                const withTopGap =
                  atom.sectionId === currentSectionId && subIndexInSection > 0;
                if (atom.sectionId === currentSectionId) {
                  subIndexInSection += 1;
                } else {
                  currentSectionId = atom.sectionId;
                  subIndexInSection = 1;
                }
                return (
                  <div key={atom.key}>{renderSubsection(atom.sub, withTopGap)}</div>
                );
              })}
            </div>
          );
        },
      )}

      {/* Overflow indicator */}
      {packed?.overflow && (
        <div
          style={{
            position: "fixed",
            top: "0.8vw",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#b91c1c",
            color: "#fff",
            padding: "0.4vw 1vw",
            borderRadius: "0.4vw",
            fontSize: "0.9vw",
            fontWeight: 700,
            letterSpacing: "0.05em",
            zIndex: 50,
          }}
        >
          MENU OVERFLOW — content cut off
        </div>
      )}

      {/* Debug panel (?debug=1) */}
      {debug && packed && (
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
            lineHeight: 1.4,
            zIndex: 50,
            fontFamily: "monospace",
          }}
        >
          col-h: {Math.round(columnHeight)}px
          {packed.cols.map((c, i) => (
            <div key={i}>
              c{i + 1}: {Math.round(c.used)}px ({c.items.length} blocks)
              {c.used > columnHeight ? " ⚠" : ""}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: "1.6vw",
          right: "1.8vw",
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
