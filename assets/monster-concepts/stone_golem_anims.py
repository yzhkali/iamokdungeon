import bpy, math
D = math.radians

arm = bpy.data.objects.get("Golem")
if not arm: raise Exception("找不到Golem，先跑stone_golem.py")
arm.animation_data_create()
# 清除所有旧NLA轨道
for t in list(arm.animation_data.nla_tracks):
    arm.animation_data.nla_tracks.remove(t)

def new_action(name):
    if name in bpy.data.actions: bpy.data.actions.remove(bpy.data.actions[name])
    return bpy.data.actions.new(name)

def kf(bone, frame, rx=0, ry=0, rz=0, lx=None, ly=None, lz=None):
    b = arm.pose.bones[bone]
    b.rotation_mode = 'XYZ'
    b.rotation_euler = (rx, ry, rz)
    b.keyframe_insert("rotation_euler", frame=frame)
    if lx is not None:
        b.location = (lx, ly, lz)
        b.keyframe_insert("location", frame=frame)

def nla(action, start):
    t = arm.animation_data.nla_tracks.new()
    t.name = action.name
    t.strips.new(action.name, start, action)

# ─── 1. IDLE (60f) ───────────────────────────────
a = new_action("Idle"); arm.animation_data.action = a
for f,v in [(0,0),(15,D(2)),(30,0),(45,D(-1)),(60,0)]:
    kf("Chest",f,rx=v)
for f,v in [(0,0),(20,D(1.5)),(40,D(-1)),(60,0)]:
    kf("Head",f,rx=v)
nla(a,0)

# ─── 2. WALK 大猩猩 (60f慢速) ─────────────────
a = new_action("Walk"); arm.animation_data.action = a
# 全程恒定：大幅前倾+头仰起看前方
for f in [0,60]:
    kf("Chest",f,rx=D(40)); kf("Spine",f,rx=D(18)); kf("Head",f,rx=D(-24))
# 腿全程半蹲+迈步
for f,ll,rl in [(0,D(32),D(8)),(15,D(22),D(18)),(30,D(8),D(32)),(45,D(18),D(22)),(60,D(32),D(8))]:
    kf("L_Thigh",f,rx=ll); kf("R_Thigh",f,rx=rl)
    kf("L_Shin",f,rx=ll*0.3); kf("R_Shin",f,rx=rl*0.3)
# L臂正rz=向前，R臂负rz=向前（镜像对称）
for f,lrz,rrz,lrx,rrx in [
    ( 0, D( 65),D(-25), D(-15),D( 5)),  # L手向前撑地
    (15, D( 20),D(-10), D( -5),D( 2)),
    (30, D(-25),D( 65), D(  5),D(-15)), # R手向前撑地
    (45, D(-10),D( 20), D(  2),D( -5)),
    (60, D( 65),D(-25), D(-15),D( 5)),
]:
    kf("L_UpperArm",f,rx=lrx,rz=lrz); kf("R_UpperArm",f,rx=rrx,rz=rrz)
    kf("L_ForeArm",f,rx=lrx*0.3);  kf("R_ForeArm",f,rx=rrx*0.3)
# 髋部左右摇摆
for f,rz in [(0,D(-6)),(15,D(-10)),(30,D(6)),(45,D(10)),(60,D(-6))]:
    kf("Hips",f,rz=rz)
nla(a,70)

# ─── 3. ATTACK 普通右拳 (40f) ──────────────────
a = new_action("Attack"); arm.animation_data.action = a
kf("Chest",0,rx=0);       kf("Chest",10,rx=D(-12)); kf("Chest",22,rx=D(18));  kf("Chest",40,rx=0)
kf("R_UpperArm",0,rx=0);  kf("R_UpperArm",10,rx=D(-50)); kf("R_UpperArm",22,rx=D(55)); kf("R_UpperArm",40,rx=0)
kf("R_ForeArm",0,rx=0);   kf("R_ForeArm",10,rx=D(-25)); kf("R_ForeArm",22,rx=D(35));  kf("R_ForeArm",40,rx=0)
kf("L_UpperArm",0,rz=0);  kf("L_UpperArm",10,rz=D(15)); kf("L_UpperArm",22,rz=D(-10));kf("L_UpperArm",40,rz=0)
nla(a,120)

# ─── 4. ATTACK HEAVY 右臂高举猛砸 (55f) ────────
a = new_action("AttackHeavy"); arm.animation_data.action = a
# 蓄力：左转+右臂高举过头
kf("Chest",0,rx=0,rz=0);       kf("Chest",14,rx=D(-10),rz=D(-18)); kf("Chest",28,rx=D(25),rz=D(22)); kf("Chest",55,rx=0,rz=0)
kf("Spine",0,rx=0,rz=0);       kf("Spine",14,rx=0,rz=D(-10));      kf("Spine",55,rx=0,rz=0)
kf("R_UpperArm",0,rx=0);        kf("R_UpperArm",14,rx=D(-120));     kf("R_UpperArm",28,rx=D(85));      kf("R_UpperArm",55,rx=0)
kf("R_ForeArm",0,rx=0);         kf("R_ForeArm",14,rx=D(-35));       kf("R_ForeArm",28,rx=D(25));       kf("R_ForeArm",55,rx=0)
kf("R_Fist",0,rx=0);            kf("R_Fist",14,rx=D(-20));          kf("R_Fist",28,rx=D(15));          kf("R_Fist",55,rx=0)
nla(a,170)

