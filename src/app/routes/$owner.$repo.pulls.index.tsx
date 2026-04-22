import { createFileRoute } from "@tanstack/react-router";
import { GitPullRequest } from "lucide-react";
import { Container } from "@/app/components/ui/Container";

export const Route = createFileRoute("/$owner/$repo/pulls/")({
  component: PrListPage,
});

// P1 replaces this scaffold with the real list + filters.
function PrListPage() {
  return (
    <Container className="py-6">
      <div className="rounded-md border border-border bg-muted px-4 py-10 text-center">
        <GitPullRequest className="mx-auto mb-2 size-5 text-(--color-fg-faint)" aria-hidden />
        <p className="font-mono text-ui text-muted-foreground">
          Pull requests list — wiring in P1.
        </p>
      </div>
    </Container>
  );
}
