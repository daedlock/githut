import { Tag, User, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import type { FilterFieldDef } from "@/app/components/ui/filter-bar";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
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

  const renderLabelValue = (value: string) => (
    <span className="font-sans">{value}</span>
  );

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
        {user ? (
          <img src={user.avatar_url} alt="" className="size-3.5 rounded-full" />
        ) : null}
        <span className="font-mono">{value}</span>
      </span>
    );
  };

  function LabelPicker({ value, onSelect }: { value?: string; onSelect: (v: string) => void }) {
    const [query, setQuery] = useState("");
    const filteredList = filterByQuery(labels, query, (l) => l.name);
    return (
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Filter labels…"
          className="text-ui"
        />
        <CommandList>
          <CommandEmpty>No labels.</CommandEmpty>
          <CommandGroup>
            {filteredList.map((label) => (
              <CommandItem
                key={label.id}
                value={label.name}
                onSelect={() => onSelect(label.name)}
              >
                <span
                  className={cn(
                    "inline-block w-3",
                    value === label.name ? "text-foreground" : "opacity-0",
                  )}
                >
                  ✓
                </span>
                <LabelPill
                  label={{ ...label, description: label.description ?? null }}
                  size="xs"
                />
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
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Filter user…"
          className="text-ui"
        />
        <CommandList>
          <CommandEmpty>Type a GitHub login.</CommandEmpty>
          <CommandGroup>
            {typedLogin && !filteredList.some((c) => c.login === typedLogin) ? (
              <CommandItem value={typedLogin} onSelect={() => onSelect(typedLogin)}>
                <User className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="font-sans">Use</span>
                <span className="font-mono">{typedLogin}</span>
              </CommandItem>
            ) : null}
            {filteredList.map((c) => (
              <CommandItem key={c.id} value={c.login} onSelect={() => onSelect(c.login)}>
                <span
                  className={cn(
                    "inline-block w-3",
                    value === c.login ? "text-foreground" : "opacity-0",
                  )}
                >
                  ✓
                </span>
                <img src={c.avatar_url} alt="" className="size-4 rounded-full" />
                <span className="font-mono text-caption">{c.login}</span>
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
