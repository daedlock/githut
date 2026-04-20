import { Check } from "lucide-react";
import { type Palette, type ThemePreference, useThemeStore } from "@/app/stores/theme";
import { cn } from "@/app/lib/cn";

/**
 * Theme picker — 5 palette preview cards.
 *
 * Each card renders itself in the palette it represents, not in the currently
 * active one: the card's outer wrapper gets either `data-theme="..."` or
 * `className="dark"`, scoping the theme tokens to that subtree only. Your
 * eyes see exactly what you'd get before you commit. No apply-and-check.
 *
 * Click = instant setPalette + setPreference. Zero React re-renders to preview,
 * zero paint flash; the CSS cascade does all the work.
 */

type PreviewWrapper = {
  /** Set as `data-theme` on the preview wrapper, or undefined for :root default. */
  dataTheme?: "ember" | "ember-soft" | "ember-light" | "dune" | "haze" | "lagoon" | "matrix" | "moss" | "sagecream";
  /** Add `.dark` class to the preview wrapper for stone-dark scoping. */
  dark?: boolean;
};

type ThemeCard = {
  id: string;
  name: string;
  tagline: string;
  palette: Palette;
  preference: "light" | "dark";
  preview: PreviewWrapper;
};

const CARDS: ThemeCard[] = [
  {
    id: "stone-light",
    name: "Stone",
    tagline: "Warm stone, daylight",
    palette: "stone",
    preference: "light",
    preview: {},
  },
  {
    id: "stone-dark",
    name: "Stone",
    tagline: "Warm stone, night",
    palette: "stone",
    preference: "dark",
    preview: { dark: true },
  },
  {
    id: "ember-light",
    name: "Ember Light",
    tagline: "Warm parchment, not clinical white",
    palette: "ember",
    preference: "light",
    preview: { dataTheme: "ember-light" },
  },
  {
    id: "ember-soft",
    name: "Ember Soft",
    tagline: "Lifted graphite, longer sessions",
    palette: "ember-soft",
    preference: "dark",
    preview: { dataTheme: "ember-soft" },
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "One spark in the ash",
    palette: "ember",
    preference: "dark",
    preview: { dataTheme: "ember" },
  },
  {
    id: "dune",
    name: "Dune",
    tagline: "Amber earth on charcoal steel",
    palette: "dune",
    preference: "dark",
    preview: { dataTheme: "dune" },
  },
  {
    id: "haze",
    name: "Haze",
    tagline: "Lavender mist, dusty mauve spark",
    palette: "haze",
    preference: "dark",
    preview: { dataTheme: "haze" },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    tagline: "Coral reef at dusk, teal waters",
    palette: "lagoon",
    preference: "dark",
    preview: { dataTheme: "lagoon" },
  },
  {
    id: "matrix",
    name: "Matrix",
    tagline: "Green phosphor glow",
    palette: "matrix",
    preference: "dark",
    preview: { dataTheme: "matrix" },
  },
  {
    id: "moss",
    name: "Moss",
    tagline: "Deep forest, warm earth tones",
    palette: "moss",
    preference: "dark",
    preview: { dataTheme: "moss" },
  },
  {
    id: "sagecream",
    name: "Sagecream",
    tagline: "Neutral graphite, sage whisper",
    palette: "sagecream",
    preference: "dark",
    preview: { dataTheme: "sagecream" },
  },
];

export function ThemePicker() {
  const palette = useThemeStore((s) => s.palette);
  const preference = useThemeStore((s) => s.preference);
  const setPalette = useThemeStore((s) => s.setPalette);
  const setPreference = useThemeStore((s) => s.setPreference);

  // A card is "active" when its (palette, preference) exactly matches the
  // current store values. We don't collapse system → light/dark here — if the
  // user has follow-system on, no specific card shows as selected; that's
  // intentional and more honest than picking one at random.
  const isActive = (card: ThemeCard) =>
    card.palette === palette && card.preference === preference;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <PreviewCard
            key={card.id}
            card={card}
            active={isActive(card)}
            onSelect={() => {
              setPalette(card.palette);
              setPreference(card.preference);
            }}
          />
        ))}
      </div>

      <PreferenceToggle
        current={preference}
        onChange={setPreference}
      />
    </div>
  );
}

// ─── Preview card ───────────────────────────────────────────────────────────

