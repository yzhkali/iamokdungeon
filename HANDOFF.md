# I'm OK Dungeon（没事地下城）- 当前交接日志

> 新会话先读 `READMEFIRST.md`，再读本文件。当前主目标是保持 3D 原型干净、可运行、可验证。

## 当前状态

- 当前分支：`codex/yard-map-asset-test`
- 主可运行入口：`prototype/3d/index.html`
- 本地运行：
  - `npm run serve` -> 默认 `http://127.0.0.1:4173/`
  - Windows 可继续双击 `prototype/3d/START-GAME.bat`，它会通过 `server.ps1` 在 `http://127.0.0.1:8100/index.html` 启动。
- 主验证命令：
  - `npm run validate`
  - `npm run check:browser`
  - `npm run prepush`

## 当前结构

- `prototype/3d/index.html`：主入口、UI/CSS、importmap、本地 BGM。
- `prototype/3d/src/main.js`：主编排和仍待进一步拆分的游戏主体，已抽出低风险核心模块、相机控制器、UI 控制器、狼 AI 控制器、主循环调度器、玩家状态/调参数据、战斗/姿态纯数学辅助函数和剑拖尾控制器。
- `prototype/3d/src/core/threeLoader.js`：本地 Three.js / GLTFLoader 加载。没有 CDN 回退。
- `prototype/3d/src/core/sfx.js`：SFX 封装。
- `prototype/3d/src/core/modelLoader.js`：GLTF 缓存、预处理和放置。
- `prototype/3d/src/combat/hitMath.js`：关键帧采样、角度差、突刺盒和旋转扫掠弧等纯数学辅助函数。
- `prototype/3d/src/world/sky.js`：天空 dome、云层和更新。
- `prototype/3d/src/world/grass.js`：草卡实例化和风动更新。
- `prototype/3d/src/rendering/waterReflection.js`：水面反射 pass，负责反射 RT 尺寸同步、clippingPlanes、水面隐藏/恢复和状态清理。
- `prototype/3d/src/camera.js`：相机偏移、yaw/pitch 平滑、pitch clamp、shake 和 lookAt 更新。
- `prototype/3d/src/loop.js`：主帧循环调度，负责 dt clamp、wolf 异常隔离、世界/相机/HUD/草/反射/最终渲染顺序。
- `prototype/3d/src/player/clips.js`：角色关键帧动画数据。
- `prototype/3d/src/player/moves.js`：连招树和招式时序数据。
- `prototype/3d/src/player/state.js`：玩家初始状态和移动/跳跃/闪避/蓄力调参常量。
- `prototype/3d/src/combat/swordTrail.js`：剑刃挥砍拖尾几何、采样、段数上限和停止后淡出。
- `prototype/3d/src/ui/input.js`：键鼠/手柄输入状态、模式切换、相机输入和输入清空。
- `prototype/3d/src/ui/mapHud.js`：体力/状态 HUD、小地图、展开地图绘制和地图开关。
- `prototype/3d/src/wolf.js`：程序化狼模型。
- `prototype/3d/src/enemies/wolfAi.js`：狼 AI 状态机、巡逻/追击/守边/返回、命中响应和玩家受伤逻辑。
- `prototype/3d/maps/map15.json`：当前唯一运行地图。
- `prototype/3d/assets/vendor/`：保留的第三方运行子集，来源见 `prototype/3d/assets/vendor/NOTICE.md`。
- `docs/archive/maps/`：旧地图归档。
- `docs/animation_refs/三连原版备份.txt`：三连动画参考归档。

## 已清理内容

- 完整 vendor 源包 `assets/packs/vendor/**` 已从 git 删除。
- 0 字节 test 文件已删除。
- 重复 `hit_bone_000/001/002.ogg` 已删除，保留 `hit_bone.ogg`、`hit_bone2.ogg`、`hit_bone3.ogg`。
- 重复 `texture_mud.png` 已删除，保留 `mud-riverbank-tile-512.png`。
- 旧备份/离线 HTML 已删除：`index.html.bak`、`index.html.bak2`、`双击玩-离线版.html`。
- 早期 2D `prototype/index.html` 及其专用 `prototype/assets/honest_man/` 已删除。
- 旧地图已归档，只保留 `map15.json` 在运行目录。

## 操作

WASD 移动 / Q/E 旋转镜头 / R/F 俯仰 / 左键轻击 / 按住右键蓄力重击 / 空格跳跃 / Shift 闪避 / T 推眼镜 / 地图按钮展开世界地图。支持 Xbox 手柄：左摇杆移动、右摇杆镜头、X 轻击、按住 Y 蓄力、A 跳、B 闪避。

## 当前已知风险

- `main.js` 已拆出低风险模块、水面反射 pass、玩家纯数据表、输入控制器、HUD/map 控制器、相机控制器、狼 AI 控制器、主循环调度器、玩家状态/调参数据、战斗/姿态纯数学辅助函数和剑拖尾控制器，但空间斩/剑气/践踏等战斗副作用和姿态执行仍在主文件中。继续拆分时先抽边界清晰的控制器，不要直接大改战斗循环。
- 部分保留工具页仍是历史工具，但已经纳入资产检查、语法检查和浏览器 smoke；后续迁移或清理仍需保持这些验证通过。
- 不要调整移动、攻击、闪避、相机、狼 AI、hitstop、shake、SFX 时序等手感常量，除非是在修明确 bug。

## 下一步建议

1. 继续小步模块化：战斗副作用或姿态执行边界整理。
2. 每个模块化切片都跑 `npm run validate` 或 `npm run prepush`，再提交。
3. 推送前读 `docs/cleanup_validation_report_2026-06-28.md`，重新跑最终验证并完成只读复查。
