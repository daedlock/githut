import { Check, Tag, User, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import type { FilterFieldDef } from "@/app/components/ui/filter-bar";
import { labelStyle } from "@/app/features/issues/utils";
import type { Collaborator, RepoLabel } from "@/app/features/pulls/pickers";
import { cn } from "@/app/lib/cn";

// ─── Repo-scoped filter fields ─────────────────────────────────────────────
//
// Reusable across PRs and Issues. Includes pickers, value rendering, and
// label tinting. Pass `include` to control which fields render (e.g. issues
// don't have "reviewer").

export type RepoFilterFieldId = "label" | "author" | "assignee" | "reviewer";

export function buildRepoFilterFields({
  labels,
  collaborators,
  include = ["label", "author", "assignee", "reviewer"],
}: {
  labels: RepoLabel[];
  collaborators: Collaborator[];
  include?: RepoFilterFieldId[];
}): FilterFieldDef[] {
  const labelByName = new Map(labels.map((l) => [l.name, l]));
  const userByLogin = new Map(collaborators.map((c) => [c.login, c]));

  const renderLabelValue = (value: string) => <span>{value}</span>;

  const labelValueStyle = (value: string) => {
    const label = labelByName.get(value);
    if (!label) return undefined;
    const { backgroundColor, color } = labelStyle(label.color);
    return { backgroundColor, color };
  };

  const renderUserValue = (value: string) => {
    const user = userByLogin.get(value);
    return (
      <span className="flex items-center gap-1">
        {user ? <Avatar login={user.login} avatarUrl={user.avatar_url} size="xs" /> : null}
        <span>{value}</span>
      </span>
    );
  };

  // Option rows mirror SidebarPicker: swatch or avatar, label, ✓ at the end.
  function LabelPicker({ value, onSelect }: { value?: string; onSelect: (v: string) => void }) {
    const [query, setQuery] = useState("");
    const filteredList = filterByQuery(labels, query, (l) => l.name);
    return (
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Filter labels…" />
        <CommandList>
          <CommandEmpty>No labels.</CommandEmpty>
          <CommandGroup>
            {filteredList.map((label) => (
              <CommandItem key={label.id} value={label.name} onSelect={() => onSelect(label.name)}>
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                  style={{ backgroundColor: `#${label.color}` }}
                />
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                <SelectedCheck selected={value === label.name} />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  function UserPicker({ value, onSelect }: { value?: string; onSelect: (v: string) => void }) {
    const [query, setQuery] = useState("");
    const filteredList = filterByQuery(collaborators, query, (c) => c.login);
    const typedLogin = isLikelyLogin(query) ? query.trim() : null;
    return (
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Filter users…" />
        <CommandList>
          <CommandEmpty>Type a GitHub login.</CommandEmpty>
          <CommandGroup>
            {typedLogin && !filteredList.some((c) => c.login === typedLogin) ? (
              <CommandItem value={typedLogin} onSelect={() => onSelect(typedLogin)}>
                <User className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  Use <span className="font-medium">{typedLogin}</span>
                </span>
              </CommandItem>
            ) : null}
            {filteredList.map((c) => (
              <CommandItem key={c.id} value={c.login} onSelect={() => onSelect(c.login)}>
                <Avatar login={c.login} avatarUrl={c.avatar_url} size="sm" />
                <span className="min-w-0 flex-1 truncate">{c.login}</span>
                <SelectedCheck selected={value === c.login} />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  const all: Record<RepoFilterFieldId, FilterFieldDef> = {
    label: {
      id: "label",
      label: "Label",
      icon: Tag,
      ValuePicker: LabelPicker,
      renderValue: renderLabelValue,
      valueStyle: labelValueStyle,
    },
    author: {
      id: "author",
      label: "Author",
      icon: User,
      ValuePicker: UserPicker,
      renderValue: renderUserValue,
    },
    assignee: {
      id: "assignee",
      label: "Assignee",
      icon: UserCheck,
      ValuePicker: UserPicker,
      renderValue: renderUserValue,
    },
    reviewer: {
      id: "reviewer",
      label: "Reviewer",
      icon: Users,
      ValuePicker: UserPicker,
      renderValue: renderUserValue,
    },
  };

  return include.map((id) => all[id]);
}

function filterByQuery<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(q));
}

function isLikelyLogin(value: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value.trim());
}

function SelectedCheck({ selected }: { selected: boolean }) {
  return (
    <Check
      aria-hidden
      className={cn("size-3.5 shrink-0 text-foreground", !selected && "invisible")}
    />
  );
}
