import { createFileRoute, Outlet, Link, useRouter, useLocation, Navigate, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CalendarDays, Wine, ClipboardCheck, Users, LogOut, Menu, Home, ChevronDown, BookOpen, PanelLeftClose, PanelLeftOpen, UtensilsCrossed, Package, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { AuthStatusScreen } from "@/components/auth-status-screen";
import { Sheet, SheetContent } from "@/components/ui/sheet";

function isMenuHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  return h === "menu.savsav.net" || h.startsWith("menu.");
}

function isWineHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  return h === "wine.savsav.net" || h.startsWith("wine.");
}

const getServerHost = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader, getRequestHost } = await import("@tanstack/react-start/server");
  try {
    const fwd = getRequestHeader("x-forwarded-host");
    if (fwd) return fwd.split(",")[0].trim();
    return getRequestHost() ?? null;
  } catch {
    return null;
  }
});

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const host =
      typeof window === "undefined"
        ? await getServerHost()
        : window.location.host;

    if (isMenuHost(host)) {
      throw redirect({
        to: "/menu",
        search: { menu: "auto", lang: "fr" },
        replace: true,
      });
    }

    if (isWineHost(host)) {
      throw redirect({
        to: "/display/wines",
        replace: true,
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

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

  if (typeof window !== "undefined" && isMenuHost(window.location.host)) {
    return (
      <Navigate
        to="/menu"
        search={{ menu: "auto", lang: "fr" }}
        replace
      />
    );
  }

  if (typeof window !== "undefined" && isWineHost(window.location.host)) {
    return <Navigate to="/display/wines" replace />;
  }

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
    { to: "/menu-editor", label: "Menu Editor", icon: UtensilsCrossed },
    { to: "/inventory", label: "Inventory", icon: Package },
    
    
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Users } as NavItem] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:sticky md:top-0 md:h-screen border-r border-border bg-card flex-col transition-[width] duration-200",
          collapsed ? "md:w-14" : "md:w-64"
        )}
      >
        <NavContent
          nav={nav}
          location={location}
          email={user?.email}
          onSignOut={handleSignOut}
          onNavigate={() => {}}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
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
            collapsed={false}
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
  collapsed = false,
  onToggleCollapsed,
}: {
  nav: NavItem[];
  location: ReturnType<typeof useLocation>;
  email?: string;
  onSignOut: () => void;
  onNavigate: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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
      <div
        className={cn(
          "border-b border-border flex items-center",
          collapsed ? "px-2 py-3 justify-center" : "px-6 py-5 justify-between"
        )}
      >
        {!collapsed && (
          <div>
            <img src={logo} alt="Savsav" className="h-8 w-auto" />
            <p className="text-xs text-muted-foreground mt-2">Employee Portal</p>
          </div>
        )}
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            className="h-8 w-8"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
        {nav.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            const groupOpen = openGroups[item.label] ?? false;
            const groupActive = item.children.some(isChildActive);

            if (collapsed) {
              // In collapsed mode, navigate to the first child instead of expanding
              const first = item.children[0];
              return (
                <Link
                  key={item.label}
                  to={first.to}
                  search={first.search ?? {}}
                  onClick={onNavigate}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
                    groupActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            }

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
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        {!collapsed && (
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">{email}</p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={onSignOut}
          className={cn(collapsed ? "w-full" : "w-full justify-start")}
          title={collapsed ? "Sign out" : undefined}
          aria-label="Sign out"
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </>
  );
}
