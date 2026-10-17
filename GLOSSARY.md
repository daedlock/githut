# Githut

A fast, keyboard-friendly GitHub client for reviewing and managing code across many repositories at once.

## Workspace

**Workspace**:
Everything githut shows in one browser window: the sidebar and the islands with their tabs.
_Avoid_: App shell, window (a browser window is a separate thing)

**Layout**:
The arrangement of islands within a workspace: which islands exist, how they are split, their sizes, and which tabs each holds.
_Avoid_: Docking state, grid

**Island**:
A rounded container in the layout that holds tabs and shows one of them. An island belongs to no repo; its tabs do.
_Avoid_: Pane, panel, group, editor group

**Tab**:
A single page open in an island, with its own history and scroll position. Every tab belongs to exactly one repo, or to none for app-wide pages such as the Inbox.
_Avoid_: View, document

**Focused island**:
The one island in a workspace that receives keyboard input and whose selected tab the URL describes.
_Avoid_: Active pane, current group

**Selected tab**:
The tab an island is currently showing. Every island has one; the selected tab of the focused island is the **focused tab**.
_Avoid_: Active tab (ambiguous between the two)

**Visible tab**:
The selected tab of an island that is not focused: on screen, but not receiving input.
_Avoid_: Secondary tab, inactive tab

**Background tab**:
A tab that is not currently shown. Its page is paused, but its tab icon still reflects live status.
_Avoid_: Inactive tab, hidden tab

**Pinned tab**:
A tab kept at the start of its island, shown as just its icon, and never closed by bulk close actions.
_Avoid_: Sticky tab, locked tab

**Unread**:
The state of a tab whose page has new activity — comments, commits, reviews — since you last viewed it.
_Avoid_: New, updated, dirty

**Draft**:
An unsent comment or review kept for a page until you send or discard it, even if its tab is closed.
_Avoid_: Unsaved changes, pending comment

**Repo mark**:
The small rounded square, with the repo's initial, that identifies which repo a tab, sidebar entry or link belongs to.
_Avoid_: Repo badge, repo icon, repo chip

## Navigation

**Sidebar**:
The collapsible navigation column on the window surface, outside the islands, holding Inbox, Favorites, Your repos and Organizations.
_Avoid_: Nav drawer, rail (the rail is only its collapsed state)

**Inbox**:
Your GitHub notifications, with read state shared with github.com. Also the page that githut opens to.
_Avoid_: Notifications page, dashboard, feed

**Done**:
A notification you have cleared from the Inbox; it is archived, not deleted.
_Avoid_: Dismissed, resolved, archived

**Your work**:
Pull requests that need you: those where your review is requested, then your own open ones.
_Avoid_: My PRs, assigned

**Favorite**:
A repo or specific page you choose to keep in the sidebar for this account on this device, independently of GitHub stars.
_Avoid_: Starred repo, pinned tab

**Your repos**:
Repos you own or can access as a direct collaborator. Organization membership alone does not put a repo in this list.
_Avoid_: All repos, contributed repos

**Organizations**:
Organizations you belong to, with their accessible repos available when expanded.
_Avoid_: Your repos

**Recent**:
Pages you visited lately that are no longer open in any tab.
_Avoid_: History, recently viewed

**Launcher**:
A control that opens a page in a tab, or jumps to the tab already showing it, and never replaces what the current tab shows: the sidebar, section icons and the command palette. In-page links are not launchers; they navigate the tab they are in.
_Avoid_: Shortcut, nav link

**Section**:
One of a repo's areas — Code, Commits, PRs, Issues, Actions.
_Avoid_: Repo tab (tabs are something else)
