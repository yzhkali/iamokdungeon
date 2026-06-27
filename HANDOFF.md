# I'm OK Dungeon（没事地下城）— 项目交接日志

> 给下一个 Claude 会话：先读这份文件，再读 `prototype/3d/src/main.js`（游戏主逻辑都在这里；index.html 只是入口+UI）。
> 用户不写代码，但极懂动作游戏、描述需求非常精准。配合方式：用户出创意+精准反馈，你负责把它落地成代码。

## 一句话项目
复古风 3D 动作游戏原型。主角"老实人"（火柴人/方块人，程序化骨骼驱动），第三人称可旋转视角。
讽刺中国式亲密关系/婚恋压力的轻肉鸽 ARPG，敌人是"没事/随便/呵呵"等阴阳怪气词怪。
**当前阶段（2026-06-25）：map15 完整移植到 main.js。
已完成：terrain heightmap / ROOM=130 / 完整地形shader(mud+road+junction) / road mask+junction / roadColor / 水面反射系统(reflRT+sceneRT双pass) / 瀑布5层 / 河道(waterSurfs) / 天空渐变dome / 卷云(cloud_cirrus)+积云billboard / 相机重写 / 清理彩虹水帘雾气鸟狼等旧残留
下一步：云可见性微调、提交git（等lock释放后`git add -u && git commit`）**

## 连招树（当前正确版本）
- gL1→轻=gL2, gL1→重=gThrust(突刺)
- gL2→轻=gL3, gL2→重=gKnee(泰拳膝踢)
- gL3→无重接
- 跳轻击aL1→轻=aL2, aL1→重=aChop(下劈)
- 跳重击=aStomp(践踏)
- 闪避轻击=dKick(飞踹), 闪避重击=dRise(升龙剑)
- dRise→轻=aChop(下劈), dRise→重=aJupiter(旋风坠)
- aJupiter：后仰起手→人球X轴旋转(dt×46,4圈)→剑头顶土星环→蜘蛛侠落地，**多段伤害每圈一次**

## 最近进度（2026-06-18，连招/动作修复 + Blender MCP）
- **本地运行**：双击 `prototype/3d/START-GAME.bat` → `http://127.0.0.1:8099/index.html`
- **main.js 当前约2570行**，关键文件结构不变
- **地图已清场**：测试用平地+单个木桩(0,5)，村庄场景代码保留但未调用
- **Blender MCP 已配置**：claude_desktop_config.json 已加入 blender MCP server，用户已装addon并启动服务。新会话可直接操作Blender做怪物模型
- **角色动画预览页**：`http://127.0.0.1:8099/gallery.html`，可浏览所有角色模型+动画
  gL1:dur=0.50s(原0.62),trailSegs:8,弓步更深,前倾加大,左臂展开弯肘。
  gL2:dur=0.53s(原0.62),弓步更深,前倾+chestX,手臂幅度拉满。
- 闪避重击(升龙dRise)✅已验收：①`chargeSlide:10`蓄力下蹲往前滑 ②蓄力武士拔刀向左拧身`DRISE_COIL=-0.7`(负=左) ③起跳往右转一圈多(`body.rotation.y=-DRISE_COIL-k*(2π-DRISE_COIL)`,精确抵消拧身使结尾脸朝正面) ④起跳后左右腿互换 ⑤闪避→升龙补间0.13→0.22减卡顿。
- 闪避冲刺(dodge,~line2400)✅已验收:左右腿互换成左腿大跨+对侧交叉摆臂(左腿前跨配左臂前探=此坐标系下的交叉)。
- 三连"Q同款"试过已还原,原版备份`prototype/3d/三连原版备份.txt`。Q剑三连节奏=慢蓄→75%爆发;帅转身=骨盆与上胸反向对拧。
- **⚠️Write/Edit大文件会静默截断**(见独立记忆),改完必须数行数+看结尾+`sed 's/await import/x/g'`后node --check,修复用git或bash补结尾。

