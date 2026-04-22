import { createFileRoute } from "@tanstack/react-router";
import { Container } from "@/app/components/ui/Container";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/files")({
  component: FilesPage,
});

function FilesPage() {
  return (
    <Container className="py-6">
      <p className="font-mono text-ui text-muted-foreground">
        Files changed — wiring in P4.
      </p>
    </Container>
  );
}
