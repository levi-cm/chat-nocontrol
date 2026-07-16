<!-- markdownlint-disable MD013 -->

# Automatic PWA Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the update prompt and silently activate each discovered service-worker update so the newest build loads on the user's next manual reload or app reopen.

**Architecture:** Keep the existing custom service-worker registration and Workbox shell cache. Configure the generated worker explicitly with unconditional `skipWaiting()` and `clientsClaim()` because `injectRegister: false` prevents `vite-plugin-pwa` from adding those flags from `registerType` alone. Enforce that lifecycle in the production-artifact gate, then delete the obsolete app-level update event and banner.

**Tech Stack:** Preact, TypeScript, Vite 8, vite-plugin-pwa 1.3, Workbox 7.4, Vitest, Playwright

---

## File map

- `vite.config.ts`: declares automatic worker activation and client claiming.
- `scripts/production-artifacts.ts`: rejects workers that wait for approval or fail to claim clients.
- `src/tests/unit/production-artifacts.test.ts`: test-drives the generated-worker policy gate.
- `src/app/bootstrap.ts`: retains registration and removes update-notification globals/events.
- `src/app/App.tsx`: removes update state, subscription, and banner UI.
- `src/i18n/index.ts`: removes banner-only EN/DE messages.
- `src/styles.css`: removes banner-only styles while preserving offline UI.
- `src/tests/release/update-banner.spec.ts`: obsolete prompt behavior; delete it.
- `package.json`: replaces the banner check with the generated-worker policy check.
- `docs/testing-and-release.md`, `docs/implementation-plan.md`, `WebLibre_full_plan.md`: align docs with silent next-navigation updates.

### Task 1: Test-drive the worker policy

**Files:**

- Modify: `src/tests/unit/production-artifacts.test.ts`
- Modify: `scripts/production-artifacts.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Write failing policy tests**

Change the fixture worker to the required policy:

```ts
await writeFile(
  join(root, "sw.js"),
  "self.skipWaiting();workbox.clientsClaim();workbox.precacheAndRoute([]);",
);
```

Add:

```ts
it("rejects an approval-based service-worker update", async () => {
  const root = await fixture();
  await writeFile(
    join(root, "sw.js"),
    "self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });",
  );
  expect(inspectProductionArtifacts(root)).toEqual([
    "service worker does not claim clients automatically",
    "service worker waits for update approval",
  ]);
});