# ─── 5. ATTACK ULTIMATE 双手砸地 (70f) ──────────
a = new_action("AttackUltimate"); arm.animation_data.action = a
# 后仰蓄力→猛砸→余震
kf("Chest",0,rx=0);      kf("Chest",18,rx=D(-30)); kf("Chest",34,rx=D(40));  kf("Chest",55,rx=D(5));  kf("Chest",70,rx=0)
kf("Spine",0,rx=0);      kf("Spine",18,rx=D(-15)); kf("Spine",34,rx=D(20));  kf("Spine",70,rx=0)
for side in ["L","R"]:
    kf(f"{side}_UpperArm",0,rx=0);   kf(f"{side}_UpperArm",18,rx=D(-130)); kf(f"{side}_UpperArm",34,rx=D(75)); kf(f"{side}_UpperArm",70,rx=0)
    kf(f"{side}_ForeArm",0,rx=0);    kf(f"{side}_ForeArm",18,rx=D(-45));   kf(f"{side}_ForeArm",34,rx=D(30));  kf(f"{side}_ForeArm",70,rx=0)
nla(a,235)

# ─── 6. LEAP 泰山压顶 (80f) ─────────────────────
a = new_action("Leap"); arm.animation_data.action = a
# 蹲踞蓄力
kf("Root",0,lx=0,ly=0,lz=0);   kf("Root",8,lx=0,ly=0,lz=-0.08)
kf("Hips",0,rx=0);              kf("Hips",8,rx=D(15))
# 起跳
kf("Root",16,lx=0,ly=0,lz=0.5); kf("Hips",16,rx=0)
kf("L_UpperArm",16,rz=D(30));   kf("R_UpperArm",16,rz=D(-30))
# 空中慢动作（展开）
kf("Root",28,lx=0,ly=0,lz=0.9); kf("Root",36,lx=0,ly=0,lz=0.9)  # 慢速停留
kf("L_UpperArm",28,rz=D(70));   kf("R_UpperArm",28,rz=D(-70))
kf("L_Thigh",28,rx=D(15));      kf("R_Thigh",28,rx=D(15))
# 下落+收腿
kf("Root",48,lx=0,ly=0,lz=0)
kf("L_UpperArm",44,rz=0);       kf("R_UpperArm",44,rz=0)
# 落地压缩+前冲惯性
kf("Root",52,lx=0,ly=-0.05,lz=-0.1);   kf("Hips",52,rx=D(20))
kf("Root",62,lx=0,ly=-0.18,lz=0);      kf("Hips",62,rx=0)
kf("Root",80,lx=0,ly=-0.18,lz=0)       # 停在前冲位
nla(a,315)

# ─── 7. HURT 普通受伤 (25f) ─────────────────────
a = new_action("Hurt"); arm.animation_data.action = a
kf("Root",0,rx=0,lx=0,ly=0,lz=0)
kf("Root",6,rx=D(-20),lx=0,ly=0.12,lz=0)   # 后仰+后退
kf("Root",14,rx=D(5),lx=0,ly=0.04,lz=0)
kf("Root",25,rx=0,lx=0,ly=0,lz=0)
kf("Head",0,rx=0); kf("Head",6,rx=D(-15)); kf("Head",25,rx=0)
nla(a,405)

# ─── 8. DEATH 碎裂机械舞 (60f) ───────────────────
a = new_action("Death"); arm.animation_data.action = a
# 机械舞：突然一动一停
kf("Root",0,rx=0,rz=0,lx=0,ly=0,lz=0)
kf("Root",5,rx=0,rz=D(22),lx=0,ly=0,lz=0)   # SNAP右
kf("Root",8,rx=0,rz=D(22),lx=0,ly=0,lz=0)   # 停
kf("Root",11,rx=D(-12),rz=D(-18),lx=0,ly=0,lz=0) # SNAP左后
kf("Root",13,rx=D(-12),rz=D(-18),lx=0,ly=0,lz=0) # 停
# 右臂甩飞
kf("R_UpperArm",0,rx=0); kf("R_UpperArm",15,rx=D(-160)); kf("R_UpperArm",16,rx=D(-160))
# 左臂甩飞
kf("L_UpperArm",0,rx=0,rz=0); kf("L_UpperArm",18,rx=D(-145),rz=D(35)); kf("L_UpperArm",19,rx=D(-145),rz=D(35))
# 头极限扭转
kf("Head",0,rx=0,rz=0); kf("Head",22,rx=D(25),rz=D(-50)); kf("Head",23,rx=D(25),rz=D(-50))
# 整体倒塌
kf("Root",22,rx=0,rz=0,lx=0,ly=0,lz=0)
kf("Root",32,rx=D(20),rz=D(15),lx=0,ly=0.05,lz=-0.15)  # SNAP前倒
kf("Root",33,rx=D(20),rz=D(15),lx=0,ly=0.05,lz=-0.15)  # 停
kf("Root",40,rx=D(50),rz=D(25),lx=0,ly=0.1,lz=-0.45)
kf("Root",55,rx=D(80),rz=D(30),lx=0,ly=0.12,lz=-0.65)  # 倒地
kf("Hips",0,rx=0); kf("Hips",40,rx=D(25)); kf("Hips",55,rx=D(40))
nla(a,440)

arm.animation_data.action = None
bpy.context.scene.frame_set(0)
print("8个动画完成：Idle/Walk/Attack/AttackHeavy/AttackUltimate/Leap/Hurt/Death")
