import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, ArrowLeft, ExternalLink, ChevronRight, Settings2, Eye, EyeOff, Copy, Ban, RotateCcw, Languages, Lock, Sparkles } from "lucide-react";
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
  translateMissingRow,
  listMissingTranslations,
  type MenuSection,
  type MenuSubsection,
  type MenuItem,
  type MenuModification,
  type Lang,
} from "@/lib/menu.functions";
import { refreshDisplayMenu } from "@/lib/menu-display.functions";
import { listMenus, addMenu, type MenuOption } from "@/lib/menus.functions";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/menu-editor")({
  component: MenuEditorPage,
});



type MenuOptionLite = { key: string; label: string };

type Dirty = { table: string; id: string; expectedVersion: number; patch: Record<string, unknown> };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isSoldOutToday(d?: string | null): boolean {
  return !!d && d === todayISO();
}

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
  options,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: MenuOptionLite[];
}) {
  const set = new Set(value);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Show on:</span>
      {options.map((m) => {
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
              onChange(options.filter((o) => next.has(o.key)).map((o) => o.key));
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

function BilingualField({
  multiline = false,
  rows = 1,
  fr,
  en,
  sourceLang,
  isManualOverrideFr,
  isManualOverrideEn,
  doNotTranslate,
  placeholderFr,
  placeholderEn,
  inputClassName,
  onChange,
}: {
  multiline?: boolean;
  rows?: number;
  fr: string;
  en: string | null;
  sourceLang: Lang;
  isManualOverrideFr: boolean;
  isManualOverrideEn: boolean;
  doNotTranslate: boolean;
  placeholderFr?: string;
  placeholderEn?: string;
  inputClassName?: string;
  onChange: (next: { fr: string; en: string; hint: Lang }) => void;
}) {
  const enVal = en ?? "";
  const handleFr = (v: string) => {
    if (doNotTranslate) onChange({ fr: v, en: v, hint: "fr" });
    else onChange({ fr: v, en: enVal, hint: "fr" });
  };
  const handleEn = (v: string) => {
    if (doNotTranslate) onChange({ fr: v, en: v, hint: "en" });
    else onChange({ fr, en: v, hint: "en" });
  };
  const Renderer = ({
    value,
    onValue,
    placeholder,
    className,
    disabled,
  }: {
    value: string;
    onValue: (v: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
  }) =>
    multiline ? (
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    ) : (
      <Input
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  const srcAccent = "border-l-[3px] border-l-primary";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-0.5">
        <Renderer
          value={fr}
          onValue={handleFr}
          placeholder={placeholderFr}
          className={cn(inputClassName, sourceLang === "fr" && !doNotTranslate && srcAccent)}
        />
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
          <span>FR</span>
          {!doNotTranslate && sourceLang === "en" && isManualOverrideFr && <span>· manual</span>}
        </div>
      </div>
      <div className="space-y-0.5">
        <Renderer
          value={enVal}
          onValue={handleEn}
          placeholder={placeholderEn}
          className={cn(
            inputClassName,
            sourceLang === "en" && !doNotTranslate && srcAccent,
            doNotTranslate && "opacity-70",
          )}
        />
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
          <span>EN</span>
          {doNotTranslate && (
            <>
              <Lock className="h-2.5 w-2.5" />
              <span>same as FR</span>
            </>
          )}
          {!doNotTranslate && sourceLang === "fr" && isManualOverrideEn && <span>· manual</span>}
        </div>
      </div>
    </div>
  );
}

function RowSettingsMenu({
  hidden,
  soldOut,
  onToggleHidden,
  onToggleSoldOut,
  onDuplicate,
  onDelete,
  onAddDescription,
  canAddDescription,
  doNotTranslate,
  onToggleDoNotTranslate,
  onTranslateMissing,
  canTranslateMissing,
  size = "md",
}: {
  hidden: boolean;
  soldOut: boolean;
  onToggleHidden: () => void;
  onToggleSoldOut: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddDescription?: () => void;
  canAddDescription?: boolean;
  doNotTranslate?: boolean;
  onToggleDoNotTranslate?: () => void;
  onTranslateMissing?: () => void;
  canTranslateMissing?: boolean;
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
        {onAddDescription && canAddDescription && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onAddDescription(); }}>
            <Plus className="h-4 w-4" /> Add description
          </DropdownMenuItem>
        )}
        {onTranslateMissing && canTranslateMissing && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onTranslateMissing(); }}>
            <Sparkles className="h-4 w-4" /> Translate missing language
          </DropdownMenuItem>
        )}
        {onToggleDoNotTranslate && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onToggleDoNotTranslate(); }}>
            <Languages className="h-4 w-4" />
            {doNotTranslate ? "Allow translation" : "Same in both languages"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onToggleSoldOut(); }}>
          {soldOut ? (
            <><RotateCcw className="h-4 w-4" /> Mark as available</>
          ) : (
            <><Ban className="h-4 w-4" /> Mark as sold out (today)</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onToggleHidden(); }}>
          {hidden ? (
            <><Eye className="h-4 w-4" /> Show on live menu</>
          ) : (
            <><EyeOff className="h-4 w-4" /> Hide on live menu</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDuplicate(); }}>
          <Copy className="h-4 w-4" /> Duplicate
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
  const translateMissing = useServerFn(translateMissingRow);
  const handleTranslateMissing = async (
    table: "menu_sections" | "menu_subsections" | "menu_items",
    id: string,
  ) => {
    try {
      const r = await translateMissing({ data: { table, id } });
      if (r.translated > 0) {
        toast.success(`Translated ${r.translated} field${r.translated > 1 ? "s" : ""}`);
        await reload();
        triggerRefresh();
      } else {
        toast.info("Nothing to translate");
      }
    } catch (e) {
      console.error("[menu] translateMissing failed", e);
      toast.error("Translation failed");
    }
  };
  const listMissing = useServerFn(listMissingTranslations);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null);
  const handleTranslateAll = async () => {
    if (translatingAll) return;
    setTranslatingAll(true);
    setTranslateProgress(null);
    try {
      const { targets } = await listMissing({});
      if (targets.length === 0) {
        toast.info("Nothing to translate");
        return;
      }
      setTranslateProgress({ done: 0, total: targets.length });
      let translated = 0;
      let failures = 0;
      const CONCURRENCY = 3;
      let cursor = 0;
      const worker = async () => {
        while (cursor < targets.length) {
          const idx = cursor++;
          const t = targets[idx];
          try {
            const r = await translateMissing({ data: { table: t.table, id: t.id } });
            translated += r.translated || 0;
          } catch (e) {
            console.error("[menu] translate row failed", t, e);
            failures++;
          }
          setTranslateProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
      if (translated > 0) {
        toast.success(
          `Translated ${translated} field${translated > 1 ? "s" : ""} across ${targets.length} row${targets.length > 1 ? "s" : ""}${failures ? ` (${failures} failed)` : ""}`,
        );
        await reload();
        triggerRefresh();
      } else {
        toast.info(failures ? `All ${failures} attempts failed` : "Nothing to translate");
      }
    } catch (e) {
      console.error("[menu] translateAll failed", e);
      toast.error("Bulk translation failed");
    } finally {
      setTranslatingAll(false);
      setTranslateProgress(null);
    }
  };
  const refreshDisplay = useServerFn(refreshDisplayMenu);
  const triggerRefresh = () => {
    refreshDisplay({}).catch((e) => console.error("[menu] refresh failed", e));
  };

  const [sections, setSections] = useState<MenuSection[]>([]);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(0);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());
  const [showDesc, setShowDesc] = useState<Set<string>>(new Set());
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [newMenuLabel, setNewMenuLabel] = useState("");
  const [addingMenu, setAddingMenu] = useState(false);
  const fetchMenus = useServerFn(listMenus);
  const createMenu = useServerFn(addMenu);
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
    const [res, m] = await Promise.all([list(), fetchMenus()]);
    setSections(res.sections);
    setMenus(m.menus);
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

  const discardChanges = async () => {
    if (dirtyRef.current.size === 0) return;
    dirtyRef.current.clear();
    setDirtyCount(0);
    await reload();
    toast.success("Changes discarded");
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

  const duplicateSection = async (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    try {
      const { row: newSecRow } = await insert({
        data: {
          table: "menu_sections" as never,
          values: {
            name: sec.name,
            description: sec.description,
            is_hidden: sec.is_hidden,
            visible_menus: sec.visible_menus,
            display_order: sections.length + 1,
          } as never,
        },
      });
      const newSecId = (newSecRow as { id: string }).id;
      for (const sub of sec.subsections) {
        const { row: newSubRow } = await insert({
          data: {
            table: "menu_subsections" as never,
            values: {
              section_id: newSecId,
              name: sub.name,
              description: sub.description,
              is_hidden: sub.is_hidden,
              visible_menus: sub.visible_menus,
              display_order: sub.display_order,
            } as never,
          },
        });
        const newSubId = (newSubRow as { id: string }).id;
        for (const item of sub.items) {
          const { row: newItemRow } = await insert({
            data: {
              table: "menu_items" as never,
              values: {
                subsection_id: newSubId,
                title: item.title,
                description: item.description,
                base_price_cents: item.base_price_cents,
                is_hidden: item.is_hidden,
                display_order: item.display_order,
              } as never,
            },
          });
          const newItemId = (newItemRow as { id: string }).id;
          for (const m of item.modifications) {
            await insert({
              data: {
                table: "item_modifications" as never,
                values: {
                  item_id: newItemId,
                  modification_name: m.modification_name,
                  price_modifier_cents: m.price_modifier_cents,
                  display_order: m.display_order,
                } as never,
              },
            });
          }
        }
      }
      const ids = sections.map((s) => s.id);
      const fromIdx = ids.indexOf(sectionId);
      const newOrder = [...ids];
      newOrder.splice(fromIdx + 1, 0, newSecId);
      await reorder({ data: { table: "menu_sections" as never, orderedIds: newOrder } });
      await reload();
      triggerRefresh();
      toast.success("Section duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate section");
    }
  };

  const duplicateSubsection = async (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    const sub = sec?.subsections.find((ss) => ss.id === subId);
    if (!sec || !sub) return;
    try {
      const { row: newSubRow } = await insert({
        data: {
          table: "menu_subsections" as never,
          values: {
            section_id: sectionId,
            name: sub.name,
            description: sub.description,
            is_hidden: sub.is_hidden,
            visible_menus: sub.visible_menus,
            display_order: sec.subsections.length + 1,
          } as never,
        },
      });
      const newSubId = (newSubRow as { id: string }).id;
      for (const item of sub.items) {
        const { row: newItemRow } = await insert({
          data: {
            table: "menu_items" as never,
            values: {
              subsection_id: newSubId,
              title: item.title,
              description: item.description,
              base_price_cents: item.base_price_cents,
              is_hidden: item.is_hidden,
              display_order: item.display_order,
            } as never,
          },
        });
        const newItemId = (newItemRow as { id: string }).id;
        for (const m of item.modifications) {
          await insert({
            data: {
              table: "item_modifications" as never,
              values: {
                item_id: newItemId,
                modification_name: m.modification_name,
                price_modifier_cents: m.price_modifier_cents,
                display_order: m.display_order,
              } as never,
            },
          });
        }
      }
      const ids = sec.subsections.map((s) => s.id);
      const fromIdx = ids.indexOf(subId);
      const newOrder = [...ids];
      newOrder.splice(fromIdx + 1, 0, newSubId);
      await reorder({ data: { table: "menu_subsections" as never, orderedIds: newOrder } });
      await reload();
      triggerRefresh();
      toast.success("Subsection duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate subsection");
    }
  };

  const duplicateItem = async (sectionId: string, subId: string, itemId: string) => {
    const sub = sections.find((s) => s.id === sectionId)?.subsections.find((ss) => ss.id === subId);
    const item = sub?.items.find((i) => i.id === itemId);
    if (!sub || !item) return;
    try {
      const { row: newItemRow } = await insert({
        data: {
          table: "menu_items" as never,
          values: {
            subsection_id: subId,
            title: item.title,
            description: item.description,
            base_price_cents: item.base_price_cents,
            is_hidden: item.is_hidden,
            display_order: sub.items.length + 1,
          } as never,
        },
      });
      const newItemId = (newItemRow as { id: string }).id;
      for (const m of item.modifications) {
        await insert({
          data: {
            table: "item_modifications" as never,
            values: {
              item_id: newItemId,
              modification_name: m.modification_name,
              price_modifier_cents: m.price_modifier_cents,
              display_order: m.display_order,
            } as never,
          },
        });
      }
      const ids = sub.items.map((i) => i.id);
      const fromIdx = ids.indexOf(itemId);
      const newOrder = [...ids];
      newOrder.splice(fromIdx + 1, 0, newItemId);
      await reorder({ data: { table: "menu_items" as never, orderedIds: newOrder } });
      await reload();
      triggerRefresh();
      toast.success("Item duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate item");
    }
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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={discardChanges} disabled={savingCount > 0}>
              Discard
            </Button>
            <Button size="sm" onClick={flush} disabled={savingCount > 0}>
              <Save className="h-4 w-4" /> {savingCount > 0 ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
      <header className="mb-6 space-y-4 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:space-y-0">
        <div>
          <Link to="/functions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Functions
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Menu Editor</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {sections.length} sections · {totalItems} items
            {savingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs">
                <Save className="h-3 w-3 animate-pulse" /> Saving…
              </span>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0 whitespace-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden xs:inline sm:inline">View Menus</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href={`https://menu.savsav.net?menu=auto`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Live Menu
                  </a>
                </DropdownMenuItem>
                {menus.map((opt) => (
                  <DropdownMenuItem key={opt.key} asChild>
                    <a
                      href={`https://menu.savsav.net?menu=${encodeURIComponent(opt.key)}`}
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
            <Button size="sm" variant="outline" onClick={handleTranslateAll} disabled={translatingAll}>
              <Sparkles className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">
                {translatingAll ? "Translating…" : "Translate missing"}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Add
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); addSection(); }}>
                  <Plus className="h-4 w-4" /> New section
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNewMenuLabel(""); setAddMenuOpen(true); }}>
                  <Plus className="h-4 w-4" /> New menu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {sections.map((sec, sIdx) => (
          <Card key={sec.id} className={`border-2 ${sec.is_hidden ? "opacity-50" : ""} ${isSoldOutToday(sec.sold_out_date) ? "[&_input]:text-muted-foreground/40" : ""}`}>
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
                  <BilingualField
                    fr={sec.name}
                    en={sec.name_en}
                    sourceLang={sec.name_source_lang}
                    isManualOverrideFr={sec.name_source_lang === "en" && sec.name_is_manual_override}
                    isManualOverrideEn={sec.name_source_lang === "fr" && sec.name_is_manual_override}
                    doNotTranslate={sec.do_not_translate}
                    placeholderFr="Nom de section"
                    placeholderEn="Section name"
                    inputClassName="text-lg font-semibold"
                    onChange={({ fr, en, hint }) => {
                      patchSection(sec.id, { name: fr, name_en: en });
                      queueEdit("menu_sections", sec.id, sec.version, {
                        name: fr,
                        name_en: en,
                        name_source_lang_hint: hint,
                      });
                    }}
                  />
                  {!collapsed.has(sec.id) && (
                    hasDesc(sec.id, sec.description) ? (
                      <BilingualField
                        multiline
                        fr={sec.description}
                        en={sec.description_en}
                        sourceLang={sec.description_source_lang}
                        isManualOverrideFr={sec.description_source_lang === "en" && sec.description_is_manual_override}
                        isManualOverrideEn={sec.description_source_lang === "fr" && sec.description_is_manual_override}
                        doNotTranslate={sec.do_not_translate}
                        placeholderFr="Description (FR)"
                        placeholderEn="Description (EN)"
                        onChange={({ fr, en, hint }) => {
                          patchSection(sec.id, { description: fr, description_en: en });
                          queueEdit("menu_sections", sec.id, sec.version, {
                            description: fr,
                            description_en: en,
                            description_source_lang_hint: hint,
                          });
                        }}
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
                    options={menus}
                    value={sec.visible_menus}
                    onChange={(next) => {
                      patchSection(sec.id, { visible_menus: next });
                      queueEdit("menu_sections", sec.id, sec.version, { visible_menus: next });
                    }}
                  />
                </div>
                <RowSettingsMenu
                  hidden={sec.is_hidden}
                  soldOut={isSoldOutToday(sec.sold_out_date)}
                  onToggleHidden={() => {
                    const next = !sec.is_hidden;
                    patchSection(sec.id, { is_hidden: next });
                    queueEdit("menu_sections", sec.id, sec.version, { is_hidden: next });
                  }}
                  onToggleSoldOut={() => {
                    const next = isSoldOutToday(sec.sold_out_date) ? null : todayISO();
                    patchSection(sec.id, { sold_out_date: next });
                    queueEdit("menu_sections", sec.id, sec.version, { sold_out_date: next });
                  }}
                  onDuplicate={() => duplicateSection(sec.id)}
                  onDelete={() => removeRow("menu_sections", sec.id)}
                  onAddDescription={() => revealDesc(sec.id)}
                  canAddDescription={!hasDesc(sec.id, sec.description) && !collapsed.has(sec.id)}
                  onTranslateMissing={() => handleTranslateMissing("menu_sections", sec.id)}
                  canTranslateMissing={!sec.do_not_translate && (
                    (!!sec.name?.trim() !== !!sec.name_en?.trim()) ||
                    (!!sec.description?.trim() !== !!sec.description_en?.trim())
                  )}
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
                <div key={sub.id} className={`rounded-md border p-3 space-y-3 ${sub.is_hidden ? "opacity-50" : ""} ${isSoldOutToday(sub.sold_out_date) ? "[&_input]:text-muted-foreground/40" : ""}`}>
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
                      <BilingualField
                        fr={sub.name}
                        en={sub.name_en}
                        sourceLang={sub.name_source_lang}
                        isManualOverrideFr={sub.name_source_lang === "en" && sub.name_is_manual_override}
                        isManualOverrideEn={sub.name_source_lang === "fr" && sub.name_is_manual_override}
                        doNotTranslate={sub.do_not_translate}
                        placeholderFr="Nom de sous-section"
                        placeholderEn="Subsection name"
                        inputClassName="font-medium"
                        onChange={({ fr, en, hint }) => {
                          patchSubsection(sec.id, sub.id, { name: fr, name_en: en });
                          queueEdit("menu_subsections", sub.id, sub.version, {
                            name: fr,
                            name_en: en,
                            name_source_lang_hint: hint,
                          });
                        }}
                      />
                      {hasDesc(sub.id, sub.description) ? (
                        <BilingualField
                          fr={sub.description}
                          en={sub.description_en}
                          sourceLang={sub.description_source_lang}
                          isManualOverrideFr={sub.description_source_lang === "en" && sub.description_is_manual_override}
                          isManualOverrideEn={sub.description_source_lang === "fr" && sub.description_is_manual_override}
                          doNotTranslate={sub.do_not_translate}
                          placeholderFr="Description (FR)"
                          placeholderEn="Description (EN)"
                          onChange={({ fr, en, hint }) => {
                            patchSubsection(sec.id, sub.id, { description: fr, description_en: en });
                            queueEdit("menu_subsections", sub.id, sub.version, {
                              description: fr,
                              description_en: en,
                              description_source_lang_hint: hint,
                            });
                          }}
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
                        options={menus}
                        value={sub.visible_menus}
                        onChange={(next) => {
                          patchSubsection(sec.id, sub.id, { visible_menus: next });
                          queueEdit("menu_subsections", sub.id, sub.version, { visible_menus: next });
                        }}
                      />
                    </div>
                    <RowSettingsMenu
                      hidden={sub.is_hidden}
                      soldOut={isSoldOutToday(sub.sold_out_date)}
                      doNotTranslate={sub.do_not_translate}
                      onToggleDoNotTranslate={() => {
                        const next = !sub.do_not_translate;
                        patchSubsection(sec.id, sub.id, { do_not_translate: next });
                        queueEdit("menu_subsections", sub.id, sub.version, { do_not_translate: next });
                      }}
                      onToggleHidden={() => {
                        const next = !sub.is_hidden;
                        patchSubsection(sec.id, sub.id, { is_hidden: next });
                        queueEdit("menu_subsections", sub.id, sub.version, { is_hidden: next });
                      }}
                      onToggleSoldOut={() => {
                        const next = isSoldOutToday(sub.sold_out_date) ? null : todayISO();
                        patchSubsection(sec.id, sub.id, { sold_out_date: next });
                        queueEdit("menu_subsections", sub.id, sub.version, { sold_out_date: next });
                      }}
                      onDuplicate={() => duplicateSubsection(sec.id, sub.id)}
                      onDelete={() => requestDeleteSubsection(sec.id, sub.id)}
                      onAddDescription={() => revealDesc(sub.id)}
                      canAddDescription={!hasDesc(sub.id, sub.description)}
                      onTranslateMissing={() => handleTranslateMissing("menu_subsections", sub.id)}
                      canTranslateMissing={!sub.do_not_translate && (
                        (!!sub.name?.trim() !== !!sub.name_en?.trim()) ||
                        (!!sub.description?.trim() !== !!sub.description_en?.trim())
                      )}
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
                      <div key={item.id} className={`rounded border bg-muted/30 p-2 space-y-2 ${item.is_hidden ? "opacity-50" : ""} ${isSoldOutToday(item.sold_out_date) ? "[&_input]:text-muted-foreground/40 [&_textarea]:text-muted-foreground/40" : ""}`}>
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
                            <BilingualField
                              fr={item.title}
                              en={item.title_en}
                              sourceLang={item.title_source_lang}
                              isManualOverrideFr={item.title_source_lang === "en" && item.title_is_manual_override}
                              isManualOverrideEn={item.title_source_lang === "fr" && item.title_is_manual_override}
                              doNotTranslate={item.do_not_translate}
                              placeholderFr="Titre"
                              placeholderEn="Title"
                              onChange={({ fr, en, hint }) => {
                                patchItem(sec.id, sub.id, item.id, { title: fr, title_en: en });
                                queueEdit("menu_items", item.id, item.version, {
                                  title: fr,
                                  title_en: en,
                                  title_source_lang_hint: hint,
                                });
                              }}
                            />
                            <PriceInput
                              cents={item.base_price_cents}
                              onCommit={(cents) => {
                                patchItem(sec.id, sub.id, item.id, { base_price_cents: cents });
                                queueEdit("menu_items", item.id, item.version, { base_price_cents: cents });
                              }}
                            />
                            {hasDesc(item.id, item.description) && (
                              <div className="sm:col-span-2">
                                <BilingualField
                                  multiline
                                  rows={1}
                                  fr={item.description}
                                  en={item.description_en}
                                  sourceLang={item.description_source_lang}
                                  isManualOverrideFr={item.description_source_lang === "en" && item.description_is_manual_override}
                                  isManualOverrideEn={item.description_source_lang === "fr" && item.description_is_manual_override}
                                  doNotTranslate={item.do_not_translate}
                                  placeholderFr="Description"
                                  placeholderEn="Description"
                                  onChange={({ fr, en, hint }) => {
                                    patchItem(sec.id, sub.id, item.id, { description: fr, description_en: en });
                                    queueEdit("menu_items", item.id, item.version, {
                                      description: fr,
                                      description_en: en,
                                      description_source_lang_hint: hint,
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <RowSettingsMenu
                            size="sm"
                            hidden={item.is_hidden}
                            soldOut={isSoldOutToday(item.sold_out_date)}
                            onToggleHidden={() => {
                              const next = !item.is_hidden;
                              patchItem(sec.id, sub.id, item.id, { is_hidden: next });
                              queueEdit("menu_items", item.id, item.version, { is_hidden: next });
                            }}
                            onToggleSoldOut={() => {
                              const next = isSoldOutToday(item.sold_out_date) ? null : todayISO();
                              patchItem(sec.id, sub.id, item.id, { sold_out_date: next });
                              queueEdit("menu_items", item.id, item.version, { sold_out_date: next });
                            }}
                            onDuplicate={() => duplicateItem(sec.id, sub.id, item.id)}
                            onDelete={() => removeRow("menu_items", item.id)}
                            onAddDescription={() => revealDesc(item.id)}
                            canAddDescription={!hasDesc(item.id, item.description)}
                            doNotTranslate={item.do_not_translate}
                            onToggleDoNotTranslate={() => {
                              const next = !item.do_not_translate;
                              patchItem(sec.id, sub.id, item.id, { do_not_translate: next });
                              queueEdit("menu_items", item.id, item.version, { do_not_translate: next });
                            }}
                            onTranslateMissing={() => handleTranslateMissing("menu_items", item.id)}
                            canTranslateMissing={!item.do_not_translate && (
                              (!!item.title?.trim() !== !!item.title_en?.trim()) ||
                              (!!item.description?.trim() !== !!item.description_en?.trim())
                            )}
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

      <Dialog open={addMenuOpen} onOpenChange={(o) => { if (!addingMenu) setAddMenuOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new menu</DialogTitle>
            <DialogDescription>
              Adds a new menu (e.g. Brunch, Late night) that items can be assigned to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-menu-label">Menu name</Label>
            <Input
              id="new-menu-label"
              autoFocus
              value={newMenuLabel}
              onChange={(e) => setNewMenuLabel(e.target.value)}
              placeholder="e.g. Brunch"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newMenuLabel.trim() && !addingMenu) {
                  e.preventDefault();
                  (async () => {
                    setAddingMenu(true);
                    try {
                      const { menu } = await createMenu({ data: { label: newMenuLabel.trim() } });
                      setMenus((m) => [...m, menu]);
                      setAddMenuOpen(false);
                      setNewMenuLabel("");
                      toast.success(`Added menu "${menu.label}"`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to add menu");
                    } finally {
                      setAddingMenu(false);
                    }
                  })();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMenuOpen(false)} disabled={addingMenu}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const label = newMenuLabel.trim();
                if (!label) return;
                setAddingMenu(true);
                try {
                  const { menu } = await createMenu({ data: { label } });
                  setMenus((m) => [...m, menu]);
                  setAddMenuOpen(false);
                  setNewMenuLabel("");
                  toast.success(`Added menu "${menu.label}"`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to add menu");
                } finally {
                  setAddingMenu(false);
                }
              }}
              disabled={addingMenu || !newMenuLabel.trim()}
            >
              {addingMenu ? "Adding…" : "Add menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

void CardTitle;
