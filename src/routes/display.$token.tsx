import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDisplayMenu, type DisplayMenu } from "@/lib/menu-display.functions";
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

const FONT_STACK =
  '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function FormattedPrice({ cents }: { cents: number }) {
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
  const [menu, setMenu] = useState<DisplayMenu | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetchMenu({ data: { token } });
      setMenu(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    }
  };

  useEffect(() => {
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

  const baseShell: React.CSSProperties = {
    minHeight: "100vh",
    background: "#fff",
    color: "#000",
    fontFamily: FONT_STACK,
    textTransform: "uppercase",
    fontWeight: 500,
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

  const filteredSections = menuFilter
    ? menu.sections
        .filter((s) => s.visible_menus.includes(menuFilter))
        .map((s) => ({
          ...s,
          subsections: s.subsections.filter((sub) => sub.visible_menus.includes(menuFilter)),
        }))
        .filter((s) => s.subsections.length > 0)
    : menu.sections;

  return (
    <FitToViewport key={(menuFilter ?? "all") + ":" + filteredSections.length}>
      {filteredSections.map((section) => (
        <section
          key={section.id}
          style={{
            breakInside: "avoid",
            pageBreakInside: "avoid",
            marginBottom: "1.6vw",
          }}
        >
          <h2
            style={{
              position: "relative",
              fontSize: "2.6vw",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#fff",
              textAlign: "center",
              margin: "0 0 0.7vw 0",
              lineHeight: 1,
              padding: "1.4vw 0.6vw",
              overflow: "hidden",
              isolation: "isolate",
            }}
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
              sub.items.every((it) => !it.description && it.modifications.length === 0);
            return (
              <div key={sub.id} style={{ marginBottom: "0.9vw" }}>
                {si > 0 && (
                  <hr
                    style={{
                      border: "none",
                      borderTop: "0.05vw solid #000",
                      margin: "0.7vw 0",
                    }}
                  />
                )}
                {sub.name && (
                  <h3
                    style={{
                      fontSize: "1.1vw",
                      fontWeight: 700,
                      margin: "0 0 0.4vw 0",
                      lineHeight: 1.1,
                    }}
                  >
                    {sub.name}
                  </h3>
                )}
                {compact ? (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: "0.95vw",
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}
                  >
                    {sub.items.map((item) => (
                      <li key={item.id}>
                        {item.title} <FormattedPrice cents={item.base_price_cents} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  sub.items.map((item) => (
                    <div key={item.id} style={{ marginBottom: "0.55vw" }}>
                      <div
                        style={{
                          fontSize: "1.15vw",
                          fontWeight: 700,
                          lineHeight: 1.15,
                        }}
                      >
                        {item.title} <FormattedPrice cents={item.base_price_cents} />
                      </div>
                      {item.description && (
                        <p
                          style={{
                            fontSize: "0.78vw",
                            fontWeight: 400,
                            margin: "0.15vw 0 0 0",
                            lineHeight: 1.3,
                          }}
                        >
                          {item.description}
                        </p>
                      )}
                      {item.modifications.length > 0 && (
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "0.2vw 0 0 0",
                            fontSize: "0.7vw",
                            fontWeight: 400,
                          }}
                        >
                          {item.modifications.map((m) => (
                            <li
                              key={m.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
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
          })}
        </section>
      ))}
    </FitToViewport>
  );
}

/**
 * Renders children inside a 4-column CSS multicol that:
 * - flows section-by-section into columns (no round-robin)
 * - balances heights when underfilled
 * - scales the entire layout up or down so it exactly fills 100vw × 100vh
 */
function FitToViewport({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    let raf = 0;
    let cancelled = false;

    const measure = () => {
      const el = innerRef.current;
      if (!el || cancelled) return;
      const targetH = window.innerHeight;
      // scrollHeight = balanced column height for current natural width
      const naturalH = el.scrollHeight;
      if (naturalH <= 0) return;
      const next = targetH / naturalH;
      // Clamp to a sane range
      const clamped = Math.max(0.4, Math.min(3, next));
      setScale((prev) => (Math.abs(prev - clamped) > 0.005 ? clamped : prev));
    };

    // Two passes so column reflow after scale change settles
    const tick = () => {
      measure();
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      if (!cancelled) requestAnimationFrame(measure);
    });
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#fff",
        color: "#000",
        fontFamily: FONT_STACK,
        textTransform: "uppercase",
        fontWeight: 500,
        position: "relative",
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: `${100 / scale}vw`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          columnCount: 4,
          columnGap: "0",
          columnRule: "0.05vw solid #000",
          columnFill: "balance",
          padding: "1.4vw 1.2vw",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "1.2vw",
          right: "1.4vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.3vw",
          lineHeight: 1,
          color: "#000",
          fontFamily: FONT_STACK,
        }}
      >
        <span style={{ fontSize: "2.4vw", fontWeight: 700 }}>✱</span>
        <span style={{ fontSize: "1.6vw", fontWeight: 700, fontStyle: "italic" }}>Savsav</span>
      </div>
    </div>
  );
}
