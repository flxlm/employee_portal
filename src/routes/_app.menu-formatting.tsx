import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  getMenuFormatting,
  saveMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";
import { FONT_OPTIONS, ensureGoogleFontsLoaded } from "@/lib/menu-fonts";
import { refreshDisplayMenu } from "@/lib/menu-display.functions";

export const Route = createFileRoute("/_app/menu-formatting")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/events" });
  },
  component: MenuFormattingPage,
});

const TEXT_KEYS: { key: FormattingKey; label: string; sample: string }[] = [
  { key: "global", label: "Global (defaults)", sample: "Applies to everything unless overridden" },
  { key: "section", label: "Section title", sample: "BREAKFAST" },
  { key: "subsection", label: "Subsection title", sample: "Pastries" },
  { key: "itemTitle", label: "Item title", sample: "Avocado Toast 14" },
  { key: "itemDescription", label: "Item description", sample: "Sourdough, smashed avocado, lemon, chili oil" },
  { key: "modification", label: "Modification", sample: "+ Add egg +3" },
  { key: "brand", label: "Brand badge", sample: "Savsav" },
];

const STYLE_FIELDS: {
  field: keyof TextStyle;
  label: string;
  placeholder: string;
  type?: "select" | "unit";
  options?: string[];
  units?: string[];
  defaultUnit?: string;
}[] = [
  { field: "fontFamily", label: "Font family", placeholder: '"Inter", sans-serif' },
  {
    field: "fontSize",
    label: "Font size",
    placeholder: "1.2",
    type: "unit",
    units: ["vw", "px", "rem", "em"],
    defaultUnit: "vw",
  },
  { field: "fontWeight", label: "Font weight", placeholder: "100–900" },
  {
    field: "letterSpacing",
    label: "Letter spacing",
    placeholder: "-0.01",
    type: "unit",
    units: ["em", "px", "rem"],
    defaultUnit: "em",
  },
  { field: "lineHeight", label: "Line height", placeholder: "1.2 (unitless)" },
  {
    field: "textTransform",
    label: "Text transform",
    placeholder: "",
    type: "select",
    options: ["", "none", "uppercase", "lowercase", "capitalize"],
  },
  { field: "color", label: "Color", placeholder: "#000000" },
  {
    field: "fontStyle",
    label: "Font style",
    placeholder: "",
    type: "select",
    options: ["", "normal", "italic"],
  },
];

function parseUnit(raw: string, units: string[], fallback: string): { num: string; unit: string } {
  if (!raw) return { num: "", unit: fallback };
  const m = String(raw)
    .trim()
    .match(/^(-?\d*\.?\d*)\s*([a-z%]*)$/i);
  if (!m) return { num: String(raw), unit: fallback };
  const unit = m[2] && units.includes(m[2]) ? m[2] : fallback;
  return { num: m[1], unit };
}

function StyleEditor({
  value,
  onChange,
  defaults,
}: {
  value: TextStyle;
  onChange: (next: TextStyle) => void;
  defaults: TextStyle;
}) {
  const update = (field: keyof TextStyle, raw: string) => {
    const next = { ...value };
    if (raw === "") {
      delete (next as Record<string, unknown>)[field];
    } else if (field === "fontWeight") {
      const n = Number(raw);
      next.fontWeight = Number.isFinite(n) ? n : raw;
    } else {
      (next as Record<string, unknown>)[field] = raw;
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {STYLE_FIELDS.map((f) => {
        const current = value[f.field];
        const placeholder =
          defaults[f.field] !== undefined && defaults[f.field] !== ""
            ? `default: ${String(defaults[f.field])}`
            : f.placeholder;
        return (
          <div key={f.field} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            {f.field === "fontFamily" ? (
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={current === undefined ? "" : String(current)}
                onChange={(e) => update(f.field, e.target.value)}
                style={{ fontFamily: current ? String(current) : undefined }}
              >
                <option value="">— inherit —</option>
                {FONT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    style={{ fontFamily: opt.value }}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : f.type === "select" ? (
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={current === undefined ? "" : String(current)}
                onChange={(e) => update(f.field, e.target.value)}
              >
                {(f.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "" ? "— inherit —" : opt}
                  </option>
                ))}
              </select>
            ) : f.type === "unit" ? (
              (() => {
                const units = f.units || [];
                const fallback = f.defaultUnit || units[0] || "";
                const { num, unit } = parseUnit(
                  current === undefined ? "" : String(current),
                  units,
                  fallback,
                );
                const commit = (n: string, u: string) => {
                  if (n === "" || n === "-") {
                    update(f.field, "");
                  } else {
                    update(f.field, `${n}${u}`);
                  }
                };
                return (
                  <div className="flex gap-1">
                    <Input
                      className="flex-1"
                      inputMode="decimal"
                      value={num}
                      onChange={(e) => commit(e.target.value, unit)}
                      placeholder={placeholder}
                    />
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm shrink-0"
                      value={unit}
                      onChange={(e) => commit(num, e.target.value)}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()
            ) : (
              <Input
                value={current === undefined ? "" : String(current)}
                onChange={(e) => update(f.field, e.target.value)}
                placeholder={placeholder}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MenuFormattingPage() {
  const fetchSettings = useServerFn(getMenuFormatting);
  const save = useServerFn(saveMenuFormatting);
  const refreshDisplay = useServerFn(refreshDisplayMenu);
  const [settings, setSettings] = useState<MenuFormatting>({});
  const [savedSettings, setSavedSettings] = useState<MenuFormatting>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    ensureGoogleFontsLoaded();
    fetchSettings({})
      .then((s) => {
        const init = s || {};
        setSettings(init);
        setSavedSettings(init);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [fetchSettings]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const updateKey = (key: FormattingKey, next: TextStyle) => {
    setSettings((prev) => ({ ...prev, [key]: next }));
  };

  const resetKey = (key: FormattingKey) => {
    setSettings((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { settings } });
      setSavedSettings(settings);
      refreshDisplay({}).catch((e) => console.error("[formatting] refresh failed", e));
      toast.success("Formatting saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewStyle = (key: FormattingKey): React.CSSProperties => {
    const merged: TextStyle = {
      ...DEFAULT_FORMATTING.global,
      ...DEFAULT_FORMATTING[key],
      ...settings.global,
      ...settings[key],
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
    };
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {isDirty && (
        <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 py-3 border-b bg-background/95 backdrop-blur flex items-center justify-between gap-3 shadow-sm">
          <span className="text-sm">Unsaved formatting changes</span>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/menu-editor">
              <ArrowLeft className="h-4 w-4" /> Back to menu editor
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Menu formatting</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Controls typography for the live menu display. Leave any field blank to
        inherit from the global defaults. Use any valid CSS value (e.g. <code>1.2vw</code>,
        <code>20px</code>, <code>1.25rem</code>).
      </p>

      <div className="space-y-4">
        {TEXT_KEYS.map(({ key, label, sample }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{label}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetKey(key)}
                disabled={!settings[key]}
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="rounded-md border bg-muted/30 p-4"
                style={{
                  ...(key === "section"
                    ? { background: "#111", color: "#fff" }
                    : {}),
                }}
              >
                <div style={previewStyle(key)}>{sample}</div>
              </div>
              <StyleEditor
                value={settings[key] || {}}
                onChange={(next) => updateKey(key, next)}
                defaults={DEFAULT_FORMATTING[key] || {}}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
