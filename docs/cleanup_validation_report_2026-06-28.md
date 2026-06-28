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
- `prototype/3d/src/combat/attackBursts.js` owns slash/heavy burst visual meshes, dormant `startSlash` effective behavior, `doSlash`, `burstCircle`, and attack burst fade updates.
- `prototype/3d/src/combat/hitMath.js` owns keyframe sampling, angle delta, thrust-box, and spin-sweep arc pure math helpers.
- `prototype/3d/src/combat/hitResolution.js` owns slash, beam, thrust, ring, jupiter, and spin-sweep hit resolution while main keeps move timing.
- `prototype/3d/src/combat/targetFeedback.js` owns hittable/dummy/monster hit flash, shake, tilt spring, and per-target hit cooldown decay.
- `prototype/3d/src/combat/spaceSlash.js` owns dodge-cancel space-slash readiness, radial line spawning, fadeout, and cleanup.
- `prototype/3d/src/combat/spinRings.js` owns big-spin ring geometry, delayed expansion, opacity fade, and cleanup while preserving the current dormant spawn behavior.
- `prototype/3d/src/combat/swordBeam.js` owns sword beam spawning, projectile/crack movement, beam lifecycle, and crack fadeout cleanup while hit resolution owns beam hit side effects.
- `prototype/3d/src/combat/swordTrail.js` owns sword trail geometry, sword root/tip sampling, segment capping, and stopped-trail fadeout.
- `prototype/3d/src/combat/stompEffects.js` owns stomp crater/debris spawning, debris physics, AoE feedback, SFX/impact callbacks, and mark fadeout cleanup.
- `prototype/3d/src/world/sky.js` and `prototype/3d/src/world/grass.js` own low-risk world rendering pieces.
- `prototype/3d/src/world/trainingDummy.js` owns training dummy geometry construction, map feature registration, collider registration, and shared dummy-array writes.
- `prototype/3d/src/rendering/waterReflection.js` owns the water reflection render pass and restores renderer/water visibility state after the pass.
- `prototype/3d/src/camera.js` owns camera offset, yaw/pitch smoothing, pitch clamp, shake offset, and lookAt updates.
- `prototype/3d/src/loop.js` owns the main frame loop schedule, delta clamp, wolf error isolation, world/camera/HUD/grass/reflection/final-render order, and RAF rescheduling.
- `prototype/3d/src/player/clips.js` owns animation clip data.
- `prototype/3d/src/player/ghostAfterimages.js` owns dodge afterimage pool creation, snapshot timing, cadence, and fadeout.
- `prototype/3d/src/player/moves.js` owns move/combo timing data.
- `prototype/3d/src/player/poseClipController.js` owns keyframe pose joint reset, transition snapshots, clip sampling/blending, and driven body pose state.
- `prototype/3d/src/player/rig.js` owns the procedural player skeleton, physical left/right aliases, weapon socket, sword tip reference, charge aura, and static Jupiter-ball meshes.
- `prototype/3d/src/player/state.js` owns player initial state and movement/jump/dodge/charge tuning constants.
- `prototype/3d/src/ui/input.js` owns keyboard, mouse, gamepad, camera-stick, and input-clear state.
- `prototype/3d/src/ui/mapHud.js` owns stamina/status HUD, mini map, world map drawing, and map open/close state.
- `prototype/3d/src/enemies/wolfAi.js` owns wolf patrol/look/chase/border/return/death state, wolf hittable callbacks, and wolf-to-player damage.
- `prototype/3d/src/enemies/cubeWolfAdapter.js` owns the retained GLTF wolf adapter that maps animated model clips to the existing wolf AI contract.
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
- `npm run check:player-rig`
- `npm run check:pose-clip-controller`
- `npm run check:ghost-afterimages`
- `npm run check:attack-bursts`
- `npm run check:target-feedback`
- `npm run check:hit-math`
- `npm run check:hit-resolution`
- `npm run check:space-slash`
- `npm run check:spin-rings`
- `npm run check:stomp-effects`
- `npm run check:training-dummy`
- `npm run check:sword-beam`
- `npm run check:sword-trail`
- `npm run check:input`
- `npm run check:map-hud`
- `npm run check:camera`
- `npm run check:render-loop`
- `npm run check:game-loop`
- `npm run check:cube-wolf-adapter`
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
- Player rig check verifies the procedural hierarchy, physical side aliases, limb dimensions, right-wrist socket, sword tip reference, Jupiter-ball meshes, charge aura material, grip constants, and main-module integration.
- Ghost afterimages check verifies pool size, capsule geometry/material setup, direct scene registration, live player/yaw snapshotting, pool wraparound, first-frame and 0.04s dodge cadence, fade math, hidden no-op behavior, and main-module integration.
- Attack bursts check verifies yaw-local slash/heavy visual construction, geometry/material values, preserved dormant `startSlash` heavy-only semantics, `doSlash`, `burstCircle`, exact hitstop/shake writes, slash/heavy fade math, active `fireFx` behavior, and main-module integration.
- Hit math check verifies keyframe easing/sampling, injected lerp behavior, angle wrapping, thrust-box boundaries, spin-sweep arc boundaries, and main-module integration.
- Space slash check verifies ready-state consumption, line mesh/material/geometry setup, deterministic radial growth, offset handling, fadeout/removal, and main-module integration.
- Spin rings check verifies ring geometry/material setup, delayed visibility, ease-out radius scaling, opacity fade, removal, five-ring saturn burst parameters, live player/radius dependency, dormant `spinSlash` behavior, and main-module integration.
- Stomp effects check verifies crater material/geometry setup, exact debris count/materials, SFX-before-impact callback order, in-range and out-of-range AoE feedback, deterministic debris bounce/settle behavior, fadeout/removal, and main-module integration.
- Training dummy check verifies dummy geometry/material/shadow values, scene registration, map feature payload, collider payload, shared dummy-array writes, feedback material collection, and main-module integration.
- Sword beam check verifies beam material/geometry setup, one-grid spawn offset, direction snapshot, movement before hit callback, crack growth/index stitching, beam removal, crack fadeout/removal, and main-module integration while preserving main-owned hit behavior.
- Sword trail check verifies mesh/material/geometry setup, default and explicit segment caps, root/tip sampling order, hidden-update no-op behavior, stopped-trail fadeout, history reset, and main-module integration.
- Input controller check verifies keyboard, mouse, gamepad, camera-stick, and input-clear behavior with a lightweight fake DOM.
- Cube wolf adapter check verifies root transforms, scene registration, mesh shadow flags, clip/state mapping, fade transitions, one-shot loop modes, finished-listener fallback, mixer update forwarding, first-mesh material mapping, fallback material safety, and removal of the unused inline main-module adapter.
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

