# Honest Man Base Body v0

Purpose: naked chibi body base for I am OK Dungeon equipment layering.

Generated files:

- `D:\I am OK Dungeon\assets\models\honest_man_base_body_v0\honest_man_base_body_v0.blend`
- `D:\I am OK Dungeon\assets\models\honest_man_base_body_v0\honest_man_base_body_v0.glb`
- `D:\I am OK Dungeon\assets\models\honest_man_base_body_v0\honest_man_base_body_v0_preview.png`

Character state:

- Bald.
- No glasses.
- Bare upper body.
- White triangular briefs.
- Bare feet.
- Fat chibi body proportions with short limbs and a large head.

Rig front axis:

- Character faces negative Y in Blender.

Core bones:

- `root`, `cog`, `hips`, `spine`, `chest`, `neck`, `head`
- `shoulder.L/R`, `upper_arm.L/R`, `forearm.L/R`, `hand.L/R`
- `thigh.L/R`, `shin.L/R`, `foot.L/R`, `toe.L/R`

Sockets / anchors:

- `socket_weapon.R`: right-hand weapon attachment.
- `socket_shield.L`: left-hand shield attachment.
- `socket_headgear`: hats, helmets, hair pieces, glasses bridge helper later.
- `socket_chest_armor`: shirts, armor, chest equipment.
- `socket_back`: back items, cape, backpack.
- `socket_waist_armor`: belt, briefs replacement, pants waist.
- `CTRL_hand.L/R`: future hand IK/control target positions.
- `CTRL_foot.L/R`: future foot IK/control target positions.

Animation notes:

- Use `cog` and `hips` for jump/run body mass.
- Use `chest` for squash/lean during run and heavy attacks.
- Keep feet short and planted; the character should feel heavy, not athletic.
- Keep equipment as separate mesh objects parented to sockets/bones.
