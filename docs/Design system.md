# OrvioHub design system

## Foundations

- **Stack:** React 19, TypeScript, Tailwind CSS v4, `class-variance-authority`, `clsx`, and `tailwind-merge`.
- **Iconography:** Lucide React. Icons are generally 14–20 px, paired with text using a 6–10 px gap.
- **Brand character:** dark, focused, and practical for product UI; expressive plum-and-gold accents for public marketing. Product copy is direct and action-led.
- **Surface split:** application/workspace screens use deep black and plum; the marketing surface adds gold, illustrations, gradients, and more generous scale.

## Colour

### Core tokens

The CSS variables in `frontend/src/index.css` are HSL triplets, so use them with Tailwind semantic utilities where available (for example `bg-primary`, `text-foreground`, and `border-border`).

| Purpose         | Token / common value                                       | Notes                                                                                          |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Brand primary   | `--primary`: `312 20% 37%` / `#714B67`                     | Main action, selected, focus, and brand block colour.                                          |
| Primary hover   | `--primary-hover`: `312 22% 43%` / approximately `#86597A` | Hover state for plum actions.                                                                  |
| Primary soft    | `--primary-soft`: `312 30% 95%`                            | Light tint token.                                                                              |
| Brand accent    | `#FDB02F`                                                  | Gold marketing highlight; use sparingly for emphasis, decorative detail, and featured actions. |
| Pink highlight  | `#D4A8C9`, `#C79DBD`, `#F0D8E8`                            | Selected labels, supporting icons, and soft plum emphasis.                                     |
| App background  | `#000`, `#080608`, `#0E0A0D`                               | Page, inset, and raised-dark surface range.                                                    |
| Raised surfaces | `#0C080B`, `#120B10`, `#160F14`                            | Cards, dialogs, and form controls.                                                             |
| Primary text    | `#F8FAFC`, `white`, `slate-100`                            | Headings and important content.                                                                |
| Secondary text  | `slate-300` / `slate-400`                                  | Body copy and supporting labels.                                                               |
| Muted text      | `slate-500` / `slate-600`                                  | Hints, placeholders, and disabled metadata.                                                    |
| Border          | `white/10` or `slate-700` / `slate-800`                    | Default separation; increase only on active or error states.                                   |
| Success         | `emerald-400` and `--success`                              | Positive status and completion.                                                                |
| Warning         | `amber-300` / `amber-500`                                  | Caution and limits.                                                                            |
| Danger          | `red-600`, `red-400`, `rose-400`                           | Destructive controls and validation errors.                                                    |

Use semantic meaning rather than colour alone for status. Pair status colour with an icon, label, or clear copy.

## Typography

- **Body UI:** `Inter`, falling back to `Odoo Unicode Support Noto`, then sans-serif.
- **Display headings:** `Caveat`, set globally on `h1`–`h6`. Existing product screens also use Tailwind weights and sizes for a denser operational look.
- **Numeric and code-like values:** `font-mono`, especially for currency, IDs, branch codes, timestamps, and compact metadata.

| Use               | Typical implementation                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Marketing hero    | `text-4xl sm:text-5xl lg:text-[62px] font-extrabold leading-[1.1] tracking-tight`        |
| Page title        | `text-2xl` to `text-3xl font-bold`                                                       |
| Card title        | `text-2xl font-bold` in the primitive; compact app cards may use `text-sm font-semibold` |
| Body              | `text-sm leading-relaxed` or `text-base` for marketing                                   |
| Labels/navigation | `text-xs font-medium` or `font-semibold`                                                 |
| Metadata/badges   | `text-[9px]`–`text-[11px]`, often uppercase, tracked, or mono                            |

Keep heading hierarchy semantic even when visual styles are overridden. Avoid using colour or size alone to convey structure.

## Layout and spacing

- Use Tailwind’s 4 px spacing scale. Common gaps are `gap-2`/8 px, `gap-3`/12 px, `gap-4`/16 px, `gap-6`/24 px, and `gap-8`/32 px.
- Standard app content uses `px-6`, with `py-8` or `py-10`; shells commonly cap content at `max-w-6xl` or `max-w-7xl`.
- Marketing sections can use `max-w-[1440px]`, responsive `px-6 sm:px-8 lg:px-12`, and larger vertical spacing.
- Form groups use `space-y-1.5`; panels commonly use `p-4`, `p-5`, or `p-6`.
- Stack on mobile first. Existing patterns use `sm:` for two-column forms and `lg:`/`xl:` for dashboards and desktop navigation.

### Radius and elevation

| Element                   | Preferred radius                                                     | Treatment                               |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Buttons, compact controls | `rounded-sm`; `rounded-sm` for small variants                        | Simple and crisp.                       |
| Inputs/selects            | `rounded-sm` in base primitive; `rounded-sm` in rich workspace flows | Match the surrounding component family. |
| Cards                     | `rounded-sm`                                                         | `border` plus dark translucent surface. |
| Modals                    | `rounded-sm` or `rounded-sm`                                         | `shadow-2xl`, usually a backdrop blur.  |
| Badges/status chips       | `rounded-full`                                                       | Compact, bordered, semantic colour.     |

