# Automatic PWA updates

- **Date:** 2026-07-16
- **Status:** Approved
- **Scope:** Service-worker update lifecycle and update-notification UI

## Goal

Make every published app build activate silently in the background. Do not show
an update-available message and do not interrupt or reload an active session.
After the user manually reloads the page or fully closes and reopens the app,
the newest activated build must load.

## Design

- Change the generated service worker from prompt-based updates to automatic
  updates through the existing Vite PWA configuration.
- Keep the current page running after a new worker activates. Do not call
  `location.reload()` from update lifecycle code.
- Remove the custom global update flag, update event, and update notification
  helpers from application bootstrap code.
- Remove update state, event subscription, banner markup, dismissal action,
  update-only translations, and update-only styles from the app shell.
- Preserve the existing offline shell, cache allowlist, outdated-cache cleanup,
  and service-worker registration scope.

## Lifecycle

1. A deployed build changes the generated service worker and precache manifest.
2. A user's browser discovers and installs that worker in the background.
3. The worker activates automatically and becomes the controller without
   forcing the open document to reload.
4. The current session continues unchanged.
5. The user's next manual reload or full app reopen requests the shell through
   the newest active worker and loads the newest build.

This intentionally does not promise an update before the browser has performed
its normal service-worker update check. Once the new worker is discovered, no
user confirmation is required.

## Safety and failure behavior

- Never force-reload while an identity is unlocked or decrypted content may be
  visible.
- If service-worker registration or update discovery fails, keep the current
  app usable and retry through the browser's normal registration lifecycle.
- Do not add network telemetry, user-data caching, or new storage.
- Do not change deployment workflows or publish the project as part of this
  work.

## Verification

- Add focused tests proving automatic-update configuration and absence of the
  old prompt lifecycle.
- Remove the obsolete banner release test and any script that exists only to
  run it.
- Confirm unit, type, format, and production-build checks pass.
- Inspect the generated service worker to confirm automatic activation and
  client claiming are present while cache policy remains unchanged.
- Run relevant offline release coverage to ensure existing offline behavior is
  preserved.
