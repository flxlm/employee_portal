import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMenuFormatting,
  saveMenuFormatting,
  DEFAULT_FORMATTING,
  type MenuFormatting,
  type TextStyle,
  type FormattingKey,
} from "@/lib/menu-formatting.functions";

export const Route = createFileRoute("/_app/menu-formatting")({
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
  type?: "select";
  options?: string[];
}[] = [
  { field: "fontFamily", label: "Font family", placeholder: '"Inter", sans-serif' },
  { field: "fontSize", label: "Font size", placeholder: "1.2vw or 18px" },
  { field: "fontWeight", label: "Font weight", placeholder: "100–900" },
  { field: "letterSpacing", label: "Letter spacing", placeholder: "-0.01em" },
  { field: "lineHeight", label: "Line height", placeholder: "1.2" },
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
            {f.type === "select" ? (
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
  const [settings, setSettings] = useState<MenuFormatting>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings({})
      .then((s) => setSettings(s || {}))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [fetchSettings]);

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
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/menu-editor">
              <ArrowLeft className="h-4 w-4" /> Back to menu editor
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Menu formatting</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
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