## 关键文件（2026-06 已拆分，注意！）
- `prototype/3d/index.html` —— **入口+UI/CSS**（约107行）。只放 DOM 和样式，末尾用 `<script type="module" src="./src/main.js">` 引主逻辑。
- `prototype/3d/src/main.js` —— **主游戏逻辑**（约2494行，纯Three.js，单文件 IIFE：顶部多CDN加载Three+GLTFLoader，然后 `main(THREE,GLTFLoader){...}` 包裹全部代码）。**这才是改游戏逻辑的地方。**
- `prototype/3d/assets/vendor/` —— 导入的 CC0 模型包（KayKit 系列）：`fantasy_props/`(家具道具gltf) `kaykit_skeletons/`(骷髅glb) `kaykit_dungeon/` `kaykit_forest/`(树/灌木) `medieval_village/`(地砖)。代码里用 `ASSET_VENDOR` + 子目录常量(PROP/SKEL/DUN/FOREST/MV)引用。
- `prototype/index.html` —— 早期2D版（已弃用，不用管）
- `assets/`（仓库根，非3d目录下）—— 早期美术资源（PS调过的8方向像素图等，3D版没用到，先留着）

> 注：拆分由 Codex 在断网期间完成，已验证：语法通过、DOM id 全部对得上、模型路径全部存在、原有角色/动画/连招完整保留，没翻车。

## 技术栈 & 重要约定
- 纯网页 + Three.js（从CDN多源加载，需要联网；代码顶部有多CDN回退）
- 角色是**程序化骨骼**：用关节旋转驱动动画，不是美术帧。这是核心，能快速加动作。
- **动画系统**：关键帧数据表 `CLIPS{}` + 招式树 `MOVES{}`，加动作=加数据表，不改引擎。
- **坐标/左右约定（极重要，反复踩坑）**：
  - 角色正面朝镜头时，**角色物理右手显示在屏幕左侧**（像照镜子）
  - 代码里已建立别名：`RArm/RLeg`=角色物理右手/右腿，`LArm/LLeg`=物理左手/左腿
  - 用户说"左/右"指**角色自己的左右**。改动作前务必确认左右，这是最常见的错误来源。
  - 3D旋转有万向节问题：手臂高举过头时z轴方向会视觉反转，调不准就让用户看了再调正负号。
- 关节约定：肘=负值朝前弯；膝=正值朝后弯。
- 动画通道：joint的x/y/z旋转；特殊通道 chestX/chestY/chestZ(腰)、bodyY(下沉)、bodyLean(前倾)、gripMode(握剑姿势0斜握/1枪式)。

## 操作
WASD移动 / Q/E旋转镜头 / R/F俯仰 / 左键轻击 / 按住右键蓄力重击 / 空格跳 / Shift闪避 / T推眼镜彩蛋 / 地图按钮看世界地图。支持Xbox手柄(左上角UI切换：左摇杆移动/右摇杆镜头/X轻击/按住Y蓄力/A跳/B闪避)。

## 已完成的战斗内容（都打磨过，手感被用户认可）
- **移动**：跑(对侧协调,伪跑动)、马里奥式跳跃(能跳上阶梯柱子)、弓步冲刺闪避+残影
- **轻击三连**(左键连点)：全身发力链(弓步沉胯/核心拧转/头部注视目标/慢动作大劈)，挥剑时枪式握剑
  - 第三下大劈=扔实心球式：慢举顶→顶点停→猛砸到身体中线
- **突刺**(轻→重)：右转拧成弹簧+T-pose扩胸蓄力→炸出突刺+冰面打滑滑行(slide=20)
- **大风车**(右键)：蓄力上发条(左转/半蹲)→双臂展开(泰坦尼克船头式)360°横扫→转晕收尾
  - 判定跟随剑旋转角度扫掠(trySweepHit)，不是一瞬间全圈。半径SPIN_RADIUS=2.8
