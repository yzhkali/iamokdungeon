import bpy
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 石头材质（带石纹暗色变体）
def stone_mat(name, r, g, b):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    _b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    _b.inputs["Base Color"].default_value = (r, g, b, 1)
    _b.inputs["Roughness"].default_value = 0.92
    return m

stone_dark  = stone_mat("StoneDark",  0.28, 0.25, 0.22)   # 躯干/腿
stone_light = stone_mat("StoneLight", 0.40, 0.37, 0.33)   # 头/手

# 发光材质（眼睛+符文）
glow = bpy.data.materials.new("Glow")
glow.use_nodes = True
nt = glow.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission')
em.inputs["Color"].default_value = (1.0, 0.75, 0.1, 1)
em.inputs["Strength"].default_value = 5.0
nt.links.new(em.outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs[0])

# 身体部件：(名称, 位置, 缩放, 材质)
PARTS = [
    ("Head",       ( 0,    0,    1.45), (0.80, 0.65, 0.72), stone_light),
    ("Torso",      ( 0,    0,    0.80), (1.10, 0.60, 0.55), stone_dark),
    ("Hips",       ( 0,    0,    0.40), (0.88, 0.52, 0.30), stone_dark),
    ("L_Shoulder", (-0.72, 0,    1.20), (0.55, 0.45, 0.12), stone_light), # 肩甲
    ("R_Shoulder", ( 0.72, 0,    1.20), (0.55, 0.45, 0.12), stone_light),
    ("L_UpperArm", (-0.95, 0,    0.88), (0.48, 0.48, 0.55), stone_dark),
    ("R_UpperArm", ( 0.95, 0,    0.88), (0.48, 0.48, 0.55), stone_dark),
    ("L_ForeArm",  (-1.00, 0,    0.32), (0.42, 0.42, 0.50), stone_dark),
    ("R_ForeArm",  ( 1.00, 0,    0.32), (0.42, 0.42, 0.50), stone_dark),
    ("L_Fist",     (-1.05, 0,   -0.22), (0.60, 0.60, 0.60), stone_light),
    ("R_Fist",     ( 1.05, 0,   -0.22), (0.60, 0.60, 0.60), stone_light),
    ("L_Thigh",    (-0.29, 0,    0.12), (0.42, 0.40, 0.28), stone_dark),
    ("R_Thigh",    ( 0.29, 0,    0.12), (0.42, 0.40, 0.28), stone_dark),
    ("L_Shin",     (-0.29, 0,   -0.20), (0.36, 0.36, 0.26), stone_dark),
    ("R_Shin",     ( 0.29, 0,   -0.20), (0.36, 0.36, 0.26), stone_dark),
    ("L_Foot",     (-0.29,-0.08,-0.42), (0.42, 0.56, 0.18), stone_light),
    ("R_Foot",     ( 0.29,-0.08,-0.42), (0.42, 0.56, 0.18), stone_light),
    ("ChestRune",  ( 0,   -0.32, 0.82), (0.22, 0.04, 0.22), glow),  # 胸口符文
    ("L_Eye",      (-0.20,-0.34, 1.50), (0.11, 0.05, 0.10), glow),
    ("R_Eye",      ( 0.20,-0.34, 1.50), (0.11, 0.05, 0.10), glow),
]

BONE_FOR = {
    "Head":"Head","Torso":"Chest","Hips":"Hips",
    "L_Shoulder":"L_UpperArm","R_Shoulder":"R_UpperArm",
    "L_UpperArm":"L_UpperArm","R_UpperArm":"R_UpperArm",
    "L_ForeArm":"L_ForeArm","R_ForeArm":"R_ForeArm",
    "L_Fist":"L_Fist","R_Fist":"R_Fist",
    "L_Thigh":"L_Thigh","R_Thigh":"R_Thigh",
    "L_Shin":"L_Shin","R_Shin":"R_Shin",
    "L_Foot":"L_Foot","R_Foot":"R_Foot",
    "ChestRune":"Chest","L_Eye":"Head","R_Eye":"Head",
}

objs = {}
for name, loc, sc, mat in PARTS:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = sc
    bpy.ops.object.transform_apply(scale=True)
    # 倒角：让边缘不那么锐利
    if mat is not glow:
        bev = o.modifiers.new("Bevel", 'BEVEL')
        bev.width = 0.022
        bev.segments = 1
    o.data.materials.append(mat)
    objs[name] = o

# 骨骼
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
arm = bpy.context.active_object
arm.name = "Golem"
eb = arm.data.edit_bones
for b in list(eb): eb.remove(b)

def B(name, head, tail, par=None):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if par: b.parent = eb[par]

B("Root",      (0,0,0),        (0,0,0.20))
B("Hips",      (0,0,0.28),     (0,0,0.55),    "Root")
B("Spine",     (0,0,0.60),     (0,0,0.85),    "Hips")
B("Chest",     (0,0,0.85),     (0,0,1.20),    "Spine")
B("Head",      (0,0,1.22),     (0,0,1.85),    "Chest")
B("L_UpperArm",(-0.60,0,1.10), (-1.00,0,0.80),"Chest")
B("L_ForeArm", (-1.00,0,0.80), (-1.05,0,0.35),"L_UpperArm")
B("L_Fist",    (-1.05,0,0.30), (-1.05,0,-0.30),"L_ForeArm")
B("R_UpperArm",( 0.60,0,1.10), ( 1.00,0,0.80),"Chest")
B("R_ForeArm", ( 1.00,0,0.80), ( 1.05,0,0.35),"R_UpperArm")
B("R_Fist",    ( 1.05,0,0.30), ( 1.05,0,-0.30),"R_ForeArm")
B("L_Thigh",   (-0.29,0,0.28), (-0.29,0,0.00),"Hips")
B("L_Shin",    (-0.29,0,0.00), (-0.29,0,-0.35),"L_Thigh")
B("L_Foot",    (-0.29,0,-0.35),(-0.29,-0.35,-0.48),"L_Shin")
B("R_Thigh",   ( 0.29,0,0.28), ( 0.29,0,0.00),"Hips")
B("R_Shin",    ( 0.29,0,0.00), ( 0.29,0,-0.35),"R_Thigh")
B("R_Foot",    ( 0.29,0,-0.35),( 0.29,-0.35,-0.48),"R_Shin")

bpy.ops.object.mode_set(mode='OBJECT')

for name, o in objs.items():
    bn = BONE_FOR[name]
    mod = o.modifiers.new("Arm", 'ARMATURE')
    mod.object = arm
    vg = o.vertex_groups.new(name=bn)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    o.parent = arm

print("石头傀儡完成！")
