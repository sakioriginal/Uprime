# Universe Engine v5.48.0 — Consolidated Full Release

This package keeps the **full source tree** and consolidates the accumulated per-version README files so the GitHub repository remains easier to upload and maintain. No `src/` source files were removed for this documentation cleanup.

## Current application baseline

The runtime code is based on v5.47.0, including:

- iPhone/touch mobile controls and landscape-orientation handling
- persistent left/right stick controls on touch devices
- collapsible Console UI
- coordinate HUD default OFF
- realtime multiplayer Relay / QR invite / Render deployment support

## Documentation history

Previous per-version README files are preserved in consolidated history files:

- `CHANGELOG_v5.10-v5.19.md`
- `CHANGELOG_v5.20-v5.29.md`
- `CHANGELOG_v5.30-v5.39.md`
- `CHANGELOG_v5.40-v5.47.md`

The historical text is retained inside those files, while the many individual `README_v*.md` files have been removed to reduce repository file count.

## GitHub upload policy

Keep the published folder name fixed if desired (for example `Universe_Engine_v5.43.0/`) and replace its contents with the latest **complete release**, rather than applying incremental patch packages. This keeps the GitHub Pages URL and Render repository paths stable.

Because `src/` currently contains about 91 files, a practical GitHub web-upload workflow is:

1. Upload/replace the complete `src/` folder as one batch.
2. Upload/replace the root files plus `server/` and `.github/` as a second batch.

This avoids relying on a chain of differential updates while staying below a 100-file-per-upload workflow.

## Multiplayer Relay

The Render Relay remains under `server/`. The default production Relay configuration from the prior release is preserved.

## Versioning note

`v5.48.0` is primarily a repository/documentation consolidation release. Runtime behavior remains based on the v5.47.0 application code unless otherwise noted in later releases.
