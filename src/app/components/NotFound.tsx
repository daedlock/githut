import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/app/components/ui/empty";

/** Shown in a tab whose URL matches no page. */
export function NotFound() {
  return (
    <Empty className="min-h-(--pane-height,100dvh)">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>GitHut has no page at this address.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Go to Inbox</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
