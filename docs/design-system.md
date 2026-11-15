# ASTRO Health design system

One visual language for every feature. Tokens live in `src/shared/design-system/theme.css`; primitives in `src/shared/design-system/ui/`; everything is exported from `@/shared/design-system`.

Direction: sober, light "medical-space" console. Light canvas, white panels, dark navy crew cards, semantic status colors that always come with a text label.

## How it works

Tailwind v4 reads the `@theme static` block and generates utilities from each token:

| Token | Utility examples |
| --- | --- |
| `--color-status-ok-surface` | `bg-status-ok-surface`, `text-…`, `border-…`, `fill-…`, `stroke-…` |
| `--radius-xl` | `rounded-xl` |
| `--text-caption` | `text-caption` |
| `--font-weight-strong` | `font-strong` |
| `--tracking-eyebrow` | `tracking-eyebrow` |
| `--shadow-card` | `shadow-card` |
| `--breakpoint-sm` (761px) | `sm:` (≥761px), `max-sm:` (≤760px) |

The stock Tailwind palette, fonts, tracking, and shadows are reset with `--*: initial`, so only project tokens exist. `bg-red-500` produces no CSS. `static` emits every token as a CSS variable on `:root`, which is what `readToken()` reads.

## Tokens

### Color

| Group | Tokens |
| --- | --- |
| Canvas & surfaces | `canvas` #f5f7fa · `surface` #fff · `surface-muted` #eef1f5 · `surface-subtle` #f8fafc · `border` #dce2e8 · `border-strong` #c8d3df · `divider` #edf0f4 · `white` · `transparent` · `current` |
| Text | `text` #1a202c · `text-strong` #1e293b · `text-secondary` #334155 · `text-subtle` #475569 · `muted` #64748b |
| Interactive | `primary` #2563eb · `primary-strong` #1d4ed8 · `primary-deep` #1e40af · `primary-soft` #f3f7fc · `selected` #e8edf2 · `selected-border` #516b83 · `hover-border` #6b8cb5 |
| Console (dark cards) | `console` #17212f · `console-hover` #1c2939 · `console-raised` #202d3f · `console-border` #2d4058 · `console-divider` #344256 · `console-tile-border` #43536a · `console-ring` #52647a · `console-avatar-border` #8da1bc · `console-text` #f8fafc · `console-text-soft` #e2e8f0 · `console-muted` #c0cbd8 · `console-faint` #d4dde8 · `console-trace` #b9c8d8 · `console-progress` #aac1d9 |
| Status ok | `status-ok` #16a34a · `-surface` #166534 · `-border` #23a455 · `-soft` #e8f4eb · `-ink` #173b24 |
| Status warn | `status-warn` #d97706 · `-surface` #854d0e · `-border` #e6a11b · `-soft` #fff3dc · `-ink` #4a2a07 · `-on-dark` #f2c879 |
| Status alert | `status-alert` #dc2626 · `-surface` #991b1b · `-border` #ed4a4a · `-soft` #fde9e9 · `-ink` #4c1111 · `-on-dark` #f0a1a1 |
| Status unknown | `status-unknown` #94a3b8 · `-surface` #475569 · `-border` #94a3b8 · `-soft` #eef1f5 · `-ink` #334155 |
| Status info | `status-info` #2563eb |
| Charts | `chart-primary` #2563eb · `chart-secondary` #64748b · `chart-grid` #e7ebf0 · `chart-bar` #7c9cc2 · `chart-axis` #64748b · `body-base` #dce2e8 · `body-highlight` #8da4ba |
| 3D scenes (WebGL) | `space-void` #0a101c (scene background) · `space-star` #cbd7e8 · `space-sun` #ffd98a · `space-sun-glow` #ff9f38 · `space-earth` #4f93ea · `space-mars` #d2643c · `space-orbit` #3b4d66 · `space-signal` #4fd8c4 (Earth link) |

Status suffixes: **surface** = filled tile with white text · **border** = accent on dark cards · **soft** = light callout background · **ink** = text on soft · **on-dark** = status text on console cards.

### Type, weight, tracking

