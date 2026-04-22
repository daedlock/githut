import { createFileRoute } from "@tanstack/react-router";
import { Container } from "@/app/components/ui/Container";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/")({
  component: ConversationPage,
});

function ConversationPage() {
  return (
    <Container className="py-6">
      <p className="font-mono text-ui text-muted-foreground">
        Conversation tab — wiring in P3.
      </p>
    </Container>
  );
}
