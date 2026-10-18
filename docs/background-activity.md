# Background activity signals

The existing tab dot now covers PR/issue lists, Actions lists/workflows/runs,
Code/Commits branch heads, and Inbox. Detail-page notification precedence is
unchanged. Signal observations never freshen the detailed page query cache.

- List signals use creation time, not edits to existing items. PR URL filters
  share the list search builder; local PR/issue text filters retain independent
  tab scopes and share matching predicates with the visible list. TanStack's
  search parser preserves JSON-escaped strings such as draft="true" and numeric
  branch names.
- GraphQL aliases share the existing bounded ten-page batches and minute cadence,
  with per-resource rate backoff. Ordinary lists fetch one newest result.
  Literal local text search inspects up to 100 newest server-filtered candidates;
  over 100 arrivals between observations can hide an older matching candidate.
  This deliberate payload bound keeps background polling lightweight. Search
  results also retain GitHub's normal indexing delay.
- Actions use conditional REST reads through the shared ETag cache, with exact
  workflow/status/branch/event/actor scope. Lists observe new runs; individual
  runs observe updates and rerun/state fingerprints. Inbox reuses the existing
  feed, including Participating versus All, without another poll.
- Shown Code, Commits and Actions pages establish fingerprint baselines from
  their real query results, including older-dated commits pushed later. Code's
  root history observer shares its header request at the root; nested paths
  need one root-head request to distinguish the branch from a path's last edit.
- Shown visits acknowledge activity. Idle timestamps stay in memory; persistence
  happens on visit boundaries or new activity. Closed tabs discard retained
  local filters. Account isolation and session/visibility/offline gates remain.
- Native window focus and visibility events coalesce for 100 ms. TanStack still
  decides which observers are stale and permits refetch-on-focus opt-outs.

Validation: unit/integration tests cover mixed batches, exact scoped filters,
new-item-only dots, visible head baselines, older-dated head changes, ETag reuse,
Inbox feed reuse, idle persistence, account/cadence/error behavior, and stale
versus fresh/opted-out queries on app focus. A deliberately inverted fingerprint
comparison failed two regression tests; the restored implementation passes.
