# AI Development Rules - I'm OK Dungeon / 没事地下城

> Scope: this file applies to the whole repository.
> Any AI agent continuing this project must read this file before editing code or assets.

## Must-Read Order

Before making changes, read these files in order:

1. `AGENTS.md`
2. `READMEFIRST.md`
3. `HANDOFF.md`
4. `docs/project_status_v0.md`
5. `docs/cleanup_validation_report_2026-06-28.md`

Use the current worktree as the source of truth. If old conversation context conflicts with files or command output, trust the current files and command output.

## Current Runtime Target

- Main runnable entry: `prototype/3d/index.html`
- Current branch: `codex/yard-map-asset-test`
- Runtime source root: `prototype/3d/src/`
- Current map: `prototype/3d/maps/map15.json`
- Vendor policy: keep only the runtime subset in `prototype/3d/assets/vendor/`; do not re-add full source packs under `assets/packs/vendor/`.

## Non-Negotiable Engineering Rules

1. Do small, reviewable slices.
   - One feature, bug fix, cleanup, or module extraction per slice.
   - Do not mix unrelated refactors, asset cleanup, gameplay changes, and documentation churn in one commit.

2. Do not grow giant files.
   - `prototype/3d/src/main.js` is orchestration only. Do not add new gameplay systems, rendering systems, AI, input logic, combat logic, or asset logic directly into it.
   - New runtime behavior belongs in a focused module under `core/`, `world/`, `player/`, `combat/`, `enemies/`, `ui/`, `rendering/`, or another clearly named folder.
   - If a normal source module approaches about 300 lines, split it by responsibility unless there is a clear data-table reason.
   - If `main.js` grows, the same slice should usually move equivalent or larger logic out of it.

3. Preserve gameplay feel unless the task is explicitly to change it.
   - Do not retune movement, attack timing, dodge timing, camera feel, wolf AI, hitstop, shake, SFX timing, combo timings, or animation timing while doing cleanup.
   - If a bug fix must touch those values, document the exact reason in the commit message or handoff note.

4. Prefer local patterns over new architecture.
   - Follow existing module factory style such as `createX(...)`, `buildX(...)`, and lightweight validation scripts in `scripts/check-*.mjs`.
   - Use dependency injection for Three.js objects, DOM references, random functions, clocks, and callbacks when that keeps modules testable.
   - Do not introduce build tools, frameworks, bundlers, package managers, or runtime dependencies without a separate explicit approval.

5. Keep assets intentional.
   - Do not import large source asset packs into git.
   - Keep GLTF dependency closures intact: if a `.gltf` is retained, retain its referenced `.bin` and textures.
   - If an asset is removed, verify HTML, JS, JSON, GLTF, dynamic manifests, and retained tools no longer reference it.

6. Keep the repository clean.
   - Do not leave generated temp folders, browser profiles, extracted packs, screenshots, logs, or scratch files in the repo.
   - Watch disk usage when using `/tmp`; delete temporary work as soon as it is no longer needed.
   - Never use destructive git commands such as `git reset --hard` or `git checkout --` unless the user explicitly asks for that exact operation.

## Required Multi-Agent Workflow

For any non-trivial code or asset slice, use separate agents with separate responsibilities:

1. Requirements reviewer
   - Reads the requested change and relevant docs.
   - Lists exact behavioral, asset, validation, and documentation requirements.
   - Calls out scope creep and unclear acceptance criteria.

2. Implementation owner
   - Owns one bounded module or file group only.
   - Must not edit unrelated files or revert other agents' work.
   - Must describe changed files and preserved behavior.

3. Implementation reviewer
   - Reviews the actual diff against current runtime behavior.
   - Looks for regressions, hidden coupling, order changes, asset path mistakes, and file-growth problems.

4. Test planner / test owner
   - Defines the validation needed for this slice.
   - Adds or updates focused `scripts/check-*.mjs` coverage when the slice changes runtime behavior or module boundaries.
   - Confirms the new check is included in `npm run validate` when appropriate.

5. Final strict reviewer
   - Runs after implementation and tests are in place.
   - Verifies git status, diff scope, docs, validation output, and remote push status.
   - A slice is not complete if this reviewer reports a blocker.

One agent should own one slice. Do not assign overlapping write scopes to multiple agents. Close agents after their result is integrated so the workspace does not accumulate idle subagents.

## Validation Gates

Before committing a completed slice, run:

```bash
npm run prepush
git status --short --branch
git diff --stat
```

`npm run prepush` currently runs `git diff --check` and the full `npm run validate` chain, including asset checks, syntax checks, static server checks, and browser smoke checks.

If a machine cannot run a browser smoke test, state that clearly and run the strongest available substitute. Do not claim full validation passed unless it actually passed.

## Commit And Push Rules

Every completed slice must be committed and pushed before starting the next unrelated slice.

Use explicit staging:

```bash
git add <exact files changed>
git commit -m "<concise imperative message>"
git push fork codex/yard-map-asset-test
git push origin codex/yard-map-asset-test
git ls-remote fork refs/heads/codex/yard-map-asset-test
git ls-remote origin refs/heads/codex/yard-map-asset-test
```

Commit messages should describe the actual slice, for example:

- `extract player update controller`
- `add runtime services validation`
- `clean legacy map archive docs`
- `document ai development rules`

Do not make a vague commit such as `update`, `fix`, or `misc`.

## Documentation Rules

Update documentation in the same slice when behavior, commands, file layout, validation gates, asset policy, or handoff status changes.

Keep these documents synchronized:

- `AGENTS.md` for AI working rules.
- `READMEFIRST.md` for project direction and first-run guidance.
- `HANDOFF.md` for current operational state.
- `docs/project_status_v0.md` for current module layout and remaining work.
- `docs/cleanup_validation_report_2026-06-28.md` for cleanup and validation evidence.

Do not let docs claim that a module still needs extraction after it has been extracted. Do not record validation as passing before running it.

## Slice Completion Checklist

A slice is complete only when all applicable items are true:

- Requirements are understood and scoped.
- The implementation is in the right module, not dumped into `main.js`.
- No file grew without a clear reason.
- Behavior-preserving changes kept order, timing, paths, and side effects intact.
- Assets referenced by HTML, JS, JSON, GLTF, and dynamic manifests exist.
- Focused tests or checks were added when needed.
- `npm run prepush` passed, or any unavailable gate is honestly documented.
- Final reviewer found no blockers.
- Changes were committed with a specific message.
- Commit was pushed to the required remote branch.
- Worktree is clean after push.

If any item is not true, keep working or document the blocker. Do not call the slice complete.
