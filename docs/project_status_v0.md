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

- `prototype/3d/src/main.js`：主编排和仍未完全拆分的游戏主体，已抽出核心加载、SFX、模型、天空、草、相机、水面反射 pass、玩家纯数据、输入控制器、HUD/map 控制器、狼 AI 控制器、主循环调度器、玩家状态/调参模块、战斗/姿态纯数学辅助函数、剑拖尾控制器、空间斩控制器、剑气/裂缝控制器和践踏特效控制器。
- `prototype/3d/src/core/`：Three 加载、SFX、模型加载。
- `prototype/3d/src/combat/hitMath.js`：关键帧采样、角度差、突刺盒和旋转扫掠弧等纯数学辅助函数。
- `prototype/3d/src/combat/spaceSlash.js`：闪避打断后的空间斩 ready 标记、辐射线生成、淡出和清理。
- `prototype/3d/src/combat/swordBeam.js`：剑气弹幕、弹道裂缝生长、剑气生命周期和裂缝淡出清理。
- `prototype/3d/src/combat/swordTrail.js`：剑刃挥砍拖尾几何、采样、段数上限和停止后淡出。
- `prototype/3d/src/combat/stompEffects.js`：战争践踏坑洞、碎石物理、AoE 反馈、SFX/震屏回调和淡出清理。
- `prototype/3d/src/world/`：天空和草。
- `prototype/3d/src/rendering/waterReflection.js`：水面反射渲染 pass。
- `prototype/3d/src/camera.js`：相机控制器。
- `prototype/3d/src/loop.js`：主帧循环调度器。
- `prototype/3d/src/player/`：关键帧动画 `CLIPS`、连招 `MOVES`、玩家初始状态和调参数据。
- `prototype/3d/src/ui/input.js`：键鼠/手柄输入控制器。
- `prototype/3d/src/ui/mapHud.js`：体力/状态 HUD、小地图和展开地图控制器。
- `prototype/3d/src/wolf.js`：程序化狼。
- `prototype/3d/src/enemies/wolfAi.js`：狼 AI 状态机和命中/受伤逻辑。
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

- 保留工具页已经纳入资产检查、语法检查和浏览器 smoke；继续改动时必须保持验证通过。
- `main.js` 仍偏大，剑拖尾、空间斩、剑气/裂缝和践踏特效已拆出；后续应继续整理姿态执行、部分命中副作用和玩家 update 主流程边界。
- 文档中早期像素原型路线仍可作为设计背景，但不再代表当前运行目标。

## Next Tasks

1. 继续行为保持式模块化。
2. 每个切片都跑 `npm run validate` 或 `npm run prepush`。
3. 最终多子代理严格复查后再推送。
