# DESIGN.md — UI/UX guidelines

The design language for **HealthNav**. Tokens live in
[`frontend/src/styles.css`](frontend/src/styles.css) as CSS custom properties —
that file is the source of truth; this doc explains intent and rules.

## Design principle
A calm, clinical-but-friendly mobile app: indigo-violet brand on soft blue-gray
surfaces, white rounded cards with gentle shadows, Lucide line icons, Inter type,
and a **strict semantic color system** where red→green always means urgency —
never decoration.

## Color tokens
**Brand**
| Token | Hex | Use |
| --- | --- | --- |
| `--primary` | `#4f6df5` | Buttons, active tab, links |
| `--primary-dark` | `#3b54d6` | Hover/pressed, chip text |
| `--primary-soft` | `#eef1fe` | Active pill, icon chips, selected chips |
| Brand gradient | `#4f6df5 → #8b5cf6` | Logo, CTAs, avatar, FAB |

**Urgency / status (semantic — carry meaning, do not reuse decoratively)**
| Token | Hex | Meaning |
| --- | --- | --- |
| `--emergency` | `#ef4444` | Call 911 |
| `--urgent` | `#f97316` | Be seen today / "see a doctor soon" |
| `--routine` | `#f59e0b` | See a clinician |
| `--self_care` | `#22c55e` | Manage at home |
| `--accent` | `#f97316` | Pain slider thumb |

**Neutrals**
`--bg-top #f3f6fb → --bg-bottom #eaf0fb` (app bg), `--card #fff`, `--ink #0f172a`,
`--ink-soft #475569`, `--muted #94a3b8`, `--line #eef2f7`.

## Typography
- **Inter** → system fallback (`system-ui, Segoe UI, Roboto`).
- Weights: 800 titles, 700 headings/labels, 600 nav/chips, 400 body.
- Sizes: page title `1.35rem`, card heading `1rem`, body `0.9rem`, caption `0.72–0.85rem`.
- Headings use tight letter-spacing (`-0.01em`).

## Iconography
- **`lucide-react` only** — never mix icon sets. 18–22px, stroke-based, inherits color.
- Canonical: `HeartPulse` (logo), `Home`, `MapPin` (Nearby), `Pill` (Meds),
  `User` (Profile), `Bot` (Health AI), `Stethoscope`, `Phone`, `Siren`, `Bell`,
  `Plus`, `Clock`, `Mic`, `Send`, `Flame` (pain), `Calendar`, `Check`, `ChevronRight`.

## Shape, depth, spacing
- Card radius `--radius: 20px`; pills/chips/badges `999px`; inputs/buttons `12–16px`.
- Shadows: `--shadow` (cards, soft/diffuse), `--shadow-sm` (small elements).
- Desktop "device" frame: 38px radius + large shadow around the 430px shell.

## Layout — the app shell
- Everything renders inside `.shell`: **max-width 430px**, centered, `100dvh`. On
  desktop it floats as a phone (rounded, shadowed) for the "installable app" feel.
- Structure: fixed `.appbar` header → scrollable `.content` → fixed `.tabbar`.
- Bottom tabs: **Home · Nearby · Meds · Profile**. Active = `--primary-soft` pill +
  `--primary`. The symptom checker and chat are routes reached via CTA/FAB, not tabs.
- A floating **`.fab`** (Health AI) sits bottom-right above the tab bar with a hover
  tooltip; hidden on `/chat`.
- Auth screens (`/signup`, `/login`) replace the shell chrome with a centered
  `.auth-card` and the animated `PulseLine` brand visual.

## Component vocabulary (reuse before inventing)
- **Card** — white, 20px radius, soft shadow.
- **Chip** — pill; `.on` = soft-bg + primary border (quick-select, filters).
- **Help tile** — `.help-grid` 2-col action tiles; `.primary/.accent/.danger` variants.
- **Urgency result / badge** — left-border + uppercase badge colored by status.
- **Med card** — circle check (green when taken) + name/dose + time pill.
- **Chat bubbles** — `.assistant` (white, left) vs `.user` (gradient, right);
  `.alert` adds a red left-border for emergencies.
- **Settings row + expander** — tappable profile rows that expand inline forms/info.

## Accessibility & motion
- All animations respect `prefers-reduced-motion` (pulse-line, skeletons, typing).
- Interactive icons get `aria-label`s; tooltips also show on `:focus-visible`.
- Keep text on gradient/colored surfaces at readable contrast (white on brand).

## Rules
1. Don't hardcode hex values in components — use the tokens.
2. Don't repurpose urgency colors for non-urgency UI.
3. New screens live inside the shell and match card/chip/spacing conventions.
4. One icon library (`lucide-react`). One font (Inter). One brand gradient.
