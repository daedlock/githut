import { CircleDot, FolderGit2, Users } from "lucide-react";
import { useState } from "react";
import { RepoMark } from "@/app/components/shell/RepoMark";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import type { FilterFieldDef, FilterValuePickerProps } from "@/app/components/ui/filter-bar";
import { cn } from "@/app/lib/cn";
import type { InboxWho } from "./filters";

const TYPE_LABELS: Record<string, string> = {
  PullRequest: "Pull requests",
  Issue: "Issues",
  Discussion: "Discussions",
  Release: "Releases",
  Commit: "Commits",
  CheckSuite: "CI runs",
  RepositoryVulnerabilityAlert: "Security alerts",
  RepositoryDependabotAlertsThread: "Dependabot alerts",
};
// PRs and issues lead even before the feed holds any.
const PINNED_TYPES = ["PullRequest", "Issue"];

const WHO_LABELS: Record<InboxWho, string> = { mine: "Mine", team: "Teammates" };
const WHO_HINTS: Record<InboxWho, string> = {
  mine: "Threads you authored",
  team: "Everyone else's PRs and issues",
};

const typeLabel = (type: string) => TYPE_LABELS[type] ?? type;

/**
 * Inbox filter fields. Repo and type list what the loaded feed holds; adding
 * a second Repo pill ORs it with the first, so several repos show together.
 */
export function buildInboxFilterFields({
  repos,
  types,
}: {
  repos: Array<{ repo: string; unread: number }>;
  types: string[];
}): FilterFieldDef[] {
  function RepoPicker({ value, onSelect }: FilterValuePickerProps) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const shown = q ? repos.filter((r) => r.repo.toLowerCase().includes(q)) : repos;
    return (
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Filter repos…"
          className="text-ui"
        />
        <CommandList>
          <CommandEmpty>No repos in the loaded notifications.</CommandEmpty>
          <CommandGroup>
            {shown.map((r) => (
              <CommandItem key={r.repo} value={r.repo} onSelect={() => onSelect(r.repo)}>
                <Check on={value === r.repo} />
                <RepoMark repo={r.repo} />
                <span className="min-w-0 flex-1 truncate font-mono text-caption">{r.repo}</span>
                {r.unread > 0 && (
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {r.unread}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  const typeOptions = [...new Set([...PINNED_TYPES, ...types])];
  function TypePicker({ value, onSelect }: FilterValuePickerProps) {
    return (
      <Command>
        <CommandList>
          <CommandGroup>
            {typeOptions.map((type) => (
              <CommandItem key={type} value={type} onSelect={() => onSelect(type)}>
                <Check on={value === type} />
                <span className="font-sans">{typeLabel(type)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  function WhoPicker({ value, onSelect }: FilterValuePickerProps) {
    return (
      <Command>
        <CommandList>
          <CommandGroup>
            {(["mine", "team"] as const).map((who) => (
              <CommandItem key={who} value={who} onSelect={() => onSelect(who)}>
                <Check on={value === who} />
                <span className="font-sans">{WHO_LABELS[who]}</span>
                <span className="ml-auto text-caption text-muted-foreground">{WHO_HINTS[who]}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  return [
    {
      id: "who",
      label: "Who",
      icon: Users,
      negatable: false,
      ValuePicker: WhoPicker,
      renderValue: (v) => <span className="font-sans">{WHO_LABELS[v as InboxWho] ?? v}</span>,
    },
    {
      id: "repo",
      label: "Repo",
      icon: FolderGit2,
      ValuePicker: RepoPicker,
      renderValue: (v) => <span className="font-mono">{v}</span>,
    },
    {
      id: "type",
      label: "Type",
      icon: CircleDot,
      ValuePicker: TypePicker,
      renderValue: (v) => <span className="font-sans">{typeLabel(v)}</span>,
    },
  ];
}

function Check({ on }: { on: boolean }) {
  return <span className={cn("inline-block w-3", on ? "text-foreground" : "opacity-0")}>✓</span>;
}
