import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addAllowedEmail, listAllowedEmails, removeAllowedEmail } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, UserPlus, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/admin")({
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
  component: AdminPage,
});

function AdminPage() {
  const list = useServerFn(listAllowedEmails);
  const add = useServerFn(addAllowedEmail);
  const remove = useServerFn(removeAllowedEmail);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["allowed-emails"], queryFn: () => list() });

  const addMut = useMutation({
    mutationFn: (vars: { email: string; as_admin: boolean }) =>
      add({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allowed-emails"] });
      setEmail("");
      setAsAdmin(false);
      toast.success("Email added");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const rmMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["allowed-emails"] }); toast.success("Removed"); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl mb-6">Invite user</h1>

      <Card>
        <CardHeader>
          <CardTitle>Allowed emails</CardTitle>
          <CardDescription>Only these emails can sign up for the portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) addMut.mutate({ email, as_admin: asAdmin });
            }}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <Input type="email" placeholder="employee@savsav.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" disabled={addMut.isPending}>
                <UserPlus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="as-admin" className="text-sm font-normal">
                Make this user an admin on signup
              </Label>
              <Switch id="as-admin" checked={asAdmin} onCheckedChange={setAsAdmin} />
            </div>
          </form>

          <div className="border-t border-border">
            {isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading…</p>
            ) : (data ?? []).length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground text-center">No invites yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data ?? []).map((row: any) => (
                  <li key={row.id} className="flex items-center justify-between py-3">
                    <span className="text-sm flex items-center gap-2">
                      {row.email}
                      {row.as_admin && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <ShieldAlert className="h-3.5 w-3.5" /> admin
                        </span>
                      )}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => rmMut.mutate(row.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
