import bpy
from mathutils import Vector, Euler
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def mat(name,r,g,b,rough=0.85):
    m=bpy.data.materials.new(name); m.use_nodes=True
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs["Base Color"].default_value=(r,g,b,1)
    node.inputs["Roughness"].default_value=rough
    return m

def glow_mat(name,r,g,b):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    em=nt.nodes.new('ShaderNodeEmission')
    em.inputs["Color"].default_value=(r,g,b,1)
    em.inputs["Strength"].default_value=5.0
    nt.links.new(em.outputs[0],nt.nodes.new('ShaderNodeOutputMaterial').inputs[0])
    return m

fur   = mat("Fur",   0.28,0.28,0.30)
light = mat("Light", 0.55,0.54,0.52)  # 浅灰：吻/胸
dark  = mat("Dark",  0.10,0.09,0.08)  # 黑：爪
white = mat("White", 0.90,0.88,0.85)  # 牙
eye   = glow_mat("Eye",1.0,0.05,0.05) # 红眼

# (名称, 位置, 缩放, 材质, 旋转角度rad xyz)
PARTS = [
    # 躯干
    ("Body",     ( 0,   0.05, 0.68),(0.70,0.88,0.48),fur,  None),
    ("Hips",     ( 0,   0.60, 0.72),(0.58,0.42,0.42),fur,  None),
    # 背部脊刺
    ("Spine1",   ( 0,  -0.05, 0.98),(0.12,0.32,0.20),fur,  None),
    ("Spine2",   ( 0,   0.28, 0.96),(0.12,0.28,0.17),fur,  None),
    # 头颈（略向前低）
    ("Neck",     ( 0,  -0.50, 0.76),(0.42,0.36,0.40),fur,  None),
    ("Head",     ( 0,  -0.92, 0.74),(0.72,0.58,0.64),fur,  None),
    ("Snout",    ( 0,  -1.32, 0.60),(0.38,0.42,0.30),light,None),
    ("Teeth",    ( 0,  -1.40, 0.50),(0.28,0.06,0.10),white,None),
    # 耳朵（向上竖起）
    ("L_Ear",    (-0.22,-0.92, 1.12),(0.14,0.10,0.32),fur,  (0,0, 0.18)),
    ("R_Ear",    ( 0.22,-0.92, 1.12),(0.14,0.10,0.32),fur,  (0,0,-0.18)),
    # 尾巴
    ("Tail1",    ( 0,   1.02, 0.80),(0.22,0.30,0.22),fur,  None),
    ("Tail2",    ( 0,   1.35, 1.02),(0.17,0.26,0.17),light,None),
    # 前腿
    ("FL_Upper", (-0.34,-0.30, 0.40),(0.26,0.26,0.36),fur, None),
    ("FR_Upper", ( 0.34,-0.30, 0.40),(0.26,0.26,0.36),fur, None),
    ("FL_Lower", (-0.34,-0.30, 0.04),(0.22,0.22,0.34),fur, None),
    ("FR_Lower", ( 0.34,-0.30, 0.04),(0.22,0.22,0.34),fur, None),
    ("FL_Paw",  (-0.34,-0.38,-0.22),(0.28,0.38,0.16),dark, None),
    ("FR_Paw",  ( 0.34,-0.38,-0.22),(0.28,0.38,0.16),dark, None),
    # 后腿
    ("BL_Upper", (-0.32, 0.55, 0.40),(0.26,0.26,0.40),fur, None),
    ("BR_Upper", ( 0.32, 0.55, 0.40),(0.26,0.26,0.40),fur, None),
    ("BL_Lower", (-0.32, 0.62,-0.02),(0.22,0.22,0.36),fur, None),
    ("BR_Lower", ( 0.32, 0.62,-0.02),(0.22,0.22,0.36),fur, None),
    ("BL_Paw",  (-0.32, 0.70,-0.28),(0.28,0.40,0.16),dark, None),
    ("BR_Paw",  ( 0.32, 0.70,-0.28),(0.28,0.40,0.16),dark, None),
    # 眼睛
    ("L_Eye",    (-0.22,-1.20, 0.84),(0.10,0.05,0.09),eye, None),
    ("R_Eye",    ( 0.22,-1.20, 0.84),(0.10,0.05,0.09),eye, None),
]

