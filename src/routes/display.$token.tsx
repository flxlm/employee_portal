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

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
    // Subscribe to refresh broadcasts from the webhook
    const channel = supabase
      .channel("menu-display")
      .on("broadcast", { event: "refresh" }, () => {
        load();
      })
      .subscribe();
    // Periodic re-pull as a backstop (matches 5-min server cache)
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-2xl text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-2xl text-muted-foreground">Loading menu…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        contain: "layout paint",
        padding: "2vw",
      }}
    >
      <header className="text-center" style={{ marginBottom: "2vw" }}>
        <h1 style={{ fontSize: "4vw", fontWeight: 700, letterSpacing: "-0.02em" }}>Menu</h1>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(28vw, 1fr))",
          gap: "2vw",
        }}
      >
        {menu.sections.map((section) => (
          <section
            key={section.id}
            style={{
              contain: "content",
              contentVisibility: "auto",
              containIntrinsicSize: "1px 600px",
            }}
          >
            <h2
              style={{
                fontSize: "2.4vw",
                fontWeight: 700,
                borderBottom: "0.15vw solid currentColor",
                paddingBottom: "0.5vw",
                marginBottom: "1vw",
              }}
            >
              {section.name}
            </h2>
            {section.description && (
              <p style={{ fontSize: "1vw", opacity: 0.7, marginBottom: "1vw" }}>
                {section.description}
              </p>
            )}
            {section.subsections.map((sub) => (
              <div key={sub.id} style={{ marginBottom: "1.5vw" }}>
                <h3 style={{ fontSize: "1.6vw", fontWeight: 600, marginBottom: "0.6vw" }}>
                  {sub.name}
                </h3>
                {sub.items.map((item) => (
                  <div key={item.id} style={{ marginBottom: "0.8vw" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1vw",
                        fontSize: "1.2vw",
                        fontWeight: 500,
                      }}
                    >
                      <span>{item.title}</span>
                      <span>{formatPrice(item.base_price_cents)}</span>
                    </div>
                    {item.description && (
                      <p style={{ fontSize: "0.9vw", opacity: 0.65 }}>{item.description}</p>
                    )}
                    {item.modifications.length > 0 && (
                      <ul style={{ fontSize: "0.85vw", opacity: 0.7, marginTop: "0.2vw", paddingLeft: "1vw" }}>
                        {item.modifications.map((m) => (
                          <li key={m.id} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>+ {m.name}</span>
                            <span>{m.price_modifier_cents >= 0 ? "+" : ""}{formatPrice(m.price_modifier_cents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      <footer
        style={{
          marginTop: "3vw",
          textAlign: "center",
          fontSize: "0.7vw",
          opacity: 0.4,
        }}
      >
        Updated {new Date(menu.generated_at).toLocaleString()}
      </footer>
    </div>
  );
}
