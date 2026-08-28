import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { getDocumentTitle } from "@/app/lib/tabMeta";

export function DocumentTitle() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.title = getDocumentTitle(pathname);
  }, [pathname]);

  return null;
}
