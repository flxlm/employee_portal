import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/_app/open-close")({
  component: OpenClosePage,
});

const TARGET = 200;

type LogRow = {
  id: string;
  user_email: string;
  shift_type: "open" | "close";
  log_date: string;
  till_amount: number;
  till_status: string;
  till_difference: number;
  cash_tips: number;
  photo_path: string | null;
  notes: string | null;
  created_at: string;
};

function OpenClosePage() {
  const { user } = useAuth();
  const [shift, setShift] = useState<"open" | "close">("open");
  const [tillAmount, setTillAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);

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

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from("open_close_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLogs(data as LogRow[]);
    // Sign photo URLs
    const urls: Record<string, string> = {};
    for (const row of data as LogRow[]) {
      if (row.photo_path) {
        const { data: signed } = await supabase.storage
          .from("shift-photos")
          .createSignedUrl(row.photo_path, 3600);
        if (signed) urls[row.id] = signed.signedUrl;
      }
    }
    setPhotoUrls(urls);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!confirmed) {
      toast.error("Please confirm you completed everything.");
      return;
    }
    const amount = parseFloat(tillAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid till amount.");
      return;
    }

    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("shift-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        photoPath = path;
      }

      const diff = amount - TARGET;
      const status = diff === 0 ? "exact" : diff > 0 ? "over" : "under";

      const { error } = await supabase.from("open_close_logs").insert({
        user_id: user.id,
        user_email: user.email!,
        shift_type: shift,
        till_amount: amount,
        till_status: status,
        till_difference: diff,
        photo_path: photoPath,
        confirmed: true,
        notes: notes || null,
      });
      if (error) throw error;

      toast.success(`${shift === "open" ? "Opening" : "Closing"} log saved`);
      setTillAmount("");
      setNotes("");
      setPhotoFile(null);
      setConfirmed(false);
      loadLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save log");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-serif mb-6">Open / Close Log</h1>

      <Tabs defaultValue="new">
        <TabsList className="mb-4">
          <TabsTrigger value="new">New entry</TabsTrigger>
          {isAdmin && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Submit shift log</CardTitle>
              <CardDescription>Filled in by {user?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={shift === "open" ? "default" : "outline"}
                    onClick={() => setShift("open")}
                    className="flex-1"
                  >
                    <Sun className="h-4 w-4 mr-2" /> Opening
                  </Button>
                  <Button
                    type="button"
                    variant={shift === "close" ? "default" : "outline"}
                    onClick={() => setShift("close")}
                    className="flex-1"
                  >
                    <Moon className="h-4 w-4 mr-2" /> Closing
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="till">Till amount ($)</Label>
                  <Input
                    id="till"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={tillAmount}
                    onChange={(e) => setTillAmount(e.target.value)}
                    placeholder="200.00"
                  />
                  {tillAmount && !isNaN(parseFloat(tillAmount)) && (
                    <p className="text-sm">
                      {parseFloat(tillAmount) > TARGET ? (
                        <span className="text-emerald-700">Over by ${(parseFloat(tillAmount) - TARGET).toFixed(2)}</span>
                      ) : parseFloat(tillAmount) < TARGET ? (
                        <span className="text-rose-700">Under by ${(TARGET - parseFloat(tillAmount)).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">On target</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo of the space</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("photo")?.click()}
                      className="gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      {photoFile ? "Change photo" : "Add photo"}
                    </Button>
                    <input
                      id="photo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    />
                    {photoFile && (
                      <span className="text-xs text-muted-foreground truncate">{photoFile.name}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-md bg-secondary">
                  <Checkbox id="confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
                  <label htmlFor="confirm" className="text-sm cursor-pointer leading-relaxed">
                    I confirm having done everything required for this {shift === "open" ? "opening" : "closing"} shift.
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Saving..." : "Submit log"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && <TabsContent value="history">
          <div className="space-y-3">
            {logs.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No logs yet.</CardContent></Card>
            )}
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.shift_type === "open" ? "default" : "secondary"}>
                          {log.shift_type === "open" ? "Opening" : "Closing"}
                        </Badge>
                        <span className="text-sm font-medium">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{log.user_email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg tabular-nums font-medium">${Number(log.till_amount).toFixed(2)}</div>
                      <div className={`text-xs ${log.till_status === "over" ? "text-emerald-700" : log.till_status === "under" ? "text-rose-700" : "text-muted-foreground"}`}>
                        {log.till_status === "exact" ? "On target" : `${log.till_status} by $${Math.abs(Number(log.till_difference)).toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                  {log.notes && <p className="text-sm mt-3 whitespace-pre-wrap">{log.notes}</p>}
                  {log.photo_path && photoUrls[log.id] && (
                    <a href={photoUrls[log.id]} target="_blank" rel="noreferrer" className="block mt-3">
                      <img src={photoUrls[log.id]} alt="Shift" className="max-h-48 rounded-md border border-border" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>}
      </Tabs>
    </div>
  );
}
