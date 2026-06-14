# Character Design v0 - 老实人 / Honest Man

## Purpose

This document defines the first playable character for **I’m OK Dungeon / 没事地下城**.

老实人 is intended to be the default beginner character: easy to understand, forgiving, comedic, and strongly tied to the game's satire of Chinese internet relationship language.

## Current Art Reference

Primary concept image:

- `D:\I’m OK Dungeon\assets\concepts\honest_man_front_iso_concept_v0.png`

Style guide:

- `D:\I’m OK Dungeon\docs\art_style_guide_v0.md`

## Character Fantasy

老实人 is the kind of person who keeps saying “没事，我扛得住” until he suddenly cannot.

He is sincere, awkward, conflict-avoidant, and extremely good at swallowing emotional damage. His gameplay identity should be: absorb pressure, survive longer than expected, then release accumulated grievance in one absurd burst.

## Visual Design

- Short and chubby.
- Cute Q-version proportions.
- Thick round multi-ring glasses.
- Plain village-style bowl cut hair.
- Blue plaid short-sleeve shirt worn open.
- White ribbed tank top underneath.
- White shorts.
- Flip-flops.
- Harmless, sincere, slightly awkward, and funny.

## Role

- Beginner-friendly default character.
- High survivability.
- Slightly slower movement.
- Simple attacks.
- Passive rewards taking damage and surviving pressure.
- Best suited for players who make mistakes but keep going.

## Personality Keywords

- Honest.
- Awkward.
- Sincere.
- Conflict-avoidant.
- Enduring.
- Easy to bully.
- Occasionally terrifying when pushed too far.

## Basic Stats v0

All numbers are placeholders and should be tuned after playtesting.

| Stat | v0 Direction |
|---|---|
| HP | Above average |
| Movement Speed | Slightly below average |
| Basic Attack Damage | Average |
| Heavy Attack Damage | Above average, slow wind-up |
| Dodge | Standard distance, standard cooldown |
| Jump | Standard combat jump |
| Skill Complexity | Low |
| Survivability | High |

## Basic Attack

Working name: **朴素挥击**

- Fast short-range melee attack.
- Uses current WASD facing direction.
- Simple and reliable.
- Low visual flash, more practical than cool.

## Heavy Attack

Working name: **认真一击**

- Triggered by right mouse button.
- Longer wind-up than basic attack.
- Higher damage and/or larger hit arc.
- Should feel like 老实人 finally worked up the courage to hit back.
- Punishable if used at the wrong time.

## Starting Skill 1

Working name: **多喝热水**

Initial concept:

- Defensive / healing skill.
- Could restore HP, reduce incoming damage briefly, or create a small warm-water recovery zone.
- The joke should be preserved, but the effect must be clear in combat.

## Starting Skill 2

Working name: **我错了**

Initial concept:

- Emergency defensive skill.
- Possible effects:
  - short invulnerability,
  - bullet clear,
  - knockback nearby enemies,
  - reduce aggro briefly.
- Should feel pathetic but useful.

## Passive Ability

Working name: **老实人抗压**

Core fantasy:

老实人 absorbs emotional damage instead of immediately expressing it. Most damage is taken normally, but a small portion is stored in a dedicated passive meter. When the meter is full, 老实人 explodes emotionally and releases the stored damage as a full-screen AOE.

### v0 Rule

When 老实人 takes damage:

- 90% of incoming damage is applied to HP immediately.
- 10% of incoming damage is stored in a dedicated passive meter.

When the passive meter is full:

- The stored damage is released all at once.
- Release effect: full-screen AOE damage.
- The passive meter resets after the burst.

### Passive Meter

The character needs a unique UI meter for this passive.

Working meter names:

- 忍耐槽
- 抗压槽
- 委屈槽
- 老实人进度条

Current recommendation: **忍耐槽**

The meter should communicate that 老实人 is silently accumulating pressure.

### Full-Screen AOE Burst

Working names:

- 忍无可忍
- 老实人爆发
- 我真的会生气
- 这次我不忍了

Current recommendation: **忍无可忍**

Possible presentation:

- Screen briefly pauses or shakes.
- 老实人 pushes up his glasses or clenches fists.
- A circular shockwave expands from the player.
- Stored damage is released as full-screen or near-full-screen AOE.
- Text pop-up could say: “老实人也是有脾气的。”


## Post-Burst State

After the full-screen AOE burst, 老实人 should enter a short-lived empowered state.

Working names:

- 爆发态
- 认真起来
- 忍耐已清空
- 超级老实人

Current recommendation: **爆发态**

### Burst State Fantasy

This is the "Dragon Ball style" moment: after being pushed too far, 老实人 suddenly becomes sharper, faster, and more forceful for a short period. The vibe should feel like a transformed state, but still comedic and grounded in his personality.

### Burst State Effects v0

- Attack speed increases.
- Attack animation amplitude increases.
- Basic attacks and heavy attacks feel heavier and more assertive.
- Movement can become slightly snappier or more aggressive.
- Visual feedback should make him look more intense and less timid.
- The state should last only briefly before he returns to normal.

### Burst State Duration

- Short duration only.
- Long enough for the player to feel the payoff.
- Short enough that it does not become the character's default mode.

### Burst State Tone

- Not heroic in a shiny anime way.
- More like: "老实人终于忍不住了。"
- Comedic, sudden, and a little dangerous.
- After the state ends, he should visibly calm down again.

### Balance Notes

- The burst state should not replace the passive burst AOE.
- The AOE is the emotional release.
- The burst state is the aftermath: a temporary heightened combat mode.
- Numbers are still placeholder and should be tuned later.


## Passive Cooldown

After the full-screen AOE and the short burst state, 老实人 enters a passive cooldown period.

Working names:

- 冷静期
- 贤者时间
- 情绪重建中
- 又开始忍了

Current recommendation: **冷静期**

### Cooldown Rule v0

During passive cooldown:

- Incoming damage is applied 100% to HP.
- No damage is stored in 忍耐槽.
- 忍耐槽 should not fill during this period.
- The passive cannot trigger again during this period.

Cooldown duration:

- TBD after playtesting.

### Design Purpose

The cooldown prevents 老实人 from becoming a damage-storage loop that triggers too often. The player gets a powerful release and short empowered window, then must survive normally for a while.

### UI Notes

- The 忍耐槽 should show that it is temporarily disabled or cooling down.
- Possible UI treatment: greyed-out meter, cooldown overlay, or small text/icon indicator.

## Animation Needs Later

- Idle 8 directions.
- Walk 8 directions.
- Basic attack 8 directions.
- Heavy attack 8 directions.
- Dodge 8 directions.
- Jump.
- Hurt.
- Passive meter full reaction.
- Burst AOE animation.
- Death / defeat.

## Next Art Task

Generate an 8-direction standing concept sheet based on:

- `honest_man_front_iso_concept_v0.png`
- `art_style_guide_v0.md`

Do not attempt full animation frames until the 8-direction standing identity is stable.



## Current 8-Direction Baseline Update

User-adjusted 8-direction standing sheet is now the current baseline for 老实人 direction design:

- $asset8

Use this version instead of the earlier generated 8-direction sheets for future animation, sprite cleanup, and direction consistency checks.
