# Real Logo Adoption Design

## Goal

Use the supplied `logo.png` as Chat NoControl's real logo everywhere the current placeholder brand mark or app icon appears. Keep only the blue chat-and-lock artwork on a transparent background. Preserve the supplied blue gradient and original proportions.

## Asset treatment

- Treat repository-root `logo.png` as the visual source, despite its `.png` name containing JPEG data.
- Remove the white surround and dark rounded-square background.
- Retain the complete blue chat bubble, three dots, lock, and keyhole.
- Export optimized transparent PNG assets at the sizes needed by the interface, favicon, and installable web app.
- Do not redraw or recolor the artwork.

## Integration

- Replace the inline placeholder `BrandMark` in the normal and unsupported-runtime headers with the cutout logo.
- Replace the empty browser favicon with the cutout logo.
- Replace `public/icons/app-icon.svg` and its manifest/cache references with generated transparent PNG app icons.
- Keep existing accessible brand text. Treat logo images as decorative where adjacent text already names the app.
- Adapt existing logo sizing CSS only as needed; do not change surrounding layout or unrelated UI.

## Failure handling

- Generated assets remain local static files, so no runtime image processing or network dependency is added.
- If extraction would remove blue edge pixels or leave dark/white halos, tune the extraction mask before integration.

## Verification

- Add or update focused tests for header logo rendering, manifest icon references, and service-worker cache paths.
- Run focused unit tests, production build, and browser checks for normal header, unsupported-runtime header, favicon, and install metadata.
- Inspect the logo on light and dark themes at desktop and mobile sizes for clipping, halos, and legibility.

## Delivery constraint

Make and verify changes locally. Do not push, publish, deploy, or update GitHub unless the user explicitly requests it later.
