export function IssueListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-[var(--color-bg-sunken)]" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-4 rounded bg-[var(--color-bg-sunken)]"
              style={{ width: `${55 + ((i * 13) % 35)}%` }}
            />
            <div className="h-3 w-48 rounded bg-[var(--color-bg-sunken)]" />
          </div>
        </div>
      ))}
    </>
  );
}
