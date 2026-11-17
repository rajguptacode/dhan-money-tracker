# Dhan design system

Dhan is meant to feel like a well-kept Indian passbook: warm paper, deep ink-green, a marigold edge, and numbers that line up. The interface is quiet so the money can be loud and clear.

## Principles

1. **The number is the hero.** Balances and goals get display type; controls stay secondary.
2. **Calm, not corporate.** Paper surfaces, editorial headings and generous whitespace instead of dashboard neon.
3. **One accent, used sparingly.** Marigold marks focus, selected navigation, stamps and goal progress. Green carries money-in and primary actions.
4. **Honest state.** Empty states explain what will appear. Warnings and estimates are labelled in plain language.
5. **Touch and keyboard are equal.** Real controls, visible focus, 44px targets on mobile, no hover-only actions.

## Typography

| Role | Family | Source |
| --- | --- | --- |
| Display / editorial | **Fraunces** | `assets/fonts/fraunces-latin.woff2` |
| UI and body | **Hanken Grotesk** | `assets/fonts/hanken-grotesk-latin.woff2` |
| Figures, labels, metadata | **IBM Plex Mono** 400/500/600 | `assets/fonts/ibm-plex-mono-*.woff2` |

All fonts are self-hosted. Licence files are in `assets/fonts/`.

Scale tokens live in `:root`:

```css
--text-display: clamp(2.7rem, 5.4vw, 4.25rem);
--text-h1: clamp(1.9rem, 3.4vw, 2.55rem);
--text-h2: 1.45rem;
--text-h3: 1.125rem;
--text-body: 1rem;
--text-sm: 0.875rem;
--text-xs: 0.8125rem;
```

Numerals use tabular lining figures (`font-variant-numeric: tabular-nums lining-nums`) wherever amounts can change, so columns do not jitter.

## Colour

Themes are driven by CSS custom properties on `:root` and `[data-theme="dark"]`.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f5f0e4` | Page paper |
| `--surface` | `#fcf9f2` | Cards, panels |
| `--ink` | `#17251f` | Primary text |
| `--ink-2` | `#34463c` | Secondary text |
| `--muted` | `#56675c` | Metadata |
| `--emerald` | `#0b5c46` | Primary actions, links |
| `--marigold` | `#d99b38` | Accent, selected nav, stamps |
| `--terra` | `#b44b36` | Money out, destructive actions |
| `--positive` | `#0b6b4f` | Money in |
| `--negative` | `#a9422f` | Overspend, liabilities |

### Dark

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0f1814` | Page |
| `--surface` | `#16231e` | Cards |
| `--ink` | `#f2ebdd` | Primary text |
| `--emerald` | `#6fc7a4` | Primary actions, links |
| `--marigold` | `#e3b25f` | Accent and primary buttons |
| `--terra` | `#f09279` | Money out |

The sidebar stays deep green in both themes. The hero panel uses its own `--hero-*` tokens so it keeps a consistent “passbook cover” treatment.

Category colours (`--cat-emerald`, `--cat-terra`, `--cat-ochre`, `--cat-teal`, `--cat-plum`, `--cat-olive`, `--cat-rose`, `--cat-slate`) are used for category icons, donut segments and ranking bars. Colour is always paired with a label and an icon.

## Spacing, radius and motion

```css
--space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
--space-4: 1rem;     --space-5: 1.25rem;  --space-6: 1.5rem;
--space-7: 2rem;     --space-8: 2.5rem;   --space-9: 3rem;
--space-10: 4rem;

--radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 18px;
--radius-xl: 26px; --radius-pill: 999px;

--motion-fast: 160ms; --motion: 240ms; --motion-slow: 420ms;
--ease: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Motion is limited to state feedback: dialogs fade/scale in, toasts rise, chart bars grow once. `prefers-reduced-motion: reduce` disables transitions and smooth scrolling. No looping decorative animation.

## Layout

- **Desktop:** 268px fixed sidebar, content up to 1240px, 18–26px card gaps.
- **Tablet (≤1023px):** sidebar becomes a compact icon rail; content gains width.
- **Mobile (≤720px):** top bar, single column, bottom navigation with a central add button. Forms become one column. Modal sheets fill the viewport width.
- **Print:** navigation, filters, buttons and toasts hidden; cards avoid page breaks; `@page` margin 14mm.

## Component vocabulary

- **Hero passbook** — net worth with ruled-paper lines, delta, three monthly figures, sparkline and a report link.
- **Card** — `--surface`, 18px radius, soft shadow, 20–24px padding.
- **Metric strip** — mono uppercase labels over display figures; 4-up on desktop, 2×2 on small screens.
- **Segmented control** — expense/income/transfer, new/old regime, light/dark/system.
- **Amount field** — large rupee glyph, display-size input, hint text below.
- **Category picker** — icon + label tiles, selection ring in the category colour.
- **Progress bar** — 8px track, emerald fill, marigold when near/over a budget.
- **Stamp** — dashed marigold outline, mono uppercase: `ESTIMATE`, `LOCAL FIRST`, `NO LOGIN`.
- **Dialog** — native `<dialog>`; sticky head and foot, scrollable body, backdrop close where safe.
- **Empty state** — icon, title, one-sentence explanation, primary next action.
- **Toasts** — bottom-right stack, auto-dismiss, `role="status"`.

## Data display rules

- All money is stored and calculated in integer paise. Display formatting is the only place division by 100 happens.
- Indian grouping (`en-IN`) and the ₹ symbol. Compact figures use lakh/crore suffixes.
- Transfers cancel out of income/expense and net worth, but still appear in the ledger.
- Archived accounts keep their history and leave active net worth.
- Goal contributions affect only goal progress, never account balances.

## Accessibility

- Semantic landmarks, one `h1` per view, labelled inputs and buttons.
- Skip link to `#main`; route changes move focus to the main region.
- Focus ring uses `--focus` with a 2px offset, visible in both themes.
- Charts render an accessible summary and keyboard-focusable data points with tooltips.
- Colour contrast targets WCAG AA for text; category colour never carries meaning alone.
- `prefers-reduced-motion`, `forced-colors` and print media have explicit handling.

## File map

- `assets/css/styles.css` — tokens, reset, components, views, responsive and print rules.
- `index.html` — inline SVG sprite and app shell.
- `assets/js/charts.js` — custom SVG charts.
- `assets/js/ui.js` — money/date formatting and shared markup.
