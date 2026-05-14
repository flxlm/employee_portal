import { Loader2 } from "lucide-react";

type Props = {
  title?: string;
  message?: string;
  hint?: string;
};

/**
 * Full-screen status display shown while authentication is hydrating
 * or while we're verifying a session. Gives users clear feedback that
 * the app is working and not stuck.
 */
export function AuthStatusScreen({
  title = "Checking your session",
  message = "Hold on while we securely restore your sign-in.",
  hint,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center bg-background px-6"
    >
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <h2 className="text-lg text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {hint ? (
          <p className="mt-3 text-xs text-muted-foreground/80">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
