import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import appCss from "../styles.css?url";

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
    const host = getRequestHeader("host");
    const reqHost = getRequestHost();
    console.log("[getServerHost] x-forwarded-host:", fwd, "host:", host, "getRequestHost():", reqHost);
    if (fwd) return fwd.split(",")[0].trim();
    return reqHost ?? null;
  } catch (e) {
    console.error("[getServerHost] error:", e);
    return null;
  }
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const host =
      typeof window === "undefined"
        ? await getServerHost()
        : window.location.host;

    if (isMenuHost(host) && location.pathname !== "/menu") {
      throw redirect({
        to: "/menu",
        search: { menu: "auto", lang: "fr" },
        replace: true,
      });
    }

    if (isWineHost(host) && location.pathname !== "/display/wines") {
      throw redirect({
        to: "/display/wines",
        replace: true,
      });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Savsav Employee Portal" },
      { name: "description", content: "Internal portal for the Savsav team" },
      { name: "author", content: "Savsav" },
      { property: "og:title", content: "Savsav Employee Portal" },
      { property: "og:description", content: "Internal portal for the Savsav team" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Savsav Employee Portal" },
      { name: "twitter:description", content: "Internal portal for the Savsav team" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8cf0cfb2-baee-4995-a86d-8fd4efa01f52/id-preview-1418c760--845ee23a-fdb7-48d1-9f75-02b8c64f13c3.lovable.app-1778758073116.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8cf0cfb2-baee-4995-a86d-8fd4efa01f52/id-preview-1418c760--845ee23a-fdb7-48d1-9f75-02b8c64f13c3.lovable.app-1778758073116.png" },
      { name: "theme-color", content: "#651025" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Savsav" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "font",
        type: "font/otf",
        href: "/fonts/PPNeueMontrealMono-Regular.otf",
        crossOrigin: "anonymous",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192x192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512x512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/install-prompt";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
        <InstallPrompt />
      </AuthProvider>
    </QueryClientProvider>
  );
}