function PreviewCard({
  card,
  active,
  onSelect,
}: {
  card: ThemeCard;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-theme={card.preview.dataTheme}
      className={cn(
        // The wrapper itself IS in the card's own palette — every descendant
        // that references --color-* / --syntax-* reads the scoped values.
        "group relative block overflow-hidden rounded-md",
        "border bg-background text-foreground text-left",
        "outline-none transition-[border-color,transform] duration-150",
        "focus-visible:ring-1 focus-visible:ring-ring/20",
        active
          ? "border-primary ring-1 ring-primary/40"
          : "border-border hover:border-input",
        // stone-dark preview uses Tailwind's .dark variant to trigger the
        // existing .dark {} block — scoped to just this card.
        card.preview.dark && "dark",
      )}
      aria-pressed={active}
      aria-label={`${card.name} theme`}
    >
      {active && (
        <span
          className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}

      <div className="p-5">
        <div className="mb-1 font-mono text-[15px] font-medium tracking-tight">{card.name}</div>
        <div className="font-sans text-caption italic text-muted-foreground">
          {card.tagline}
        </div>
      </div>

      {/* Code snippet — hand-tagged with syntax vars so the preview is a real
          demonstration of the theme's syntax palette, not a vague mockup. */}
      <pre
        className="m-0 px-5 pb-4 font-mono text-[11px] leading-[18px]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <SnippetLine>
          <Tk c="meta">import</Tk>
          <Tk> {"{ "}</Tk>
          <Tk c="function">render</Tk>
          <Tk> {"} "}</Tk>
          <Tk c="meta">from</Tk>
          <Tk c="string"> "./ember"</Tk>
          <Tk c="punctuation">;</Tk>
        </SnippetLine>

        <SnippetLine />

        <SnippetLine>
          <Tk c="comment">{"// one vivid spark"}</Tk>
        </SnippetLine>

        <SnippetLine>
          <Tk c="keyword">const</Tk>
          <Tk> </Tk>
          <Tk c="constant">sparks</Tk>
          <Tk> = </Tk>
          <Tk c="punctuation">[</Tk>
          <Tk c="string">"coral"</Tk>
          <Tk>, </Tk>
          <Tk c="string">"gold"</Tk>
          <Tk>, </Tk>
          <Tk c="string">"olive"</Tk>
          <Tk c="punctuation">]</Tk>
          <Tk> </Tk>
          <Tk c="keyword">as</Tk>
          <Tk> </Tk>
          <Tk c="type">const</Tk>
          <Tk c="punctuation">;</Tk>
        </SnippetLine>

        <SnippetLine />

        <SnippetLine>
          <Tk c="keyword">export function</Tk>
          <Tk> </Tk>
          <Tk c="function">ignite</Tk>
          <Tk c="punctuation">(</Tk>
          <Tk>n</Tk>
          <Tk c="operator">: </Tk>
          <Tk c="type">number</Tk>
          <Tk c="punctuation">)</Tk>
          <Tk> {"{"}</Tk>
        </SnippetLine>

        <SnippetLine>
          <Tk>{"  "}</Tk>
          <Tk c="keyword">return</Tk>
          <Tk> </Tk>
          <Tk c="variable">sparks</Tk>
          <Tk c="punctuation">.</Tk>
          <Tk c="function">slice</Tk>
          <Tk c="punctuation">(</Tk>
          <Tk c="number">0</Tk>
          <Tk>, n</Tk>
          <Tk c="punctuation">)</Tk>
          <Tk c="punctuation">;</Tk>
        </SnippetLine>

        <SnippetLine>
          <Tk>{"}"}</Tk>
        </SnippetLine>
      </pre>

      {/* Accent swatch strip — the 6 palette hues + the hero ring */}
      <div
        className="flex items-center gap-1.5 border-t border-border px-5 py-3"
        aria-hidden
      >
        <Swatch colorVar="--color-accent" primary />
        <Swatch colorVar="--syntax-function" />
        <Swatch colorVar="--syntax-string" />
        <Swatch colorVar="--syntax-property" />
        <Swatch colorVar="--syntax-tag" />
        <Swatch colorVar="--syntax-meta" />
        <Swatch colorVar="--color-fg-muted" />
      </div>
    </button>
  );
}

function SnippetLine({ children }: { children?: React.ReactNode }) {
  // An empty line still needs height — render a zero-width space.
  return <div className="whitespace-pre">{children ?? "\u200b"}</div>;
}

/** Syntax-colored token span. `c` is the syntax role name (maps to --syntax-*). */
function Tk({
  c,
  children,
}: {
  c?:
    | "keyword"
    | "string"
    | "number"
    | "comment"
    | "function"
    | "type"
    | "property"
    | "constant"
    | "variable"
    | "operator"
    | "punctuation"
    | "tag"
    | "attribute"
    | "meta";
  children: React.ReactNode;
}) {
  const fontStyle = c === "comment" ? "italic" : undefined;
  return (
    <span style={{ color: c ? `var(--syntax-${c})` : "var(--color-fg)", fontStyle }}>
      {children}
    </span>
  );
}

function Swatch({ colorVar, primary }: { colorVar: string; primary?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        primary ? "size-3 ring-1 ring-[var(--color-accent-fg)]/30" : "size-2",
      )}
      style={{ backgroundColor: `var(${colorVar})` }}
    />
  );
}

// ─── Preference toggle (light / dark / system) ──────────────────────────────

function PreferenceToggle({
  current,
  onChange,
}: {
  current: ThemePreference;
  onChange: (p: ThemePreference) => void;
}) {
  const options: { value: ThemePreference; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        Follow
      </span>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-sm px-3 py-1 font-mono text-micro",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-ring/20",
              current === o.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="font-sans text-micro italic text-[var(--color-fg-faint)]">
        {current === "system"
          ? "matches OS color scheme"
          : "override OS preference"}
      </span>
    </div>
  );
}
