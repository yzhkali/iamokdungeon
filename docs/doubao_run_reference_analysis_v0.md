# Doubao Run Reference Analysis v0

## Source

Reference frames saved from the user's Doubao video screenshots:

- `D:\I’m OK Dungeon\assets\references\doubao_run_reference_v0\`
- `D:\I’m OK Dungeon\assets\references\doubao_honest_man_run_reference_v0_sheet.png`
- `D:\I’m OK Dungeon\assets\references\doubao_honest_man_run_reference_v0.gif`

## Short Verdict

This reference is useful. It should not be directly extracted as final game sprites, but it should become the motion and style target for 老实人's front-45-degree run.

It succeeds where previous generated sheets failed:

- Body mass feels heavy but cute.
- The belly stays covered and readable.
- The run is awkward-soft, not clownish.
- Flip-flops stay readable.
- Shirt flap motion supports the run.
- The face remains stable enough to preserve identity.

## Why Not Directly Extract

The screenshots are not final production sprites:

- They include sky, grass, and player UI/sidebar artifacts.
- The character is rendered as a large showcase animation, not a clean transparent game sprite.
- Camera framing changes slightly between screenshots.
- Some frames are near-duplicates or not exact 8-frame cycle samples.
- There is no clean alpha channel.

Use this as a motion reference, not as final cutout art.

## Animation Lessons To Copy

### Body

- Torso leans forward consistently.
- Belly leads the body slightly.
- The head stays comparatively stable.
- The body sinks on contact and rises into the passing/flight beat.

### Feet

- Flip-flop contact is clear.
- The front foot has a strong planted silhouette.
- The rear foot drags/sweeps behind with a soft arc.
- The stride is short enough to feel chubby and grounded.

### Arms

- Fists are small and close to the body.
- Arm swing is contained, not heroic.
- The rear arm is partially hidden by the open shirt, which helps avoid noisy motion.

### Shirt

- The open blue plaid shirt is the best secondary motion.
- The shirt flares backward when the torso advances.
- The side flap follows the body late, giving weight without exposing the belly.

## Suggested 8-Frame Cycle From Reference

Use the 11 captured frames as reference, but build a clean 8-frame cycle:

| New frame | Reference feel | Purpose |
|---|---|---|
| 1 | Similar to captured frame 1 / 11 | Front foot contact, anchor pose |
| 2 | Similar to captured frame 2 / 3 | Down/compression |
| 3 | Similar to captured frame 4 | Push-off begins |
| 4 | Similar to captured frame 5 | Passing / light flight |
| 5 | Similar to captured frame 6 / 7 | Opposite foot contact |
| 6 | Similar to captured frame 8 | Opposite down/compression |
| 7 | Similar to captured frame 9 / 10 | Opposite push-off |
| 8 | Similar to captured frame 10 / 11 | Flight / return into frame 1 |

## Updated Acceptance Criteria

The next 老实人 run animation passes only if:

- It feels closer to the Doubao reference than to the previous v2/v3 attempts.
- The belly is covered by the tank top in every frame.
- The face does not drift into a different person.
- The run does not become a side-view platformer run.
- Feet land with visible weight.
- Shirt flaps animate but do not dominate.
- It can be watched as a loop for 5 seconds without obvious frame popping.

## Production Direction

Next attempt should not ask for a full AI sprite sheet from scratch.

Recommended workflow:

1. Use the Doubao reference as motion target.
2. Use the accepted 老实人 concept as identity target.
3. Generate or draw 8 separate key poses, one pose at a time.
4. Enforce the same head, glasses, belly, tank top, shorts, shirt, and flip-flops on every frame.
5. Assemble into a GIF only after all 8 still frames pass identity checks.

