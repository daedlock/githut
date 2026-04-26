# Product names

All availability verified against the **Namecheap API** (authoritative).
Pricing reflects what Namecheap displays at the time of the check.
Constraint: `.app` or `.dev` TLD (open-source dev tool, replacing GitHub UI).

---

## Top picks

| Name | TLD | Why it works |
|---|---|---|
| **braise** | `braise.dev` | Single English word. "To cook slowly with care" — code review *is* slow careful refinement. Same brand-shape as Linear / Drizzle: single oblique-meaning word on `.dev`. Verbable: *"braise this PR."* |
| **treen** | `treen.dev` | Single short word meaning *small wooden objects, hand-crafted.* Bun/Vite-shape — short, distinctive, evokes craft. Obscure enough to feel discovered, common enough to teach in one sentence. |
| **felka** | `felka.app` `felka.dev` `felka.ai` `felka.io` | Coined Linear/Figma-shape. **Full multi-TLD coverage** — total brand control for ~$60/yr. No collisions. No anchor meaning, so you teach the brand through product. |
| **diffside** | `diffside.app` (also `.com .dev .ai .io`) | Function-rooted, descriptive. Side-by-side diff is the screen. Less Graphite-shape, more "tool that does X." Full 5-TLD coverage available. |

### My pick: `braise.dev`

It survives every test:
- Single word, single concept
- Sticky metaphor for what review actually is (slow refinement)
- Verbs cleanly
- Standard registration, no premium tier
- `.dev` is on equal footing for an OSS dev tool (Vite, Bun, Astro, Tailwind all live there)
- Not git-coupled, won't leash you if scope expands

---

## All available — standard registration

### Single English words

| Name | TLD | Meaning |
|---|---|---|
| **braise** | `.dev` | Cook slowly with care |
| **treen** | `.dev` | Small wooden objects, hand-crafted |
| **withe** | `.dev` | Flexible willow branch used for binding |
| **pintle** | `.dev` | Metal pin used as a hinge |
| **gird** | `.app` | Prepare / strengthen |
| **snath** | `.app` | Shaft of a scythe |
| **niamh** | `.app` | Irish name "bright" — pronounced NEEV (spelling/pronunciation friction) |
| **cardamom** | `.dev` | A spice — long, less brand-shape |

### Coined / Linear-Vercel-shape

| Name | TLD | Notes |
|---|---|---|
| **felka** | `.app` `.dev` `.ai` `.io` | Full multi-TLD coverage |
| **falka** | `.app` | Linear-shape |
| **halen** | `.dev` | Coined |
| **hadu** | `.dev` | Coined, short |
| **lovi** | `.dev` | Coined, short |

### Function-rooted compounds

These describe what the product does. Less brand-shape, more direct clarity.

| Name | TLD | Notes |
|---|---|---|
| **diffside** | `.app` `.com` `.dev` `.ai` `.io` | Side-by-side diff |
| **diffpane** | `.app` `.com` `.dev` `.ai` `.io` | Diff is the surface |
| **diffflow** | `.app` `.com` `.dev` `.ai` `.io` | Flow of reviewing diffs |
| **prread** | `.app` `.com` `.dev` `.ai` `.io` | Reading PRs |
| **gitperch** | `.app` `.com` `.dev` `.ai` `.io` | Observation perch |
| **skimkit** | `.app` `.com` `.dev` `.ai` `.io` | Skim PRs |
| **annokit** | `.app` `.com` `.dev` `.ai` `.io` | Annotation kit |

---

## Available premium (priced)

| Name | TLD | Annual |
|---|---|---|
| **lacquer** | `.app` | $68.60 |
| **mura** | `.dev` | $460.60 (Japanese: village / imperfection) |
| **sen** | `.dev` | $460.60 (Japanese: line) |

---

## Confirmed unavailable (for the record)

These all came back TAKEN via the authoritative Namecheap API. Listed so we don't re-check them.

**Premium-held / aftermarket only:**
`nib`, `gloss`, `polish`, `stitch`, `charter`, `counsel`, `keen`, `slate`, `quartz`, `arc`, `beam`, `crest`, `draft`, `mark`, `ink`, `scroll`, `chalk`, `sage`, `tome`, `folio`, `jade`, `coral`, `amber`, `obsidian`, `opal`, `marble`, `bronze`, `brass`

**Outright taken:**
`flint`, `mica`, `onyx`, `glyph`, `canon`, `pewter`, `rune`, `vellum`, `volley`, `opus`, `ethos`, `kairos`, `praxis`, `axiom`, `saga`, `nova`, `vega`, `atlas`, `aurora`, `nyx`, `chord`, `chime`

---

## Methodology

Every name was queried via Namecheap's `domains.check` API endpoint:
```
GET https://api.namecheap.com/xml.response
    ?Command=namecheap.domains.check
    &DomainList=<domain1>,<domain2>,...
```

API returns `Available="true"` (registrable) or `"false"` (taken),
with `IsPremiumName` and `PremiumRegistrationPrice` flagging premium-tier domains.

**Known limitation of earlier methods:** DNS NS-record checks and DoH queries
returned false-positives for parked / undelegated registered domains.
Namecheap's API is authoritative.
