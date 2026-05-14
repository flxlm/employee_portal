import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Wine, ClipboardCheck, Users } from "lucide-react";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
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

  const tiles = [
    { to: "/events", title: "Event Inquiries", description: "Review new, ongoing, confirmed, declined and past events.", icon: CalendarDays },
    { to: "/wines", title: "Wine List", description: "Browse the current wine offering and inventory.", icon: Wine },
    { to: "/open-close", title: "Open / Close Log", description: "Log opening and closing shifts with till and photo.", icon: ClipboardCheck },
    ...(isAdmin ? [{ to: "/admin", title: "Admin", description: "Manage who can sign in to the portal.", icon: Users }] : []),
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif">{greeting}</h1>
        <p className="text-muted-foreground mt-1">Welcome to the Savsav employee portal.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="font-serif">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
