import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Monitor, Coffee } from "lucide-react";
import { refreshScreencloudMenu } from "@/lib/screencloud.functions";

export const Route = createFileRoute("/_app/functions")({
  component: FunctionsPage,
});

function FunctionsPage() {
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [pending, setPending] = useState<null | "main" | "grab_n_go">(null);
  const refresh = useServerFn(refreshScreencloudMenu);

  const handleRefresh = async (menu: "main" | "grab_n_go") => {
    setPending(menu);
    try {
      const result = await refresh({ data: { menu } });
      if (result.ok) {
        toast.success(menu === "main" ? "Main menu refreshed" : "Grab & Go menu refreshed");
        setRefreshOpen(false);
      } else {
        toast.error(result.error || "Refresh failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setPending(null);
    }
  };

  const functions = [
    {
      key: "refresh-menu",
      title: "Refresh Menu",
      description: "Force the in-restaurant menu screens to reload their content.",
      icon: RefreshCw,
      onClick: () => setRefreshOpen(true),
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif">Functions</h1>
        <p className="text-muted-foreground mt-1">
          Quick actions for day-to-day restaurant operations.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {functions.map(({ key, title, description, icon: Icon, onClick }) => (
          <button key={key} onClick={onClick} className="text-left group">
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
          </button>
        ))}
      </div>

      <Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Refresh which menu?</DialogTitle>
            <DialogDescription>
              This will reload the selected screen so it picks up the latest menu content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              disabled={pending !== null}
              onClick={() => handleRefresh("main")}
            >
              <Monitor className="h-5 w-5" />
              <span>{pending === "main" ? "Refreshing..." : "Main Menu"}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              disabled={pending !== null}
              onClick={() => handleRefresh("grab_n_go")}
            >
              <Coffee className="h-5 w-5" />
              <span>{pending === "grab_n_go" ? "Refreshing..." : "Grab & Go Menu"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
