# Honest Man Run Animation Spec v0

## Goal

Lock a single run direction for 老实人 / Honest Man:

- Direction: front 45 degrees
- Frame count: 8 frames
- Loop type: seamless run loop
- Use case: combat prototype player locomotion

This spec is intentionally narrow. Do not expand to 8-direction animation yet.

## Motion Reference

Use real run mechanics:

1. Contact
2. Down
3. Push
4. Flight
5. Opposite contact
6. Down
7. Push
8. Flight / loop return

The loop should read as a believable run cycle, not a walk, not a bounce, not a comic shuffle.

## Identity Lock

Keep these traits fixed in every frame:

- Head is large relative to the body
- Body is short and heavy
- Belly mass is visible
- Flip-flops remain readable
- Open blue plaid shirt sways outward and inward
- White tank top stays mostly covered
- Glasses stay thick, round, and readable
- Hair remains a simple village-style bowl cut
- Expression stays small, calm, and slightly awkward

## Pose Rules

- Weight must move forward and back across the cycle.
- Feet must clearly alternate left and right contact.
- The support leg should compress on contact.
- The torso should dip on down frames and rise on push-off.
- Arms swing opposite the legs.
- The open shirt should lag behind the torso by one beat.
- The head should bob less than the torso.
- The feet should feel planted, not floating.

## Frame Plan

### Frame 1
Left foot contact. Right leg back. Body slightly low. This is the anchor pose.

### Frame 2
Down / compression. Weight sinks onto the left leg. Right leg starts to pass through.

### Frame 3
Push / transition. Left leg starts to leave the ground. Torso rises.

### Frame 4
Flight. Both feet are close to off-ground or one is barely grazing. Body is highest.

### Frame 5
Right foot contact. Mirror of frame 1, but not identical.

### Frame 6
Down / compression on the right side.

### Frame 7
Push / transition. Left leg advances.

### Frame 8
Flight / loop return. Match timing so it flows into frame 1 cleanly.

## Pixel / Sprite Constraints

- Keep the silhouette readable at sprite scale.
- Use chunky pixel clusters, not painterly noise.
- Avoid thin limb spaghetti.
- Avoid extreme limb extension.
- Avoid exaggerated slapstick motion.
- The result should be slightly awkward, but still competent.

## Animation Target

The final feel should be:

- heavy enough to imply body mass
- soft enough to fit the character
- awkward but not broken
- comic but not clownish

## Deliverables

If generating art, produce:

- 8 individual frame PNGs
- 1 horizontal sprite sheet PNG
- 1 looping GIF preview
- 1 prompt text file

## Production Prompt

Use this as the base prompt for frame generation or sprite cleanup:

```text
Create a polished retro Japanese ARPG pixel art run-cycle sprite for I’m OK Dungeon.

Subject: 老实人 / Honest Man, a short chubby cute chibi man with thick round multi-ring glasses, a village-style bowl cut, an open blue plaid short-sleeve shirt, a white ribbed tank top, white shorts, and flip-flops.

Direction: front 45 degrees only.
Animation: true 8-frame run cycle, seamless loop, with real run mechanics: contact, down, push, flight, opposite contact, down, push, flight.

Must keep: large head, heavy belly, open shirt sway, readable flip-flops, awkward but believable run, calm small expression, strong readable silhouette, dark outline, visible pixel clusters, clear volume.

Avoid: walk cycle, bounce loop, comedy slapstick, floating feet, broken limbs, overextended poses, heroic sprinting, 8-direction sheet, extra characters, text, watermark, background scene.

Composition: one character only, centered, plain neutral background, consistent scale across all 8 frames, suitable for game sprite extraction.
```

