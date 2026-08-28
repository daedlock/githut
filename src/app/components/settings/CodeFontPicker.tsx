import { Check, Type } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { track } from "@/app/lib/analytics";
import { cn } from "@/app/lib/cn";
import {
  type CodeFont,
  type CodeFontSize,
  type UiFont,
  useSettingsStore,
} from "@/app/stores/settings";

const UI_FONT_OPTIONS: Array<{
  id: UiFont;
  name: string;
  note: string;
  family: string;
}> = [
  {
    id: "inter",
    name: "Inter",
    note: "Neutral",
    family: '"Inter Variable", "Inter", ui-sans-serif, sans-serif',
  },
  {
    id: "rubik",
    name: "Rubik",
    note: "Friendly",
    family: '"Rubik Variable", "Rubik", ui-sans-serif, sans-serif',
  },
  {
    id: "geist",
    name: "Geist",
    note: "Crisp",
    family: '"Geist Variable", "Geist", ui-sans-serif, sans-serif',
  },
  {
    id: "ibm-plex-sans",
    name: "IBM Plex Sans",
    note: "Technical",
    family: '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, sans-serif',
  },
];

const CODE_FONT_OPTIONS: Array<{
  id: CodeFont;
  name: string;
  note: string;
  preview: string;
  family: string;
}> = [
  {
    id: "fira-code",
    name: "Fira Code",
    note: "Geometric",
    preview: "const result = value !== null",
    family: '"Fira Code Variable", ui-monospace, monospace',
  },
  {
    id: "berkeley-mono",
    name: "Berkeley Mono",
    note: "GitHut original",
    preview: "const result = value !== null => value",
    family: '"Berkeley Mono SemiCondensed", ui-monospace, monospace',
  },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    note: "Readable",
    preview: "const result = value !== null",
    family: '"JetBrains Mono Variable", ui-monospace, monospace',
  },
  {
    id: "ibm-plex-mono",
    name: "IBM Plex Mono",
    note: "Editorial",
    preview: "const result = value !== null",
    family: '"IBM Plex Mono", ui-monospace, monospace',
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    note: "Open",
    preview: "const result = value !== null",
    family: '"Source Code Pro Variable", ui-monospace, monospace',
  },
];

const CODE_SIZE_OPTIONS: Array<{ id: CodeFontSize; name: string; px: number }> = [
  { id: "compact", name: "Compact", px: 12 },
  { id: "comfortable", name: "Comfortable", px: 13 },
  { id: "large", name: "Large", px: 14 },
];

