import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "savsav.pwa.installDismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already dismissed this session/recently?
    if (localStorage.getItem(DISMISS_KEY) || sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }

    // In standalone (already installed) — never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Don't show inside Lovable preview iframe
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    if (inIframe) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setDeferred(null);
      setShowIos(false);
    };
    window.addEventListener("appinstalled", installed);

    // iOS detection (no beforeinstallprompt support)
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    if (isIos) setShowIos(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const onInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;
  if (!deferred && !showIos) return null;

  return (
    <div
      id="install-button"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg"
      role="dialog"
      aria-label="Install app"
    >
      <button
        onClick={onDismiss}
        className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground hover:bg-accent"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      {deferred ? (
        <div className="flex items-center gap-3 pr-6">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Download className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Install Savsav</p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick access.
            </p>
          </div>
          <Button size="sm" onClick={onInstall}>
            Install
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Share className="size-5" />
          </div>
          <div className="flex-1 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Add to Home Screen</p>
            <p className="mt-1">
              Tap the Share icon in Safari, then choose <strong>Add to Home Screen</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
