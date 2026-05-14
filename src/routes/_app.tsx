import { createFileRoute, Outlet, Link, useRouter, useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CalendarDays, Wine, ClipboardCheck, Users, LogOut, Menu, Home, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { AuthStatusScreen } from "@/components/auth-status-screen";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

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

  if (loading) {
    return (
      <AuthStatusScreen
        title="Loading your portal"
        message="Restoring your session and permissions."
      />
    );
  }
  if (!user) {
    return <Navigate to="/login" />;
  }

  const nav: { to: string; label: string; icon: typeof Home; search?: Record<string, string> }[] = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/events", label: "Event Inquiries", icon: CalendarDays },
    { to: "/events", label: "Confirmed Events", icon: CalendarDays, search: { status: "CONFIRMED" } },
    { to: "/wines", label: "Wine List", icon: Wine },
    { to: "/open-close", label: "Open / Close", icon: ClipboardCheck },
    { to: "/functions", label: "Functions", icon: Zap },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Users }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "md:w-64 md:sticky md:top-0 md:h-screen border-r border-border bg-card flex flex-col",
        open ? "block" : "hidden md:flex"
      )}>
        <div className="px-6 py-5 border-b border-border">
          <img src={logo} alt="Savsav" className="h-8 w-auto" />
          <p className="text-xs text-muted-foreground mt-2">Employee Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item, idx) => {
            const currentStatus = new URLSearchParams(location.search).get("status");
            const itemStatus = item.search?.status;
            const pathMatches = location.pathname.startsWith(item.to);
            const active = pathMatches && (itemStatus ? currentStatus === itemStatus : !currentStatus);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}-${idx}`}
                to={item.to}
                search={item.search ?? {}}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <img src={logo} alt="Savsav" className="h-6 w-auto" />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
