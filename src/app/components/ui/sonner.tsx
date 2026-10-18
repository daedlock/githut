import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type CSSProperties, memo } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useResolvedTheme } from "@/app/stores/theme";

// Hoisted so a re-render (a theme change) hands Sonner the same objects.
const ICONS: ToasterProps["icons"] = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin" />,
};

const STYLE = {
  "--normal-bg": "var(--color-popover)",
  "--normal-text": "var(--color-popover-foreground)",
  "--normal-border": "var(--color-border)",
  "--border-radius": "var(--radius-xl)",
} as CSSProperties;

const TOAST_OPTIONS: ToasterProps["toastOptions"] = { classNames: { toast: "cn-toast" } };

/**
 * Sonner's default `dir` reads `getComputedStyle(<html>).direction` on every
 * render. A theme change has just rewritten <html>'s data-theme, so that read
 * forces a whole-document style recalculation inside React's render (~20 ms
 * per render, three renders per theme change). The direction only comes from
 * the `dir` attribute here, so read that instead.
 */
function documentDirection(): ToasterProps["dir"] {
  if (typeof document === "undefined") return "ltr";
  return document.documentElement.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
}

const Toaster = memo(function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme();

  return (
    <Sonner
      theme={theme}
      dir={documentDirection()}
      className="toaster group"
      icons={ICONS}
      style={STYLE}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  );
});

export { Toaster };
