# Real Logo Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the supplied blue chat-and-lock artwork onto transparency and use it everywhere the placeholder brand mark, favicon, and PWA app icon currently appear.

**Architecture:** Keep `logo.png` as the untouched visual source. Use the built-in image editor once to isolate the existing artwork on a removable chroma background, convert that result to a transparent canonical PNG, then derive fixed-size static assets. Render one shared `BrandLogo` component in both app headers and reference the generated assets from the document head, PWA manifest, and service-worker allowlist.

**Tech Stack:** Preact, TypeScript, CSS, Vite/VitePWA, Vitest, built-in image editing, ImageMagick, PNG static assets

---

## File map

- Preserve: `logo.png` — user-supplied source artwork; never overwrite it.
- Create: `public/icons/app-logo-512.png` — canonical transparent logo, header source, and 512px install icon.
- Create: `public/icons/app-logo-192.png` — 192px install icon.
- Create: `public/icons/favicon-32.png` — browser favicon.
- Delete: `public/icons/app-icon.svg` — old placeholder app icon.
- Modify: `src/components/navigation/icons.tsx` — export shared raster `BrandLogo`; retain navigation SVG icons.
- Modify: `src/app/App.tsx` — use `BrandLogo` in normal header.
- Modify: `src/app/unsupported-environment.tsx` — use `BrandLogo` in blocked-runtime header.
- Modify: `src/styles.css` — size the transparent logo without the old colored tile.
- Modify: `index.html` — point favicon metadata at the real logo.
- Modify: `public/manifest.webmanifest` — point install metadata at 192px and 512px PNGs.
- Modify: `vite.config.ts` — include PNGs in Workbox discovery.
- Modify: `src/sw/cache-policy.ts` — allow only the three named logo assets.
- Modify: `src/tests/unit/app-shell.test.tsx` — verify the normal header uses the real logo.
- Modify: `src/tests/unit/runtime-support.test.tsx` — verify the blocked-runtime header uses the real logo.
- Modify: `src/tests/unit/service-worker-cache-policy.test.ts` — verify new logo paths are cached and old path is rejected.
- Preserve: `AGENTS.md` — already blocks GitHub Pages deployment unless explicitly requested.

### Task 1: Produce transparent logo assets

**Files:**
- Preserve: `logo.png`
- Create: `tmp/imagegen/logo-chroma.png`
- Create: `tmp/imagegen/logo-cutout.png`
- Create: `public/icons/app-logo-512.png`
- Create: `public/icons/app-logo-192.png`
- Create: `public/icons/favicon-32.png`

- [ ] **Step 1: Verify derived assets do not exist yet**

Run:

```bash
test ! -e public/icons/app-logo-512.png \
  && test ! -e public/icons/app-logo-192.png \
  && test ! -e public/icons/favicon-32.png
```

Expected: exit 0. If a file exists, inspect it before replacing it; do not overwrite an unrelated user asset.

- [ ] **Step 2: Edit the supplied source onto a flat chroma background**

Use built-in image editing with `logo.png` as the edit target and this exact prompt:

```text
Use case: background-extraction
Asset type: Chat NoControl app logo source for header, favicon, and PWA icons
Primary request: isolate the existing blue chat-bubble, three dots, padlock, and keyhole artwork from the supplied image. Place that exact blue artwork on a perfectly flat solid #ff00ff chroma-key background for later background removal.
Input images: Image 1 is the edit target and authoritative artwork.
Composition/framing: preserve the artwork's current proportions and relative positions; center the full artwork with generous even padding.
Constraints: change only the white surround and dark rounded-square background; preserve the complete blue gradient, chat outline, three dots, lock outline, and keyhole; crisp antialiased edges; no shadow; no text; no watermark.
Avoid: redesigning, redrawing, recoloring, adding elements, removing blue pixels, dark fringe, white fringe, transparency, gradients or texture in the #ff00ff background.
```

