import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRepoStarred, useToggleStar } from "@/app/hooks/useRepoStarred";
import { track } from "@/app/lib/analytics";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";

type StarButtonProps = {
  owner: string;
  repo: string;
  starCount: number | undefined;
  className?: string;
};

// Six radial particles emitted on star. Pre-computed angles for stable
// motion keys across renders (random would re-mount on every burst).
const PARTICLES = [0, 60, 120, 180, 240, 300].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    deg,
    x: Math.cos(rad) * 18,
    y: Math.sin(rad) * 18,
  };
});

export function StarButton({ owner, repo, starCount, className }: StarButtonProps) {
  const { canMutate, reason } = useCanMutate();
  const { data: starred } = useRepoStarred(owner, repo);
  const toggle = useToggleStar(owner, repo);
  const reduced = useReducedMotion();
  const isStarred = !!starred;

  // burst is keyed by an incrementing id so each star action renders a
  // fresh particle ring even when the user fires repeatedly.
  const [burstId, setBurstId] = useState(0);
  const wasStarred = useRef<boolean | undefined>(starred);
  useEffect(() => {
    if (starred && wasStarred.current === false && !reduced) {
      setBurstId((n) => n + 1);
    }
    wasStarred.current = starred;
  }, [starred, reduced]);

  const onClick = () => {
    if (toggle.isPending || !canMutate) return;
    track("star_toggled", { action: isStarred ? "unstar" : "star" });
    toggle.mutate(!isStarred);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={starred === undefined || !canMutate}
      title={reason}
      aria-pressed={isStarred}
      data-starred={isStarred ? "true" : "false"}
      className={cn(
        "group/star inline-flex h-7 select-none items-stretch overflow-hidden rounded-md",
        "border border-border bg-background text-caption font-medium text-foreground",
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        "hover:border-[color-mix(in_oklab,var(--color-warning)_50%,var(--color-border))]",
        "data-[starred=true]:border-[color-mix(in_oklab,var(--color-warning)_45%,var(--color-border))]",
        "data-[starred=true]:bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-bg-subtle))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-warning)_50%,transparent)]",
        className,
      )}
    >
      {/* Action segment */}
      <span className="relative flex items-center gap-1.5 px-2">
        <span className="relative flex size-3.5 items-center justify-center">
          <motion.span
            key={isStarred ? "on" : "off"}
            initial={reduced ? false : isStarred ? { scale: 0.4, rotate: -30 } : { scale: 1.15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={
              isStarred
                ? { type: "spring", stiffness: 600, damping: 14, mass: 0.6 }
                : { type: "spring", stiffness: 700, damping: 22 }
            }
            className="flex"
          >
            <Star
              className={cn(
                "size-3.5 transition-colors duration-150",
                isStarred
                  ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                  : "text-muted-foreground group-hover/star:text-[var(--color-warning)]",
              )}
              strokeWidth={isStarred ? 2 : 1.75}
            />
          </motion.span>

          {/* Particle burst — radial dots that fan out on the star action.
              Pointer-events disabled so the button stays clickable. */}
          {!reduced && (
            <AnimatePresence>
              {burstId > 0 && (
                <motion.span
                  key={burstId}
                  className="pointer-events-none absolute inset-0"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onAnimationComplete={() => {
                    // Best-effort cleanup: small delay before unmounting.
                  }}
                >
                  {PARTICLES.map((p) => (
                    <motion.span
                      key={p.deg}
                      className="absolute left-1/2 top-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-warning)]"
                      initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                      animate={{
                        x: [0, p.x * 0.4, p.x],
                        y: [0, p.y * 0.4, p.y],
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ))}
                  {/* Brief halo pulse */}
                  <motion.span
                    className="absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      boxShadow:
                        "0 0 0 0 color-mix(in oklab, var(--color-warning) 70%, transparent)",
                    }}
                    initial={{ scale: 0.6, opacity: 0.9 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(closest-side, color-mix(in oklab, var(--color-warning) 60%, transparent) 0%, transparent 75%)",
                      }}
                    />
                  </motion.span>
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </span>

        <span className="relative inline-flex h-4 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={isStarred ? "starred" : "star"}
              initial={reduced ? false : { y: isStarred ? 8 : -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: isStarred ? -8 : 8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 700, damping: 32 }}
              className="leading-4"
            >
              {isStarred ? "Starred" : "Star"}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>

      {/* Count segment — tabular slot animation when the count changes */}
      <span
        aria-hidden
        className={cn(
          "flex items-center border-l border-border px-2 font-mono tabular-nums",
          "text-caption text-foreground/85",
          "data-[starred=true]:border-[color-mix(in_oklab,var(--color-warning)_30%,var(--color-border))]",
        )}
        data-starred={isStarred ? "true" : "false"}
      >
        <CountSlot value={starCount} />
      </span>
    </button>
  );
}

function CountSlot({ value }: { value: number | undefined }) {
  const reduced = useReducedMotion();
  const formatted = value === undefined ? "—" : formatStars(value);
  return (
    <span className="relative inline-flex h-4 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={formatted}
          initial={reduced ? false : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 10, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 36 }}
          className="leading-4"
        >
          {formatted}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}
