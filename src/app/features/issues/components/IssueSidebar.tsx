import { useMemo } from "react";
import { Tag, User } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { Card } from "@/app/components/ui/card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { SidebarPicker, type PickerItem } from "@/app/features/pulls/components/SidebarPicker";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { useSetIssueAssignees, useSetIssueLabels } from "@/app/features/issues/hooks";
import type { RepoIssue } from "@/app/features/issues/schemas";

export function IssueSidebar({
  owner,
  repo,
  issue,
}: {
  owner: string;
  repo: string;
  issue: RepoIssue;
}) {
  const labelsQuery = useRepoLabels(owner, repo);
  const collabQuery = useRepoCollaborators(owner, repo);

  const setAssignees = useSetIssueAssignees(owner, repo, issue.number);
  const setLabels = useSetIssueLabels(owner, repo, issue.number);

  const assigneeItems: PickerItem[] = useMemo(
    () =>
      (collabQuery.data ?? []).map((c) => ({
        id: c.login,
        label: c.login,
        avatarUrl: c.avatar_url,
      })),
    [collabQuery.data],
  );
  const selectedAssignees = useMemo(
    () => new Set(issue.assignees.map((a) => a.login)),
    [issue.assignees],
  );
  const onToggleAssignee = (login: string, next: boolean) => {
    if (next) setAssignees.mutate({ add: [login], remove: [] });
    else setAssignees.mutate({ add: [], remove: [login] });
  };

  const labelItems: PickerItem[] = useMemo(
    () =>
      (labelsQuery.data ?? []).map((l) => ({
        id: l.name,
        label: l.name,
        description: l.description ?? undefined,
        color: l.color,
      })),
    [labelsQuery.data],
  );
  const selectedLabels = useMemo(
    () => new Set(issue.labels.map((l) => l.name)),
    [issue.labels],
  );
  const onToggleLabel = (name: string, next: boolean) => {
    const current = issue.labels.map((l) => l.name);
    const nextNames = next ? [...current, name] : current.filter((n) => n !== name);
    setLabels.mutate({ names: nextNames });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card variant="muted" className="p-3">
        <SectionHeader
          icon={<Tag className="size-3" />}
          title="Labels"
          picker={
            <SidebarPicker
              title="Apply labels"
              ariaLabel="Edit labels"
              items={labelItems}
              selectedIds={selectedLabels}
              onToggle={onToggleLabel}
              loading={labelsQuery.isPending}
              emptyText="No labels"
            />
          }
        />
        <div className="mt-2">
          {issue.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((l) => (
                <LabelPill key={l.id} label={l} size="sm" />
              ))}
            </div>
          ) : (
            <EmptyState>None yet</EmptyState>
          )}
        </div>
      </Card>

      <Card variant="muted" className="p-3">
        <SectionHeader
          icon={<User className="size-3" />}
          title="Assignees"
          picker={
            <SidebarPicker
              title="Assign people"
              ariaLabel="Edit assignees"
              items={assigneeItems}
              selectedIds={selectedAssignees}
              onToggle={onToggleAssignee}
              loading={collabQuery.isPending}
              emptyText="No collaborators"
            />
          }
        />
        <div className="mt-2">
          {issue.assignees.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {issue.assignees.map((a) => (
                <div key={a.login} className="flex items-center gap-2">
                  <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                  <ProfileLink login={a.login} className="text-xs text-muted-foreground">
                    {a.login}
                  </ProfileLink>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No one assigned</EmptyState>
          )}
        </div>
      </Card>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  picker,
}: {
  icon: React.ReactNode;
  title: string;
  picker?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-xs font-medium text-muted-foreground">{title}</span>
      {picker}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}
