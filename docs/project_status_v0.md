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

- `prototype/3d/src/main.js`：约 411 行，保留启动编排、主依赖装配和少量跨系统粘合逻辑；核心加载、SFX、模型、天空、草、地形水面、世界碰撞/高度状态、静态村庄/blockout、训练木人桩构建器、相机、水面反射 pass、玩家纯数据、输入控制器、HUD/map 控制器、狼 AI 控制器、GLTF 狼适配器、主循环调度器、玩家状态/调参模块、玩家程序化 rig、闪避残影控制器、动作关键帧控制器、玩家逐帧 update、运行时服务、战斗运行时、战斗/姿态纯数学辅助函数、命中判定控制器、攻击视觉爆发控制器、目标受击反馈控制器、剑拖尾控制器、空间斩控制器、剑气/裂缝控制器、践踏特效控制器和大风车同心环控制器已拆出。
- `prototype/3d/src/core/`：Three 加载、SFX、模型加载和运行时服务启动编排。
- `prototype/3d/src/core/runtimeServices.js`：HUD、水面反射 pass、测试探针、resize/loading 启动和 game loop 启动。
- `prototype/3d/src/combat/attackBursts.js`：轻击刀光/重击圆圈视觉对象、休眠 `startSlash` 语义、`doSlash`、`burstCircle` 和淡出更新。
- `prototype/3d/src/combat/runtimeCombat.js`：空间斩、命中目标反馈、命中判定、攻击爆发、残影、目标反馈、同心环、剑拖尾、剑气、践踏特效和 `updateFx` 的运行时装配。
- `prototype/3d/src/combat/hitMath.js`：关键帧采样、角度差、突刺盒和旋转扫掠弧等纯数学辅助函数。
- `prototype/3d/src/combat/hitResolution.js`：普通挥砍、剑气、突刺、大风车、木星球和扫掠命中的目标判定与命中副作用调度。
- `prototype/3d/src/combat/targetFeedback.js`：柱子/狼 hittable、木人桩和怪物的受击红闪、摇晃、后仰弹簧和命中冷却衰减。
- `prototype/3d/src/combat/spaceSlash.js`：闪避打断后的空间斩 ready 标记、辐射线生成、淡出和清理。
- `prototype/3d/src/combat/swordBeam.js`：剑气弹幕、弹道裂缝生长、剑气生命周期和裂缝淡出清理。
- `prototype/3d/src/combat/swordTrail.js`：剑刃挥砍拖尾几何、采样、段数上限和停止后淡出。
- `prototype/3d/src/combat/stompEffects.js`：战争践踏坑洞、碎石物理、AoE 反馈、SFX/震屏回调和淡出清理。
- `prototype/3d/src/combat/spinRings.js`：大风车同心环几何、延迟展开、淡出和清理；当前保持原来的休眠触发状态。
- `prototype/3d/src/world/`：天空、草、世界碰撞/高度状态、静态村庄/blockout 和训练木人桩构建器。
- `prototype/3d/src/rendering/waterReflection.js`：水面反射渲染 pass。
- `prototype/3d/src/camera.js`：相机控制器。
- `prototype/3d/src/loop.js`：主帧循环调度器。
- `prototype/3d/src/player/`：关键帧动画 `CLIPS`、连招 `MOVES`、玩家初始状态和调参数据。
- `prototype/3d/src/player/rig.js`：玩家程序化骨架、物理左右别名、武器插槽、剑尖引用、蓄力光环和木星球静态对象。
- `prototype/3d/src/player/ghostAfterimages.js`：闪避残影池、快照、计时和淡出。
- `prototype/3d/src/player/poseClipController.js`：动作关键帧关节重置、切招快照、clip 采样补间和身体驱动值 staging。
- `prototype/3d/src/player/updateController.js`：玩家逐帧 update 主流程，保留原有移动、闪避、连招、hitstop、pose 和战斗特效顺序。
- `prototype/3d/src/ui/input.js`：键鼠/手柄输入控制器。
- `prototype/3d/src/ui/mapHud.js`：体力/状态 HUD、小地图和展开地图控制器。
- `prototype/3d/src/wolf.js`：程序化狼。
- `prototype/3d/src/enemies/wolfAi.js`：狼 AI 状态机和命中/受伤逻辑。
- `prototype/3d/src/enemies/cubeWolfAdapter.js`：保留的 GLTF 狼适配器，用于把外部动画狼模型映射到当前狼 AI 契约；当前运行路径仍使用程序化狼。
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
- `main.js` 已从超大文件收敛为主编排文件，但仍保留少量跨系统粘合逻辑；后续只在明确收益大于风险时继续小切片整理。
- 文档中早期像素原型路线仍可作为设计背景，但不再代表当前运行目标。

## Next Tasks

1. 当前短期目标是保持干净、可运行、可验证，不再做非必要的大范围重构。
2. 后续每个代码或资产切片都跑 `npm run validate` 或 `npm run prepush`。
3. 仅在发现明确 bug、缺失文档或低风险废弃物时继续清理。
