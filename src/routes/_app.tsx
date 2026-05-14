import { createFileRoute, Outlet, Link, useRouter, useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CalendarDays, Wine, ClipboardCheck, Users, LogOut, Menu, Home, Zap, ChevronDown, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { AuthStatusScreen } from "@/components/auth-status-screen";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

  type NavChild = { to: string; label: string; search?: Record<string, string> };
  type NavItem = { label: string; icon: typeof Home } & (
    | { to: string; search?: Record<string, string>; children?: never }
    | { to?: never; children: NavChild[] }
  );
  const nav: NavItem[] = [
    { to: "/home", label: "Home", icon: Home },
    {
      label: "Events",
      icon: CalendarDays,
      children: [
        { to: "/events", label: "Inquiries" },
        { to: "/events", label: "Confirmed", search: { status: "CONFIRMED" } },
      ],
    },
    { to: "/wines", label: "Wine List", icon: Wine },
    { to: "/open-close", label: "Open / Close", icon: ClipboardCheck },
    { to: "/recipes", label: "Recipes", icon: BookOpen },
    { to: "/functions", label: "Functions", icon: Zap },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Users } as NavItem] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:sticky md:top-0 md:h-screen border-r border-border bg-card flex-col">
        <NavContent
          nav={nav}
          location={location}
          email={user?.email}
          onSignOut={handleSignOut}
          onNavigate={() => {}}
        />
      </aside>

      {/* Mobile sticky header */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <img src={logo} alt="Savsav" className="h-6 w-auto" />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile right-side overlay */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0 w-72 bg-card flex flex-col">
          <NavContent
            nav={nav}
            location={location}
            email={user?.email}
            onSignOut={handleSignOut}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

type NavChild = { to: string; label: string; search?: Record<string, string> };
type NavItem = { label: string; icon: typeof Home } & (
  | { to: string; search?: Record<string, string>; children?: never }
  | { to?: never; children: NavChild[] }
);

function NavContent({
  nav,
  location,
  email,
  onSignOut,
  onNavigate,
}: {
  nav: NavItem[];
  location: ReturnType<typeof useLocation>;
  email?: string;
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  const currentStatus = new URLSearchParams(location.search).get("status");
  const isChildActive = (c: NavChild) =>
    location.pathname.startsWith(c.to) &&
    (c.search?.status ? currentStatus === c.search.status : !currentStatus);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    nav.forEach((item) => {
      if (item.children && item.children.some(isChildActive)) init[item.label] = true;
    });
    return init;
  });

  return (
    <>
      <div className="px-6 py-5 border-b border-border">
        <img src={logo} alt="Savsav" className="h-8 w-auto" />
        <p className="text-xs text-muted-foreground mt-2">Employee Portal</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            const groupOpen = openGroups[item.label] ?? false;
            const groupActive = item.children.some(isChildActive);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [item.label]: !groupOpen }))
                  }
                  className={cn(
                    "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    groupActive ? "text-foreground" : "text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      groupOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>
                {groupOpen && (
                  <div className="mt-1 ml-7 space-y-1 border-l border-border pl-2">
                    {item.children.map((child, idx) => {
                      const active = isChildActive(child);
                      return (
                        <Link
                          key={`${child.to}-${idx}`}
                          to={child.to}
                          search={child.search ?? {}}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-secondary"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const itemStatus = item.search?.status;
          const pathMatches = location.pathname.startsWith(item.to);
          const active = pathMatches && (itemStatus ? currentStatus === itemStatus : !currentStatus);
          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.search ?? {}}
              onClick={onNavigate}
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
        <p className="px-3 py-1 text-xs text-muted-foreground truncate">{email}</p>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="w-full justify-start">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </>
  );
}
