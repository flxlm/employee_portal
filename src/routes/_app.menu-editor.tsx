import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, ArrowLeft, ExternalLink, ChevronRight, Settings2, Eye, EyeOff } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listMenu,
  insertRow,
  updateRow,
  softDeleteRow,
  reorderRows,
  type MenuSection,
  type MenuSubsection,
  type MenuItem,
  type MenuModification,
} from "@/lib/menu.functions";
import { refreshDisplayMenu } from "@/lib/menu-display.functions";

export const Route = createFileRoute("/_app/menu-editor")({
  component: MenuEditorPage,
});



const MENU_OPTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
] as const;

type Dirty = { table: string; id: string; expectedVersion: number; patch: Record<string, unknown> };

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}
function parsePrice(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function PriceInput({
  cents,
  onCommit,
  className,
}: {
  cents: number;
  onCommit: (cents: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string>(formatPrice(cents));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(formatPrice(cents));
  }, [cents, focused]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
        setDraft(v);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parsePrice(draft);
        if (parsed === null) {
          setDraft(formatPrice(cents));
          return;
        }
        if (parsed !== cents) onCommit(parsed);
        setDraft(formatPrice(parsed));
      }}
    />
  );
}

function MenuToggles({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const set = new Set(value);
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Show on:</span>
      {MENU_OPTIONS.map((m) => {
        const on = set.has(m.key);
        return (
          <Toggle
            key={m.key}
            size="sm"
            pressed={on}
            onPressedChange={(pressed) => {
              const next = new Set(set);
              if (pressed) next.add(m.key);
              else next.delete(m.key);
              onChange(MENU_OPTIONS.filter((o) => next.has(o.key)).map((o) => o.key));
            }}
            className="h-7 px-2 text-xs"
          >
            {m.label}
          </Toggle>
        );
      })}
    </div>
  );
}