export function CodeFontPicker() {
  const uiFont = useSettingsStore((state) => state.uiFont);
  const codeFont = useSettingsStore((state) => state.codeFont);
  const codeFontSize = useSettingsStore((state) => state.codeFontSize);
  const codeLigatures = useSettingsStore((state) => state.codeLigatures);
  const setUiFont = useSettingsStore((state) => state.setUiFont);
  const setCodeFont = useSettingsStore((state) => state.setCodeFont);
  const setCodeFontSize = useSettingsStore((state) => state.setCodeFontSize);
  const setCodeLigatures = useSettingsStore((state) => state.setCodeLigatures);

  const selectedCodeFont = CODE_FONT_OPTIONS.find((option) => option.id === codeFont)!;
  const selectedCodeSize = CODE_SIZE_OPTIONS.find((option) => option.id === codeFontSize)!;

  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="font-sans text-ui font-medium text-foreground">Interface font</legend>
        <p className="mt-1 font-sans text-caption text-muted-foreground">
          Used for navigation, controls, conversations, and supporting text.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {UI_FONT_OPTIONS.map((option) => (
            <FontOptionButton
              key={option.id}
              selected={uiFont === option.id}
              name={option.name}
              note={option.note}
              style={{ fontFamily: option.family }}
              onClick={() => {
                track("ui_font_changed", { font: option.id });
                setUiFont(option.id);
              }}
            >
              Review with clarity
            </FontOptionButton>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
        <legend className="font-sans text-ui font-medium text-foreground">Monospace font</legend>
        <p className="mt-1 font-sans text-caption text-muted-foreground">
          Used everywhere monospace appears, including identifiers, source, diffs, and logs.
        </p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {CODE_FONT_OPTIONS.map((option) => {
            const selected = codeFont === option.id;
            return (
              <FontOptionButton
                key={option.id}
                selected={selected}
                name={option.name}
                note={option.note}
                onClick={() => {
                  track("code_font_changed", { font: option.id });
                  setCodeFont(option.id);
                }}
                style={{
                  fontFamily: option.family,
                  fontFeatureSettings: codeLigatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0',
                }}
              >
                {option.preview}
              </FontOptionButton>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 border-t border-border pt-4 lg:grid-cols-[1fr_auto]">
        <fieldset className="flex flex-col gap-2">
          <legend className="font-sans text-ui font-medium text-foreground">Code size</legend>
          <div className="inline-flex w-fit rounded-md bg-[var(--color-bg-sunken)] p-0.5">
            {CODE_SIZE_OPTIONS.map((option) => {
              const selected = codeFontSize === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${option.name}, ${option.px} pixels`}
                  onClick={() => {
                    track("code_font_size_changed", { size: option.id });
                    setCodeFontSize(option.id);
                  }}
                  className={cn(
                    "rounded-[3px] px-2.5 py-1.5 font-sans text-caption outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    selected
                      ? "bg-background font-medium text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.name}
                  <span className="ml-1 tabular-nums opacity-60">{option.px}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex min-w-56 items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
          <span className="flex flex-col">
            <span className="font-sans text-ui font-medium text-foreground">
              Programming ligatures
            </span>
            <span className="font-sans text-caption text-muted-foreground">
              Turn symbols like != into glyphs.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={codeLigatures}
            aria-label="Programming ligatures"
            onClick={() => {
              track("code_ligatures_toggled", { enabled: !codeLigatures });
              setCodeLigatures(!codeLigatures);
            }}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-muted",
              codeLigatures ? "bg-primary" : "bg-[var(--color-bg-sunken)]",
            )}
          >
            <span
              className={cn(
                "pointer-events-none mt-0.5 inline-block size-3.5 rounded-full bg-background transition-transform",
                codeLigatures ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-[var(--color-code-bg)]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Type className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="font-sans text-caption font-medium text-foreground">
            Live code specimen
          </span>
          <span className="ml-auto font-sans text-micro uppercase tracking-wider text-muted-foreground">
            {selectedCodeFont.name} · {selectedCodeSize.px}px
          </span>
        </div>
        <pre
          className="overflow-x-auto px-3 py-3 text-foreground"
          style={{
            fontFamily: selectedCodeFont.family,
            fontSize: selectedCodeSize.px,
            lineHeight: "20px",
            fontFeatureSettings: codeLigatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0',
          }}
        >
          <code>
            <span style={{ color: "var(--syntax-keyword)" }}>const</span> review = changes
            <span style={{ color: "var(--syntax-operator)" }}>.</span>
            <span style={{ color: "var(--syntax-function)" }}>filter</span>((change) {"=>"} change
            <span style={{ color: "var(--syntax-operator)" }}>.</span>status !=={" "}
            <span style={{ color: "var(--syntax-string)" }}>&quot;resolved&quot;</span>);
          </code>
        </pre>
      </div>
    </div>
  );
}

function FontOptionButton({
  selected,
  name,
  note,
  style,
  onClick,
  children,
}: {
  selected: boolean;
  name: string;
  note: string;
  style: CSSProperties;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2.5 text-left",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        selected
          ? "border-input bg-background text-foreground"
          : "border-transparent bg-[var(--color-bg-sunken)]/45 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground",
      )}
    >
      <span className="flex w-full items-center gap-2 font-sans">
        <span className="truncate text-ui font-medium">{name}</span>
        <span className="ml-auto text-micro uppercase tracking-widest text-muted-foreground">
          {note}
        </span>
        {selected ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
      </span>
      <span className="w-full truncate text-caption text-foreground" style={style}>
        {children}
      </span>
    </button>
  );
}
