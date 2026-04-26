import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { LoginCard } from "@/app/components/LoginCard";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { DotPattern } from "@/app/components/ui/dot-pattern";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <DotPattern
        width={20}
        height={20}
        cr={1}
        className="z-0 text-foreground/30 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
      />

      {/* Theme toggle — fixed top-right */}
      <div className="absolute top-0 right-0 z-10 flex h-9 items-center px-3">
        <ThemeToggle />
      </div>

      {/* Logo — sits on the page surface, above the card */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
        <svg
          width={60}
          height={60}
          viewBox="0 0 100 100"
          aria-label="GitHut"
          className="text-foreground"
        >
          <path
            fillRule="evenodd"
            fill="currentColor"
            d="M50 4 A46 46 0 1 1 50 96 A46 46 0 1 1 50 4 Z M54 32 L67 43 Q71 47 71 52 L71 62 Q71 68 65 68 L35 68 Q29 68 29 62 L29 52 Q29 47 33 43 L46 32 Q50 28 54 32 Z"
          />
        </svg>
        <span
          className="text-foreground"
          style={{
            fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          githut
        </span>
      </div>

      {/* Card — raised surface */}
      <div className="relative z-10 w-full max-w-[320px] rounded-xl bg-muted p-6">
        <LoginCard onLogin={startLogin} errorMessage={errorMessage} />
      </div>
    </div>
  );
}
