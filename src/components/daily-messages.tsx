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
  Megaphone,
  Trash2,
  Plus,
  CalendarIcon,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DailyMessage = {
  id: string;
  message: string;
  visible_from: string;
  expires_at: string;
  created_at: string;
  created_by: string | null;
};

function endOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function startOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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
  const [visibleFrom, setVisibleFrom] = useState<Date>(() => startOfToday());
  const [expiresOn, setExpiresOn] = useState<Date>(() => startOfToday());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_messages")
      .select("id, message, visible_from, expires_at, created_at, created_by")
      .gt("expires_at", new Date().toISOString())
      .order("visible_from", { ascending: true })
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

  const applyQuickRange = (from: Date, to: Date) => {
    setVisibleFrom(from);
    setExpiresOn(to);
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error("Message required");
      return;
    }
    if (expiresOn < visibleFrom) {
      toast.error("End date must be on or after the start date");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("daily_messages").insert({
      message: text.trim(),
      visible_from: startOfDayIso(visibleFrom),
      expires_at: endOfDayIso(expiresOn),
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setVisibleFrom(startOfToday());
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

        <MessageCarousel
          messages={messages}
          isAdmin={isAdmin}
          onRemove={remove}
        />

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

function MessageCarousel({
  messages,
  isAdmin,
  onRemove,
}: {
  messages: DailyMessage[];
  isAdmin: boolean;
  onRemove: (id: string) => void;
}) {
  const total = messages.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index > total) setIndex(0);
  }, [total, index]);

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No messages yet.
      </p>
    );
  }

  const lastIndex = total; // "all caught up" card
  const atEnd = index >= lastIndex;

  return (
    <div className="w-full">
      <div className="relative">
        <Card className="min-h-[180px]">
          <CardContent className="pt-5 pb-4 flex flex-col gap-3">
            {!atEnd ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Until {new Date(messages[index].expires_at).toLocaleDateString()}
                  </span>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 -mt-1 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(messages[index].id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {messages[index].message}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-6">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">You're all caught up</p>
                <Button size="sm" variant="outline" onClick={() => setIndex(0)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Go back to the beginning
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          aria-label="Previous"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {atEnd ? "End" : `${index + 1} of ${total}`}
        </p>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={atEnd}
          onClick={() => setIndex((i) => Math.min(lastIndex, i + 1))}
          aria-label="Next"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
