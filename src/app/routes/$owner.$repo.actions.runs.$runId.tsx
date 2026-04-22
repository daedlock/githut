import { createFileRoute } from "@tanstack/react-router";
import { Container } from "@/app/components/ui/Container";

export const Route = createFileRoute("/$owner/$repo/actions/runs/$runId")({
  component: RunDetailPage,
});

// P3 lands the full detail view (run header + jobs timeline + step list).
// For now this is a placeholder so RunRow can link to it.

function RunDetailPage() {
  const { runId } = Route.useParams();
  return (
    <Container className="py-6">
      <p className="font-mono text-ui text-muted-foreground">Run #{runId} — detail (P3).</p>
    </Container>
  );
}
