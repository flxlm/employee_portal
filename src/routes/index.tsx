import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthStatusScreen } from "@/components/auth-status-screen";

export const Route = createFileRoute("/")({
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

