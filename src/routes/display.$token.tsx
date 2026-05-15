import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDisplayMenu, type DisplayMenu } from "@/lib/menu-display.functions";
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
  validateSearch: (s: Record<string, unknown>): { menu?: MenuType } => {
    const m = typeof s.menu === "string" ? s.menu.toLowerCase() : "";
    return MENU_TYPES.includes(m as MenuType) ? { menu: m as MenuType } : {};
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

function DisplayPage() {
  const { token } = Route.useParams();
  const { menu: menuFilter } = Route.useSearch();
  const fetchMenu = useServerFn(getDisplayMenu);
  const fetchFormatting = useServerFn(getMenuFormatting);
  const [menu, setMenu] = useState<DisplayMenu | null>(null);
  const [formatting, setFormatting] = useState<MenuFormatting>({});
  const [error, setError] = useState<string | null>(null);

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

  // Round-robin distribute sections across columns
  const columns = useMemo(() => {
    const cols: typeof filteredSections[] = Array.from(
      { length: NUM_COLUMNS },
      () => [],
    );
    filteredSections.forEach((s, i) => {
      cols[i % NUM_COLUMNS].push(s);
    });
    return cols;
  }, [filteredSections]);

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
      {columns.map((col, ci) => (
        <div
          key={ci}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            paddingRight: ci < NUM_COLUMNS - 1 ? "1.6vw" : 0,
          }}
        >
          {col.map((section) => (
            <section key={section.id}>
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
                  margin: "0 auto 1vw auto",
                  padding: "0.6vw",
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
                <span style={{ position: "relative" }}>{section.name}</span>
              </h2>
              {section.subsections.map((sub, si) => {
                const compact =
                  sub.items.length >= 3 &&
                  sub.items.every(
                    (it) => !it.description && it.modifications.length === 0,
                  );
                return (
                  <div key={sub.id} style={{ marginBottom: "1.2vw" }}>
                    {si > 0 && <div style={{ height: "1vw" }} />}
                    {sub.name && (
                      <h3
                        style={styleFor("subsection", {
                          margin: "0 0 0.6vw 0",
                        })}
                      >
                        {sub.name}
                      </h3>
                    )}
                    {compact ? (
                      <ul
                        style={styleFor("itemTitle", {
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          lineHeight: 1.6,
                        })}
                      >
                        {sub.items.map((item) => (
                          <li key={item.id}>
                            {item.title}{" "}
                            <FormattedPrice cents={item.base_price_cents} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      sub.items.map((item) => (
                        <div key={item.id} style={{ marginBottom: "0.8vw" }}>
                          <div style={styleFor("itemTitle")}>
                            {item.title}{" "}
                            <FormattedPrice cents={item.base_price_cents} />
                          </div>
                          {item.description && (
                            <p
                              style={styleFor("itemDescription", {
                                margin: "0.25vw 0 0 0",
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
                                    <FormattedPrice
                                      cents={m.price_modifier_cents}
                                    />
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
              })}
            </section>
          ))}
        </div>
      ))}
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
