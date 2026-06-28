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
- `prototype/3d/src/combat/hitMath.js` owns keyframe sampling, angle delta, thrust-box, and spin-sweep arc pure math helpers.
- `prototype/3d/src/world/sky.js` and `prototype/3d/src/world/grass.js` own low-risk world rendering pieces.
- `prototype/3d/src/rendering/waterReflection.js` owns the water reflection render pass and restores renderer/water visibility state after the pass.
- `prototype/3d/src/camera.js` owns camera offset, yaw/pitch smoothing, pitch clamp, shake offset, and lookAt updates.
- `prototype/3d/src/loop.js` owns the main frame loop schedule, delta clamp, wolf error isolation, world/camera/HUD/grass/reflection/final-render order, and RAF rescheduling.
- `prototype/3d/src/player/clips.js` owns animation clip data.
- `prototype/3d/src/player/moves.js` owns move/combo timing data.
- `prototype/3d/src/player/state.js` owns player initial state and movement/jump/dodge/charge tuning constants.
- `prototype/3d/src/ui/input.js` owns keyboard, mouse, gamepad, camera-stick, and input-clear state.
- `prototype/3d/src/ui/mapHud.js` owns stamina/status HUD, mini map, world map drawing, and map open/close state.
- `prototype/3d/src/enemies/wolfAi.js` owns wolf patrol/look/chase/border/return/death state, wolf hittable callbacks, and wolf-to-player damage.
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
- `npm run check:player-data`
- `npm run check:player-state`
- `npm run check:hit-math`
- `npm run check:input`
- `npm run check:map-hud`
- `npm run check:camera`
- `npm run check:render-loop`
- `npm run check:game-loop`
- `npm run check:wolf-ai`
- `npm run check:syntax`
- `npm run check:server`
- `npm run check:browser`
- `npm run validate`
- `npm run prepush`

Coverage:

- Asset check scans all `prototype/3d/*.html` files and all `prototype/3d/src/**/*.js` files.
- Asset check rejects external runtime references and missing referenced local files.
- Vendor subset check parses retained `.gltf` files and verifies `.bin` and texture dependency closure.
- Player data check verifies clip keyframe shape and move references to clips and chained moves.
- Player state check verifies player default fields, vector factory use, tuning constants, frozen tuning source, cloned tuning behavior, and main-module integration.
- Hit math check verifies keyframe easing/sampling, injected lerp behavior, angle wrapping, thrust-box boundaries, spin-sweep arc boundaries, and main-module integration.
- Input controller check verifies keyboard, mouse, gamepad, camera-stick, and input-clear behavior with a lightweight fake DOM.
- Map HUD check verifies required DOM ids/canvas drawing sizes, module integration, stamina/status text, mini-map mode toggling, world-map open/close/Escape handling, input clearing, and map redraw cadence with a lightweight fake DOM/canvas.
- Camera controller check verifies camera offset math, yaw/pitch stick consumption, pitch clamp, smoothing, player lookAt target, minimum camera height, and shake offset with lightweight fakes.
- Render loop check verifies water reflection RT sizing, `uRes` sync, reflection camera/clip setup, water mesh hide/restore, render-target/clipping reset order, and cleanup on reflection render errors with lightweight fakes.
- Game loop check verifies frame delta clamping, main/wolf/sky/water/camera/HUD/grass/reflection/render/RAF call order, skipped sky updates, wolf error logging isolation, and elapsed-time usage with lightweight fakes.
- Wolf AI check verifies patrol timing, vision/look/chase transitions, attack cooldown and damage/iframe/death handling, territory border/return behavior, hittable removal, finite knockback, and final hittable position sync with lightweight fakes.
- Syntax check covers runtime source files, validation scripts, and inline scripts in all top-level `prototype/3d/*.html` pages.
- Static server check verifies normal runtime routes, rejects path traversal, rejects directory listing, and rejects unsupported methods.
- Browser smoke opens the primary runtime and all retained tool pages, blocks external requests, fails on page errors and 4xx/5xx responses, requires the primary runtime canvas to render nonblank pixels, and probes mini-map/world-map canvas drawing, map UI interactions, camera wiring, and render-state restoration on `/index.html`.

