---
name: Chat NoControl
description: Calm Apple-inspired local encryption client without Apple mimicry.
colors:
  accent: "#075fad"
  accent-pressed: "#064f91"
  accent-soft: "#e7f2ff"
  canvas: "#f5f7fb"
  surface: "#ffffff"
  text: "#172033"
  muted: "#4f5d73"
  hairline: "#d8deea"
  danger: "#b42318"
  danger-surface: "#fff1f0"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "clamp(2.45rem, 6vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  control: "12px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "12px 14px"
---

# Design System: Chat NoControl

## Overview

**Creative North Star: "The Calm Local Utility"**

Apple-inspired means polished system typography, familiar navigation, controlled depth, precise touch feedback, and excellent mobile ergonomics. It never means copying Apple assets or leaning on glass as decoration. Privacy warnings interrupt the calm only when risk demands it.

Desktop uses a narrow rail and centered workspace. Mobile changes structure into a fixed safe-area bottom bar and one-column task surface. Motion reports state in 180ms; reduced-motion users get immediate changes.

The top bar and floating mobile navigation may use restrained translucent material. A persisted Settings toggle replaces those materials with fully opaque theme surfaces.

**Key Characteristics:**

- Restrained cool-neutral surfaces with one blue action accent.
- Danger red reserved for private recovery and destructive actions.
- Native controls, generous targets, short line lengths, visible status.
- Public PPXC and private PPXR/PPXV use different structure and language.

## Colors

Cool blue provides action and selection. Neutral surfaces carry nearly all area; semantic red appears only for genuine danger.

### Primary

- **Civic Blue:** Primary actions, selection, focus, and public-safe authority.

### Neutral

- **Cool Canvas:** App background and low-emphasis contained output.
- **Clear Surface:** Forms, panels, cards, and dialogs.
- **Ink:** Primary copy and labels.
- **Slate:** Supporting copy that still meets AA contrast.
- **Hairline:** Dividers and secondary-control outlines.

### Secondary

- **Recovery Red:** Private recovery, destructive actions, and safe failure.

**The Selected Accent Rule.** Blue is the default. Settings may choose indigo, purple, teal, pink, orange, or graphite. The selected accent is functional, never decorative. Red, orange, and green remain semantic and are never replaced by the chosen accent.

## Typography

**Display Font:** System UI stack
**Body Font:** System UI stack
**Label/Mono Font:** SFMono-compatible system monospace for PPX payloads only

**Character:** Native, quiet, and readable. One family reduces latency and prevents a cryptography tool from feeling editorial or promotional.

### Hierarchy

- **Display** (700, responsive onboarding only, 0.98): First-use and route orientation.
- **Headline** (700, 2rem to 3.5rem): Flow titles.
- **Title** (700, 1rem to 1.25rem): Panel and card headings.
- **Body** (400, 1rem, 1.55): Instructions and limitations, capped near 65ch.
- **Label** (700, 0.875rem): Controls, status, and compact navigation.

**The Utility Type Rule.** Protocol payloads may be monospace; instructions and controls never are.

## Elevation

Tonal layering is primary. One ambient shadow supports elevated navigation/material panels and dialogs; bordered cards do not also receive wide decorative shadows. Opaque backgrounds remain mandatory when transparency is reduced or unsupported.

### Shadow Vocabulary

- **Ambient material** (`0 8px 24px rgb(46 73 112 / 0.1)`): Floating navigation and genuinely elevated surfaces only.

**The Flat-by-Default Rule.** Forms and content surfaces stay flat until hierarchy requires elevation.

## Components

### Buttons

- **Shape:** Gently curved control (12px), minimum 48px high for primary form actions.
- **Primary:** Civic Blue with white text; pressed blue on hover.
- **Hover / Focus:** 180ms color response, 0.98 active scale, 3px visible focus outline.
- **Secondary / Danger:** Neutral bordered secondary; red text and outline only for destructive action.

### Cards / Containers

- **Corner Style:** 16px panels; 12px inner controls.
- **Background:** Clear Surface or semantic danger surface.
- **Shadow Strategy:** Border or ambient lift, not both as decoration.
- **Internal Padding:** 18px to 38px by task density.

### Inputs / Fields

- **Style:** Full-width native controls, 48px minimum, hairline stroke, 12px radius.
- **Focus:** Global 3px focus outline outside the control.
- **Error / Disabled:** Text plus semantic color; disabled actions remain recognizable and non-interactive.

### Navigation

Desktop uses a sticky 184px rail. Mobile uses fixed bottom navigation with safe-area padding. Active state combines color and surface; no route relies on icons or color alone.

### Public and Private Export Cards

PPXC is neutral/blue and explicitly shareable. PPXR and PPXV use full danger borders, warning copy, a danger marker, and format labels. They must never become visual variants of one generic QR card.

## Do's and Don'ts

### Do:

- **Do** keep primary tasks familiar, one-handed, keyboard-complete, and honest.
- **Do** preserve 12px controls, 16px panels, 44px practical targets, and visible focus.
- **Do** use system assets only; all visual resources remain local.
- **Do** show warning severity in words, structure, and color.

### Don't:

- **Don't** use crypto-hacker aesthetics, neon security theater, or fear-driven copy.
- **Don't** build generic SaaS feature-card grids or decorative dashboards.
- **Don't** imitate official Apple UI, use fake Liquid Glass, or imply Apple endorsement.
- **Don't** place political messaging inside critical workflows.
- **Don't** use gradient text, side-stripe alerts, decorative glass cards, or repeating stripe backgrounds.
