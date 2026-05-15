import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, ArrowLeft, ExternalLink, ChevronRight } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_app/menu-editor")({
  component: MenuEditorPage,
});

const DEBOUNCE_MS = 500;

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
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
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

function MenuEditorPage() {
  const list = useServerFn(listMenu);
  const insert = useServerFn(insertRow);
  const update = useServerFn(updateRow);
  const del = useServerFn(softDeleteRow);
  const reorder = useServerFn(reorderRows);

  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const collapseAll = () => setCollapsed(new Set(sections.map((s) => s.id)));
  const expandAll = () => setCollapsed(new Set());

  const dirtyRef = useRef<Map<string, Dirty>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = async () => {
    const res = await list();
    setSections(res.sections);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const scheduleFlush = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  };

  const flush = async () => {
    const items = Array.from(dirtyRef.current.values());
    if (items.length === 0) return;
    dirtyRef.current.clear();
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
      for (const r of results) {
        if ("conflict" in r && r.conflict) conflicts++;
        if ("error" in r && r.error) console.error(r.error);
      }
      if (conflicts > 0) {
        toast.error(`${conflicts} edit conflict${conflicts > 1 ? "s" : ""} — reloading`);
        await reload();
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
    scheduleFlush();
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
  };
  const addSubsection = async (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const order = sec.subsections.length + 1;
    const { row } = await insert({
      data: { table: "menu_subsections" as never, values: { section_id: sectionId, name: "New subsection", display_order: order } as never },
    });
    patchSection(sectionId, { subsections: [...sec.subsections, { ...(row as unknown as MenuSubsection), items: [] }] });
  };
  const addItem = async (sectionId: string, subId: string) => {
    const sub = sections.find((s) => s.id === sectionId)?.subsections.find((ss) => ss.id === subId);
    if (!sub) return;
    const order = sub.items.length + 1;
    const { row } = await insert({
      data: { table: "menu_items" as never, values: { subsection_id: subId, title: "New item", base_price_cents: 0, display_order: order } as never },
    });
    patchSubsection(sectionId, subId, { items: [...sub.items, { ...(row as unknown as MenuItem), modifications: [] }] });
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
  };

  const removeRow = async (table: string, id: string) => {
    await del({ data: { table: table as never, id } });
    await reload();
  };

  const move = async (table: string, ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await reorder({ data: { table: table as never, orderedIds: next } });
    await reload();
  };

  const totalItems = useMemo(
    () => sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.items.length, 0), 0),
    [sections]
  );

  if (loading) return <div className="p-10">Loading menu…</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link to="/functions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Functions
          </Link>
          <h1 className="text-3xl md:text-4xl">Menu Editor</h1>
          <p className="text-muted-foreground mt-1">
            {sections.length} sections · {totalItems} items · auto-saves as you type
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savingCount > 0 ? (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Save className="h-3 w-3 animate-pulse" /> Saving…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
          <Button asChild size="sm" variant="outline">
            <a
              href="/display/YtXYdKR1kwQYV7OeoqeuQM0PurNAxKdU"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" /> Live menu
            </a>
          </Button>
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
          <Card key={sec.id} className="border-2">
            <CardHeader className="space-y-3">
              <div className="flex items-start gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => toggleCollapsed(sec.id)}
                  aria-label={collapsed.has(sec.id) ? "Expand section" : "Collapse section"}
                >
                  {collapsed.has(sec.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move("menu_sections", sections.map((x) => x.id), sIdx, sIdx - 1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move("menu_sections", sections.map((x) => x.id), sIdx, sIdx + 1)}>
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
                    <Textarea
                      rows={1}
                      value={sec.description}
                      onChange={(e) => {
                        patchSection(sec.id, { description: e.target.value });
                        queueEdit("menu_sections", sec.id, sec.version, { description: e.target.value });
                      }}
                      placeholder="Section description"
                    />
                  )}
                  <MenuToggles
                    value={sec.visible_menus}
                    onChange={(next) => {
                      patchSection(sec.id, { visible_menus: next });
                      queueEdit("menu_sections", sec.id, sec.version, { visible_menus: next });
                    }}
                  />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeRow("menu_sections", sec.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            {!collapsed.has(sec.id) && (
            <CardContent className="space-y-4">
              {sec.subsections.map((sub, ssIdx) => (
                <div key={sub.id} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move("menu_subsections", sec.subsections.map((x) => x.id), ssIdx, ssIdx - 1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move("menu_subsections", sec.subsections.map((x) => x.id), ssIdx, ssIdx + 1)}>
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
                      <Input
                        value={sub.description}
                        onChange={(e) => {
                          patchSubsection(sec.id, sub.id, { description: e.target.value });
                          queueEdit("menu_subsections", sub.id, sub.version, { description: e.target.value });
                        }}
                        placeholder="Subsection description"
                      />
                      <MenuToggles
                        value={sub.visible_menus}
                        onChange={(next) => {
                          patchSubsection(sec.id, sub.id, { visible_menus: next });
                          queueEdit("menu_subsections", sub.id, sub.version, { visible_menus: next });
                        }}
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeRow("menu_subsections", sub.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-8">
                    {sub.items.map((item, iIdx) => (
                      <div key={item.id} className="rounded border bg-muted/30 p-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col">
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move("menu_items", sub.items.map((x) => x.id), iIdx, iIdx - 1)}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move("menu_items", sub.items.map((x) => x.id), iIdx, iIdx + 1)}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_120px]">
                            <Input
                              value={item.title}
                              onChange={(e) => {
                                patchItem(sec.id, sub.id, item.id, { title: e.target.value });
                                queueEdit("menu_items", item.id, item.version, { title: e.target.value });
                              }}
                              placeholder="Item title"
                            />
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={formatPrice(item.base_price_cents)}
                              onChange={(e) => {
                                const cents = parsePrice(e.target.value);
                                if (cents === null) return;
                                patchItem(sec.id, sub.id, item.id, { base_price_cents: cents });
                                queueEdit("menu_items", item.id, item.version, { base_price_cents: cents });
                              }}
                            />
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
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeRow("menu_items", item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        {item.modifications.length > 0 && (
                          <div className="pl-7 space-y-1">
                            {item.modifications.map((m) => (
                              <div key={m.id} className="flex items-center gap-2">
                                <Input
                                  className="h-8 flex-1"
                                  value={m.modification_name}
                                  onChange={(e) => {
                                    patchMod(sec.id, sub.id, item.id, m.id, { modification_name: e.target.value });
                                    queueEdit("item_modifications", m.id, m.version, { modification_name: e.target.value });
                                  }}
                                  placeholder="Modification"
                                />
                                <Input
                                  className="h-8 w-24"
                                  type="number"
                                  step="0.01"
                                  value={formatPrice(m.price_modifier_cents)}
                                  onChange={(e) => {
                                    const cents = parsePrice(e.target.value);
                                    if (cents === null) return;
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
    </div>
  );
}

void CardTitle;
