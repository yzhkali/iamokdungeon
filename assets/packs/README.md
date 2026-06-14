# Vendor Asset Packs

This folder stores third-party asset packs used as source material for I am OK Dungeon.

## Policy

- Keep original pack folders intact so licenses, previews, and source structure remain traceable.
- Prefer `.gltf` or `.glb` for direct Three.js integration.
- Use `.fbx` as a conversion source when a pack has animations or rigged characters.
- Do not edit files inside `vendor/` directly. Copy selected production-ready assets into a project-specific folder later.

## Imported Packs

| Pack | Main Use | Best Runtime Formats | License File |
|---|---|---|---|
| `vendor/Fantasy Props MegaKit[Standard]` | Medieval fantasy props, furniture, weapons, books, potions, clutter | `.gltf`, `.fbx`, `.obj` | `License_Standard.txt` |
| `vendor/Medieval Village MegaKit[Standard]` | Medieval village buildings, walls, roofs, doors, stairs, outdoor modules | `.gltf`, `.fbx`, `.obj` | `License_Standard.txt` |
| `vendor/Modular Character Outfits - Fantasy[Standard]` | Fantasy humanoid outfit modules for knights, mages, rogues, NPC variants | `.gltf`, `.fbx` | `License_Standard.txt` |
| `vendor/Universal Base Characters[Standard]` | Base humanoid bodies and hairstyles for future rigged character experiments | `.gltf`, `.fbx` | `License_Standard.txt` |
| `vendor/Universal Animation Library 2[Standard]` | Humanoid animation reference and future retargeting tests | `.glb`, `.fbx`, `.blend` | `License.txt` |
| `vendor/KayKit_Adventurers_2.0_FREE` | Simple chibi adventurer characters and animations | `.glb`, `.gltf`, `.fbx` | `License.txt` |
| `vendor/KayKit_Skeletons_1.1_FREE` | Skeleton enemies, enemy animation tests | `.glb`, `.gltf`, `.fbx` | `License.txt` |
| `vendor/KayKit_DungeonRemastered_1.1_FREE` | Modular dungeon rooms, walls, traps, doors, dungeon props | `.gltf`, `.fbx`, `.obj` | `License.txt` |
| `vendor/KayKit_Forest_Nature_Pack_1.0_FREE` | Forest set dressing, trees, rocks, terrain props | `.gltf`, `.fbx`, `.obj` | `License.txt` |
| `vendor/KayKit_ResourceBits_1.0_FREE` | Resource icons/objects and small pickup props | `.gltf`, `.fbx`, `.obj` | `License.txt` |
| `vendor/KayKit_RPGToolsBits_1.0_FREE` | RPG tool props, small items, inventory-like objects | `.gltf`, `.fbx`, `.obj` | `License.txt` |

## License Summary

The included license files state these packs are CC0 / public domain dedication. Keep the original license files with the project for auditability.

## Near-Term Usage Plan

1. Use KayKit Dungeon Remastered or Medieval Village MegaKit to replace the current greybox room.
2. Use KayKit Skeletons for the first real enemy placeholder.
3. Use Fantasy Props MegaKit for room dressing: barrels, books, potions, banners, and weapons.
4. Keep the current procedural Honest Man as the player character until combat feel and enemy loops are stable.
5. Experiment with Universal Base Characters plus Universal Animation Library on a separate Git branch before replacing the player model.
