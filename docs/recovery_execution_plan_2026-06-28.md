# Recovery Execution Plan - 2026-06-28

## Current Verified State

- Active branch: `codex/yard-map-asset-test`.
- Remote HEAD: `1a121d3` (`草地简化：只保留5种连片草`).
- The previous local worktree at `/tmp/iamokdungeon-review` was deleted before it was pushed. The previously reported local HEAD `07d7aac` and 21 ahead commits are not present in any currently visible local git object store.
- This worktree was recloned from `origin/codex/yard-map-asset-test` on 2026-06-28.
- Current remote state still has the original large runtime file and duplicate vendor source packs:
  - `prototype/3d/src/main.js`: 3174 lines, about 183 KB.
  - `assets/packs/vendor/`: about 907 MB.
  - `prototype/3d/assets/vendor/`: about 115 MB retained runtime subset.
  - No root `package.json` validation scripts are present.

## Goal

Produce a clean, readable, runnable prototype while preserving existing gameplay behavior. The final branch must be validated locally, reviewed by multiple focused subagents, committed in logical slices, and pushed only after strict verification passes.

## Non-Negotiable Constraints

- Do not tune gameplay constants or change the accepted feel of movement, attacks, dodge, camera, wolf behavior, hitstop, shake, or SFX timing unless fixing an explicit runtime bug.
- Preserve the primary playable entry: `prototype/3d/index.html`.
- Keep core tool pages in `prototype/3d/` unless a migration is explicitly tested:
  - `editor3d.html`
  - `gallery.html`
  - `pose-editor.html`
  - `sfx-editor.html`
  - `bones.html`
  - `skeleton-demo.html`
  - `quat-demo.html`
- Asset policy: keep the runtime subset in `prototype/3d/assets/vendor`, remove complete source packs from `assets/packs/vendor`, and document source/license provenance.
- Use `/tmp` for transient browser profiles and smoke artifacts, and clean old artifacts during long runs to avoid filling the root filesystem.

## Implementation Slices

### Slice 1: Baseline Validation and Vendor Cleanup

- Add root `package.json` scripts:
  - `check:assets`
  - `check:syntax`
  - `check:server`
  - `validate`
  - `serve`
  - `prepush`
- Add validation scripts:
  - `scripts/check-assets.mjs`
  - `scripts/check-syntax.mjs`
  - `scripts/static-server.mjs`
  - `scripts/check-server.mjs`
- Remove tracked `assets/packs/vendor/**`.
- Update `assets/packs/README.md` to explain that full vendor source packs are external and not stored in git.
- Add `prototype/3d/assets/vendor/NOTICE.md` with source and license notes for Fantasy Props, Medieval Village, KayKit packs, Quaternius/UAL2, and any retained runtime subset sources.
- Validate that every referenced GLTF/GLB dependency closure keeps required `.bin` and texture files.

### Slice 2: Runtime Modularization

Refactor `prototype/3d/src/main.js` into readable modules while preserving behavior:

- `core/threeLoader.js`
- `core/sfx.js`
- `core/modelLoader.js`
- `world/terrainWater.js`
- `world/sky.js`
- `world/grass.js`
- `world/village.js`
- `player/rig.js`
- `player/clips.js`
- `player/moves.js`
- `player/controller.js`
- `combat/effects.js`
- `enemies/wolfAi.js`
- `ui/input.js`
- `ui/mapHud.js`
- `camera.js`
- `loop.js`

`main.js` should remain only the startup coordinator and dependency assembly layer.

### Slice 3: Runtime Blocker Fixes

- Map loading must use a local path such as `./maps/map15.json` and check `response.ok`.
- Wolf hittable state must be consistent: either instantiate wolf behavior or fully disable wolf hittables. Do not leave a hittable target active when `wolf` is `null`.
- Add real player `hp`, `hpMax`, and `dead` state so wolf attacks damage the player and death disables gameplay input while the render/HUD loop continues.
- Guard knockback normalization against `dist === 0`.
- Replace missing texture references with existing assets or canvas fallbacks:
  - road: `texture_road.png` or generated fallback
  - clouds: `cloud_cumulus.png` or `cloud_01-03.png`
  - grass cards: `texture_foliage.png` or disable the missing layer
- Fix SFX reference `swosh-3.ogg` to `swosh-03.ogg`.

### Slice 4: Legacy Cleanup

- Delete zero-byte test files.
- Delete duplicate `hit_bone_000/001/002.ogg`.
- Delete duplicate `texture_mud.png` only after confirming no runtime reference needs it.
- Remove or archive:
  - `index.html.bak`
  - `index.html.bak2`
  - `双击玩-离线版.html`
  - early `prototype/index.html` and its dedicated assets, if not needed by current docs.
- Move `三连原版备份.txt` to `docs/animation_refs/`.
- Move old maps `map3_v1`, `map8_clean`, `map10`, and `map_v1_baseline` to `docs/archive/maps/`; keep only `map15.json` in the runtime map directory.
- Update `READMEFIRST.md` and `HANDOFF.md` with the current module structure, entry point, port, run commands, and validation commands.

### Slice 5: Browser and Gameplay Smoke

- Add browser smoke tests using native CDP or another local-only browser driver already available in the environment.
- Required smoke checks:
  - `/index.html` opens.
  - no page errors.
  - no 404/500 for runtime resources.
  - no external network request is required.
  - `canvas#c` exists and has nonblank pixels.
  - runtime probe is available only under test flag.
  - movement, light attack, heavy attack, dodge, camera, map pause, wolf damage, wolf death, player death, and SFX mapping are covered.
- Test-only hooks must be gated behind `globalThis.__IAMOK_ENABLE_TEST_PROBE__`.
- Normal runtime must not expose mutable test controls or consume external test hooks.

## Multi-Agent Review Plan

- Requirements reviewer: confirm this plan still covers the user's requested cleanup, modularization, validation, and push policy.
- Vendor/assets reviewer: inspect retained runtime asset closure, removed source packs, NOTICE coverage, and asset checker coverage.
- Runtime implementation reviewer: inspect module split, behavior preservation, test hook gating, and no unintended gameplay tuning.
- Test-plan reviewer: inspect validation scripts and browser/gameplay smoke coverage.
- Final strict reviewer: after local gates pass, re-check current diff, docs, commands, artifacts, and remaining risks before push.

## Commit Plan

1. `document recovery cleanup execution plan`
2. `remove duplicate vendor source packs and add validation baseline`
3. `refactor 3d runtime modules and fix runtime blockers`
4. `clean legacy prototype files and update docs`
5. `add final gameplay smoke gate`

The plan may be compressed into fewer commits only if each commit remains reviewable and validation evidence is recorded.

## Required Local Verification Before Push

- `npm run validate`
- Browser smoke gates added by the implementation.
- `git diff --check`
- `git status --short`
- `git diff --stat`
- Final multi-agent strict review with no blocker findings.

## Current Risk

Because the previous unpushed local worktree was deleted, earlier implementation work must be reconstructed from the remote branch rather than amended. This document is the new traceable baseline for the remaining work.
