import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDisplayMenu, type DisplayMenu } from "@/lib/menu-display.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/display/$token")({
  head: () => ({
    meta: [
      { title: "Menu Display" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DisplayPage,
});

function FormattedPrice({ cents }: { cents: number }) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = (abs % 100).toString().padStart(2, "0");
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {sign}
      {dollars}
      <sup style={{ fontSize: "0.55em", fontWeight: 700, marginLeft: "0.05em" }}>{c}</sup>
    </span>
  );
}

function DisplayPage() {
  const { token } = Route.useParams();
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

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          color: "#000",
          fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <p>{error}</p>
      </div>
    );
  }
  if (!menu) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          color: "#000",
          fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <p>Loading menu…</p>
      </div>
    );
  }

  // Distribute sections round-robin into 4 columns
  const columns: typeof menu.sections[] = [[], [], [], []];
  menu.sections.forEach((s, i) => columns[i % 4].push(s));

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "#fff",
        color: "#000",
        fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
        textTransform: "uppercase",
        position: "relative",
        overflow: "hidden",
        contain: "layout paint",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          width: "100%",
          minHeight: "100vh",
        }}
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            style={{
              borderLeft: ci === 0 ? "none" : "0.08vw solid #000",
              padding: "1.2vw 1vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vw",
            }}
          >
            {col.map((section) => (
              <section key={section.id}>
                <h2
                  style={{
                    fontSize: "1.9vw",
                    fontWeight: 900,
                    letterSpacing: "-0.01em",
                    borderBottom: "0.18vw solid #000",
                    paddingBottom: "0.3vw",
                    marginBottom: "0.8vw",
                    lineHeight: 1,
                  }}
                >
                  {section.name}
                </h2>
                {section.subsections.map((sub, si) => {
                  // "Compact" subsections: many short items with no description -> inline list
                  const compact =
                    sub.items.length >= 3 &&
                    sub.items.every((it) => !it.description && it.modifications.length === 0);
                  return (
                    <div key={sub.id} style={{ marginBottom: "0.8vw" }}>
                      {si > 0 && (
                        <hr
                          style={{
                            border: "none",
                            borderTop: "0.05vw solid #000",
                            margin: "0.6vw 0",
                          }}
                        />
                      )}
                      {sub.name && (
                        <h3
                          style={{
                            fontSize: "1vw",
                            fontWeight: 800,
                            margin: "0 0 0.4vw 0",
                            lineHeight: 1.1,
                          }}
                        >
                          {sub.name}
                        </h3>
                      )}
                      {compact ? (
                        <div style={{ fontSize: "0.85vw", lineHeight: 1.4 }}>
                          {sub.items.map((item, ii) => (
                            <span key={item.id}>
                              <span style={{ fontWeight: 700 }}>{item.title}</span>{" "}
                              <FormattedPrice cents={item.base_price_cents} />
                              {ii < sub.items.length - 1 && (
                                <span style={{ margin: "0 0.4vw" }}>·</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        sub.items.map((item) => (
                          <div key={item.id} style={{ marginBottom: "0.5vw" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: "0.6vw",
                                fontSize: "1.05vw",
                                fontWeight: 800,
                                lineHeight: 1.15,
                              }}
                            >
                              <span>{item.title}</span>
                              <FormattedPrice cents={item.base_price_cents} />
                            </div>
                            {item.description && (
                              <p
                                style={{
                                  fontSize: "0.7vw",
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
                                  fontSize: "0.65vw",
                                  fontWeight: 500,
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
          </div>
        ))}
      </div>
      <img
        src="/logo.svg"
        alt=""
        style={{
          position: "absolute",
          bottom: "1vw",
          right: "1vw",
          height: "2vw",
          width: "auto",
          filter: "grayscale(1) contrast(1000%) brightness(0)",
          opacity: 0.9,
        }}
      />
    </div>
  );
}
