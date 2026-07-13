---
name: Mizan
description: Calm, precise Arabic-first finance and project operations.
colors:
  canvas: "#f7f8fc"
  surface: "#ffffff"
  surface-subtle: "#eff1f8"
  surface-strong: "#e5e8f3"
  ink: "#171827"
  muted: "#64677b"
  soft: "#9699aa"
  border: "#191c3614"
  border-strong: "#191c3624"
  balance-indigo: "#4b52c7"
  balance-indigo-hover: "#3f46b6"
  balance-indigo-soft: "#eeefff"
  balance-indigo-ink: "#31388f"
  success: "#0b7659"
  success-soft: "#eaf8f3"
  warning: "#9b5d00"
  warning-soft: "#fff6df"
  danger: "#c54250"
  danger-soft: "#fff0f1"
  info: "#287ab2"
  info-soft: "#ecf6fc"
  dark-canvas: "#10111a"
  dark-surface: "#181a26"
  dark-surface-raised: "#202230"
  dark-ink: "#f5f6fb"
  dark-muted: "#b1b4c4"
  dark-balance-indigo: "#8f95ff"
  dark-primary-on: "#151733"
typography:
  display:
    fontFamily: "Noto Sans Arabic Variable, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Noto Sans Arabic Variable, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Noto Sans Arabic Variable, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans Arabic Variable, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans Arabic Variable, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  round: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.balance-indigo}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.balance-indigo-hover}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  navigation-active:
    backgroundColor: "{colors.balance-indigo-soft}"
    textColor: "{colors.balance-indigo-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Mizan

## Overview

**Creative North Star: "The Trusted Ledger"**

Mizan should feel like a trusted ledger translated into a modern Arabic product: ordered, exact, and calm enough to use when money is stressful. Information density is comfortable rather than sparse; hierarchy comes from type, spacing, and semantic color, not decoration. Users should immediately understand what is current, what changed, and what action is safe.

The visual system is restrained and confident. It explicitly rejects decorative or flashy fintech, noisy dashboards, casino-like gamification, generic AI SaaS styling, excessive gradients or glass effects, and over-rounded components. Motion confirms state changes and never delays the task.

**Key Characteristics:**
- Arabic-first RTL composition with isolated LTR tabular numerals.
- Cool neutral surfaces with one scarce, recognizable indigo accent.
- Layered depth through tonal surfaces, fine borders, and selective elevation.
- Clear semantic states that pair color with text or icon meaning.
- Mobile-first controls with consistent touch targets and visible focus.

## Colors

The palette combines cool, quiet neutrals with **Balance Indigo** as the single product accent; semantic colors communicate outcomes rather than decorate sections.

### Primary
- **Balance Indigo** (`#4b52c7`): primary actions, active navigation, focus, and the most important data emphasis only.
- **Deep Balance Indigo** (`#3f46b6`): hover and pressed emphasis.
- **Mist Indigo** (`#eeefff`): selected or informative backgrounds that need no elevation.

### Secondary
- **Measured Green** (`#0b7659`): verified positive outcomes, settled balances, and successful actions.
- **Caution Amber** (`#9b5d00`): pending, approaching, or attention-required states.
- **Ledger Red** (`#c54250`): destructive actions, blocking errors, and real negative outcomes.
- **Reference Blue** (`#287ab2`): neutral information that is neither success nor warning.

### Neutral
- **Quiet Canvas** (`#f7f8fc`): application background.
- **Ledger Surface** (`#ffffff`): primary reading and input surface.
- **Soft Layer** (`#eff1f8`): grouped controls, inactive regions, and skeletons.
- **Ledger Ink** (`#171827`): primary text and financial values.
- **Muted Ink** (`#64677b`): supporting text that must remain readable.
- **Night Ledger** (`#10111a`): dark-mode canvas with semantic roles remapped, not inverted mechanically.

### Named Rules

**The One Accent Rule.** Balance Indigo occupies no more than the actions, current selection, focus, and one dominant insight on a screen.

**The Evidence Rule.** Green is reserved for verified positive meaning; never color a projection or motivational message green unless the underlying data supports it.

## Typography

**Display Font:** Noto Sans Arabic Variable (with Noto Sans Arabic, Tahoma, sans-serif fallbacks)  
**Body Font:** Noto Sans Arabic Variable (with Noto Sans Arabic, Tahoma, sans-serif fallbacks)  
**Label/Mono Font:** The same family; numeric values use tabular figures, LTR direction, and Unicode isolation.

