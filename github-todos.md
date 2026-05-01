# GitHub PR View Parity TODOs

## Highest priority

- [ ] Add the missing **Files changed** tab to the PR subtabs.
  - Route and page already exist at `/$owner/$repo/pull/$number/files`.
  - `PrSubTabs` currently renders Conversation, Commits, Checks only.
  - `counts.files` is passed but ignored.
  - Keep the focused **Review** workspace as a separate CTA, not a replacement for Files changed.

- [x] Add pagination / full data loading for large PRs.
  - [x] PR files fetch all pages.
  - [x] PR commits fetch all pages.
  - [x] Conversation comments, timeline events, reviews, review comments, check runs, reactions, and GraphQL review threads fetch all pages.
  - [x] Large PRs no longer silently drop first-page-limited data.

- [x] Make the merge box GitHub-parity.
  - [x] Show required review status.
  - [x] Show required checks vs optional checks.
  - [x] Block or warn on unresolved conversations.
  - [x] Handle stale review dismissal.
  - [x] Explain branch protection failures.
  - [x] Add **Update branch** when behind base.
  - [x] Support enable/disable auto-merge.
  - [x] Account for merge queue / blocked repository-rule states in messaging.
  - [x] Add delete branch after merge.
  - [x] Add restore deleted branch.
  - [x] Respect repo-allowed merge methods.
  - [x] Handle admin override / blocked states in messaging.

## Review / Files changed workflow

- [ ] Add per-file **Viewed** checkbox support.
- [ ] Add hide whitespace toggle.
- [ ] Support multi-line review comments.
- [ ] Support comments on unchanged lines outside the patch.
- [ ] Mark and handle outdated threads.
- [ ] Handle generated / too-large diffs explicitly.
- [ ] Add binary and image diff previews.
- [ ] Add load-more-files affordance.
- [ ] Add no-newline, file mode, symlink, and submodule indicators where applicable.

## Sidebar parity

- [ ] Support team reviewers and requested teams.
- [ ] Add Projects section.
- [ ] Add Development / linked issues section.
- [ ] Add Participants section.
- [ ] Add Notifications / subscribe controls.
- [ ] Add lock / unlock conversation controls.
- [ ] Allow milestone editing, not just display.
- [ ] Surface CODEOWNERS review context.
- [ ] Provide sidebar metadata access on mobile, likely via drawer or stacked section.

## Conversation timeline parity

- [x] Render commits pushed / committed events.
- [x] Group consecutive commit events into an expandable / collapsible block.
- [x] Render cross-reference and linked issue events with issue / PR hovercards.
- [x] Render base branch changed events.
- [x] Render review dismissed events with reason.
- [x] Render auto-merge enabled / disabled events.
- [x] Render deployment and environment events.
- [x] Render project events.
- [x] Improve branch deleted / restored timeline details after merge.

## Checks tab parity

- [ ] Show annotations summary.
- [ ] Group required vs optional checks.
- [ ] Group checks by workflow / check suite.
- [ ] Add rerun failed jobs and rerun all actions where permitted.
- [ ] Handle pending approval and environment deployment gates.
- [ ] Show richer check-suite status.

## Commits tab parity

- [x] Add pagination.
- [ ] Show status/check indicator per commit.
- [ ] Show verified signature badge.
- [ ] Distinguish author vs committer where useful.
- [ ] Add browse-files-at-commit / compare affordances.

## Header and actions parity

- [ ] Allow editing PR title.
- [ ] Add copy PR link / copy branch affordances.
- [ ] Show source repo label for fork PRs.
- [ ] Make edit controls permission-aware for collaborators, not only author-only where applicable.

## Existing strengths to preserve

- Conversation body, comments, reactions, and markdown rendering.
- Reviews and inline review threads.
- Resolve / unresolve review threads.
- Merge dialog with merge, squash, and rebase choices.
- Checks and statuses fetch.
- Focused full-width review workspace.
- Sidebar editing for reviewers, assignees, and labels.
