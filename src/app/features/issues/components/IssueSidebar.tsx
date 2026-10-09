import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Settings2, Tag, User } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PropertyEmpty, PropertySection } from "@/app/components/PropertySection";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { useSetIssueAssignees, useSetIssueLabels } from "@/app/features/issues/hooks";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { type PickerItem, SidebarPicker } from "@/app/features/pulls/components/SidebarPicker";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { useKeybindings } from "@/app/hooks/useKeybindings";

// DESIGN.md micro-interaction curve.
const EASE = [0.16, 1, 0.3, 1] as const;

type PickerId = "labels" | "assignees";

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

  const [picker, setPicker] = useState<PickerId | null>(null);
  useKeybindings(
    useMemo(() => ({ l: () => setPicker("labels"), a: () => setPicker("assignees") }), []),
  );
  const pickerProps = (id: PickerId) => ({
    open: picker === id,
    onOpenChange: (open: boolean) => setPicker(open ? id : null),
  });

  const reduced = useReducedMotion();
  const presence = {
    layout: !reduced,
    initial: { opacity: 0, y: reduced ? 0 : -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduced ? 0 : -4 },
    transition: { duration: 0.16, ease: EASE },
  };

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
  const selectedLabels = useMemo(() => new Set(issue.labels.map((l) => l.name)), [issue.labels]);
  const onToggleLabel = (name: string, next: boolean) => {
    const current = issue.labels.map((l) => l.name);
    const nextNames = next ? [...current, name] : current.filter((n) => n !== name);
    setLabels.mutate({ names: nextNames });
  };

  return (
    <div className="flex flex-col gap-6">
      <PropertySection
        icon={<Tag />}
        title="Labels"
        action={
          <PickerHint label="Edit labels" shortcut="L" suppressed={picker === "labels"}>
            <SidebarPicker
              {...pickerProps("labels")}
              title="Apply labels"
              ariaLabel="Edit labels"
              placeholder="Apply labels…"
              items={labelItems}
              selectedIds={selectedLabels}
              onToggle={onToggleLabel}
              loading={labelsQuery.isPending}
              emptyText="No labels"
              trigger={<PickerTrigger label="Edit labels" shortcut="l" />}
            />
          </PickerHint>
        }
      >
        {issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {issue.labels.map((l) => (
                <motion.div key={l.id} {...presence}>
                  <LabelPill label={l} size="sm" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <PropertyEmpty>No labels</PropertyEmpty>
        )}
      </PropertySection>

      <PropertySection
        icon={<User />}
        title="Assignees"
        action={
          <PickerHint label="Edit assignees" shortcut="A" suppressed={picker === "assignees"}>
            <SidebarPicker
              {...pickerProps("assignees")}
              title="Assign people"
              ariaLabel="Edit assignees"
              placeholder="Assign to…"
              items={assigneeItems}
              selectedIds={selectedAssignees}
              onToggle={onToggleAssignee}
              loading={collabQuery.isPending}
              emptyText="No collaborators"
              trigger={<PickerTrigger label="Edit assignees" shortcut="a" />}
            />
          </PickerHint>
        }
      >
        {issue.assignees.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {issue.assignees.map((a) => (
                <motion.div key={a.login} {...presence} className="flex items-center gap-2">
                  <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                  <ProfileLink login={a.login} className="truncate text-ui text-foreground">
                    {a.login}
                  </ProfileLink>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <PropertyEmpty>No one assigned</PropertyEmpty>
        )}
      </PropertySection>
    </div>
  );
}

function PickerTrigger({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-xs" aria-label={label} aria-keyshortcuts={shortcut}>
        <Settings2 />
      </Button>
    </TooltipTrigger>
  );
}

/**
 * Tooltip for a picker trigger. Hidden while the picker is open, and quiet
 * for a moment after it closes so returning focus doesn't pop the tooltip.
 */
function PickerHint({
  label,
  shortcut,
  suppressed,
  children,
}: {
  label: string;
  shortcut: string;
  suppressed: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const quietUntil = useRef(0);
  useEffect(() => {
    if (!suppressed) quietUntil.current = Date.now() + 300;
  }, [suppressed]);
  return (
    <Tooltip
      open={open && !suppressed}
      onOpenChange={(next) => setOpen(next && Date.now() > quietUntil.current)}
    >
      {children}
      <TooltipContent>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
