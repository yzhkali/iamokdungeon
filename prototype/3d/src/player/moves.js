//  连招树 MOVES
//  每招: clip动画 / active(可衔接时长) / recover(僵直时长) /
//        onLight onHeavy(衔接到哪一招) / lunge前冲 / fx特效 / air是否空中招
//  recover>0 时该招最后有僵直；衔接窗口在 active 段内
// ============================================================
// ============================================================
//  连招树 MOVES（带 预备→挥击→停顿→收势 节奏）
//  strike: 命中瞬间(触发特效+顿帧)   cancel: 可取消/衔接下一招的时刻
//  total : 招式总时长(过后自动收势回站姿)   衔接窗口=[cancel, total]
// ============================================================
export const MOVES={
  // —— 地面轻击三连（cancel~total 之间为结尾定格，加长以增强分量感）——
  gL1:{clip:'gL1', strike:0.18, cancel:0.24, total:0.50, comboAt:0.32, onLight:'gL2', onHeavy:'gThrust', lunge:3.0, fx:'slashR', trail:true, trailSegs:8, hitR:0.85},
  gL2:{clip:'gL2', strike:0.17, cancel:0.24, total:0.53, comboAt:0.32, onLight:'gL3', onHeavy:'gKnee', lunge:2.6, fx:'slashL', trail:true, hitR:0.85},
  gL3:{clip:'gL3', strike:0.72, cancel:0.86, total:1.06, recoverClip:'gL3_recover', onLight:null, onHeavy:null, lunge:2.4, fx:'chop', trail:true},
  // 轻→重：突刺（滑行更远；突刺动作做完后才可按重击接大风车）
  gThrust:{clip:'gThrust', strike:0.44, cancel:0.54, total:0.80, comboAt:0.72, recoverClip:'gThrust_recover', onLight:null, onHeavy:'gSpinSlide', lunge:0, slide:20, fx:'thrust', thrustHit:true, trail:true},
  // 轻轻→重：顺发蓄力重击
  gFollowHeavy:{clip:'gFollowHeavy', strike:0.30, cancel:0.44, total:0.88, recoverClip:'gFollowHeavy_recover', onLight:null, onHeavy:null, lunge:3.6, fx:'heavyCircle'},
  // 大风车(重击按一次)：极快360°横扫，周身一圈判定
  gKnee:{clip:'gKnee', strike:0.32, cancel:0.46, total:0.68, onLight:null, onHeavy:null, lunge:14.0, slide:6, fx:'kick', hitR:1.1},
  gSpin:{clip:'gSpin', strike:0.30, cancel:0.52, total:0.62, recoverClip:'gSpin_recover', onLight:null, onHeavy:null, lunge:0, spinY:true, spinStart:0.26, spinEnd:0.50, fx:'spinSlash', ringHit:true, trail:true},
  // 突刺接出的大风车：带向前滑动 + 结束僵直更长
  gSpinSlide:{clip:'gSpin', strike:0.30, cancel:0.52, total:0.82, recoverClip:'gSpin_recover', onLight:null, onHeavy:null, lunge:0, spinY:true, spinStart:0.26, spinEnd:0.50, slide:9, fx:'spinSlash', ringHit:true, trail:true},
  // 蓄满大风车：转3圈，可20%移动，结尾不僵直→半蹲晕一圈
  gSpinCharged:{clip:'gSpin', strike:0.30, cancel:1.10, total:2.30, recoverClip:'gSpinCharged_recover', useRecoverClip:true, onLight:null, onHeavy:null, lunge:0, spinY:true, spinTurns:4, spinStart:0.26, spinEnd:1.10, chargedMove:true, dizzy:true, fx:'spinSlash', ringHit:true, trail:true},
  // 轻轻轻→重：顺发重击×2（A自动接B，B后有较长定格）
  gHeavyChain1:{clip:'gHeavyA', strike:0.24, cancel:0.34, total:0.44, onLight:null, onHeavy:null, auto:'gHeavyChain2', lunge:3.0, fx:'heavyCircle'},
  gHeavyChain2:{clip:'gHeavyB', strike:0.30, cancel:0.44, total:0.92, recoverClip:'gHeavyB_recover', onLight:null, onHeavy:null, lunge:3.4, fx:'heavyCircleBig'},

  // —— 空中招（第一下滞空挥剑，第二下从天而降大劈）——
  // 空中轻击两下：①aL1=地面轻击1(gL1)放空中挥+滞空 ②aChop=举刀从天而降俯冲、落地砸地、收势对齐 gL3、不发剑气
  aL1:{clip:'gL1', strike:0.22, cancel:0.32, total:0.62, comboAt:0.42, onLight:'aL2', onHeavy:'aChop', lunge:2.4, air:true, fx:'slashR', trail:true, hitR:0.85},
  // 空中第二下：举刀从天而降，落地瞬间砸地(无剑气)，落地姿态/收势对齐地面大劈 gL3
  aChop:{clip:'aChop', strike:0.35, cancel:0.42, total:0.45, hangT:0.25, onLight:null, onHeavy:null, air:true, plunge:'aChopLand', landHit:true, landFx:'slam', hitR:1.0, trail:true},
  aL2:{clip:'gL2', strike:0.22, cancel:0.32, total:0.62, comboAt:0.42, onLight:null, onHeavy:'aChop', lunge:2.6, air:true, fx:'slashL', trail:true, hitR:0.85},  // (现未接入连招，保留备用)
  aPlunge:{clip:'aPlunge', strike:0.16, cancel:99, total:0.30, onLight:null, onHeavy:null, air:true, plunge:'aPlunge_stiff', fx:'chop'},
  aThrust:{clip:'aThrust', strike:0.14, cancel:99, total:0.44, recoverClip:'aThrust_stiff', onLight:null, onHeavy:null, air:true, lunge:5.5, fx:'thrust'},
  aHeavyPlunge:{clip:'aHeavyPlunge', strike:0.16, cancel:99, total:0.30, onLight:null, onHeavy:null, air:true, plunge:'aHeavyPlunge_stiff', fx:'heavyCircle'},  // (旧空中重击，已被 aStomp 取代，保留备用)
  // 空中重击=陨石式战争践踏：无剑、双手举高瞬间砸地，落地坑痕+碎石+强震，半蹲力量姿势收尾
  aStomp:{clip:'aStomp', strike:0.05, cancel:99, total:0.40, onLight:null, onHeavy:null, air:true, plunge:'aStompLand', diveV:26, landFx:'stomp'},
  aJupiterLand:{clip:'aJupiterLand', strike:99, cancel:99, total:0.65, onLight:null, onHeavy:null},
  // 升龙接重击：空中木星电锯球(3圈前翻滚电锯+密集剑影+蜘蛛侠落地)
  aDrill:{clip:'aDrill', strike:0.04, cancel:99, total:0.25, onLight:null, onHeavy:null, air:true, plunge:'aJupiterLand', diveV:40, landFx:'drill', trail:true, trailSegs:10, ringHit:true, hitR:1.1}, // 旋风坠
  aJupiter:{clip:'aJupiter', strike:0.22, cancel:99, total:0.75, onLight:null, onHeavy:null, air:true, plunge:'aJupiterLand', hangT:0.55, diveV:22, trail:true, trailSegs:24, hitR:1.8, ringHit:true},
  aSpin:{clip:'aSpin', strike:0.30, cancel:99, total:0.42, onLight:null, onHeavy:null, air:true, plunge:'aSpin_stiff', spin:true, fx:'heavyCircleBig'},

  // —— 闪避连招 ——
  // 闪避→轻击：闪现飞踹(瞬移已在触发处完成，这里只播飞踹动作；暂不击飞，留给血量系统)
  dKick:{clip:'dKick', strike:0.26, cancel:0.46, total:0.60, onLight:null, onHeavy:null, lunge:2.0, slide:8, air:true, fx:'kick', hitR:1.0},
  // 闪避→重击：升龙剑。地面深蹲蓄力(0~0.24)→啪蹬地起跳上挑→空翻到顶→顶点定格。comboAt 在顶点(0.56)，接招更从容
  dRise:{clip:'dRise', strike:0.32, cancel:0.56, total:0.90, comboAt:0.68, onLight:'aChop', onHeavy:'aJupiter', lunge:0.4, chargeSlide:10, air:true, noHang:true, landClip:'dRise_land', fx:'rise', hitR:1.1, trail:true},
};