Copy the selected built-in output from `$CODEX_HOME/generated_images/...` to `tmp/imagegen/logo-chroma.png`. Do not overwrite `logo.png`.

- [ ] **Step 3: Remove the chroma background**

Run:

```bash
mkdir -p tmp/imagegen public/icons
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input tmp/imagegen/logo-chroma.png \
  --out tmp/imagegen/logo-cutout.png \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

Expected: `tmp/imagegen/logo-cutout.png` is RGBA PNG; corners are transparent; blue artwork is intact; no magenta fringe is visible.

- [ ] **Step 4: Derive canonical, install, and favicon sizes**

Run:

```bash
magick tmp/imagegen/logo-cutout.png \
  -trim +repage -resize 440x440 \
  -gravity center -background none -extent 512x512 \
  public/icons/app-logo-512.png
magick public/icons/app-logo-512.png -resize 192x192 public/icons/app-logo-192.png
magick public/icons/app-logo-512.png -resize 32x32 public/icons/favicon-32.png
```

Expected: three true PNG files with transparent backgrounds and centered, unclipped blue artwork.

- [ ] **Step 5: Validate dimensions, alpha, and visible bounds**

Run:

```bash
identify -format '%f %m %wx%h %[channels]\n' \
  public/icons/app-logo-512.png \
  public/icons/app-logo-192.png \
  public/icons/favicon-32.png
magick public/icons/app-logo-512.png -format 'corner-alpha=%[fx:a.p{0,0}]\n' info:
```

Expected:

```text
app-logo-512.png PNG 512x512 srgba
app-logo-192.png PNG 192x192 srgba
favicon-32.png PNG 32x32 srgba
corner-alpha=0
```

Open `public/icons/app-logo-512.png` at original detail. Confirm only blue artwork remains, all four sides have padding, and no dark, white, or magenta halo is visible. If only a thin magenta fringe remains, repeat Step 3 once with `--edge-contract 1`, then repeat Steps 4–5.

- [ ] **Step 6: Commit source and derived assets locally**

```bash
git add logo.png public/icons/app-logo-512.png public/icons/app-logo-192.png public/icons/favicon-32.png
git commit --only logo.png public/icons/app-logo-512.png public/icons/app-logo-192.png public/icons/favicon-32.png \
  -m "assets: add real Chat NoControl logo"
```

Expected: local commit succeeds. Do not push, deploy, or publish.

### Task 2: Replace header placeholder with shared real logo

**Files:**
- Modify: `src/tests/unit/app-shell.test.tsx`
- Modify: `src/tests/unit/runtime-support.test.tsx`
- Modify: `src/components/navigation/icons.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/unsupported-environment.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing normal-header logo test**

Add to `src/tests/unit/app-shell.test.tsx` inside `describe("app shell", ...)`:

```tsx
it("uses the real logo in the app header", () => {
  const { container } = render(<App />);
  const logo = container.querySelector<HTMLImageElement>("img.brand-logo");

  expect(logo?.getAttribute("src")).toBe("./icons/app-logo-512.png");
  expect(logo?.getAttribute("alt")).toBe("");
});
```

- [ ] **Step 2: Write failing blocked-runtime logo assertion**

In the existing `"blocks the app before identity creation on insecure HTTP"` test in `src/tests/unit/runtime-support.test.tsx`, capture the render container and assert the shared logo:

```tsx
const { container } = render(
  <AppRoot
    locale="en"
    runtimeSupport={{ supported: false, reason: "insecure-context" }}
  />,
);

const logo = container.querySelector<HTMLImageElement>("img.brand-logo");
expect(logo?.getAttribute("src")).toBe("./icons/app-logo-512.png");
expect(logo?.getAttribute("alt")).toBe("");
```

Replace only the existing `render(...)` statement in that test; keep its existing runtime-blocking assertions.

- [ ] **Step 3: Run focused tests to verify failure**

Run:

```bash
npx vitest run src/tests/unit/app-shell.test.tsx src/tests/unit/runtime-support.test.tsx
```