function RowSettingsMenu({
  hidden,
  onToggleHidden,
  onDelete,
  size = "md",
}: {
  hidden: boolean;
  onToggleHidden: () => void;
  onDelete: () => void;
  size?: "sm" | "md";
}) {
  const btnClass = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className={btnClass} aria-label="Settings">
          <Settings2 className={iconClass} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onToggleHidden(); }}>
          {hidden ? (
            <><Eye className="h-4 w-4" /> Show on live menu</>
          ) : (
            <><EyeOff className="h-4 w-4" /> Hide on live menu</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); onDelete(); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuEditorPage() {
  const list = useServerFn(listMenu);
  const insert = useServerFn(insertRow);
  const update = useServerFn(updateRow);
  const del = useServerFn(softDeleteRow);
  const reorder = useServerFn(reorderRows);
  const refreshDisplay = useServerFn(refreshDisplayMenu);
  const triggerRefresh = () => {
    refreshDisplay({}).catch((e) => console.error("[menu] refresh failed", e));
  };

  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(0);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());
  const [showDesc, setShowDesc] = useState<Set<string>>(new Set());
  const revealDesc = (id: string) => setShowDesc((p) => { const n = new Set(p); n.add(id); return n; });
  const hasDesc = (id: string, val: string | null | undefined) => (val && val.length > 0) || showDesc.has(id);

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleCollapsedSub = (id: string) =>
    setCollapsedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const collapseAll = () => setCollapsed(new Set(sections.map((s) => s.id)));
  const expandAll = () => setCollapsed(new Set());

  const dirtyRef = useRef<Map<string, Dirty>>(new Map());

  const reload = async () => {
    const res = await list();
    setSections(res.sections);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  // Warn on unload if there are unsaved edits
  useEffect(() => {
    if (dirtyCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyCount]);

  const flush = async () => {
    const items = Array.from(dirtyRef.current.values());
    if (items.length === 0) return;
    dirtyRef.current.clear();
    setDirtyCount(0);
    setSavingCount((c) => c + items.length);
    try {
      const results = await Promise.all(
        items.map((d) =>
          update({
            data: { table: d.table as never, id: d.id, expectedVersion: d.expectedVersion, patch: d.patch as never },
          }).catch((e) => ({ ok: false as const, error: e }))
        )
      );
      let conflicts = 0;
      let errors = 0;
      for (const r of results) {
        if ("conflict" in r && r.conflict) conflicts++;
        if ("error" in r && r.error) {
          errors++;
          console.error(r.error);
        }
      }
      if (conflicts > 0) {
        toast.error(`${conflicts} edit conflict${conflicts > 1 ? "s" : ""} — reloading`);
        await reload();
      } else if (errors > 0) {
        toast.error(`${errors} change${errors > 1 ? "s" : ""} failed to save`);
      } else {
        toast.success("Changes saved");
        triggerRefresh();
      }
    } finally {
      setSavingCount((c) => Math.max(0, c - items.length));
    }
  };

  const queueEdit = (table: string, id: string, expectedVersion: number, patch: Record<string, unknown>) => {
    const key = `${table}:${id}`;
    const existing = dirtyRef.current.get(key);
    dirtyRef.current.set(key, {
      table,
      id,
      expectedVersion: existing?.expectedVersion ?? expectedVersion,
      patch: { ...(existing?.patch || {}), ...patch },
    });
    setDirtyCount(dirtyRef.current.size);
  };

  const patchSection = (id: string, patch: Partial<MenuSection>) => {
    setSections((s) => s.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)));
  };
  const patchSubsection = (sectionId: string, id: string, patch: Partial<MenuSubsection>) => {
    setSections((s) =>
      s.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, subsections: sec.subsections.map((ss) => (ss.id === id ? { ...ss, ...patch } : ss)) }
      )
    );
  };
  const patchItem = (sectionId: string, subId: string, id: string, patch: Partial<MenuItem>) => {
    setSections((s) =>
      s.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              subsections: sec.subsections.map((ss) =>
                ss.id !== subId
                  ? ss
                  : { ...ss, items: ss.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
              ),
            }
      )
    );
  };
  const patchMod = (sectionId: string, subId: string, itemId: string, id: string, patch: Partial<MenuModification>) => {
    setSections((s) =>
      s.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              subsections: sec.subsections.map((ss) =>
                ss.id !== subId
                  ? ss
                  : {
                      ...ss,
                      items: ss.items.map((it) =>
                        it.id !== itemId
                          ? it
                          : {
                              ...it,
                              modifications: it.modifications.map((m) => (m.id === id ? { ...m, ...patch } : m)),
                            }
                      ),
                    }
              ),
            }
      )
    );
  };

  const addSection = async () => {
    const order = sections.length + 1;
    const { row } = await insert({ data: { table: "menu_sections" as never, values: { name: "New section", display_order: order } as never } });
    setSections((s) => [...s, { ...(row as unknown as MenuSection), subsections: [] }]);
    triggerRefresh();
  };
  const addSubsection = async (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const order = sec.subsections.length + 1;
    const { row } = await insert({
      data: { table: "menu_subsections" as never, values: { section_id: sectionId, name: "New subsection", display_order: order } as never },
    });
    patchSection(sectionId, { subsections: [...sec.subsections, { ...(row as unknown as MenuSubsection), items: [] }] });
    triggerRefresh();
  };
  const addItem = async (sectionId: string, subId: string) => {
    const sub = sections.find((s) => s.id === sectionId)?.subsections.find((ss) => ss.id === subId);
    if (!sub) return;
    const order = sub.items.length + 1;
    const { row } = await insert({
      data: { table: "menu_items" as never, values: { subsection_id: subId, title: "New item", base_price_cents: 0, display_order: order } as never },
    });
    patchSubsection(sectionId, subId, { items: [...sub.items, { ...(row as unknown as MenuItem), modifications: [] }] });
    triggerRefresh();
  };
  const addMod = async (sectionId: string, subId: string, itemId: string) => {
    const item = sections
      .find((s) => s.id === sectionId)
      ?.subsections.find((ss) => ss.id === subId)
      ?.items.find((i) => i.id === itemId);
    if (!item) return;
    const order = item.modifications.length + 1;
    const { row } = await insert({
      data: { table: "item_modifications" as never, values: { item_id: itemId, modification_name: "Modification", price_modifier_cents: 0, display_order: order } as never },
    });
    patchItem(sectionId, subId, itemId, { modifications: [...item.modifications, row as unknown as MenuModification] });
    triggerRefresh();
  };

  const removeRow = async (table: string, id: string) => {
    try {
      await del({ data: { table: table as never, id } });
      await reload();
      triggerRefresh();
      const label =
        table === "menu_items"
          ? "Item deleted"
          : table === "item_modifications"
          ? "Modification deleted"
          : table === "menu_sections"
          ? "Section deleted"
          : "Deleted";
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // ---- Subsection deletion flow ----
  const [deleteSubTarget, setDeleteSubTarget] = useState<{
    sectionId: string;
    subId: string;
    name: string;
    itemCount: number;
  } | null>(null);
  const [deleteSubMode, setDeleteSubMode] = useState<"move" | "delete">("move");
  const [deleteSubMoveTo, setDeleteSubMoveTo] = useState<string>("");
  const [deleteSubBusy, setDeleteSubBusy] = useState(false);

  const subsectionOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    sections.forEach((sec) => {
      sec.subsections.forEach((ss) => {
        if (deleteSubTarget && ss.id === deleteSubTarget.subId) return;
        opts.push({
          value: ss.id,
          label: `${sec.name || "Untitled section"} › ${ss.name || "Untitled subsection"}`,
        });
      });
    });
    return opts;
  }, [sections, deleteSubTarget]);

  const requestDeleteSubsection = (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    const sub = sec?.subsections.find((ss) => ss.id === subId);
    if (!sub) return;
    if (sub.items.length === 0) {
      void removeRow("menu_subsections", subId);
      return;
    }
    setDeleteSubTarget({
      sectionId,
      subId,
      name: sub.name || "Untitled subsection",
      itemCount: sub.items.length,
    });
    setDeleteSubMode("move");
    setDeleteSubMoveTo("");
  };

  const confirmDeleteSubsection = async () => {
    if (!deleteSubTarget) return;
    const sec = sections.find((s) => s.id === deleteSubTarget.sectionId);
    const sub = sec?.subsections.find((ss) => ss.id === deleteSubTarget.subId);
    if (!sub) {
      setDeleteSubTarget(null);
      return;
    }
    setDeleteSubBusy(true);
    try {
      // Flush any pending edits so version numbers are current
      await flush();

      if (deleteSubMode === "move") {
        if (!deleteSubMoveTo) {
          toast.error("Pick a destination subsection");
          setDeleteSubBusy(false);
          return;
        }
        // Determine display_order offset in destination
        const dest = sections
          .flatMap((s) => s.subsections)
          .find((ss) => ss.id === deleteSubMoveTo);
        const baseOrder = (dest?.items.length ?? 0) + 1;
        const results = await Promise.all(
          sub.items.map((it, i) =>
            update({
              data: {
                table: "menu_items" as never,
                id: it.id,
                expectedVersion: it.version,
                patch: {
                  subsection_id: deleteSubMoveTo,
                  display_order: baseOrder + i,
                } as never,
              },
            }).catch((e) => ({ ok: false as const, error: e })),
          ),
        );
        const failed = results.filter(
          (r) => ("ok" in r && !r.ok) || ("error" in r && r.error),
        ).length;
        if (failed > 0) {
          toast.error(`Failed to move ${failed} item${failed > 1 ? "s" : ""}`);
          await reload();
          setDeleteSubBusy(false);
          return;
        }
      } else {
        // Delete every item in the subsection
        await Promise.all(
          sub.items.map((it) =>
            del({ data: { table: "menu_items" as never, id: it.id } }),
          ),
        );
      }

      // Now soft-delete the subsection itself
      await del({ data: { table: "menu_subsections" as never, id: sub.id } });
      await reload();
      triggerRefresh();
      toast.success(
        deleteSubMode === "move"
          ? `Moved ${sub.items.length} item${sub.items.length > 1 ? "s" : ""} and deleted subsection`
          : "Subsection and items deleted",
      );
      setDeleteSubTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete subsection");
    } finally {
      setDeleteSubBusy(false);
    }
  };

  const move = async (table: string, ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await reorder({ data: { table: table as never, orderedIds: next } });
    await reload();
    triggerRefresh();
  };

  const totalItems = useMemo(
    () => sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.items.length, 0), 0),
    [sections]
  );

  if (loading) return <div className="p-10">Loading menu…</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {dirtyCount > 0 && (
        <div className="sticky top-0 z-40 -mx-6 md:-mx-10 mb-4 px-6 md:px-10 py-3 border-b bg-background/95 backdrop-blur flex items-center justify-between gap-3 shadow-sm">
          <span className="text-sm">
            {dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}
          </span>
          <Button size="sm" onClick={flush} disabled={savingCount > 0}>
            <Save className="h-4 w-4" /> {savingCount > 0 ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link to="/functions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Functions
          </Link>
          <h1 className="text-3xl md:text-4xl">Menu Editor</h1>
          <p className="text-muted-foreground mt-1">
            {sections.length} sections · {totalItems} items
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savingCount > 0 && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Save className="h-3 w-3 animate-pulse" /> Saving…
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4" /> Live menu
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                { key: "all", label: "Full menu", qs: "" },
                { key: "breakfast", label: "Breakfast", qs: "?menu=breakfast" },
                { key: "lunch", label: "Lunch", qs: "?menu=lunch" },
                { key: "dinner", label: "Dinner", qs: "?menu=dinner" },
              ].map((opt) => (
                <DropdownMenuItem key={opt.key} asChild>
                  <a
                    href={`/display/YtXYdKR1kwQYV7OeoqeuQM0PurNAxKdU${opt.qs}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {opt.label}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={collapsed.size === sections.length && sections.length > 0 ? expandAll : collapseAll} size="sm" variant="outline">
            {collapsed.size === sections.length && sections.length > 0 ? "Expand all" : "Collapse all"}
          </Button>
          <Button onClick={addSection} size="sm">
            <Plus className="h-4 w-4" /> Section
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        {sections.map((sec, sIdx) => (
          <Card key={sec.id} className={`border-2 ${sec.is_hidden ? "opacity-50" : ""}`}>
            <CardHeader className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col rounded-md border bg-muted/40 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-b-none" disabled={sIdx === 0} onClick={() => move("menu_sections", sections.map((x) => x.id), sIdx, sIdx - 1)} aria-label="Move section up">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-t-none" disabled={sIdx === sections.length - 1} onClick={() => move("menu_sections", sections.map((x) => x.id), sIdx, sIdx + 1)} aria-label="Move section down">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    className="text-lg font-semibold"
                    value={sec.name}
                    onChange={(e) => {
                      patchSection(sec.id, { name: e.target.value });
                      queueEdit("menu_sections", sec.id, sec.version, { name: e.target.value });
                    }}
                    placeholder="Section name"
                  />
                  {!collapsed.has(sec.id) && (
                    hasDesc(sec.id, sec.description) ? (
                      <Textarea
                        rows={1}
                        value={sec.description}
                        onChange={(e) => {
                          patchSection(sec.id, { description: e.target.value });
                          queueEdit("menu_sections", sec.id, sec.version, { description: e.target.value });
                        }}
                        placeholder="Section description"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => revealDesc(sec.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" /> Add description
                      </button>
                    )
                  )}
                  <MenuToggles
                    value={sec.visible_menus}
                    onChange={(next) => {
                      patchSection(sec.id, { visible_menus: next });
                      queueEdit("menu_sections", sec.id, sec.version, { visible_menus: next });
                    }}
                  />
                </div>
                <RowSettingsMenu
                  hidden={sec.is_hidden}
                  onToggleHidden={() => {
                    const next = !sec.is_hidden;
                    patchSection(sec.id, { is_hidden: next });
                    queueEdit("menu_sections", sec.id, sec.version, { is_hidden: next });
                  }}
                  onDelete={() => removeRow("menu_sections", sec.id)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => toggleCollapsed(sec.id)}
                  aria-label={collapsed.has(sec.id) ? "Expand section" : "Collapse section"}
                >
                  {collapsed.has(sec.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {!collapsed.has(sec.id) && (
            <CardContent className="space-y-4">
              {sec.subsections.map((sub, ssIdx) => (
                <div key={sub.id} className={`rounded-md border p-3 space-y-3 ${sub.is_hidden ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col rounded-md border bg-background shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-b-none" disabled={ssIdx === 0} onClick={() => move("menu_subsections", sec.subsections.map((x) => x.id), ssIdx, ssIdx - 1)} aria-label="Move subsection up">
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-t-none" disabled={ssIdx === sec.subsections.length - 1} onClick={() => move("menu_subsections", sec.subsections.map((x) => x.id), ssIdx, ssIdx + 1)} aria-label="Move subsection down">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        className="font-medium"
                        value={sub.name}
                        onChange={(e) => {
                          patchSubsection(sec.id, sub.id, { name: e.target.value });
                          queueEdit("menu_subsections", sub.id, sub.version, { name: e.target.value });
                        }}
                        placeholder="Subsection name"
                      />
                      {hasDesc(sub.id, sub.description) ? (
                        <Input
                          value={sub.description}
                          onChange={(e) => {
                            patchSubsection(sec.id, sub.id, { description: e.target.value });
                            queueEdit("menu_subsections", sub.id, sub.version, { description: e.target.value });
                          }}
                          placeholder="Subsection description"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => revealDesc(sub.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> Add description
                        </button>
                      )}
                      <MenuToggles
                        value={sub.visible_menus}
                        onChange={(next) => {
                          patchSubsection(sec.id, sub.id, { visible_menus: next });
                          queueEdit("menu_subsections", sub.id, sub.version, { visible_menus: next });
                        }}
                      />
                    </div>
                    <RowSettingsMenu
                      hidden={sub.is_hidden}
                      onToggleHidden={() => {
                        const next = !sub.is_hidden;
                        patchSubsection(sec.id, sub.id, { is_hidden: next });
                        queueEdit("menu_subsections", sub.id, sub.version, { is_hidden: next });
                      }}
                      onDelete={() => requestDeleteSubsection(sec.id, sub.id)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => toggleCollapsedSub(sub.id)}
                      aria-label={collapsedSubs.has(sub.id) ? "Expand subsection" : "Collapse subsection"}
                    >
                      {collapsedSubs.has(sub.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {!collapsedSubs.has(sub.id) && (
                  <div className="space-y-2 pl-8">
                    {sub.items.map((item, iIdx) => (
                      <div key={item.id} className={`rounded border bg-muted/30 p-2 space-y-2 ${item.is_hidden ? "opacity-50" : ""}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col rounded-md border bg-background shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-b-none" disabled={iIdx === 0} onClick={() => move("menu_items", sub.items.map((x) => x.id), iIdx, iIdx - 1)} aria-label="Move item up">
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-t-none" disabled={iIdx === sub.items.length - 1} onClick={() => move("menu_items", sub.items.map((x) => x.id), iIdx, iIdx + 1)} aria-label="Move item down">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_120px]">
                            <div className="flex items-center gap-2">
                              <Input
                                value={item.title}
                                onChange={(e) => {
                                  patchItem(sec.id, sub.id, item.id, { title: e.target.value });
                                  queueEdit("menu_items", item.id, item.version, { title: e.target.value });
                                }}
                                placeholder="Item title"
                              />
                              {!hasDesc(item.id, item.description) && (
                                <button
                                  type="button"
                                  onClick={() => revealDesc(item.id)}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
                                  aria-label="Add description"
                                >
                                  <Plus className="h-3 w-3" /> description
                                </button>
                              )}
                            </div>
                            <PriceInput
                              cents={item.base_price_cents}
                              onCommit={(cents) => {
                                patchItem(sec.id, sub.id, item.id, { base_price_cents: cents });
                                queueEdit("menu_items", item.id, item.version, { base_price_cents: cents });
                              }}
                            />
                            {hasDesc(item.id, item.description) && (
                              <Textarea
                                className="sm:col-span-2"
                                rows={1}
                                value={item.description}
                                onChange={(e) => {
                                  patchItem(sec.id, sub.id, item.id, { description: e.target.value });
                                  queueEdit("menu_items", item.id, item.version, { description: e.target.value });
                                }}
                                placeholder="Item description"
                              />
                            )}
                          </div>
                          <RowSettingsMenu
                            size="sm"
                            hidden={item.is_hidden}
                            onToggleHidden={() => {
                              const next = !item.is_hidden;
                              patchItem(sec.id, sub.id, item.id, { is_hidden: next });
                              queueEdit("menu_items", item.id, item.version, { is_hidden: next });
                            }}
                            onDelete={() => removeRow("menu_items", item.id)}
                          />
                        </div>

                        {item.modifications.length > 0 && (
                          <div className="pl-7 space-y-1">
                            {item.modifications.map((m, mIdx) => (
                              <div key={m.id} className="flex items-center gap-2">
                                <div className="flex flex-col rounded-md border bg-background shrink-0">
                                  <Button size="icon" variant="ghost" className="h-5 w-5 rounded-b-none" disabled={mIdx === 0} onClick={() => move("item_modifications", item.modifications.map((x) => x.id), mIdx, mIdx - 1)} aria-label="Move modification up">
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-5 w-5 rounded-t-none" disabled={mIdx === item.modifications.length - 1} onClick={() => move("item_modifications", item.modifications.map((x) => x.id), mIdx, mIdx + 1)} aria-label="Move modification down">
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <Input
                                  className="h-8 flex-1"
                                  value={m.modification_name}
                                  onChange={(e) => {
                                    patchMod(sec.id, sub.id, item.id, m.id, { modification_name: e.target.value });
                                    queueEdit("item_modifications", m.id, m.version, { modification_name: e.target.value });
                                  }}
                                  placeholder="Modification"
                                />
                                <PriceInput
                                  className="h-8 w-24"
                                  cents={m.price_modifier_cents}
                                  onCommit={(cents) => {
                                    patchMod(sec.id, sub.id, item.id, m.id, { price_modifier_cents: cents });
                                    queueEdit("item_modifications", m.id, m.version, { price_modifier_cents: cents });
                                  }}
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow("item_modifications", m.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pl-7">
                          <Button size="sm" variant="ghost" onClick={() => addMod(sec.id, sub.id, item.id)}>
                            <Plus className="h-3 w-3" /> Add modification
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addItem(sec.id, sub.id)}>
                      <Plus className="h-3 w-3" /> Add item
                    </Button>
                  </div>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addSubsection(sec.id)}>
                <Plus className="h-3 w-3" /> Add subsection
              </Button>
            </CardContent>
            )}
          </Card>
        ))}

        {sections.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No sections yet — click "Section" to add the first one.
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteSubTarget}
        onOpenChange={(o) => {
          if (!o && !deleteSubBusy) setDeleteSubTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete subsection “{deleteSubTarget?.name}”?</DialogTitle>
            <DialogDescription>
              This subsection contains {deleteSubTarget?.itemCount} item
              {deleteSubTarget?.itemCount === 1 ? "" : "s"}. Choose what to do
              with them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <input
                  type="radio"
                  name="delete-sub-mode"
                  className="mt-1"
                  checked={deleteSubMode === "move"}
                  onChange={() => setDeleteSubMode("move")}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">Move items to another subsection</div>
                  <div className="text-xs text-muted-foreground">
                    Items keep their data and order at the end of the destination.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <input
                  type="radio"
                  name="delete-sub-mode"
                  className="mt-1"
                  checked={deleteSubMode === "delete"}
                  onChange={() => setDeleteSubMode("delete")}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-destructive">Delete items along with the subsection</div>
                  <div className="text-xs text-muted-foreground">
                    All {deleteSubTarget?.itemCount} item
                    {deleteSubTarget?.itemCount === 1 ? "" : "s"} will be removed.
                  </div>
                </div>
              </label>
            </div>

            {deleteSubMode === "move" && (
              <div className="space-y-2">
                <Label>Move items to</Label>
                {subsectionOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other subsections available — create one first or choose to delete the items.
                  </p>
                ) : (
                  <Select value={deleteSubMoveTo} onValueChange={setDeleteSubMoveTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a destination subsection" />
                    </SelectTrigger>
                    <SelectContent>
                      {subsectionOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSubTarget(null)}
              disabled={deleteSubBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteSubsection}
              disabled={
                deleteSubBusy ||
                (deleteSubMode === "move" && !deleteSubMoveTo)
              }
            >
              {deleteSubBusy
                ? "Working…"
                : deleteSubMode === "move"
                ? "Move items & delete subsection"
                : "Delete subsection & items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

void CardTitle;