- `Asset check passed (77 runtime assets, 33 source files).`
- `Vendor subset check passed (prototype/3d/assets/vendor).`
- `Player data check passed (37 clips, 24 moves).`
- `Player state check passed.`
- `Ghost afterimages check passed.`
- `Attack bursts check passed.`
- `Hit math check passed.`
- `Space slash check passed.`
- `Spin rings check passed.`
- `Stomp effects check passed.`
- `Sword beam check passed.`
- `Sword trail check passed.`
- `Input controller check passed.`
- `Map HUD check passed.`
- `Camera controller check passed.`
- `Render loop check passed.`
- `Game loop check passed.`
- `Wolf AI check passed.`
- `Syntax check passed (46 files plus 9 inline scripts).`
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
- Sword trail implementation review: no behavior blocker. The reviewer confirmed start/stop/update semantics, sampling order, fadeout, `spaceSlashReady` gating, update order after `poseCharacter`, and map/dead/hitstop early-return behavior are preserved.
- Sword trail validation/repository review: two hygiene blockers were raised because `prototype/3d/src/combat/swordTrail.js` and `scripts/check-sword-trail.mjs` were not yet staged and the verification evidence counts were stale. This slice stages both files and updates the evidence to `71 runtime assets, 27 source files` and `34 files plus 9 inline scripts`; the brittle main integration assertions were relaxed to regex checks.
- Space slash implementation review: no behavior blocker. The reviewer confirmed ready-state consumption is one-shot, `onHitTarget` still continues to SFX, hitstop/shake still use `Math.max`, dodge cancel readiness keeps the same sword-trail gate, update order stays after spin rings and before stomps, and map/dead/hitstop early returns still skip space-slash updates.
- Space slash validation/repository review: one hygiene blocker was raised because `prototype/3d/src/combat/spaceSlash.js` and `scripts/check-space-slash.mjs` were not yet staged. This slice stages both files; `check:space-slash` is included in `validate`, static server coverage includes `/src/combat/spaceSlash.js`, and the latest evidence is `72 runtime assets, 28 source files` and `36 files plus 9 inline scripts`.
- Sword beam implementation review: no behavior blocker. The reviewer confirmed spawn position and facing snapshot, speed/lifetime/removal behavior, crack growth/fadeout, move-before-hit callback ordering, `fireFx('chop')` SFX/hitstop/shake order, and map/dead/hitstop early-return behavior are preserved. The unused legacy `beamHitDummies` path was confirmed safe to delete.
- Sword beam validation/repository review: one hygiene blocker was raised because `prototype/3d/src/combat/swordBeam.js` and `scripts/check-sword-beam.mjs` were not yet staged. This slice stages both files; `check:sword-beam` is included in `validate`, static server coverage includes `/src/combat/swordBeam.js`, and the latest evidence is `73 runtime assets, 29 source files` and `38 files plus 9 inline scripts`.
- Stomp effects requirement/boundary review: no behavior blocker. The reviewer identified SFX-before-impact order, `Math.max` hitstop/shake semantics, drill ordering, AoE-only feedback, debris physics constants, fade timing, and the normal-update placement as required preservation points.
- Stomp effects testing-plan review: no blocker. The reviewer requested module-level fake-Three coverage for crater materials, debris count/materials, AoE feedback, physics/fade/removal, and main-module wiring; `scripts/check-stomp-effects.mjs` implements those checks and is included in `validate`.
- Stomp effects implementation review: no blocker. The reviewer confirmed SFX order, drill order, AoE side effects, debris physics/fade/removal, update order, and syntax/import integration are preserved. The latest evidence is `74 runtime assets, 30 source files` and `40 files plus 9 inline scripts`.
- Spin rings requirement/boundary review: no behavior blocker. The reviewer identified exact ring geometry/material, delay semantics, ease-out scaling, opacity fade, cleanup, live player/radius dependencies, update order, and the currently dormant `spawnSaturnRings()` call site as required preservation points.
- Spin rings testing-plan review: no blocker. The reviewer requested fake-Three coverage for creation, delayed update, removal, five-ring saturn burst parameters, main-module wiring, server route coverage, and updates to existing order assertions; `scripts/check-spin-rings.mjs` implements those checks and is included in `validate`.
- Spin rings implementation review: no blocker. The reviewer confirmed geometry/material, `SPIN_RING_Y`, negative-delay timing, ease-out radius, opacity fade, reverse iteration, removal semantics, dormant `spinSlash` behavior, update order, and validation integration are preserved.
- Ghost afterimages requirement/boundary review: no behavior blocker. The reviewer identified pool size/material/geometry, direct scene ownership, first-frame spawn, 0.04s cadence, spawn-before-movement/yaw update, snapshot values, fade math, and early-return/hitstop fade behavior as required preservation points.
- Ghost afterimages testing-plan review: no blocker. The reviewer requested fake-Three coverage for pool construction, spawn snapshot/wraparound, dodge timer cadence, fade behavior, main-module integration, and static server route coverage; `scripts/check-ghost-afterimages.mjs` implements those checks and is included in `validate`.
- Attack bursts requirement/boundary review: no behavior blocker. The reviewer identified yaw-local mesh ownership, exact slash/heavy geometry/material values, duplicate `startSlash` effective semantics, `fireFx` active behavior, `doSlash`, `burstCircle`, fade math, and hitstop/shake overwrite semantics as required preservation points.
- Attack bursts testing-plan review: no blocker. The reviewer requested fake-Three coverage for construction, dormant `startSlash` behavior, `doSlash`, `burstCircle`, update fade behavior, `fireFx` wiring, static server coverage, and old inline removal; `scripts/check-attack-bursts.mjs` implements those checks and is included in `validate`.

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