Expected: FAIL because `img.brand-logo` does not exist.

- [ ] **Step 4: Replace `BrandMark` with `BrandLogo`**

In `src/components/navigation/icons.tsx`, replace the entire `BrandMark` function with:

```tsx
export function BrandLogo() {
  return (
    <img
      class="brand-logo"
      src="./icons/app-logo-512.png"
      alt=""
      width="36"
      height="36"
    />
  );
}
```

In `src/app/App.tsx`, change the import and usage:

```tsx
import { BrandLogo, NavigationIcon } from "../components/navigation/icons";
```

```tsx
<span class="brand-mark" aria-hidden="true">
  <BrandLogo />
</span>
```

In `src/app/unsupported-environment.tsx`, make the same `BrandLogo` import and usage change.

- [ ] **Step 5: Remove placeholder-tile styling**

Replace the current `.brand-mark`, `.brand-mark svg`, and `.brand-mark circle` blocks in `src/styles.css` with:

```css
.brand-mark {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
}

.brand-logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Remove `.brand-mark` from both grouped dark-theme selectors so they become:

```css
:root[data-theme="dark"] .button.primary {
  color: var(--accent-ink);
}
```

```css
:root[data-theme="system"] .button.primary {
  color: var(--accent-ink);
}
```

Keep the existing `@media (max-width: 400px)` `.brand-mark` size override; `.brand-logo` inherits its 34px square through `width: 100%` and `height: 100%`.

- [ ] **Step 6: Run focused tests to verify pass**

Run:

```bash
npx vitest run src/tests/unit/app-shell.test.tsx src/tests/unit/runtime-support.test.tsx
```

Expected: both test files PASS.

- [ ] **Step 7: Commit header integration locally**

```bash
git add src/tests/unit/app-shell.test.tsx src/tests/unit/runtime-support.test.tsx \
  src/components/navigation/icons.tsx src/app/App.tsx \
  src/app/unsupported-environment.tsx src/styles.css
git commit --only src/tests/unit/app-shell.test.tsx src/tests/unit/runtime-support.test.tsx \
  src/components/navigation/icons.tsx src/app/App.tsx \
  src/app/unsupported-environment.tsx src/styles.css \
  -m "feat: use real logo in app headers"
```

Expected: local commit succeeds without including unrelated staged files. Do not push.

### Task 3: Replace favicon, PWA icon, and cache references

**Files:**
- Modify: `src/tests/unit/service-worker-cache-policy.test.ts`
- Modify: `src/sw/cache-policy.ts`
- Modify: `index.html`
- Modify: `public/manifest.webmanifest`
- Modify: `vite.config.ts`
- Delete: `public/icons/app-icon.svg`

- [ ] **Step 1: Update cache-policy test first**

Replace the allowed icon entry in `src/tests/unit/service-worker-cache-policy.test.ts` with all real logo assets:

```ts
"icons/app-logo-512.png",
"icons/app-logo-192.png",
"icons/favicon-32.png",
```

Add the old path to the denied cases:

```ts
"icons/app-icon.svg",
```

- [ ] **Step 2: Run cache-policy test to verify failure**

Run:

```bash
npx vitest run src/tests/unit/service-worker-cache-policy.test.ts
```

Expected: FAIL because new PNG paths are not allowlisted and old SVG path remains allowed.

- [ ] **Step 3: Update document and PWA metadata**

Replace the empty favicon in `index.html`:

```html
<link rel="icon" type="image/png" sizes="32x32" href="./icons/favicon-32.png" />
```

Replace `icons` in `public/manifest.webmanifest` with:

```json
"icons": [
  {
    "src": "./icons/app-logo-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "./icons/app-logo-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any"
  }
]
```

Use `purpose: "any"`, not `maskable`, because the user requires a transparent blue-only logo and maskable icons require an opaque safe-zone background.

- [ ] **Step 4: Update cache discovery and allowlist**

In `vite.config.ts`, change the Workbox glob to:

```ts
globPatterns: ["**/*.{html,js,css,png,svg,webmanifest}"],
```

Replace `EXPLICIT_SHELL_PATHS` in `src/sw/cache-policy.ts` with:

```ts
const EXPLICIT_SHELL_PATHS = new Set([
  "index.html",
  "manifest.webmanifest",
  "icons/app-logo-512.png",
  "icons/app-logo-192.png",
  "icons/favicon-32.png",
]);
```

Delete `public/icons/app-icon.svg`.

- [ ] **Step 5: Run cache-policy test to verify pass**

Run:

```bash
npx vitest run src/tests/unit/service-worker-cache-policy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Build and inspect emitted metadata**