BONE_FOR = {
    "Body":"Spine","Hips":"Hips","Neck":"Neck","Head":"Head",
    "Snout":"Head","Teeth":"Head","L_Ear":"Head","R_Ear":"Head",
    "Spine1":"Spine","Spine2":"Spine",
    "Tail1":"Tail1","Tail2":"Tail2",
    "FL_Upper":"FL_Upper","FR_Upper":"FR_Upper",
    "FL_Lower":"FL_Lower","FR_Lower":"FR_Lower",
    "FL_Paw":"FL_Paw","FR_Paw":"FR_Paw",
    "BL_Upper":"BL_Upper","BR_Upper":"BR_Upper",
    "BL_Lower":"BL_Lower","BR_Lower":"BR_Lower",
    "BL_Paw":"BL_Paw","BR_Paw":"BR_Paw",
    "L_Eye":"Head","R_Eye":"Head",
}

objs = {}
for name, loc, sc, m, rot in PARTS:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = sc
    if rot: o.rotation_euler = Euler(rot, 'XYZ')
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if m not in (eye, white):
        bev = o.modifiers.new("Bevel",'BEVEL')
        bev.width=0.018; bev.segments=1
    o.data.materials.append(m)
    objs[name] = o

# 骨骼
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
arm = bpy.context.active_object; arm.name = "AshWolf"
eb = arm.data.edit_bones
for b in list(eb): eb.remove(b)

def B(name,head,tail,par=None):
    b=eb.new(name); b.head,b.tail=Vector(head),Vector(tail)
    if par: b.parent=eb[par]

B("Root",    (0,0,0),           (0,0,0.20))
B("Hips",    (0, 0.55,0.68),    (0, 0.12,0.70),"Root")
B("Spine",   (0, 0.08,0.70),    (0,-0.32,0.72),"Hips")
B("Chest",   (0,-0.32,0.72),    (0,-0.60,0.76),"Spine")
B("Neck",    (0,-0.60,0.76),    (0,-0.80,0.85),"Chest")
B("Head",    (0,-0.80,0.85),    (0,-1.28,0.88),"Neck")
B("Tail1",   (0, 0.85,0.74),    (0, 1.18,0.95),"Hips")
B("Tail2",   (0, 1.18,0.95),    (0, 1.48,1.12),"Tail1")
B("FL_Upper",(-0.34,-0.30,0.58),(-0.34,-0.30,0.22),"Chest")
B("FL_Lower",(-0.34,-0.30,0.22),(-0.34,-0.30,-0.14),"FL_Upper")
B("FL_Paw", (-0.34,-0.30,-0.14),(-0.34,-0.48,-0.28),"FL_Lower")
B("FR_Upper",( 0.34,-0.30,0.58),( 0.34,-0.30,0.22),"Chest")
B("FR_Lower",( 0.34,-0.30,0.22),( 0.34,-0.30,-0.14),"FR_Upper")
B("FR_Paw", ( 0.34,-0.30,-0.14),( 0.34,-0.48,-0.28),"FR_Lower")
B("BL_Upper",(-0.32, 0.55,0.60),(-0.32, 0.60,0.18),"Hips")
B("BL_Lower",(-0.32, 0.60,0.18),(-0.32, 0.68,-0.20),"BL_Upper")
B("BL_Paw", (-0.32, 0.68,-0.20),(-0.32, 0.78,-0.35),"BL_Lower")
B("BR_Upper",( 0.32, 0.55,0.60),( 0.32, 0.60,0.18),"Hips")
B("BR_Lower",( 0.32, 0.60,0.18),( 0.32, 0.68,-0.20),"BR_Upper")
B("BR_Paw", ( 0.32, 0.68,-0.20),( 0.32, 0.78,-0.35),"BR_Lower")

bpy.ops.object.mode_set(mode='OBJECT')

for name, o in objs.items():
    bn=BONE_FOR[name]
    mod=o.modifiers.new("Arm",'ARMATURE'); mod.object=arm
    vg=o.vertex_groups.new(name=bn)
    vg.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
    o.parent=arm

print("灰狼完成！")
