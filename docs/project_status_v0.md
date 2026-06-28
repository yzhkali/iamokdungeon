# Project Status v0 - I am OK Dungeon / 没事地下城

> 新会话应先读 `READMEFIRST.md`，再读 `HANDOFF.md` 和本文件。

## Current State

当前仓库已经有可运行 3D 原型，主入口是：

- `prototype/3d/index.html`

运行与验证：

- `npm run serve`
- `npm run validate`
- `npm run check:browser`
- `npm run prepush`

Windows 本地双击入口仍保留：

- `prototype/3d/START-GAME.bat`
- `prototype/3d/启动游戏.bat`

## Current Runtime Layout

- `prototype/3d/src/main.js`：主编排和仍未完全拆分的游戏主体。
- `prototype/3d/src/core/`：Three 加载、SFX、模型加载。
- `prototype/3d/src/world/`：天空和草。
- `prototype/3d/src/wolf.js`：程序化狼。
- `prototype/3d/maps/map15.json`：当前运行地图。
- `prototype/3d/assets/vendor/`：保留运行子集，完整源包不入库。
- `docs/archive/maps/`：旧地图归档。
- `docs/animation_refs/`：动画参考归档。

## Cleanup Status

已完成：

- 删除 `assets/packs/vendor/**` 完整源包。
- 增加 `prototype/3d/assets/vendor/NOTICE.md`。
- 增加 root `package.json` 和 `scripts/` 验证工具。
- 删除 0 字节 test 文件。
- 删除重复音效和重复泥土贴图。
- 删除旧备份/离线 HTML。
- 删除早期 2D `prototype/index.html` 和专用 `prototype/assets/honest_man/`。
- 归档旧地图到 `docs/archive/maps/`。
- 归档三连动画备份到 `docs/animation_refs/`。

## Known Issues

- 工具页还需要最终本地化复查和 smoke 覆盖。
- `main.js` 仍偏大，后续应继续拆 `CLIPS`、`MOVES`、输入、HUD、相机、循环。
- 文档中早期像素原型路线仍可作为设计背景，但不再代表当前运行目标。

## Next Tasks

1. 修保留工具页的 CDN/缺失资源引用，并纳入验证。
2. 继续行为保持式模块化。
3. 最终多子代理严格复查后再推送。