- **蓄力重击**：按住右键蓄力(半蹲移动,越蓄越慢)，1.5秒满(全身金色光环闪烁,满后1秒不放则取消)
  - 没蓄满松手=普通大风车1圈(gSpin)；蓄满=大风车转3圈(gSpinCharged)+20%移动+转晕长僵直
- **突刺接大风车**：突刺做完(comboAt0.72)再按重击→取消僵直接大风车(gSpinSlide,带前滑)
- **剑气**(大劈触发)：贴地飞的鲨鱼鳍(ExtrudeGeometry薄立体)+弹道追踪式地面裂缝(跟着飞,3格长,10秒保持15秒消失)+移动判定(beamHitByBeam,每目标命中一次)
- **剑影拖尾**：每段独立年龄,彗星尾式逐段消失。大风车用长拖尾画近似圆。
- **场景**：4根可跳上去的阶梯柱子(带顶盖,platforms)+练武木人桩(makeDummy,红闪+弹簧后仰回弹)+通用碰撞(colliders/resolveCollision)

## 空间斩机制（已完成，用户认可的简化版）
**规则极简——只是个状态标记+下次命中放动画，没有别的：**
1. 触发：剑攻击挥砍中(剑影还在/`P.move && trailMesh.visible && trailActive`)用闪避打断 → 标记 `spaceSlashReady=true`（在闪避代码块里）
2. 生效：下次任意剑攻击命中目标 → `onHitTarget()` 检查标记，在命中点放**辐射状空间斩**(spawnSpaceSlash：长细线一条条快速射出→定住→原地淡出,不飞走) → 清除标记
3. 没有剑影残留、没有辉光、没有伤害加成、不叠加。纯动画效果。
4. 相关函数：`spaceSlashReady`变量 / `spawnSpaceSlash` / `updateSpaceSlash`(在主循环调) / `onHitTarget`(在tryHitObjects/tryThrustHit/trySweepHit三处命中点调用)
注：之前做过复杂版(剑影残留+辉光+魔剑架构),用户觉得太张扬,已全部删除重做成这个简化版。

## 这次会话之后的其他改动（都已完成）
- 闪避残影高度修复：`spawnGhost`里 `g.position.set(P.x, P.y+1.1, P.z)` —— 跳跃冲刺时残影跟到半空(之前写死1.1留在地上)
- 跑步调整：`MOVE_SPEED=8.0`(原6.6,更快)；步频 `runPhase+=...*1.9`(原2.9,腿摆放慢)
- 自检修过3个bug：HUD蓄力%用HEAVY_CHARGE_TIME、phase==='hold'判断、闪避重置chargeFull

## 2026-06 新增：场景 / 视角 / 地图（Codex 断网期间做的，已验证可跑）
- **开放村庄场景**（main.js 约380-425行）：长老屋/客栈/铁匠铺/商店/教堂/民居/玩家家(addBuilding/addPlayerHome)，加树木(addTree)、灌木、石头、火把、铁匠铺工具(铁砧/武器架/工作台)、市集摊位、家具道具——全用 KayKit gltf 模型，加载失败时回退到基础几何体。地砖 medieval_village/Floor_Brick。
- **可旋转开放视角**（`cameraRig` 约60-90行）：不再是固定俯视45°。yaw可转(Q/E或右摇杆)、pitch可俯仰(R/F)，有室内/室外两套距离和俯仰范围(进屋自动拉近)。`cameraOffset()` 按 yaw/pitch 算位置。
- **地图系统**：小地图(miniMap，圆形罗盘，右上角，可切N朝上/朝向模式) + 世界地图大图(worldMap 弹窗，点"地图"按钮)。场景物体通过 `registerMapFeature({type,name,x,z,...})` 注册到地图上。地形高度查询 `terrainYAt(x,z)`。
- **碰撞系统**：`addCollider(x,z,w,d,yMin,yMax)` 注册碰撞盒，`resolveCollision` 处理。建筑/木桩/柱子/道具都注册了碰撞。

