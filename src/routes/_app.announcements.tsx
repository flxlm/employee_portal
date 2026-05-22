import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_app/announcements")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/home" });
  },
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  is_enabled: boolean;
  message: string;
  link_url: string | null;
  link_text: string | null;
  background_color: string;
  text_color: string;
  updated_at: string;
  updated_by: string | null;
};

function AnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<Announcement | null>(null);
  const [updatedByEmail, setUpdatedByEmail] = useState<string | null>(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [bg, setBg] = useState("#000000");
  const [fg, setFg] = useState("#FFFFFF");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setRow(data as Announcement);
        setIsEnabled(data.is_enabled);
        setMessage(data.message ?? "");
        setLinkUrl(data.link_url ?? "");
        setLinkText(data.link_text ?? "");
        setBg(data.background_color ?? "#000000");
        setFg(data.text_color ?? "#FFFFFF");
        if (data.updated_by) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", data.updated_by)
            .maybeSingle();
          setUpdatedByEmail(prof?.email ?? null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const lastUpdated = useMemo(() => {
    if (!row?.updated_at) return null;
    try {
      return new Date(row.updated_at).toLocaleString();
    } catch {
      return row.updated_at;
    }
  }, [row?.updated_at]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      const { data, error } = await supabase
        .from("announcements")
        .update({
          is_enabled: isEnabled,
          message,
          link_url: linkUrl.trim() || null,
          link_text: linkText.trim() || null,
          background_color: bg,
          text_color: fg,
          updated_at: new Date().toISOString(),
          updated_by: userId ?? null,
        })
        .eq("id", row.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRow(data as Announcement);
        if (sess.session?.user.email) setUpdatedByEmail(sess.session.user.email);
      }
      toast.success("Announcement saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl mb-2 flex items-center gap-2">
        <Megaphone className="h-7 w-7" /> Announcement Bar
      </h1>
      <p className="text-muted-foreground mb-6">
        Control the announcement bar shown on the customer-facing website.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !row ? (
        <p className="text-sm text-destructive">No announcement row found.</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                {isEnabled ? "Visible on the website." : "Currently hidden."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="w-full rounded-md px-4 py-3 text-sm text-center"
                style={{ backgroundColor: bg, color: fg }}
              >
                {message || <span className="opacity-60">Your announcement message will appear here</span>}
                {linkUrl && linkText && (
                  <>
                    {" "}
                    <a
                      href={linkUrl}
                      onClick={(e) => e.preventDefault()}
                      className="underline font-medium"
                      style={{ color: fg }}
                    >
                      {linkText}
                    </a>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="enabled" className="text-sm font-normal">
                  Announcement enabled
                </Label>
                <Switch id="enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Free shipping on orders over $50!"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="link-url">Link URL (optional)</Label>
                  <Input
                    id="link-url"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/sale"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-text">Link text (optional)</Label>
                  <Input
                    id="link-text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Shop now"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bg">Background color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="bg"
                      type="color"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="h-10 w-16 p-1"
                    />
                    <Input
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fg">Text color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="fg"
                      type="color"
                      value={fg}
                      onChange={(e) => setFg(e.target.value)}
                      className="h-10 w-16 p-1"
                    />
                    <Input
                      value={fg}
                      onChange={(e) => setFg(e.target.value)}
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  {lastUpdated ? (
                    <>
                      Last updated {lastUpdated}
                      {updatedByEmail ? <> by {updatedByEmail}</> : null}
                    </>
                  ) : (
                    "Not yet updated"
                  )}
                </p>
                <Button onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
