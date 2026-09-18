import { useId } from "react";
import { cn } from "@/app/lib/cn";
import { CONTAINER_WIDTH_OPTIONS } from "@/app/lib/containerWidth";
import { useSettingsStore } from "@/app/stores/settings";

export function ContainerWidthPicker() {
  const width = useSettingsStore((state) => state.containerWidth);
  const setWidth = useSettingsStore((state) => state.setContainerWidth);
  const id = useId();

  return (
    <fieldset className="min-w-0" aria-describedby={`${id}-description`}>
      <legend className="text-ui font-medium text-foreground">Container width</legend>
      <p id={`${id}-description`} className="mt-1 text-caption text-muted-foreground">
        Keep the header and page content aligned. Applies immediately and stays in this browser.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONTAINER_WIDTH_OPTIONS.map((option, index) => (
          <label key={option.id} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name={`${id}-width`}
              value={option.id}
              checked={width === option.id}
              onChange={() => setWidth(option.id)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-full flex-col gap-2 rounded-md border border-border bg-background p-3 transition-colors",
                "hover:bg-accent peer-checked:border-primary peer-checked:bg-accent",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-focus) peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-muted",
              )}
            >
              <span
                aria-hidden
                className="flex h-6 items-center rounded-sm border border-border px-1"
              >
                <span
                  className="mx-auto h-3 rounded-xs bg-foreground/25"
                  style={{ width: `${40 + index * 20}%` }}
                />
              </span>
              <span className="text-ui font-medium text-foreground">{option.label}</span>
              <span className="text-caption text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
