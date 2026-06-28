export function createMapHud({
  THREE,
  roomSize,
  mapFeatures,
  getPlayer,
  heavyChargeTime,
  clearGameplayInputState,
  documentRef = document,
  windowRef = window
}) {
  const miniMapCanvas = documentRef.getElementById('miniMapCanvas');
  const miniMapCtx = miniMapCanvas.getContext('2d');
  const miniMapModeBtn = documentRef.getElementById('miniMapMode');
  const compassLabel = documentRef.getElementById('compassLabel');
  const worldMapOverlay = documentRef.getElementById('worldMapOverlay');
  const worldMapCanvas = documentRef.getElementById('worldMapCanvas');
  const worldMapCtx = worldMapCanvas.getContext('2d');
  const mapDockBtn = documentRef.getElementById('mapDockBtn');
  const closeWorldMapBtn = documentRef.getElementById('closeWorldMap');
  const stamBar = documentRef.getElementById('stamBar');
  const stateEl = documentRef.getElementById('state');

  let miniMapFollowFacing = false;
  let mapFrame = 0;

  miniMapModeBtn.onclick = () => {
    miniMapFollowFacing = !miniMapFollowFacing;
    miniMapModeBtn.textContent = miniMapFollowFacing ? '↑' : 'N';
    miniMapModeBtn.title = miniMapFollowFacing ? '角色朝向固定' : '北向固定';
    compassLabel.textContent = miniMapFollowFacing ? '' : 'N';
  };

  mapDockBtn.onclick = () => openWorldMap();
  closeWorldMapBtn.onclick = () => closeWorldMap();
  worldMapOverlay.addEventListener('click', e => {
    if (e.target === worldMapOverlay) closeWorldMap();
  });
  windowRef.addEventListener('keydown', e => {
    if (e.code === 'Escape' && isWorldMapOpen()) closeWorldMap();
  });

  function isWorldMapOpen() {
    return worldMapOverlay.classList.contains('open');
  }

  function openWorldMap() {
    clearGameplayInputState();
    worldMapOverlay.classList.add('open');
    drawWorldMap();
  }

  function closeWorldMap() {
    clearGameplayInputState();
    worldMapOverlay.classList.remove('open');
  }

  function colorToCss(color, alpha = 1) {
    const c = new THREE.Color(color);
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
  }

  function worldToMapPoint(x, z, scale, view, canvas) {
    return { x: canvas.width / 2 + (x - view.x) * scale, y: canvas.height / 2 + (z - view.z) * scale };
  }

  function drawRotRect(ctx, feature, scale, view, canvas, fill, stroke, lineWidth = 1) {
    const p = worldToMapPoint(feature.x, feature.z, scale, view, canvas);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(feature.rot);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(-feature.w * scale / 2, -feature.d * scale / 2, feature.w * scale, feature.d * scale);
    if (stroke) ctx.strokeRect(-feature.w * scale / 2, -feature.d * scale / 2, feature.w * scale, feature.d * scale);
    ctx.restore();
  }

  function drawPlayerMarker(ctx, scale, view, canvas, big = false) {
    const P = getPlayer();
    const p = worldToMapPoint(P.x, P.z, scale, view, canvas);
    const markerRot = miniMapFollowFacing && !big ? 0 : Math.PI - P.facing;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(markerRot);
    ctx.fillStyle = '#fff0a6';
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = big ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, big ? -13 : -9);
    ctx.lineTo(big ? 8 : 6, big ? 9 : 7);
    ctx.lineTo(0, big ? 5 : 3);
    ctx.lineTo(big ? -8 : -6, big ? 9 : 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawMap(ctx, canvas, { centerX = 0, centerZ = 0, scale = 4, rot = 0, big = false } = {}) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const view = { x: centerX, z: centerZ, rot };
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (rot) ctx.rotate(rot);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.fillStyle = big ? '#302b20' : '#2f2b20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(229,204,142,0.14)';
    ctx.lineWidth = 1;
    const gridStep = big ? 10 : 8;
    for (let gx = -60; gx <= 60; gx += gridStep) {
      const a = worldToMapPoint(gx, -60, scale, view, canvas), b = worldToMapPoint(gx, 60, scale, view, canvas);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let gz = -60; gz <= 60; gz += gridStep) {
      const a = worldToMapPoint(-60, gz, scale, view, canvas), b = worldToMapPoint(60, gz, scale, view, canvas);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const f of mapFeatures.filter(m => m.type === 'terrain')) drawRotRect(ctx, f, scale, view, canvas, colorToCss(f.color, 0.86), 'rgba(20,18,14,0.18)');
    for (const f of mapFeatures.filter(m => m.type === 'road')) drawRotRect(ctx, f, scale, view, canvas, colorToCss(f.color, 0.9), 'rgba(245,221,160,0.18)');
    for (const f of mapFeatures.filter(m => m.type === 'wall')) drawRotRect(ctx, f, scale, view, canvas, 'rgba(88,70,47,0.92)', 'rgba(36,25,15,0.7)');
    for (const f of mapFeatures.filter(m => m.type === 'building')) {
      const fill = f.tower ? '#b8aea0' : f.stone ? '#a9a091' : '#b99b6e';
      drawRotRect(ctx, f, scale, view, canvas, fill, 'rgba(60,36,20,0.9)', big ? 2 : 1);
      if (big && (f.sign || f.name)) {
        const p = worldToMapPoint(f.x, f.z, scale, view, canvas);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-(view.rot || 0));
        ctx.fillStyle = '#f3d995'; ctx.font = 'bold 14px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.sign || f.name, 0, 0);
        ctx.restore();
      }
    }
    for (const f of mapFeatures.filter(m => m.type === 'training' || m.type === 'monster')) {
      const p = worldToMapPoint(f.x, f.z, scale, view, canvas);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-(view.rot || 0));
      ctx.fillStyle = f.type === 'monster' ? '#b45b7a' : '#d49a4a';
      ctx.strokeStyle = 'rgba(20,12,8,0.8)';
      ctx.lineWidth = big ? 2 : 1;
      ctx.beginPath(); ctx.arc(0, 0, big ? 7 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (big) { ctx.fillStyle = '#f0d68a'; ctx.font = '12px Arial, sans-serif'; ctx.fillText(f.type === 'monster' ? '怪' : '桩', 0, 4); }
      ctx.restore();
    }
    ctx.restore();
    drawPlayerMarker(ctx, scale, { x: centerX, z: centerZ, rot: 0 }, canvas, big);
    if (!big) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,226,146,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawMiniMap() {
    const P = getPlayer();
    const scale = 6.3;
    const rot = miniMapFollowFacing ? P.facing - Math.PI : 0;
    drawMap(miniMapCtx, miniMapCanvas, { centerX: P.x, centerZ: P.z, scale, rot, big: false });
  }

  function drawWorldMap() {
    const scale = Math.min((worldMapCanvas.width - 90) / (roomSize * 2), (worldMapCanvas.height - 90) / (roomSize * 2));
    drawMap(worldMapCtx, worldMapCanvas, { centerX: 0, centerZ: 0, scale, rot: 0, big: true });
    worldMapCtx.save();
    worldMapCtx.fillStyle = '#f0d68a'; worldMapCtx.font = 'bold 18px Arial, sans-serif'; worldMapCtx.textAlign = 'center';
    worldMapCtx.fillText('N', worldMapCanvas.width / 2, 34);
    worldMapCtx.fillText('S', worldMapCanvas.width / 2, worldMapCanvas.height - 18);
    worldMapCtx.fillText('W', 28, worldMapCanvas.height / 2);
    worldMapCtx.fillText('E', worldMapCanvas.width - 28, worldMapCanvas.height / 2);
    worldMapCtx.restore();
  }

  function updateHUD() {
    const P = getPlayer();
    const r = P.stamina / P.staminaMax;
    stamBar.style.width = (r * 100) + '%';
    stamBar.style.background = r < 0.28 ? '#d9534f' : '#5bc0de';
    let st;
    if (P.dead) st = '倒下';
    else if (P.state === 'dodge') st = '闪避冲刺';
    else if (P.charging) st = '蓄力 ' + (Math.min(1, P.chargeT / heavyChargeTime) * 100 | 0) + '%' + (P.chargeFull ? ' 满!' : '');
    else if (P.move) st = '连招: ' + P.move + (P.phase === 'hold' ? '(收势)' : P.phase === 'startup' ? '(预备)' : '');
    else if (P.state === 'taunt') st = '推眼镜';
    else if (P.jumping) st = '跳跃';
    else if (P.moving) st = '奔跑';
    else st = '待机';
    stateEl.textContent = '状态: ' + st;
    mapFrame++;
    if (mapFrame % 2 === 0) drawMiniMap();
    if (isWorldMapOpen() && mapFrame % 6 === 0) drawWorldMap();
  }

  return { updateHUD, isWorldMapOpen, openWorldMap, closeWorldMap, drawMiniMap, drawWorldMap };
}
