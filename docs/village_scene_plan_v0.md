# Village Scene Plan v0

## Goal

Build a first playable village prototype around the existing main character without changing the character's move set, attack timings, dodge, jump, or combo definitions.

## Current Layout

- South entrance and main road: the player starts near the village road and can read the space immediately.
- Central square: broad testing space for movement, camera, and attacks.
- Elder house: north terrace with a small elevation change, used as the village focal point.
- Villager houses: four small houses around the road and square.
- Inn: west side, with benches and table dressing.
- Smithy: northwest yard, with workbenches, anvil, and weapon stand.
- Shop: east side, with stall, cart, bottles, crates, and produce.
- Chapel: northeast raised plot, with tower, cross, candles, and bookcase.
- Training yard: west fenced yard with two attackable wooden dummies.
- Monster pen: east fenced yard with the current small monster target.

## Asset Direction

- Primary scene language: Medieval Village MegaKit for readable building silhouettes.
- Props: Fantasy Props MegaKit for function markers such as smith tools, shop crates, inn benches, and chapel objects.
- Nature dressing: KayKit Forest Nature for edge trees, rocks, and bushes.
- Combat targets: current wooden dummy logic and skeleton/placeholder monster target remain compatible with the existing hit code.

## Next Useful Steps

- Replace primitive building boxes with more modular wall, window, roof, and door combinations from the Medieval Village pack.
- Add simple NPC placeholders near each functional building.
- Add interaction prompts later for inn, shop, smith, and elder, after the movement and camera scale feels right.
- Decide whether this village is a hub, tutorial area, or pre-dungeon staging area.
- Tune camera height after testing character readability on a larger map.

## Guardrail

The main character's moves, attack definitions, combo tree, dodge behavior, jump behavior, and hit timings should remain untouched while iterating on the village scene.
