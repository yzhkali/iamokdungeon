# Art Style Guide v0 - I’m OK Dungeon

## Purpose

This document records the first visual style direction for **I’m OK Dungeon / 没事地下城**. Future characters, props, VFX, UI icons, enemies, and environments should follow this shared style unless a later guide overrides it.

Primary style anchor:

- `D:\I’m OK Dungeon\assets\concepts\honest_man_front_iso_concept_v0.png`

This image defines the current target for character volume, rendering density, outline weight, chibi proportion, and retro ARPG pixel-art feel.

## Overall Visual Direction

- Retro Japanese RPG / ARPG pixel art.
- Three-quarter top-down / isometric-feeling camera angle.
- Cute chibi proportions, but with enough material detail and volume to feel polished.
- Similar in spirit to high-quality 32-bit era RPG sprites, not flat icons.
- Game-readable first, illustration quality second.
- Comedic, expressive, and slightly absurd, matching the Chinese internet relationship satire theme.

## Camera And Perspective

- Characters should be drawn in a front three-quarter top-down view for concept art.
- In-game sprites should support 8 movement/facing directions when needed.
- The camera should feel like a retro ARPG room view: slightly above the character, enough to see head, shoulders, torso, and feet.
- Avoid pure side-view, pure front portrait view, or flat top-down board-game view.

## Character Proportions

- Chibi / Q-version body proportion.
- Large head, compact body, short limbs.
- Body should still have believable volume, not a sticker silhouette.
- Feet and hands can be simplified but should remain readable.
- Faces should be expressive even at small scale.

For the first player character, 老实人 / Honest Man:

- Short and chubby.
- Harmless, sincere, awkward, funny.
- Thick round multi-ring glasses.
- Village-style bowl cut hair.
- Blue plaid open short-sleeve shirt.
- White ribbed tank top underneath.
- White shorts.
- Flip-flops.

## Pixel Rendering

- Polished pixel-art look with visible pixel clusters.
- Strong dark outline around the silhouette.
- Internal details should use clusters, highlights, and shadow patches, not smooth airbrushed gradients.
- Use clear light direction and readable volume.
- Avoid over-noisy dithering.
- Avoid blurry painterly rendering.
- Avoid vector-flat shapes.
- Avoid photorealistic or 3D-rendered surfaces.

## Color And Lighting

- Colors should be saturated enough to feel game-like, but not neon.
- Use warm skin tones, readable clothing colors, and strong contrast between major clothing layers.
- Characters should have a small ground shadow when presented as concept art.
- Lighting should create volume without obscuring sprite readability.

## Outline And Detail Density

- Use dark, readable outlines similar to the Honest Man concept.
- Details should be dense enough to show personality, but not so dense that the sprite becomes unreadable when reduced.
- Important silhouette features should be exaggerated: glasses, hair shape, body shape, clothing blocks, props.
- Repeated characters should share the same detail density so they feel from the same game.

## Environment Style

Future environments should match the character perspective and rendering density:

- Retro pixel ARPG room layouts.
- Three-quarter top-down floor and props.
- Clear walkable areas, readable collision boundaries.
- Background detail should not overpower characters or enemy attack telegraphs.
- The first room theme is currently: 聊天框地下城 / chat-box dungeon.

## Prop And Item Style

Props and items should be:

- Pixel-art objects with clear outlines.
- Slightly exaggerated for readability.
- Consistent with the same top-down / isometric-feeling angle.
- Funny when appropriate, but still readable as gameplay objects.

Examples:

- Milk tea heal item.
- Skill book.
- Relationship-themed relics.
- Internet meme objects.
- Chat bubble obstacles.

## VFX And Attack Telegraphs

VFX should be readable before beautiful.

- AOE warnings must be clear and visible against the floor.
- Jumpable ground attacks should have a distinct telegraph style.
- Bullet patterns should be clean, not visually noisy.
- Text-based enemies or attacks, such as “呵呵”, “随便”, “你猜”, should be readable but not oversized.
- Effects should match pixel-art style, with hard edges or pixel-cluster animation.
- Avoid modern glow-heavy effects unless heavily pixel-stylized.

## UI And Icons

- Skill icons should use the same pixel-art language.
- Icons need strong silhouettes and simple color coding.
- UI should be clear and functional, not overly ornate.
- Target info panels can show enemy portrait/avatar and basic information.

## Prompt Template For Future Image Generation

Use this as a base for future character, enemy, item, or prop prompts:

```text
Create a polished retro Japanese ARPG pixel art concept asset for I’m OK Dungeon.
Style anchor: three-quarter top-down / isometric-feeling 32-bit RPG sprite style, cute chibi proportions where applicable, strong dark pixel outline, visible pixel clusters, clear light and shadow volume, readable game silhouette, compact full-body game asset feeling.
Subject: <describe asset>
Mood: comedic, expressive, slightly absurd, matching Chinese internet relationship satire.
Composition: single asset centered on a plain neutral background, small soft ground shadow if appropriate, no text, no watermark, no extra characters, no complex scene.
Avoid: photorealism, 3D render, vector art, flat icon style, anime splash illustration, blurry painterly rendering, excessive glow, noisy background.
```

## Current Style Status

Status: v0 style direction accepted by the user.

Accepted anchor image:

- `assets/concepts/honest_man_front_iso_concept_v0.png`

Next recommended art task:

- Generate 8-direction standing concept sheet for 老实人 based on the accepted v0 style.

## Current Character Direction Baseline

The accepted visual style now includes the user-adjusted 8-direction 老实人 sheet:

- $asset8

Future character direction sheets should match this version's scale, chibi proportion, outline density, clothing consistency, and three-quarter top-down ARPG perspective.
