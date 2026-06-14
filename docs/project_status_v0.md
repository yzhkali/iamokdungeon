# Project Status v0 - I am OK Dungeon / 没事地下城

> New Codex conversations should read this file after `READMEFIRST.md`.

## Current Folder State

Project folder:

- `D:\I am OK Dungeon\`

Current top-level contents:

- `READMEFIRST.md`
- `docs/`
- `assets/`

There is currently no playable prototype project yet.

## What Has Been Established

The project is a retro pixel ARPG / light roguelite prototype about Chinese internet relationship language and awkward intimacy-pressure satire.

Current first playable character:

- 老实人 / Honest Man
- Beginner-friendly, high-survivability character.
- Visual identity: short chubby chibi man, thick round glasses, bowl cut, blue plaid open shirt, white tank top, white shorts, flip-flops.
- Core passive: 忍耐槽 stores a small portion of damage, then releases as 忍无可忍 full-screen AOE and a short burst state.

Current visual direction:

- Retro Japanese ARPG pixel art.
- Three-quarter top-down / isometric-feeling camera.
- Cute chibi proportions with strong dark outline and readable pixel clusters.
- Accepted anchor assets are in `assets/concepts/`.

Current animation focus:

- Do not expand to all directions yet.
- First lock one run direction: front 45 degrees, 8-frame seamless run cycle.
- Doubao reference is useful as a motion target, but should not be directly extracted as final sprites.

## Existing Documents To Read

Priority order for a new conversation:

1. `READMEFIRST.md`
2. `docs/project_status_v0.md`
3. `docs/character_honest_man_v0.md`
4. `docs/art_style_guide_v0.md`
5. `docs/input_design_v0.md`
6. `docs/honest_man_run_animation_spec_v0.md`
7. `docs/honest_man_run_frame_table_v0.md`
8. `docs/doubao_run_reference_analysis_v0.md`
9. `docs/image_generation_workflow_v0.md` only when generating new images.

## Known Issues To Fix

1. `docs/game_design_v0.md` does not exist yet.
2. `docs/input_design_v0.md` has stray literal `` `r`n`` text in a few table rows.
3. `docs/input_design_v0.md` has a control conflict:
   - tables say Dodge = Left Shift,
   - Dodge Rules say Dodge uses Space.
   Recommended fix: Left Shift = dodge, Space = jump.
4. Several documents contain encoding mojibake, such as `鑰佸疄浜?` for 老实人 and `I鈥檓` for I’m. These should be cleaned when editing those files.
5. Some docs mention `D:\I’m OK Dungeon\`, but the actual folder currently being read is `D:\I am OK Dungeon\`.

## Recommended Next Task

Do this next:

1. Create `docs/game_design_v0.md`.
2. Make it a compact GDD for the first playable prototype.
3. Lock the first prototype scope:
   - 1 battle room.
   - 1 playable character: 老实人.
   - 3-6 word enemies.
   - 1 first boss: “没事”.
   - Player movement, facing, basic attack, heavy attack, dodge, jump.
   - HP, death, enemy death, simple win state.
   - One post-fight skill choice or result screen.
4. Fix `docs/input_design_v0.md` control conflict and stray `` `r`n`` text.
5. Create `prototype/` for the playable greybox.

## Recommended Prototype Tech

Use a simple browser prototype first.

Suggested first implementation:

- `prototype/index.html`
- `prototype/src/main.js`
- `prototype/src/style.css`

Use pure HTML Canvas first if speed and low dependency risk matter most. Phaser can be introduced later if the prototype grows.

## Scope Warning

Do not expand into a full game yet. The next milestone is only a tiny playable combat room that can be opened, tested, tuned, and recorded.
## Local Tool Paths

Blender is installed as a portable build and launched through this desktop shortcut:

- Shortcut: `C:\Users\Windows\Desktop\blender.exe.lnk`
- Actual executable: `E:\blender-5.1.2-windows-x64\blender.exe`
- Working directory: `E:\blender-5.1.2-windows-x64`

Use the actual executable path for Blender Python scripts and automated exports.
## Existing 3D Movement Prototype

A movable 3D control prototype was found from the previous Codex conversation. It is not yet inside the main project folder.

Prototype files:

- Current playable page: `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\cone_player_3d_prototype.html`
- Saved controls baseline: `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\cone_player_3d_prototype_v1_controls_saved.html`
- Saved controls notes: `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\cone_player_3d_prototype_v1_controls_saved_notes.md`

Related Blender / GLB files:

- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_concept_v3_actor.blend`
- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_concept_v3_actor.glb`
- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_lowpoly_actor_v2.blend`
- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_lowpoly_actor_v2.glb`
- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_lowpoly_rig_v1.blend`
- `C:\Users\Windows\Documents\Codex\2026-06-12\files-mentioned-by-the-user-i-2\outputs\blender\honest_man_lowpoly_rig_v1.glb`

Controls in the saved baseline:

- WASD / arrow keys: move
- Space: jump
- Left Shift: dodge
- Left mouse: light attack
- Right mouse: heavy attack
- Xbox gamepad: left stick move, A jump, B dodge, X light attack, Y heavy attack

To test in Codex Browser, serve the outputs folder over localhost, then open:

- `http://127.0.0.1:8765/cone_player_3d_prototype.html`

The current local server for this conversation was started from the previous outputs folder and is temporary. Future conversations may need to start a new localhost static server.
