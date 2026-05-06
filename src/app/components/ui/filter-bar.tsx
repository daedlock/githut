import { ListFilter, Plus, X } from "lucide-react";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
  useEffect,
  useState,
} from "react";
import { Button } from "@/app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/app/lib/cn";

// ─── Generic, reusable filter bar ──────────────────────────────────────────
//
// A Linear-style filter primitive for list pages. Owns presentation only —
// the parent supplies field definitions (icon, label, value picker) and the
// active filter list, and reads back changes via `onChange`. URL-state
// mapping stays at the call site.
//
// Two surfaces:
//  • `<FilterTrigger />` — toolbar icon button. Always visible. Opens the
//    "add filter" menu. Shows an ember dot when filters are active.
//  • `<FilterBar />` — the pill row. Renders nothing when `active` is
//    empty. Otherwise: pill per active filter, trailing `+`, "Clear" right.
//
// A pill is three clickable segments + close, separated by hairlines:
//   [icon] Label │ is │ [chip] value │ ×

export type FilterOp = "is" | "is_not";

export type ActiveFilter = {
  fieldId: string;
  op: FilterOp;
  value: string;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type FilterValuePickerProps = {
  value?: string;
  onSelect: (value: string) => void;
};

export type FilterFieldDef = {
  id: string;
  label: string;
  icon: IconComponent;
  /** Hide the "is/is not" segment and force op = "is". Default: negatable. */
  negatable?: boolean;
  /** Renders the popover body for value selection. Call `onSelect` to commit. */
  ValuePicker: ComponentType<FilterValuePickerProps>;
  /** Render the value chip (text + optional swatch/avatar). */
  renderValue: (value: string) => ReactNode;
  /** Optional inline style applied to the value segment itself (e.g. label tint). */
  valueStyle?: (value: string) => CSSProperties | undefined;
};

export type FilterBarProps = {
  fields: FilterFieldDef[];
  active: ActiveFilter[];
  onChange: (next: ActiveFilter[]) => void;
  className?: string;
};

// ─── Filter row ────────────────────────────────────────────────────────────

export function FilterBar({ fields, active, onChange, className }: FilterBarProps) {
  if (active.length === 0) return null;
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  const replace = (idx: number, next: ActiveFilter) => {
    const copy = [...active];
    copy[idx] = next;
    onChange(copy);
  };
  const removeAt = (idx: number) => onChange(active.filter((_, i) => i !== idx));
  const add = (next: ActiveFilter) => onChange([...active, next]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {active.map((a, i) => {
        const field = fieldMap.get(a.fieldId);
        if (!field) return null;
        return (
          <FilterPill
            key={`${a.fieldId}-${a.op}-${i}`}
            field={field}
            filter={a}
            onUpdate={(next) => replace(i, next)}
            onRemove={() => removeAt(i)}
          />
        );
      })}
      <AddFilterMenu fields={fields} onAdd={add} variant="inline" />
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "ml-auto h-6 rounded-md px-2 font-sans text-caption text-muted-foreground",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Clear
      </button>
    </div>
  );
}

// ─── Toolbar trigger (icon button) ─────────────────────────────────────────

export function FilterTrigger({ fields, active, onChange, className }: FilterBarProps) {
  const add = (next: ActiveFilter) => onChange([...active, next]);
  return (
    <AddFilterMenu
      fields={fields}
      onAdd={add}
      variant="trigger"
      hasActive={active.length > 0}
      className={className}
    />
  );
}

// ─── Add-filter menu (two-step popover) ────────────────────────────────────

type AddFilterMenuProps = {
  fields: FilterFieldDef[];
  onAdd: (next: ActiveFilter) => void;
  variant: "trigger" | "inline";
  hasActive?: boolean;
  className?: string;
};

function AddFilterMenu({ fields, onAdd, variant, hasActive, className }: AddFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{ field: FilterFieldDef } | null>(null);

  // Reset step after the close animation settles.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setStep(null), 140);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "trigger" ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Filter"
            className={cn("relative", className)}
          >
            <ListFilter />
            {hasActive ? (
              <span
                aria-hidden
                className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
              />
            ) : null}
          </Button>
        ) : (
          <button
            type="button"
            aria-label="Add filter"
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full",
              "border border-dashed border-border text-muted-foreground",
              "outline-none transition-colors",
              "hover:border-(--color-border-strong) hover:bg-accent hover:text-foreground",
              "aria-expanded:border-(--color-border-strong) aria-expanded:bg-accent aria-expanded:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <Plus className="size-3" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "trigger" ? "end" : "start"}
        sideOffset={6}
        className="w-60 p-1"
      >
        {step ? (
          <step.field.ValuePicker
            onSelect={(value) => {
              onAdd({ fieldId: step.field.id, op: "is", value });
              setOpen(false);
            }}
          />
        ) : (
          <Command>
            <CommandInput placeholder="Filter…" className="text-ui" />
            <CommandList>
              <CommandEmpty>No filters.</CommandEmpty>
              <CommandGroup>
                {fields.map((f) => {
                  const Icon = f.icon;
                  return (
                    <CommandItem
                      key={f.id}
                      value={f.label}
                      onSelect={() => setStep({ field: f })}
                    >
                      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="font-sans">{f.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Pill ──────────────────────────────────────────────────────────────────

type FilterPillProps = {
  field: FilterFieldDef;
  filter: ActiveFilter;
  onUpdate: (next: ActiveFilter) => void;
  onRemove: () => void;
};

function FilterPill({ field, filter, onUpdate, onRemove }: FilterPillProps) {
  const Icon = field.icon;
  const negatable = field.negatable !== false;

  const segment =
    "flex h-full items-center px-1.5 font-sans text-caption leading-none text-muted-foreground " +
    "outline-none hover:bg-accent hover:text-foreground " +
    "aria-expanded:bg-accent aria-expanded:text-foreground " +
    "focus-visible:bg-accent focus-visible:text-foreground";

  const isColored = !!field.valueStyle?.(filter.value);

  return (
    <div
      className={cn(
        "flex h-6 items-center divide-x divide-border overflow-hidden rounded-full",
        "border border-border bg-secondary",
      )}
    >
      {/* Field name — opens value picker */}
      <ValuePopover
        field={field}
        currentValue={filter.value}
        onSelect={(value) => onUpdate({ ...filter, value })}
      >
        <button type="button" className={cn(segment, "gap-1 rounded-l-full pl-2")}>
          <Icon className="size-3" aria-hidden />
          <span>{field.label}</span>
        </button>
      </ValuePopover>

      {/* Op */}
      {negatable ? (
        <OpPopover
          op={filter.op}
          onSelect={(op) => onUpdate({ ...filter, op })}
        >
          <button type="button" className={segment}>
            {filter.op === "is" ? "is" : "is not"}
          </button>
        </OpPopover>
      ) : (
        <span className={cn(segment, "pointer-events-none")}>is</span>
      )}

      {/* Value chip — opens value picker */}
      <ValuePopover
        field={field}
        currentValue={filter.value}
        onSelect={(value) => onUpdate({ ...filter, value })}
      >
        <button
          type="button"
          style={field.valueStyle?.(filter.value)}
          className={cn(
            segment,
            "gap-1 px-2 text-foreground aria-expanded:text-foreground",
            isColored
              ? "hover:brightness-95 dark:hover:brightness-110"
              : "hover:bg-accent hover:text-foreground",
          )}
        >
          {field.renderValue(filter.value)}
        </button>
      </ValuePopover>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${field.label} filter`}
        className={cn(segment, "rounded-r-full pr-2 hover:text-foreground")}
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}

function ValuePopover({
  field,
  currentValue,
  onSelect,
  children,
}: {
  field: FilterFieldDef;
  currentValue: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-64 p-1">
        <field.ValuePicker
          value={currentValue}
          onSelect={(value) => {
            onSelect(value);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function OpPopover({
  op,
  onSelect,
  children,
}: {
  op: FilterOp;
  onSelect: (op: FilterOp) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-32 p-1">
        <Command>
          <CommandList>
            <CommandGroup>
              {(["is", "is_not"] as const).map((value) => (
                <CommandItem
                  key={value}
                  value={value}
                  onSelect={() => {
                    onSelect(value);
                    setOpen(false);
                  }}
                  className="font-sans text-ui"
                >
                  <span className={cn("inline-block w-3", op === value ? "text-foreground" : "opacity-0")}>
                    ✓
                  </span>
                  {value === "is" ? "is" : "is not"}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
