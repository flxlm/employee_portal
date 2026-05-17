import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Megaphone, Trash2, Plus, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DailyMessage = {
  id: string;
  message: string;
  expires_at: string;
  created_at: string;
  created_by: string | null;
};

function endOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatPretty(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DailyMessages({ isAdmin, userId }: { isAdmin: boolean; userId: string | null }) {
  const [messages, setMessages] = useState<DailyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [expiresOn, setExpiresOn] = useState<Date>(() => startOfToday());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_messages")
      .select("id, message, expires_at, created_at, created_by")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((data ?? []) as DailyMessage[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!text.trim()) {
      toast.error("Message required");
      return;
    }
    setSaving(true);
    const expires_at = endOfDayIso(expiresOn);
    const { error } = await supabase.from("daily_messages").insert({
      message: text.trim(),
      expires_at,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setExpiresOn(todayInputValue());
    toast.success("Message posted");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("daily_messages").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  // For non-admins, hide entirely when there are no messages
  if (!isAdmin && !loading && messages.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium tracking-wide uppercase">Daily Messages</h2>
      </div>

      <div className="grid gap-3">
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Post a message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a note with the team…"
                rows={2}
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Visible until end of</Label>
                  <Input
                    type="date"
                    value={expiresOn}
                    min={todayInputValue()}
                    onChange={(e) => setExpiresOn(e.target.value || todayInputValue())}
                    className="w-44"
                  />
                </div>
                <Button onClick={submit} disabled={saving} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> {saving ? "Posting…" : "Post"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Default: disappears at end of today.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <p className="text-sm whitespace-pre-wrap flex-1">{m.message}</p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Until {new Date(m.expires_at).toLocaleDateString()}
                </span>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