Run:

```bash
npm run build
rg -n "app-logo|favicon-32|app-icon" dist/index.html dist/manifest.webmanifest
find dist/icons -maxdepth 1 -type f -printf '%f\n' | sort
```

Expected:

- `npm run build` exits 0.
- `dist/index.html` references `favicon-32.png`.
- `dist/manifest.webmanifest` references `app-logo-192.png` and `app-logo-512.png`.
- No emitted file or metadata reference contains `app-icon.svg`.
- `dist/icons` contains the three PNG assets.

- [ ] **Step 7: Commit metadata and cache integration locally**

```bash
git add index.html public/manifest.webmanifest vite.config.ts \
  src/sw/cache-policy.ts src/tests/unit/service-worker-cache-policy.test.ts \
  public/icons/app-icon.svg
git commit --only index.html public/manifest.webmanifest vite.config.ts \
  src/sw/cache-policy.ts src/tests/unit/service-worker-cache-policy.test.ts \
  public/icons/app-icon.svg \
  -m "feat: use real logo for app metadata"
```

Expected: local commit succeeds. Do not push, deploy, or publish.

### Task 4: Verify app behavior and visual integration

**Files:**
- Verify: all files changed in Tasks 1–3
- Verify: `AGENTS.md`

- [ ] **Step 1: Run static and focused regression checks**

Run:

```bash
npm run typecheck
npx vitest run \
  src/tests/unit/app-shell.test.tsx \
  src/tests/unit/runtime-support.test.tsx \
  src/tests/unit/service-worker-cache-policy.test.ts
npm run build
git diff --check HEAD~3..HEAD
```

Expected: every command exits 0; focused tests pass; production build succeeds; no whitespace errors.

- [ ] **Step 2: Verify normal header in a real browser**

Start the local dev server without publishing:

```bash
npm run dev
```

Open the reported local URL in the browser. Check normal app header at desktop width and 390px mobile width in both light and dark themes.

Expected:

- Only blue chat-and-lock artwork appears beside/above the accessible `Chat NoControl` brand text.
- No old white chat SVG, accent tile, dark square, white surround, or colored halo remains.
- Logo remains square, centered, sharp, and unclipped at 36px desktop and 34px narrow mobile.

- [ ] **Step 3: Verify blocked-runtime header**

Open the production preview through an insecure non-localhost HTTP origin, or render the existing `AppRoot` blocked-runtime fixture in a browser-capable test harness.

Expected: blocked-runtime header shows the same real blue-only logo; secure-context warning behavior remains unchanged.

- [ ] **Step 4: Verify favicon and install metadata**

In browser developer tools, inspect the document head and fetched manifest.

Expected:

- Browser requests `./icons/favicon-32.png` successfully.
- Manifest requests both PNG install icons successfully.
- No request for `app-icon.svg` occurs.
- No network request leaves the local app origin.

- [ ] **Step 5: Confirm deployment guard and repository scope**

Run:

```bash
rg -n "Never publish or deploy this project to GitHub Pages" AGENTS.md
git status --short
```

Expected: deployment rule is present. Review status carefully; logo work is local. Do not run `git push`, GitHub Pages workflow dispatch, deployment scripts, or any publish command.
