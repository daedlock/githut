import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { LoginCard } from "@/app/components/LoginCard";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { startLogin } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

const LoginSearch = z.object({
  error: z.string().optional(),
});

const ERROR_COPY: Record<string, string> = {
  bad_state: "Login flow expired or tampered with. Try again.",
  missing_params: "Missing OAuth response parameters.",
  token_exchange_failed: "GitHub rejected the code exchange.",
  no_token: "GitHub returned no access token.",
  expired: "Session expired. Sign in again.",
};

export const Route = createFileRoute("/login")({
  validateSearch: LoginSearch,
  beforeLoad: () => {
    if (useAuthStore.getState().token) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { error } = useSearch({ from: "/login" });
  const errorMessage = error ? (ERROR_COPY[error] ?? error) : undefined;

  return (
    <AppShell
      header={<ShellHeader right={<ThemeToggle />} />}
      footer={<ShellFooter origin="localhost:5173" showHelpHint={false} />}
    >
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <LoginCard onLogin={startLogin} errorMessage={errorMessage} />
      </div>
    </AppShell>
  );
}
