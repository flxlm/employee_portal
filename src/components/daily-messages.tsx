import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Megaphone, Trash2, Plus, CalendarIcon, RotateCcw, CheckCircle2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
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
    const { error } = await supabase.from("daily_messages").insert({
      message: text.trim(),
      expires_at: endOfDayIso(expiresOn),
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setExpiresOn(startOfToday());
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

  // Non-admins: hide entirely when there are no messages
  if (!isAdmin && (loading || messages.length === 0)) return null;

  const count = messages.length;
  const label =
    count === 0
      ? "NO MESSAGES — POST ONE"
      : `${count} MESSAGE${count === 1 ? "" : "S"} AVAILABLE FOR TODAY`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="mb-6 cursor-pointer transition-colors hover:border-primary">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium tracking-wide uppercase">{label}</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Tap to read or post a message" : "Tap to read"}
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Daily Messages
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No messages yet.
              </p>
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
        </ScrollArea>

        {isAdmin && (
          <div className="border-t pt-4 space-y-3">
            <Label className="text-xs uppercase tracking-wide">Post a message</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share a note with the team…"
              rows={2}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Visible until end of</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("w-56 justify-start font-normal")}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {formatPretty(expiresOn)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresOn}
                      onSelect={(d) => d && setExpiresOn(d)}
                      disabled={(d) => d < startOfToday()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={submit} disabled={saving} size="sm">
                <Plus className="h-4 w-4 mr-1" /> {saving ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
