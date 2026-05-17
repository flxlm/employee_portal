import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Wine, ClipboardCheck, Users, BookOpen, UtensilsCrossed, Package, ClipboardList, KeyRound, GripVertical, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasscodesDialog } from "@/components/passcodes-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

type Tile = {
  key: string;
  title: string;
  description: string;
  icon: typeof CalendarDays;
  to?: string;
  onClick?: () => void;
};

function HomePage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [passcodesOpen, setPasscodesOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);

  const storageKey = user ? `home:tile-order:${user.id}` : null;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setOrder(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setOrder([]);
    }
  }, [storageKey]);

  const tiles: Tile[] = [
    { key: "events", to: "/events", title: "Event Inquiries", description: "Review new, ongoing, confirmed, declined and past events.", icon: CalendarDays },
    { key: "wines", to: "/wines", title: "Wine List", description: "Browse the current wine offering and inventory.", icon: Wine },
    { key: "open-close", to: "/open-close", title: "Open / Close Log", description: "Log opening and closing shifts with till and photo.", icon: ClipboardCheck },
    { key: "recipes", to: "/recipes", title: "Recipes", description: "Browse drink recipes for FOH staff.", icon: BookOpen },
    { key: "menu-editor", to: "/menu-editor", title: "Menu Editor", description: "Edit menu sections, items and modifications. Auto-saves as you type.", icon: UtensilsCrossed },
    { key: "inventory", to: "/inventory", title: "Inventory", description: "Track stock levels and flag items to reorder.", icon: Package },
    { key: "passcodes", onClick: () => setPasscodesOpen(true), title: "Passcodes", description: "View shared passcodes available to your account.", icon: KeyRound },
    ...(isAdmin ? [{ key: "order-list", to: "/order-list", title: "Order List", description: "Review and process items flagged for reorder.", icon: ClipboardList } as Tile] : []),
    ...(isAdmin ? [{ key: "admin", to: "/admin", title: "Admin", description: "Manage who can sign in to the portal.", icon: Users } as Tile] : []),
  ];

  const orderedTiles = useMemo(() => {
    const activeOrder = draftOrder ?? order;
    if (!activeOrder) return tiles;
    const byKey = new Map(tiles.map((t) => [t.key, t]));
    const result: Tile[] = [];
    for (const k of activeOrder) {
      const t = byKey.get(k);
      if (t) {
        result.push(t);
        byKey.delete(k);
      }
    }
    // Append any tiles not in saved order (new ones, or admin tiles that appeared later)
    for (const t of tiles) if (byKey.has(t.key)) result.push(t);
    return result;
  }, [draftOrder, order, tiles]);

  const moveTile = (from: string, to: string) => {
    if (from === to) return;
    const list = [...orderedTiles];
    const fromIdx = list.findIndex((t) => t.key === from);
    const toIdx = list.findIndex((t) => t.key === to);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDraftOrder(list.map((t) => t.key));
  };

  const resetOrder = () => {
    setDraftOrder(order ?? []);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">{greeting}</h1>
          <p className="text-muted-foreground mt-1">Welcome to the Savsav employee portal.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing && (
            <Button variant="ghost" size="sm" onClick={resetOrder}>Reset</Button>
          )}
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <><Check className="h-4 w-4 mr-1" /> Done</> : <><Pencil className="h-4 w-4 mr-1" /> Reorder</>}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {orderedTiles.map(({ key, to, onClick, title, description, icon: Icon }) => {
          const isDragging = dragKey === key;
          const isOver = overKey === key && dragKey !== key;
          const inner = (
            <Card className={cn(
              "h-full transition-colors group-hover:border-primary",
              isDragging && "opacity-50",
              isOver && "border-primary ring-2 ring-primary",
            )}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {editing && (
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  )}
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          );

          const dragProps = editing ? {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              setDragKey(key);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", key);
            },
            onDragEnd: () => { setDragKey(null); setOverKey(null); },
            onDragOver: (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overKey !== key) setOverKey(key);
            },
            onDragLeave: () => { if (overKey === key) setOverKey(null); },
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("text/plain");
              if (from) moveTile(from, key);
              setDragKey(null);
              setOverKey(null);
            },
          } : {};

          if (editing) {
            return (
              <div key={key} className="group select-none" {...dragProps}>
                {inner}
              </div>
            );
          }

          return to ? (
            <Link key={key} to={to} className="group">{inner}</Link>
          ) : (
            <button key={key} type="button" onClick={onClick} className="group text-left">{inner}</button>
          );
        })}
      </div>

      <PasscodesDialog open={passcodesOpen} onOpenChange={setPasscodesOpen} />
    </div>
  );
}
