import { Search, X } from "lucide-react";
import { type ComponentProps, useEffect, useRef } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/app/components/ui/input-group";
import { Kbd } from "@/app/components/ui/kbd";
import { cn } from "@/app/lib/cn";

const PAGE_SEARCH = "[data-page-search]";

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest("input, textarea, select, [role=textbox]"))
  );
}

type SearchFieldProps = Omit<ComponentProps<"input">, "value" | "onChange" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** The page's main search: `/` focuses it and the hint shows. Default true. */
  pageSearch?: boolean;
  /** `sm` matches toolbar controls (h-7). */
  size?: "sm" | "default";
  inputClassName?: string;
};

/**
 * Search box for pages and panels. `/` focuses the page search from anywhere,
 * Esc clears it and then blurs, and the `/` hint becomes a clear button once
 * there is text.
 */
export function SearchField({
  value,
  onValueChange,
  pageSearch = true,
  size = "default",
  className,
  inputClassName,
  onKeyDown,
  ...props
}: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pageSearch) return;
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      if (isEditable(event.target)) return;
      // Pages can mount more than one search; the first visible one owns `/`.
      const first = Array.from(document.querySelectorAll<HTMLInputElement>(PAGE_SEARCH)).find(
        (element) => element.getClientRects().length > 0,
      );
      if (!first || first !== input.current) return;
      event.preventDefault();
      first.focus();
      first.select();
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [pageSearch]);

  return (
    <InputGroup className={cn(size === "sm" && "h-7", className)}>
      <InputGroupAddon align="inline-start">
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
        type="search"
        autoComplete="off"
        data-page-search={pageSearch ? "" : undefined}
        aria-keyshortcuts={pageSearch ? "/" : undefined}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Escape") return;
          // Escape belongs to the field first: clear, then leave.
          event.preventDefault();
          if (value) onValueChange("");
          else event.currentTarget.blur();
        }}
        className={cn(size === "sm" && "h-7", inputClassName)}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {value ? (
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              onValueChange("");
              input.current?.focus();
            }}
          >
            <X />
          </InputGroupButton>
        ) : pageSearch ? (
          <Kbd>/</Kbd>
        ) : null}
      </InputGroupAddon>
    </InputGroup>
  );
}
