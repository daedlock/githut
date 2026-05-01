type UmamiEventData = Record<string, string | number | boolean | null | undefined>;

type UmamiGlobal = {
  track?: (event: string, data?: UmamiEventData) => void;
};

const UMAMI_DISABLED_KEY = "umami.disabled";

function getUmami(): UmamiGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { umami?: UmamiGlobal }).umami;
}

export function isAnalyticsEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(UMAMI_DISABLED_KEY) !== "1";
}

export function setAnalyticsEnabledPreference(enabled: boolean) {
  if (typeof window === "undefined") return;

  if (enabled) {
    window.localStorage.removeItem(UMAMI_DISABLED_KEY);
  } else {
    window.localStorage.setItem(UMAMI_DISABLED_KEY, "1");
  }
}

export function track(event: string, data?: UmamiEventData) {
  if (!isAnalyticsEnabled()) return;
  getUmami()?.track?.(event, data);
}

export function bucketNumber(value: number, buckets: number[]): string {
  for (const bucket of buckets) {
    if (value <= bucket) return `<=${bucket}`;
  }
  return `>${buckets.at(-1) ?? 0}`;
}

export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "none";
  return name
    .slice(dot + 1)
    .toLowerCase()
    .slice(0, 16);
}