## Current Verification Evidence

Latest passing gate for the current cleanup/modularization slice:

- `npm run prepush`

Important passing lines from the latest run:

- `Asset check passed (70 runtime assets, 26 source files).`
- `Vendor subset check passed (prototype/3d/assets/vendor).`
- `Player data check passed (37 clips, 24 moves).`
- `Player state check passed.`
- `Hit math check passed.`
- `Input controller check passed.`
- `Map HUD check passed.`
- `Camera controller check passed.`
- `Render loop check passed.`
- `Game loop check passed.`
- `Wolf AI check passed.`
- `Syntax check passed (32 files plus 9 inline scripts).`
- `Static server check passed.`
- Browser smoke passed for `/index.html`, `/editor3d.html`, `/gallery.html`, `/pose-editor.html`, `/sfx-editor.html`, `/bones.html`, `/skeleton-demo.html`, `/quat-demo.html`, and `/角色展示厅.html`.

The final handoff should rerun `npm run prepush` after any document or code changes.

## Multi-Agent Review Notes

- Implementation/behavior review: no blocker. The reviewer confirmed the wolf AI extraction preserves the previous state machine shape and noted only that `prototype/3d/src/enemies/wolfAi.js` must be included in the commit.
- Validation/docs/repository-hygiene review: no blocker and no non-blocker findings. The reviewer confirmed `check:wolf-ai`, server route coverage, docs, and temporary-file state are consistent.
- Game loop implementation review: no blocker and no non-blocker findings. The reviewer confirmed the extracted loop preserves the frame order and keeps wolf error isolation.
- Game loop validation review: one commit-hygiene blocker was raised because `prototype/3d/src/loop.js` and `scripts/check-game-loop.mjs` were still untracked during review; this slice stages both files. The reviewer also requested tighter unit coverage, which was added for sky/camera clamped dt, exact event count, repeated RAF rescheduling, and second-frame elapsed-time use.
- Player state implementation review: no blocker and no non-blocker findings. The reviewer confirmed the extracted player defaults and tuning constants match the old inline values and that `state.js` does not depend on Three.js.
- Player state validation review: one commit-hygiene blocker was raised because `prototype/3d/src/player/state.js` and `scripts/check-player-state.mjs` were still untracked during review; this slice stages both files. The reviewer noted the integration assertions are string-based but acceptable for this lightweight guard.
- Hit math implementation review: no blocker. The reviewer confirmed `sampleTrack`, `angleDelta`, thrust-box math, and spin-sweep arc math preserve the old calculations; the only note was to ensure `prototype/3d/src/combat/hitMath.js` is staged with the slice.
- Hit math validation/repository review: one commit-hygiene blocker was raised because `prototype/3d/src/combat/hitMath.js` and `scripts/check-hit-math.mjs` were still untracked during review; this slice stages both files. Coverage, script order, server route coverage, docs, and repo hygiene had no blocker findings.

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
  - combat side-effect boundaries
  - pose execution boundaries
- Keep each slice covered by `npm run validate` or `npm run prepush`.
- Do not retune movement, combat, dodge, camera, wolf AI, hitstop, shake, or SFX timing unless fixing a confirmed bug.

## Push Policy

Before pushing to `origin/codex/yard-map-asset-test`:

1. Rerun `npm run prepush`.
2. Confirm `git status --short --branch`.
3. Review `git diff --stat origin/codex/yard-map-asset-test..HEAD`.
4. Confirm no `/tmp/iamokdungeon-chrome-*` directories remain.
5. Complete final read-only multi-agent review with no blocker findings.
