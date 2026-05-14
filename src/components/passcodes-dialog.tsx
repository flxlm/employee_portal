import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Plus, Trash2, ShieldAlert, Lock } from "lucide-react";
import {
  listPasscodes,
  upsertPasscode,
  deletePasscode,
} from "@/lib/passcodes.functions";

interface Passcode {
  id: string;
  label: string;
  code: string;
  admin_only: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasscodesDialog({ open, onOpenChange }: Props) {
  const list = useServerFn(listPasscodes);
  const upsert = useServerFn(upsertPasscode);
  const remove = useServerFn(deletePasscode);

  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Passcode[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newAdminOnly, setNewAdminOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await list();
      setIsAdmin(res.isAdmin);
      setItems(res.passcodes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load passcodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setRevealed({});
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleReveal = (id: string) =>
    setRevealed((r) => ({ ...r, [id]: !r[id] }));

  const handleToggleAdminOnly = async (p: Passcode, value: boolean) => {
    setBusyId(p.id);
    try {
      await upsert({
        data: { id: p.id, label: p.label, code: p.code, admin_only: value },
      });
      setItems((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, admin_only: value } : x)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: Passcode) => {
    if (!confirm(`Delete passcode "${p.label}"?`)) return;
    setBusyId(p.id);
    try {
      await remove({ data: { id: p.id } });
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim() || !newCode.trim()) {
      toast.error("Title and code are required");
      return;
    }
    setBusyId("new");
    try {
      await upsert({
        data: {
          label: newLabel.trim(),
          code: newCode.trim(),
          admin_only: newAdminOnly,
        },
      });
      setNewLabel("");
      setNewCode("");
      setNewAdminOnly(false);
      toast.success("Passcode added");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Lock className="h-5 w-5" /> Passcodes
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "All passcodes. Toggle admin-only access per passcode."
              : "Passcodes available to you."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passcodes yet.</p>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {p.label}
                      </span>
                      {p.admin_only && (
                        <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="font-mono text-base mt-0.5 select-all">
                      {revealed[p.id] ? p.code : "••••••••"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleReveal(p.id)}
                      aria-label={revealed[p.id] ? "Hide" : "Show"}
                    >
                      {revealed[p.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyId === p.id}
                        onClick={() => handleDelete(p)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Admin only</span>
                    <Switch
                      checked={p.admin_only}
                      disabled={busyId === p.id}
                      onCheckedChange={(v) => handleToggleAdminOnly(p, v)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isAdmin && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium">Add passcode</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pc-label" className="text-xs">
                  Title
                </Label>
                <Input
                  id="pc-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. POS Manager"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pc-code" className="text-xs">
                  Code
                </Label>
                <Input
                  id="pc-code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="1234"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="pc-admin"
                className="text-xs text-muted-foreground"
              >
                Admin only
              </Label>
              <Switch
                id="pc-admin"
                checked={newAdminOnly}
                onCheckedChange={setNewAdminOnly}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={busyId === "new"}
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              {busyId === "new" ? "Adding..." : "Add passcode"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
