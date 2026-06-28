# Cleanup Validation Report - 2026-06-28

## Scope

This report records the cleanup and validation result for branch `codex/yard-map-asset-test`.

Primary runtime target:

- `prototype/3d/index.html`

Retained tool pages:

- `prototype/3d/editor3d.html`
- `prototype/3d/gallery.html`
- `prototype/3d/pose-editor.html`
- `prototype/3d/sfx-editor.html`
- `prototype/3d/bones.html`
- `prototype/3d/skeleton-demo.html`
- `prototype/3d/quat-demo.html`
- `prototype/3d/角色展示厅.html`

## Completed Cleanup

- Removed tracked complete third-party source packs from `assets/packs/vendor/**`.
- Kept the runtime vendor subset under `prototype/3d/assets/vendor/`.
- Added `prototype/3d/assets/vendor/NOTICE.md` with retained vendor source and license notes.
- Updated `assets/packs/README.md` to document that full source packs stay external.
- Deleted zero-byte test files.
- Deleted duplicate `hit_bone_000.ogg`, `hit_bone_001.ogg`, and `hit_bone_002.ogg`.
- Deleted duplicate `prototype/3d/textures/texture_mud.png`.
- Deleted old backup/offline HTML files.
- Deleted the early 2D `prototype/index.html` and its dedicated `prototype/assets/honest_man/` assets.
- Archived old maps to `docs/archive/maps/`; runtime maps now keep `prototype/3d/maps/map15.json`.
- Moved `三连原版备份.txt` to `docs/animation_refs/`.

## Runtime Fixes

- `prototype/3d/src/core/threeLoader.js` now loads only local Three.js and GLTFLoader.
- `prototype/3d/src/core/sfx.js` owns SFX loading and fixes the `swosh-03.ogg` path.
- `prototype/3d/src/core/modelLoader.js` owns GLTF cache/load/place behavior.
- `prototype/3d/src/world/sky.js` and `prototype/3d/src/world/grass.js` own low-risk world rendering pieces.
- `prototype/3d/src/main.js` is reduced from the original giant file and remains the startup/gameplay coordinator.
- Map loading uses local `./maps/map15.json` and validates the HTTP response.
- Wolf runtime state is active instead of leaving a hittable null wolf.
- Player runtime state has `hp`, `hpMax`, and `dead`; death disables gameplay input while rendering/HUD continue.
- Knockback normalization protects zero-distance cases.
- Missing texture/SFX references were replaced with existing local assets or fallbacks.
- Water reflection avoids sampling feedback by hiding the water mesh during reflection rendering.

## Validation Gates

Root scripts:

- `npm run check:assets`
- `npm run check:vendor-subset`
- `npm run check:syntax`
- `npm run check:server`
- `npm run check:browser`
- `npm run validate`
- `npm run prepush`

Coverage:

- Asset check scans all `prototype/3d/*.html` files and all `prototype/3d/src/**/*.js` files.
- Asset check rejects external runtime references and missing referenced local files.
- Vendor subset check parses retained `.gltf` files and verifies `.bin` and texture dependency closure.
- Syntax check covers runtime source files, validation scripts, and inline scripts in all top-level `prototype/3d/*.html` pages.
- Static server check verifies normal runtime routes, rejects path traversal, rejects directory listing, and rejects unsupported methods.
- Browser smoke opens the primary runtime and all retained tool pages, blocks external requests, fails on page errors and 4xx/5xx responses, and requires the primary runtime canvas to render nonblank pixels.

## Current Verification Evidence

Latest known passing gate before this report:

- `npm run prepush`

Important passing lines from the latest run:

- `Asset check passed (60 runtime assets, 16 source files).`
- `Vendor subset check passed (prototype/3d/assets/vendor).`
- `Syntax check passed (13 files plus 9 inline scripts).`
- `Static server check passed.`
- Browser smoke passed for `/index.html`, `/editor3d.html`, `/gallery.html`, `/pose-editor.html`, `/sfx-editor.html`, `/bones.html`, `/skeleton-demo.html`, `/quat-demo.html`, and `/角色展示厅.html`.

The final handoff should rerun `npm run prepush` after any document or code changes.

## Repository Size Notes

Observed local size after cleanup:

- Worktree: about 696 MB
- `prototype/3d`: about 153 MB
- `assets`: about 43 MB
- `docs`: about 1.6 MB
- `.git`: about 500 MB

The large `.git` size is expected while local history still contains removed vendor packs. The working tree no longer tracks `assets/packs/vendor/**`.

## Remaining Non-Blocking Work

- Continue modularizing `prototype/3d/src/main.js` in small behavior-preserving slices:
  - animation clip data
  - move definitions
  - input/controller state
  - HUD/map rendering
  - camera behavior
  - main loop orchestration
- Keep each slice covered by `npm run validate` or `npm run prepush`.
- Do not retune movement, combat, dodge, camera, wolf AI, hitstop, shake, or SFX timing unless fixing a confirmed bug.

## Push Policy

Before pushing to `origin/codex/yard-map-asset-test`:

1. Rerun `npm run prepush`.
2. Confirm `git status --short --branch`.
3. Review `git diff --stat origin/codex/yard-map-asset-test..HEAD`.
4. Confirm no `/tmp/iamokdungeon-chrome-*` directories remain.
5. Complete final read-only multi-agent review with no blocker findings.
