# Input Design v0 - I’m OK Dungeon

## Purpose

This document defines the first keyboard and mouse control scheme for the combat prototype of **I’m OK Dungeon / 没事地下城**.

The implementation should use action mapping instead of hard-coding gameplay logic directly to physical keys. This keeps the prototype ready for later gamepad support.

## Keyboard + Mouse Controls

| Action | Input |
|---|---|
| Move | WASD |
| Facing Direction | WASD movement direction, 8 directions supported |
| Basic Attack | Left mouse button |
| Heavy Attack | Right mouse button |
| Dodge | Left Shift |`r`n| Jump | Space |
| Skill 1 | Q |
| Skill 2 | E |
| Interact / Confirm | F |
| Milk Tea / Heal Item | R |
| Target Info / Cycle Target | Tab |`r`n| Pause | Esc |

## Direction Rules

Player facing is controlled by the current movement input, not by the mouse.

The prototype should support 8 facing directions:

| Input | Facing Direction |
|---|---|
| W | Up |
| S | Down |
| A | Left |
| D | Right |
| W + A | Up-left |
| W + D | Up-right |
| S + A | Down-left |
| S + D | Down-right |

If the player releases all movement keys, the player keeps the last facing direction.

## Attack Rules

- Basic attack uses the left mouse button.
- Heavy attack uses the right mouse button.
- Both attacks are released toward the player's current facing direction.
- The mouse does not control character facing in combat v0.
- Basic attack should be a fast melee arc or short-range hitbox.
- Heavy attack has a slightly longer wind-up, should hit harder and/or cover a larger arc, and should be punishable if used carelessly.

## Dodge Rules

- Dodge uses Space.
- If the player is holding a movement direction, dodge moves a short distance in that input direction.
- If the player is holding diagonal input, dodge moves diagonally.
- If no movement key is pressed, dodge moves in the last facing direction.
- Dodge should have a short cooldown.
- Dodge should have a short invulnerability window in the first prototype.

## Skill Rules

- Skill 1 uses Q.
- Skill 2 uses E.
- Skills that need direction should use the current facing direction.
- The first prototype can show clickable skill icons in the UI, but combat should primarily rely on Q/E.
- If UI clicking is implemented, clicking a skill icon should trigger the skill without causing an attack.

## Action Map

The code should think in gameplay actions, not raw keys.

| Gameplay Action | Default Keyboard / Mouse Binding | Future Gamepad Binding |
|---|---|---|
| move | WASD | Left stick |
| face | WASD / last movement direction | Left stick / last movement direction |
| attack | Left mouse button | X / Square |
| heavyAttack | Right mouse button | RT / R2 |
| dodge | Left Shift | B / Circle |`r`n| jump | Space | A / Cross |
| skill1 | Q | Y / Triangle |
| skill2 | E | RB / R1 |
| interact | F | A / Cross |
| heal | R | LB / L1 |
| openSkillBook | K | View / Touchpad |`r`n| targetInfo | Tab | Right stick click / custom |`r`n| pause | Esc | Menu / Options |`r`n| openMap | M | Select / Back |`r`n| openInventory | I or B | D-pad panel shortcut / custom |

## Prototype Notes

- The first prototype only needs keyboard and mouse support.
- Gamepad support should be considered in architecture but does not need to be implemented in v0.
- The mouse is not used for aiming or facing in combat v0.
- Mouse buttons are used only for basic attack and heavy attack.
- Interact / Confirm is reserved for future NPC, reward selection, doors, and dialogue prompts.
- Heal item is currently themed as milk tea.

## Open Questions

- Should basic attack be a pure melee arc, or a very short slash projectile? Suggested answer: melee arc first.
- How much stronger should heavy attack be than basic attack? Suggested answer: about 2x damage with a clearly punishable wind-up.
- Should skills auto-target enemies, use selected target, or follow current facing direction? Suggested answer: each skill declares its targeting rule; default is facing direction, special tracking skills may use selected target.
- Should dodge distance be the same in diagonal directions after normalization? Suggested answer: yes, normalize diagonal movement so diagonal dodge is not faster.`r`n- Which attacks can be avoided by jumping? Suggested answer: only explicitly jumpable ground AOE/shockwaves, not all damage.







