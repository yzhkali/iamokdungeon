# Runtime Vendor Asset Notice

This directory contains a curated runtime subset of third-party assets used by the 3D prototype and retained local tools. Complete source packs are intentionally excluded from git.

## Retained Sources

| Runtime folder | Source pack/provider | License note | Notes |
|---|---|---|
| `fantasy_props/` | Quaternius, Fantasy Props MegaKit | CC0 / public-domain style source pack license. | Props and village dressing used by `prototype/3d/src/main.js`. |
| `medieval_village/` | Quaternius, Medieval Village MegaKit | CC0 / public-domain style source pack license. | Building, wall, roof, floor, and trim assets used by the village prototype. |
| `kaykit_dungeon/` | Kay Lousberg / KayKit, Dungeon Remastered | KayKit free asset license / CC0-style distribution. | Dungeon props and tiles retained for tools/prototype use. |
| `kaykit_forest/` | Kay Lousberg / KayKit, Forest Nature Pack | KayKit free asset license / CC0-style distribution. | Trees, bushes, rocks, and foliage props retained for tools/prototype use. |
| `kaykit_skeletons/` | Kay Lousberg / KayKit, Skeletons | KayKit free asset license / CC0-style distribution. | Skeleton enemy/gallery assets. |
| `kaykit_adventurers/` | Kay Lousberg / KayKit, Adventurers | KayKit free asset license / CC0-style distribution. | Character and rig assets used by retained demo/tool pages. |
| `character_gallery/` | KayKit / retained gallery exports | Derived from retained permissive KayKit runtime exports. | Character gallery GLB runtime subset. |
| `quaternius/` | Quaternius / Universal Animation Library 2 | Quaternius CC0 1.0 Public Domain Dedication. | Animation reference asset used by retained animation tools. |
| `skeleton_compare/` | KayKit / Quaternius comparison exports | Derived from retained permissive KayKit and Quaternius runtime exports. | Small comparison assets used by `bones.html`. |

## License Summary

The imported packs were selected from packs distributed with permissive public-domain or creator-friendly licenses such as CC0/public-domain dedication or the providers' standard free asset licenses. Complete source packs and their original license text are intentionally kept outside this git branch after runtime-subset extraction.

Keep this notice with the runtime subset. If new assets are copied in, update this file with the source pack, provider, and license location before committing.
