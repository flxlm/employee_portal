import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicInStockWines, type PublicWine } from "@/lib/wine-public.functions";

export const Route = createFileRoute("/display/wines")({
  component: DisplayWinesPage,
  head: () => ({
    meta: [
      { title: "Wine List — SavSav" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});

// Group order & display labels — mapped from the `colour` field in DB.
const GROUP_ORDER = ["Sparkling", "White", "Orange", "Rosé", "Red"] as const;
type Group = (typeof GROUP_ORDER)[number];

function mapColourToGroup(colour: string): Group | null {
  const c = colour.toLowerCase();
  if (c.includes("bulle") || c.includes("spark")) return "Sparkling";
  if (c.includes("blanc") || c.includes("white")) return "White";
  if (c.includes("orange")) return "Orange";
  if (c.includes("rose") || c.includes("rosé") || c.includes("rosa")) return "Rosé";
  if (c.includes("rouge") || c.includes("red")) return "Red";
  return null;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(0)}`;
}

function DisplayWinesPage() {
  const fetchFn = useServerFn(getPublicInStockWines);
  const { data } = useQuery({
    queryKey: ["public-wines"],
    queryFn: () => fetchFn(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  // Realtime: bump on wines changes (debounced via react-query refetch)
  useEffect(() => {
    const channel = supabase
      .channel("public-wines-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wines" }, () => {
        // Trigger a query invalidation via window event — keep it simple
        void fetchFn();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFn]);

  // Fullscreen state — drives cursor hiding, pagination, wake lock
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement ||
          !!(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const enterFullscreen = async () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {
      /* noop */
    }
  };

  // Hide cursor + wake lock — only while fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "none";
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        /* noop */
      }
    };
    void requestLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.body.style.cursor = prevCursor;
      document.removeEventListener("visibilitychange", onVisible);
      try {
        void wakeLock?.release();
      } catch {
        /* noop */
      }
    };
  }, [isFullscreen]);


  const grouped = useMemo(() => {
    const buckets: Record<Group, PublicWine[]> = {
      Sparkling: [],
      White: [],
      Orange: [],
      Rosé: [],
      Red: [],
    };
    for (const w of data ?? []) {
      const g = mapColourToGroup(w.colour);
      if (!g) continue;
      buckets[g].push(w);
    }
    for (const g of GROUP_ORDER) {
      buckets[g].sort((a, b) => a.bottle - b.bottle);
    }
    return GROUP_ORDER
      .map((g) => ({ group: g, wines: buckets[g] }))
      .filter((s) => s.wines.length > 0);
  }, [data]);

  // Build a flat list of "blocks" (group header + each wine row), then
  // paginate by measuring after layout.
  type Block =
    | { kind: "header"; group: Group; key: string }
    | { kind: "wine"; wine: PublicWine; key: string };

  const blocks: Block[] = useMemo(() => {
    const out: Block[] = [];
    for (const section of grouped) {
      out.push({ kind: "header", group: section.group, key: `h-${section.group}` });
      for (const w of section.wines) {
        out.push({ kind: "wine", wine: w, key: `w-${w.id}` });
      }
    }
    return out;
  }, [grouped]);

  const measureRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<number[][]>([]); // each page = array of block indexes
  const [pageIdx, setPageIdx] = useState(0);
  const [fade, setFade] = useState(true);

  // Recompute pagination whenever blocks or viewport size change
  useEffect(() => {
    if (blocks.length === 0) {
      setPages([]);
      return;
    }
    const recompute = () => {
      const measureEl = measureRef.current;
      const contentEl = contentRef.current;
      if (!measureEl || !contentEl) return;
      const available = contentEl.clientHeight * 2; // 2-column layout shares vertical space
      const children = Array.from(measureEl.children) as HTMLElement[];
      if (children.length === 0) return;

      const result: number[][] = [];
      let current: number[] = [];
      let usedHeight = 0;
      for (let i = 0; i < children.length; i++) {
        const h = children[i].getBoundingClientRect().height;
        const block = blocks[i];
        // Don't end a page on a group header — push it to next page with its rows
        if (usedHeight + h > available && current.length > 0) {
          // If the last item on current page is a header, pull it forward to next page
          const lastBlockIdx = current[current.length - 1];
          if (blocks[lastBlockIdx]?.kind === "header") {
            current.pop();
          }
          if (current.length > 0) result.push(current);
          current = [];
          usedHeight = 0;
          // If the header was popped, re-add it as first of next page
          if (lastBlockIdx !== undefined && blocks[lastBlockIdx]?.kind === "header") {
            const hh = children[lastBlockIdx].getBoundingClientRect().height;
            current.push(lastBlockIdx);
            usedHeight += hh;
          }
        }
        current.push(i);
        usedHeight += h;
        // If a single block is taller than the page, still place it alone
        if (usedHeight > available && current.length === 1) {
          result.push(current);
          current = [];
          usedHeight = 0;
        }
        // Avoid orphan: if this is a header and next won't fit, defer to next page
        if (
          block.kind === "header" &&
          i + 1 < children.length &&
          usedHeight + children[i + 1].getBoundingClientRect().height > available
        ) {
          current.pop();
          if (current.length > 0) result.push(current);
          current = [i];
          usedHeight = h;
        }
      }
      if (current.length > 0) result.push(current);
      setPages(result);
      setPageIdx((p) => (p >= result.length ? 0 : p));
    };

    // Wait a tick for layout
    const raf = requestAnimationFrame(recompute);
    const ro = new ResizeObserver(() => recompute());
    if (contentRef.current) ro.observe(contentRef.current);
    if (measureRef.current) ro.observe(measureRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [blocks]);

  // Auto-advance pages with fade — only while fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    if (pages.length <= 1) return;
    const PAGE_MS = 20_000;
    const FADE_MS = 800;
    const advance = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPageIdx((p) => (p + 1) % pages.length);
        setFade(true);
      }, FADE_MS);
    }, PAGE_MS);
    return () => clearInterval(advance);
  }, [pages.length, isFullscreen]);


  const currentBlockIdxs = pages[pageIdx] ?? blocks.map((_, i) => i);

  return (
    <div
      className="display-wines"
      data-fullscreen={isFullscreen ? "true" : "false"}
      style={{
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? 0 : undefined,
        minHeight: isFullscreen ? undefined : "100vh",
        background: "#FFFFFF",
        color: "#111111",
        overflow: isFullscreen ? "hidden" : "auto",
        fontFamily: "'Neue Montreal', 'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        paddingLeft: "clamp(1.5rem, 6vw, 7.5rem)",
        paddingRight: "clamp(1.5rem, 6vw, 7.5rem)",
        paddingTop: "clamp(1.5rem, 4vh, 5rem)",
        paddingBottom: "clamp(1.5rem, 4vh, 5rem)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=neue-montreal@400,500,700&display=swap');
        .display-wines[data-fullscreen="true"], .display-wines[data-fullscreen="true"] * { cursor: none !important; }
        .display-wines { text-transform: uppercase; }
        .wine-name, .wine-section, .wine-title { font-family: 'Neue Montreal', system-ui, sans-serif; }
        .wine-meta, .wine-price { font-family: 'Neue Montreal', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

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
            fontFamily: "'Neue Montreal', 'Inter', system-ui, sans-serif",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          }}
        >
          Play Fullscreen
        </button>
      )}

      {/* Header */}
      <header
        style={{
          textAlign: "center",
          paddingBottom: "clamp(1rem, 2.5vh, 3rem)",
        }}
      >
        <h1
          className="wine-title"
          style={{
            fontSize: "clamp(2.5rem, 5vw, 7.5rem)",
            lineHeight: 1.05,
            fontWeight: 500,
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          Wine List
        </h1>
      </header>

      {/* Visible content area — paginated in fullscreen, fully scrollable otherwise */}
      <div
        ref={contentRef}
        style={{
          flex: isFullscreen ? 1 : undefined,
          minHeight: 0,
          position: "relative",
          opacity: isFullscreen ? (fade ? 1 : 0) : 1,
          transition: "opacity 700ms ease-in-out",
          columnCount: 2,
          columnGap: "clamp(2rem, 5vw, 6rem)",
          columnFill: "balance",
        }}
      >
        {isFullscreen
          ? currentBlockIdxs.map((i) => renderBlock(blocks[i]))
          : blocks.map((b) => renderBlock(b))}
      </div>

      {/* Hidden measurement layer — only needed for fullscreen pagination */}
      {isFullscreen && (
        <div
          ref={measureRef}
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            visibility: "hidden",
            pointerEvents: "none",
            paddingLeft: "clamp(1.5rem, 6vw, 7.5rem)",
            paddingRight: "clamp(1.5rem, 6vw, 7.5rem)",
          }}
        >
          {blocks.map((b) => renderBlock(b))}
        </div>
      )}
    </div>
  );
}

function renderBlock(block:
  | { kind: "header"; group: string; key: string }
  | { kind: "wine"; wine: PublicWine; key: string }) {
  if (block.kind === "header") {
    return (
      <div
        key={block.key}
        style={{
          marginTop: "clamp(1.5rem, 3vh, 4rem)",
          marginBottom: "clamp(0.75rem, 1.5vh, 2rem)",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        <h2
          className="wine-section"
          style={{
            fontSize: "clamp(1.75rem, 3.5vw, 5rem)",
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: 0,
            paddingBottom: "clamp(0.4rem, 0.8vh, 1rem)",
            borderBottom: "1px solid #111111",
          }}
        >
          {block.group}
        </h2>
      </div>
    );
  }
  const w = block.wine;
  const origin = [w.domaine, w.country].filter(Boolean).join(" · ");
  return (
    <div
      key={block.key}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        columnGap: "clamp(1rem, 3vw, 4rem)",
        alignItems: "baseline",
        paddingTop: "clamp(0.5rem, 1vh, 1.25rem)",
        paddingBottom: "clamp(0.5rem, 1vh, 1.25rem)",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="wine-name"
          style={{
            fontSize: "clamp(1.25rem, 2.8vw, 4rem)",
            lineHeight: 1.15,
            fontWeight: 500,
          }}
        >
          {w.name || "—"}
        </div>
        {origin && (
          <div
            className="wine-meta"
            style={{
              fontSize: "clamp(0.875rem, 1.6vw, 2.25rem)",
              color: "#666666",
              fontWeight: 300,
              marginTop: "clamp(0.15rem, 0.4vh, 0.5rem)",
            }}
          >
            {origin}
          </div>
        )}
      </div>
      <div
        className="wine-price"
        style={{
          fontSize: "clamp(1.25rem, 2.5vw, 3.75rem)",
          fontWeight: 400,
          color: "#111111",
          whiteSpace: "nowrap",
        }}
      >
        {formatPrice(w.togo)}
      </div>
    </div>
  );
}