## 战斗/伤害系统现状（下一步重点，目前≈零）
**重要：现在攻击只有"视觉反馈"，没有任何数值。要从这里往下搭。**
- **攻击目标**有两类：
  - 木人桩 `makeDummy`(约446行)：纯几何体木桩，2个在训练场(-21.8,15)和(-24.5,17.8)。被打=红闪(flashT)+后仰回弹(tilt/tiltVel弹簧物理)。
  - 怪物靶子 `makeMonsterTarget`(约487行)：KayKit 骷髅小兵(Skeleton_Minion.glb)，1个在(0,-6)，挂"打我"文字标签+红色地圈。被打=红闪+顿帧。**会动会追的真敌人还没做，这只是不还手的靶子。**
- **命中判定管道已铺好**：三处命中点 `tryHitObjects`(约1652行,挥砍) / `tryThrustHit`(约1737行,突刺) / `trySweepHit`(约1684行,大风车剑气) 命中后都调 `onHitTarget(x,y,z)`。
- **`onHitTarget`(约679行) 目前只干一件事**：检查空间斩标记→放空间斩动画。**没有 hp、没有 takeDamage、没有伤害数值、打不死。** 做血量系统就是给 dummy/monster 加 hp 字段 + 血条UI + 在 onHitTarget(或命中点)扣血 + 死亡处理。

- **继续做连招**（用户当前想推进的方向）
- **真正的敌人**：会动会追、有攻击前摇、能被打硬直的"词怪"(呵呵/随便/你猜)。现在只有不还手的木桩。
- **血量/伤害数值系统**：木桩/敌人加血条，攻击有数值
- **体力系统**：现在stamina是空转的(DODGE_COST=0)。用户说大风车以后要耗体力,不然成割草。
- **魔剑**：带附魔属性的武器(以后做)。
- Boss：大姨妈/扶弟魔/彩礼(最终boss)。

## 死代码（用户说先留着，可能以后用，别删）
- 土星环特效(spawnSaturnRings/spawnSpinRing/updateSpinRings)——已弃用但保留
- doSlash函数、旧蓄力圆圈(heavyRing/heavyFill/setHeavyCircle/burstCircle/HEAVY_R_MIN/MAX)
- gFollowHeavy招式(轻轻→重,当前触发不到)
- 一些没用的常量(CHARGE_MAX/CHARGE_MOVE/CHARGE_AUTO/HEAVY_LUNGE)

## 协作经验（重要）
- 用户描述动作极细致(分蓄力/发力/停顿阶段)，照着做准。改完让用户刷新(Ctrl+F5)看效果。
- 用户看不到的视觉细节(尤其左右方向、3D旋转正负)经常要调，做完主动提示"哪几个点可能要调"。
- 不擅长的别硬接：精细手工建模(Blender捏脸)绝对不要碰，那是上一个工具(Codex)翻车的坑。程序化骨骼/几何才是对的路。
- **省token**：用户token烧得多。单回合别做太多次工具调用(会产生大量无意义"call"垃圾输出且费token)，改动前先想全方案，合并编辑。

## 树贴图待实现（下一个会话直接接手）
- `prototype/3d/textures/` 里已有两张新贴图：`texture_foliage.png`（1024×1024 RGBA透明）和 `texture_tree_bark.png`（1024×1024 RGBA）
- **KayKit 树不可复用**：4棵树全是单网格+单atlas `forest_texture.png`，bark和foliage UV混在一起，无法分离贴图
- **确认方案**：写 `makeProcTree(x,z)` 程序化树，替换现有 `addTree`：
  - 树干：CylinderGeometry + `texture_tree_bark.png`（tileable，repeat wrapping）
  - 树冠：3组交叉 PlaneGeometry + `texture_foliage.png`（RGBA，`alphaTest:0.5`，双面）
  - 用户已认可方案，等待实现

## 当前已知小问题
- 体力条still空转(摆设)
- 状态HUD等细节已修过几个bug(蓄力百分比用HEAVY_CHARGE_TIME、phase==='hold'判断、闪避重置chargeFull)