it("rejects a service worker that does not activate immediately", async () => {
  const root = await fixture();
  await writeFile(join(root, "sw.js"), "workbox.clientsClaim();");
  expect(inspectProductionArtifacts(root)).toEqual([
    "service worker does not activate updates automatically",
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run src/tests/unit/production-artifacts.test.ts
```

Expected: FAIL because the inspector does not report update-policy violations.

- [ ] **Step 3: Implement the artifact gate**

After the existing shell-file check in `inspectProductionArtifacts()`, add:

```ts
const serviceWorkerPath = resolve(absoluteRoot, "sw.js");
if (existsSync(serviceWorkerPath)) {
  const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
  if (!/\bself\.skipWaiting\(\)/u.test(serviceWorker))
    issues.push("service worker does not activate updates automatically");
  if (!/\.clientsClaim\(\)/u.test(serviceWorker))
    issues.push("service worker does not claim clients automatically");
  if (/SKIP_WAITING/u.test(serviceWorker))
    issues.push("service worker waits for update approval");
}
```

Keep the final `issues.sort()`.

- [ ] **Step 4: Verify GREEN, then prove old build fails**

Run:

```bash
npx vitest run src/tests/unit/production-artifacts.test.ts
npm run build
```

Expected: 5 unit tests pass; build fails because current `sw.js` waits for `SKIP_WAITING` and does not claim clients.

- [ ] **Step 5: Configure automatic activation**

Set these exact Vite PWA options while retaining current cache rules:

```ts
injectRegister: false,
registerType: "autoUpdate",
manifest: false,
workbox: {
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  globPatterns: ["**/*.{html,js,css,svg,png,webmanifest}"],
  manifestTransforms: [
    (entries) =>
      Promise.resolve({
        manifest: entries.filter((entry) =>
          isAllowedShellCachePath(entry.url),
        ),
        warnings: [],
      }),
  ],
  navigateFallback: "index.html",
  sourcemap: false,
},
```

Explicit flags matter: the plugin derives them from `registerType` only when registration injection is automatic; this app uses custom registration.

- [ ] **Step 6: Verify generated output**

Run:

```bash
npm run build
rg -o "skipWaiting|clientsClaim|SKIP_WAITING" dist/sw.js | sort | uniq -c
```

Expected: build passes; one `skipWaiting`, one `clientsClaim`, no `SKIP_WAITING`.

### Task 2: Remove the update prompt

**Files:**

- Modify: `src/app/bootstrap.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Delete: `src/tests/release/update-banner.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Simplify registration**

Delete `UPDATE_FLAG`, `UpdateWindow`, `isUpdateAvailable()`, `notifyUpdateAvailable()`, and `dismissUpdateAvailable()` from `bootstrap.ts`. Replace the registration internals with:

```ts
await navigator.serviceWorker.register(scriptUrl, { scope: "./" });
return true;
```

Keep unsupported-browser and caught-failure behavior.

- [ ] **Step 2: Remove prompt UI**

In `App.tsx`, remove the two bootstrap imports, `updateAvailable` state, `ppx-update-available` effect, and update-banner JSX. Keep `banner-stack` for offline/storage notices.

Delete `newerVersion` and `reviewLater` from both locale objects. Change the shared CSS rule to `.offline-banner` only, then delete `.update-banner` and `.update-banner button` rules.

- [ ] **Step 3: Replace the release command**

Delete `src/tests/release/update-banner.spec.ts`. In `package.json`, replace:

```json
"test:update-banner": "playwright test src/tests/release/update-banner.spec.ts"
```

with:

```json
"test:pwa-update-policy": "npm run build"
```

Remove `npm run test:update-banner` from `verify:quality`; replace its final `npm run build` with `npm run test:pwa-update-policy`, preserving one build.

- [ ] **Step 4: Verify prompt removal**

Run:

```bash
npx vitest run src/tests/unit/production-artifacts.test.ts src/tests/unit/i18n.test.ts
npm run typecheck
npm run lint
npx prettier --check vite.config.ts scripts/production-artifacts.ts src/tests/unit/production-artifacts.test.ts src/app/bootstrap.ts src/app/App.tsx src/i18n/index.ts src/styles.css package.json
rg -n "ppx-update-available|PPX_UPDATE_AVAILABLE|update-banner|newerVersion|reviewLater|test:update-banner" src package.json
```

Expected: checks pass; search returns no matches.

- [ ] **Step 5: Commit implementation**

```bash
git add vite.config.ts scripts/production-artifacts.ts \
  src/tests/unit/production-artifacts.test.ts src/app/bootstrap.ts \
  src/app/App.tsx src/i18n/index.ts src/styles.css package.json \
  src/tests/release/update-banner.spec.ts
git commit -m "fix: activate PWA updates silently"
```

### Task 3: Align docs and verify the product

**Files:**

- Modify: `docs/testing-and-release.md`
- Modify: `docs/implementation-plan.md`
- Modify: `WebLibre_full_plan.md`

- [ ] **Step 1: Update current requirements**

In `docs/testing-and-release.md`, replace `test:update-banner` with `test:pwa-update-policy`, rename the matrix row to `PWA update policy`, and use:

```text
New workers activate silently; the current document is not force-reloaded.
```

In `docs/implementation-plan.md`, replace update-banner test/script references and prompt acceptance text with:

```text
The generated worker must call skipWaiting() and clientsClaim() without waiting for user approval. The app must not force-reload an open document; the newest active worker serves the next manual reload or app reopen.
```

In `WebLibre_full_plan.md`, replace both prompt requirements with the same silent-activation/no-forced-reload rule.

- [ ] **Step 2: Verify docs**

Run:

```bash
npm run docs:check
npx prettier --check docs/testing-and-release.md docs/implementation-plan.md WebLibre_full_plan.md
git diff --check
rg -n "test:update-banner|update-banner.spec|new-version prompt|update prompt" docs WebLibre_full_plan.md package.json src
```

Expected: checks pass; no live prompt requirement remains outside historical design/plan artifacts.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm run test:pwa-update-policy
npm run test:offline -- --project=desktop-chromium
npm run test:network-denial -- --project=desktop-chromium
npm run typecheck
npm run lint
git diff --check
```

Expected: generated-worker gate, desktop offline/network-denial coverage, typecheck, lint, and whitespace checks pass. `dist/sw.js` contains unconditional `skipWaiting()` and `clientsClaim()` and no `SKIP_WAITING` listener.

- [ ] **Step 4: Commit docs and inspect scope**

```bash
git add docs/testing-and-release.md docs/implementation-plan.md WebLibre_full_plan.md
git commit -m "docs: document silent PWA updates"
git status --short
git log -4 --oneline --decorate
```

Expected: only pre-existing unrelated untracked files remain; implementation and docs commits are visible.