Use soft elevation: `shadow-lg` for actions, `shadow-xl` for cards, and `shadow-2xl` for menus/modals. On dark surfaces, a translucent border is as important as a shadow.

## Shared components

Import primitives from `@/components/ui` and use `cn()` from `@/lib/utils` when adding classes.

| Component      | Default behaviour                                                        | Variants / guidance                                                                                                                          |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`       | Inline flex, 11 px height, medium label, keyboard ring, disabled opacity | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `gradient`; sizes `sm`, `default`, `lg`, `icon`. Use `asChild` for links. |
| `Input`        | Full-width, 44 px high, dark inset surface, 16 px horizontal padding     | Label it with `Label`; show an adjacent visible error message and preserve focus styling.                                                    |
| `Card`         | Dark translucent, bordered, blurred, 24 px radius                        | Compose with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.                                                  |
| `Badge`        | Rounded status chip                                                      | Use `default`, `secondary`, `destructive`, `outline`, or `success`; do not use a badge as the only indication of a critical status.          |
| `Checkbox`     | Radix accessible checkbox                                                | Checked state is primary plum; ensure its text label is clickable.                                                                           |
| `CustomSelect` | Searchable once options exceed six; closes on outside click/Escape       | Supports icons, descriptions, badges, clear action, disabled options, and inline errors.                                                     |
| `Skeleton`     | Pulsing dark placeholder with optional shimmer                           | Preserve the intended content geometry; use page, dashboard, form, or table skeleton compositions when suitable.                             |
| `Toaster`      | Sonner with dark theme                                                   | Use concise, actionable messages; success/error intent should be obvious in text.                                                            |

## Interaction and state

- **Hover:** raise contrast gently—`hover:bg-white/5`, lighter plum, a border lift, or a restrained shadow increase.
- **Focus:** all custom controls need a visible ring. Shared primitives use `ring-2`; rich fields use a 1 px plum border/ring. Never remove focus without replacing it.
- **Pressed:** primary buttons commonly use `active:scale-95` or `active:scale-[0.98]`.
- **Disabled:** `pointer-events-none` or `cursor-not-allowed` plus `opacity-50`; retain explanatory text when the reason is non-obvious.
- **Transitions:** `transition-colors` for simple changes; `transition-all` only for small, controlled controls. Most duration values are 150–300 ms.
- **Overlays:** use an opaque black backdrop (`bg-black/80`) and blur for modal focus. Menus/popovers sit at `z-50`.
- **Loading:** use skeletons for content regions, a spinner inside actions, and `aria-busy` on loading containers.

## Patterns

### Forms

Place a `Label` above every control, use a 10–11 px muted error beneath it, and group related fields in responsive grids. Inputs are normally 40–44 px tall. Prefix icons sit inside the field at 14 px; icons must not replace text labels.

### Navigation

Product UI uses a dark header and, where needed, a left sidebar. Navigation items are compact, icon-led, and become `bg-white/5`/white on hover. Current workspace/branch context is displayed in a bordered dark switcher. Marketing navigation is wider, with an outlined sign-in action and plum primary CTA.

### Cards, tables, and empty states

Cards combine a dark surface, `white/10` or slate border, and 16–24 px padding. Tables preserve headers and row rhythm during loading using `TableSkeleton`. Empty states use concise title, supporting copy, and one clear next action; their containers often use `border-dashed border-white/15`.

### Marketing

Marketing may combine black surfaces, plum (#714B67), gold (#FDB02F), gradient fills, decorative patterns, and translucent telemetry cards. Keep the gold accent selective so the primary action remains visually clear. Marketing illustrations must have useful alt text; decorative elements should be hidden from assistive technology.

## Accessibility and quality checklist

- Use native buttons and links for their real actions; do not attach click handlers to non-interactive containers.
- Give icon-only controls an `aria-label` or visible tooltip.
- Keep text contrast legible against dark and translucent backgrounds; `black` is for secondary metadata, not essential instructions.
- Support keyboard focus, Escape dismissal for menus/dialogs, and logical focus movement after opening overlays.
- Include labels, error text, and required indicators for form fields; connect errors using `aria-describedby` when practical.
- Respect responsive layouts and test at narrow mobile and wide desktop widths.
- Prefer existing primitives before adding one-off styling. When a repeated exception emerges, promote it into `components/ui` with variants instead of duplicating class strings.

## Source of truth

The live implementation is the source of truth:

- `frontend/src/index.css` — global tokens, typography, utility classes, and animation keyframes.
- `frontend/src/components/ui/` — reusable primitives.
- `frontend/src/components/landing/` — marketing expression and responsive public-site patterns.
- `frontend/src/components/workspace/` and `frontend/src/surfaces/` — operational/workspace patterns.