- Font: system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). No web fonts.
- Sizes: `3xs` 8 · `2xs` 9 · `micro` 10 · `xs` 11 · `caption` 12 · `sm` 13 · `body` 14 · `base` 15 (body default) · `md` 16 · `lg` 17 · `xl` 18 · `2xl` 20 · `3xl` 22 · `display-sm` 28 · `display` clamp(28–38) · `vital` clamp(20–23) · `eyebrow` 11/700/0.105em.
- Weights: `medium` 500 · `semibold` 600 · `strong` 650 · `bold` 700 · `heavy` 750.
- Tracking: `display` -0.035em · `tight` -0.025em · `snug` -0.02em · `normal` 0 · `caps` 0.045em · `caps-wide` 0.075em · `eyebrow` 0.105em.
- `h1`/`h2`/`h3` base styles are set in `theme.css`; don't restyle headings per feature.

### Radius, shadow, breakpoints

- Radius: `xs` 5 · `sm` 7 · `md` 8 · `lg` 10 · `xl` 12 (panels) · `2xl` 16 (crew cards).
- Shadow: `card` · `popover` · `toggle` · `inset-avatar` · `selected`.
- Breakpoints: `xs` 431 · `sm` 761 · `md` 1051 · `lg` 1200 · `xl` 1360. Mobile-down tweaks use `max-xs:` (≤430), `max-sm:` (≤760), `max-md:` (≤1050).

## Status → tone

`toneFor(status)` is the only mapping from domain values to visuals:

| Domain status | Tone |
| --- | --- |
| `within-demo-reference`, `stable`, `active`, `link` | `ok` |
| `demo-deviation`, `monitoring` | `warn` |
| `demo-alert`, `simulated-alert` | `alert` |
| `resting` | `info` |
| `unknown`, `blackout` (no Earth link), anything else | `unknown` |

Then pick the treatment: `toneSurface[tone]` (filled tile), `toneSoft[tone]` (callout with left accent), `toneBorder[tone]` (outline on dark card), `toneDot[tone]` (indicator). Always render the text label too — color is never the only signal.

Canvas and WebGL materials cannot take classes: read the color with `readToken(toneToken[tone])` (same colors as `toneBorder`) and the `space-*` tokens with `readToken("color-space-earth")`. Keep the text label next to the scene.

## Primitives

| Component | Use for |
| --- | --- |
| `SiteHeader` | Global header (already in `layout.tsx`); inline A/orbit/heartbeat mark, ASTRO Health wordmark, and UMBRAL mission wordmark |
| `PageFooter` | Footer at the end of every view |
| `Panel` | White bordered card (`<article>`) |
| `PanelHeading` | Eyebrow + h2 + optional actions inside a panel |
| `SectionHeading` | h2 + muted description + right-side aside |
| `Eyebrow` | Small uppercase label above a heading |
| `StatusText` | Status label (`variant="light" \| "console"`, optional dot) |
| `Avatar` | Neutral initials avatar (`size`, `variant`) |
| `SegmentedToggle` | Pressed-button group (e.g. 7/30 days) — client component |

Helpers: `cn()` (`@/shared/lib/cn`), `formatShortDate()` (`@/shared/lib/format-date`), `readToken()`, `toneToken`, `THEME_COLOR`.

## Do / Don't

- ✅ `className="rounded-xl border border-border bg-surface p-5"`
- ✅ `className={cn("rounded-md border-l-5", toneSoft[toneFor(scenario.status)])}`
- ✅ Layout-only arbitrary values: `grid-cols-[minmax(0,1fr)_auto]`, `w-[min(94px,55%)]`
- ✅ SVG geometry attributes (`strokeWidth={2.5}`, `r={3}`) — they are shape, not theme
- ❌ `bg-red-500`, `text-gray-600` (no CSS is generated)
- ❌ `bg-[#991b1b]`, `style={{ color: "#64748b" }}`, `fill="#2563eb"` (lint fails)
- ❌ Defining new status colors inside a feature

## Changing the system

1. Branch `feat/design-system-<x>` from `main`.
2. Add the token to `theme.css` (and to `status.ts` if it is a tone) and document it in this file.
3. Merge it first; feature branches then rebase on `main` and use it.
4. Removing or renaming a token is a breaking change: search all features and update them in the same PR.
