import { createFileRoute } from "@tanstack/react-router";
import { Container } from "@/app/components/ui/Container";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/checks")({
  component: ChecksPage,
});

function ChecksPage() {
  return (
    <Container className="py-6">
      <p className="font-mono text-ui text-muted-foreground">
        Checks — wiring in P8.
      </p>
    </Container>
  );
}
