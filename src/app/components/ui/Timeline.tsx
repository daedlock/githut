// The waterfall Timeline component was never rendered and has been removed.
// `formatDuration` now lives in `@/app/lib/time`; this re-export keeps the
// Actions screens compiling until they import it from there. Delete this
// file once nothing imports `@/app/components/ui/Timeline`.
export { formatDuration } from "@/app/lib/time";
