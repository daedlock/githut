import { Check, ChevronsUpDown, GitBranch } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import type { RepoBranch } from "@/app/hooks/useRepoBranches";
import { cn } from "@/app/lib/cn";

function uniqueBranchNames(names: Array<string | undefined>) {
  return Array.from(new Set(names.filter((name): name is string => !!name)));
}

export function BranchSelector({
  branches,
  value,
  defaultBranch,
  isLoading,
  onChange,
}: {
  branches: RepoBranch[] | undefined;
  value: string | undefined;
  defaultBranch: string | undefined;
  isLoading?: boolean;
  onChange: (branch: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ?? defaultBranch;
  const items = useMemo(() => {
    const names = branches?.map((branch) => branch.name) ?? [];
    return uniqueBranchNames([selected, defaultBranch, ...names]);
  }, [branches, defaultBranch, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-w-56 justify-between gap-2 font-mono"
          aria-label="Select branch"
        >
          <GitBranch data-icon="inline-start" />
          <span className="min-w-0 truncate">{selected ?? "Branch"}</span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Find branch…" />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading branches…" : "No branches found."}</CommandEmpty>
            <CommandGroup heading="Branches">
              {items.map((branch) => {
                const isSelected = branch === selected;
                return (
                  <CommandItem
                    key={branch}
                    value={branch}
                    onSelect={() => {
                      onChange(branch);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("opacity-0", isSelected && "opacity-100")} />
                    <span className="min-w-0 truncate font-mono text-code">{branch}</span>
                    {branch === defaultBranch && (
                      <span className="ml-auto text-caption text-muted-foreground">default</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
