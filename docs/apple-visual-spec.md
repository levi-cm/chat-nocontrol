# Chat NoControl Apple-Inspired Visual Specification

> **Authority:** Chat NoControl documentation authority; this file normatively defines the user-approved visual direction for Chat NoControl v1.
> **Status:** User-approved direction, 2026-07-12
> **Boundary:** Apple-inspired web design. This is not Apple UI, an Apple-endorsed design, or official Liquid Glass.

## Design read

Chat NoControl is a task-focused privacy product for everyday mobile and desktop users. The interface uses an Apple-like calm, direct, polished language without security theater.

Design dials:

- Design variance: 6
- Motion intensity: 4
- Visual density: 4

## System

- Native CSS and semantic Preact components.
- System font stack only: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, sans-serif.
- System light and dark modes through semantic CSS variables.
- No remote fonts, images, scripts, tracking, analytics, or decorative downloads.
- Frosted material is a labeled web approximation using transparency and `backdrop-filter`; opaque fallbacks are mandatory.
- A Settings toggle disables all translucent material and blur, replacing it with opaque theme surfaces.

## Palette

The default product accent is accessible cool blue. Settings may select blue, indigo, purple, teal, pink, orange, or graphite. Red, orange, and green remain reserved for semantic danger, passphrase caution, and success when they communicate status rather than the selected accent.

Light:

- Canvas: `#f5f7fb`
- Surface: `#ffffff`
- Elevated material: `rgb(255 255 255 / 0.78)`
- Primary text: `#172033`
- Secondary text: `#4f5d73`
- Hairline: `#d8deea`
- Accent: `#075fad`
- Accent pressed: `#064f91`
- Danger: `#b42318`
- Danger surface: `#fff1f0`
- Success: `#137a48`

The selected accent changes primary actions, focus, and selection only. It does not recolor warnings or passphrase-strength bands.

Dark:

- Canvas: `#0e1118`
- Surface: `#171b24`
- Elevated material: `rgb(30 35 47 / 0.82)`
- Primary text: `#f3f6fb`
- Secondary text: `#b6c0d0`
- Hairline: `#353d4d`
- Accent: `#78b8ff`
- Accent pressed: `#9acaff`
- Danger: `#ff8d86`
- Danger surface: `#341d20`
- Success: `#68d59a`

## Shape and depth

- Panels: 16px radius.
- Inputs: 12px radius.
- Buttons: full pill only for compact actions; 12px for form actions.
- One subtle, tinted shadow layer on elevated material. Never combine a wide decorative shadow with a bordered card.
- Desktop navigation rail and mobile bottom navigation may use frosted material because they float above changing content.

## Layout

- Desktop: narrow left rail plus centered work area, maximum content width 1120px.
- Mobile: single column plus fixed bottom navigation with safe-area padding.
- Forms keep labels above fields and errors below.
- Public-contact and private-recovery content use different structure, labels, icons, and semantic colors.
- Minimum practical touch target: 44x44 CSS pixels.

## Motion

- 180-240ms state transitions using transform and opacity only.
- Motion communicates focus, navigation state, disclosure, or completion.
- No page-load choreography, parallax, cursor effects, or infinite decorative loops.
- `prefers-reduced-motion: reduce` makes state changes immediate.

## Accessibility and pre-flight

- WCAG 2.2 AA target, visible focus, complete keyboard operation, 200% zoom/reflow.
- Status never depends on color alone.
- English and German preserve warning severity.
- No em dashes in visible UI copy.
- No fake screenshots, remote assets, generic feature-card grids, gradient text, or security-themed neon effects.
