import {
  ArrowDownUp,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleDot,
  Flag,
  Layers3,
  List,
  type LucideIcon,
  SlidersHorizontal,
  Tag,
  UserRound,
  UserRoundPen,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Separator } from "@/app/components/ui/separator";
import type { ListGrouping } from "@/app/features/repo/listGrouping";
import { useKeybindings } from "@/app/hooks/useKeybindings";

type DisplayOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

const GROUPING_OPTIONS: DisplayOption<ListGrouping>[] = [
  { value: "none", label: "No grouping", icon: List },
  { value: "status", label: "Status", icon: CircleDot },
  { value: "assignee", label: "Assignee", icon: UserRound },
  { value: "author", label: "Author", icon: UserRoundPen },
  { value: "label", label: "Label", icon: Tag },
  { value: "milestone", label: "Milestone", icon: Flag },
];

type ListDisplayMenuProps<Sort extends string> = {
  groupBy: ListGrouping;
  onGroupByChange: (groupBy: ListGrouping) => void;
  groupKeys: string[];
  collapsedGroups: ReadonlySet<string>;
  onGroupsCollapsed: (keys: string[], collapsed: boolean) => void;
  ordering?: {
    value: Sort;
    options: readonly DisplayOption<Sort>[];
    onChange: (sort: Sort) => void;
  };
};

export function ListDisplayMenu<Sort extends string>({
  groupBy,
  onGroupByChange,
  groupKeys,
  collapsedGroups,
  onGroupsCollapsed,
  ordering,
}: ListDisplayMenuProps<Sort>) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useKeybindings(useMemo(() => ({ "shift+v": () => setOpen((value) => !value) }), []));
  const currentGrouping = GROUPING_OPTIONS.find((option) => option.value === groupBy)!;
  const grouped = groupBy !== "none" && groupKeys.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            groupBy === "none"
              ? "Display options, no grouping"
              : `Display options, grouped by ${currentGrouping.label.toLowerCase()}`
          }
          aria-keyshortcuts="Shift+V"
          title="Display options (Shift V)"
        >
          <SlidersHorizontal data-icon="inline-start" aria-hidden />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={8}
        aria-labelledby={titleId}
        className="w-72 max-w-[calc(100vw-1rem)]"
      >
        <PopoverHeader>
          <PopoverTitle id={titleId}>Display options</PopoverTitle>
        </PopoverHeader>
        <DisplaySelect
          label="Grouping"
          icon={Layers3}
          value={groupBy}
          options={GROUPING_OPTIONS}
          onChange={onGroupByChange}
        />
        {ordering && <DisplaySelect label="Ordering" icon={ArrowDownUp} {...ordering} />}
        <Separator className="h-px" />
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={!grouped || !groupKeys.some((key) => collapsedGroups.has(key))}
            onClick={() => {
              onGroupsCollapsed(groupKeys, false);
              setOpen(false);
            }}
          >
            <ChevronsUpDown data-icon="inline-start" aria-hidden />
            Expand all groups
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={!grouped || groupKeys.every((key) => collapsedGroups.has(key))}
            onClick={() => {
              onGroupsCollapsed(groupKeys, true);
              setOpen(false);
            }}
          >
            <ChevronsDownUp data-icon="inline-start" aria-hidden />
            Collapse all groups
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DisplaySelect<T extends string>({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: T;
  options: readonly DisplayOption<T>[];
  onChange: (value: T) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-ui text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-w-36 justify-between"
            aria-label={`${label}: ${current?.label}`}
          >
            {current?.label}
            <ChevronDown data-icon="inline-end" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label === "Grouping" ? "Group by" : "Order by"}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => {
                const option = options.find((item) => item.value === next);
                if (option) onChange(option.value);
              }}
            >
              {options.map(({ value, label, icon: OptionIcon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {OptionIcon && <OptionIcon aria-hidden />}
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