**Character:** One highly legible Arabic family keeps the product familiar and operational. Weight and spacing establish hierarchy without introducing a decorative display voice.

### Hierarchy
- **Display** (700, 32px, 1.25): authentication and rare product-level titles only.
- **Headline** (700, 28px, 1.3): top-level page titles.
- **Title** (700, 20px, 1.4): section titles and decisive card labels.
- **Body** (400, 16px, 1.5): instructions, descriptions, and empty-state guidance; prose remains under 70 characters where practical.
- **Label** (700, 14px, 1.4): controls, navigation, compact metrics, and form labels.

### Named Rules

**The Numeric Isolation Rule.** Money, rates, dates, and identifiers remain directionally isolated and use tabular figures; never rely on surrounding RTL text to order digits.

## Elevation

Mizan uses quiet layers: tonal surface changes establish most grouping, fine borders define interactive boundaries, and shadows are reserved for raised or floating surfaces. A screen should remain understandable if every shadow is removed.

### Shadow Vocabulary
- **Card Ambient** (`0 1px 2px rgb(27 30 60 / 3%), 0 12px 36px rgb(27 30 60 / 5%)`): only for a genuinely elevated primary card.
- **Floating Action** (`0 14px 40px rgb(27 30 60 / 14%)`): menus, transient panels, and high-priority floating controls.
- **Navigation Separation** (`0 -8px 32px rgb(27 30 60 / 6%)`): mobile bottom navigation only.

### Named Rules

**The Layer Before Shadow Rule.** Change the surface tone or use a fine border before adding elevation. Never stack a wide decorative shadow with a heavy border.

## Components

Components are restrained and confident: familiar controls, consistent geometry, explicit states, and no ornamental interaction.

### Buttons
- **Shape:** gently compact corners (12px), a minimum 44px touch height, and stable widths during loading.
- **Primary:** Balance Indigo with high-contrast text and 12px by 20px padding.
- **Hover / Focus:** deepen the surface on hover; use the global 3px focus outline with a 3px offset; active feedback may scale to 0.98 for 150ms.
- **Secondary / Ghost:** neutral surfaces or transparent backgrounds with strong readable ink; destructive actions use semantic red only when the action is destructive.

### Chips
- **Style:** soft semantic background, readable semantic ink, compact 8px corners, and a text label.
- **State:** selected chips combine background and icon or weight; color alone is forbidden.

### Cards / Containers
- **Corner Style:** 16px by default; 20px is reserved for major summary surfaces.
- **Background:** Ledger Surface for reading, Soft Layer for grouping.
- **Shadow Strategy:** flat by default; Card Ambient only when hierarchy requires it.
- **Border:** a single fine neutral border; no colored side stripes.
- **Internal Padding:** 16px on mobile and 20–24px on larger summary surfaces.

### Inputs / Fields
- **Style:** Ledger Surface, a fine neutral border, 12px corners, and at least a 44px control height.
- **Focus:** Balance Indigo outline and a stronger border without layout shift.
- **Error / Disabled:** errors keep helper text visible and use red plus text; disabled states reduce emphasis but remain readable.

### Navigation
- Bottom navigation is the mobile primary path with five stable destinations, icon-plus-label targets, safe-area padding, and a clearly tinted active state. Supervisor navigation uses the same accent and focus vocabulary at a wider density.

### Financial Insight
- Every insight presents a clear label, value, time range, and explanation or confidence signal. Projections are visibly distinct from actuals, and unavailable values render as “insufficient data” rather than zero.

## Do's and Don'ts

### Do:
- **Do** derive all visual roles from `src/styles/tokens.css` and keep light and dark themes semantically equivalent.
- **Do** make the primary action and current state obvious while progressively revealing advanced detail.
- **Do** pair every loading, empty, error, and success state with a useful next action.
- **Do** keep Arabic copy concise and isolate numeric content with tabular LTR formatting.
- **Do** use real transaction evidence and explain confidence for every financial rate or projection.

### Don't:
- **Don't** introduce decorative or flashy fintech, noisy dashboards, or casino-like gamification.
- **Don't** use generic AI SaaS styling, excessive gradients or glass effects, or over-rounded components.
- **Don't** invent financial certainty, ship fake data, or celebrate unsupported progress.
- **Don't** use thick colored side-stripe borders, gradient text, nested cards, or identical decorative card grids.
- **Don't** hardcode new colors, radii, shadows, or dark-mode exceptions inside feature components.
