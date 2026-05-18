import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthStatusScreen } from "@/components/auth-status-screen";

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

import { createServerFn } from "@tanstack/react-start";

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

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { menu?: string; debug?: boolean } => {
    const out: { menu?: string; debug?: boolean } = {};
    if (typeof s.menu === "string" && s.menu.length > 0) out.menu = s.menu;
    if (s.debug === true || s.debug === "1" || s.debug === "true") out.debug = true;
    return out;
  },
  beforeLoad: async ({ search }) => {
    const host =
      typeof window === "undefined"
        ? await getServerHost()
        : window.location.host;

    if (isMenuHost(host)) {
      throw redirect({
        to: "/menu",
        search: { menu: (search.menu as string | undefined) ?? "auto", lang: "fr" },
        replace: true,
      });
    }
  },
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <AuthStatusScreen
        title="Getting things ready"
        message="Checking whether you're already signed in."
      />
    );
  }
  return <Navigate to={user ? "/home" : "/login"} />;
}
