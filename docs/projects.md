# GitHub Projects in Githut

Open **Projects** in the workspace sidebar for personal and organization projects. In a repository, choose **Projects** between **Issues** and **Actions** in the section menu. The repository directory lists projects explicitly linked to that repository. Opening a membership on an issue or pull request takes you to its task panel in the same project workspace.

## Data and API coverage

The OAuth flow requests the GitHub `project` scope in addition to the existing repository and organization scopes. Existing sessions can authorize Projects from the access error. Project membership, repository content and saved views each keep their GitHub identifiers.

| Surface | GitHub operations and behavior |
| --- | --- |
| Directory | GraphQL `projectsV2` on an owner or repository, `createProjectV2`, and `copyProjectV2` for templates. |
| List, Board and Roadmap | Project fields, items, field values and views come from GraphQL connections. Project writes use `updateProjectV2ItemFieldValue`, `clearProjectV2ItemFieldValue` and `updateProjectV2ItemPosition`. Draft conversion preserves the existing item. Arrow keys on a timeline bar shift its dates. Shift with an arrow resizes its end. |
| Shared views | The REST view-items endpoint applies GitHub’s shared filter and ordering. Save as new creates a shared view through the user or organization REST endpoint. Edits to existing shared view definitions open GitHub. Temporary filters, grouping, sorting and visible fields are local until saved. |
| Repository tasks | Issue and PR GraphQL mutations edit shared content. REST handles comments, assignees, labels, milestones, issue state and blocked-by relationships. Sub-issues use `addSubIssue`. Linking a closing PR explicitly adds a closing reference to its description. The app offers the repository issue or PR page for the full conversation. |
| Recovery | After issue creation, retry uses its returned node ID and repeats the outstanding project step. Confirmed partial progress is retained for the current browser tab and verified account. Inline field edits check the current GitHub value before writing. GitHub provides no atomic compare-and-set for project fields. |
| Administration | GraphQL handles project settings, field creation and renaming, repository links, collaborator roles, template designation, archiving and project state. Field and project deletion, visibility changes and unlinking a repository require explicit confirmation. Workflow definitions are readable. Editing workflow rules and changing existing option or iteration schedules open GitHub. |
| Reporting | Dated updates use `createProjectV2StatusUpdate`. Insights displays current counts and a burn-up reconstructed from current membership, estimates, date added and close date. Saved GitHub charts and historical scope changes require GitHub Insights. |

The REST client uses API version `2022-11-28`. The project role controls membership edits, while GitHub evaluates repository content permissions independently. A redacted item keeps its visible project fields read-only. Githut’s connectivity policy rejects writes while offline and leaves retry under the user's control.

## Verification

Run `bun test`, `bunx tsc --noEmit` and `bun run build`. With a local Githut server running, run `UI_BASE_URL=http://127.0.0.1:5173 node scripts/test-projects.mjs`. The browser check simulates GitHub responses, including an issue creation that succeeds before its membership request fails. Set `CHROME_BIN` to use an existing Chromium executable.

[GitHub Projects GraphQL guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) · [GitHub REST Projects API](https://docs.github.com/en/rest/projects)
