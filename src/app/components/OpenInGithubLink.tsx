import { useRouterState } from "@tanstack/react-router";
import { getOpenInGithubHref } from "@/app/lib/openGithubUrl";

export function OpenInGithubLink() {
  const href = useRouterState({
    select: (state) => getOpenInGithubHref(state.location),
  });

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed right-4 bottom-4 z-30 rounded-md px-2 py-1 font-sans text-caption text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
    >
      Open in GitHub
    </a>
  );
}
