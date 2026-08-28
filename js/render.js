// ===================== Rendering: perspective 3D pitch, players, ball, HUD, minimap =====================
// A lightweight hand-rolled 3D camera (no WebGL/engine): world points (x = pitch length,
// y = height above ground, z = pitch width/depth) are projected through a look-at camera onto
// the canvas. The minimap stays a flat top-down radar, same as before.
const UNIT_PER_MIN_DIM = 600;
const BILLBOARD_HEIGHT = 64;   // world units tall for an outfield player's on-screen sprite
const GK_BILLBOARD_HEIGHT = 68;

function segLine(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
}

function strokePolyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.stroke();
}

function fillQuad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
  ctx.fill();
}

function taperedTorsoPath(ctx, cx, topY, h, topW, botW, r) {
  const x0t = cx - topW / 2, x1t = cx + topW / 2;
  const x0b = cx - botW / 2, x1b = cx + botW / 2;
  const botY = topY + h;
  r = Math.max(0, Math.min(r, h / 2));
  ctx.beginPath();
  ctx.moveTo(x0t + r, topY);
  ctx.lineTo(x1t - r, topY);
  ctx.quadraticCurveTo(x1t, topY, x1t, topY + r);
  ctx.lineTo(x1b, botY - r);
  ctx.quadraticCurveTo(x1b, botY, x1b - r, botY);
  ctx.lineTo(x0b + r, botY);
  ctx.quadraticCurveTo(x0b, botY, x0b, botY - r);
  ctx.lineTo(x0t, topY + r);
  ctx.quadraticCurveTo(x0t, topY, x0t + r, topY);
  ctx.closePath();
}

const HAIR_COLORS = ['#241a12', '#3a2416', '#0f0d0b', '#5c3a1e', '#1c1c1c'];

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

class Renderer {
  constructor(canvas, miniCanvas, wrapEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = miniCanvas;
    this.miniCtx = miniCanvas.getContext('2d');
    this.wrap = wrapEl;
    // Smoothed ground-plane point the 3D camera tracks (still called `camera` to keep the
    // minimap/API surface stable — it is the look-at focus, not the camera position itself).
    this.camera = { x: FIELD.length / 2, y: FIELD.width / 2 };
    this.dpr = 1;
    this.viewW = 1000;   // approximate ground footprint, used only for the minimap viewport box
    this.viewH = 640;
    this.zoomUnits = UNIT_PER_MIN_DIM;
    this.fovY = 0.80;    // vertical field of view, radians
    this.focal = 500;
    this.cam = null;
    this.ballTrail = [];
    this.hud = {
      score: document.getElementById('hudScore'),
      clock: document.getElementById('hudClock'),
      homeName: document.getElementById('hudHomeName'),
      awayName: document.getElementById('hudAwayName'),
      homeBadge: document.getElementById('hudHomeBadge'),
      awayBadge: document.getElementById('hudAwayBadge'),
      banner: document.getElementById('banner'),
    };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const cw = this.wrap.clientWidth || 800;
    const ch = this.wrap.clientHeight || 500;
    const ratio = cw / ch;
    if (ratio >= 1) { this.viewH = this.zoomUnits; this.viewW = this.zoomUnits * ratio; }
    else { this.viewW = this.zoomUnits; this.viewH = this.zoomUnits / ratio; }

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(cw * dpr));
    this.canvas.height = Math.max(1, Math.round(ch * dpr));
    this.dpr = dpr;
    this.focal = (this.canvas.height / 2) / Math.tan(this.fovY / 2);

    const mw = this.miniCanvas.clientWidth || 150;
    const mh = this.miniCanvas.clientHeight || 96;
    this.miniCanvas.width = Math.round(mw * dpr);
    this.miniCanvas.height = Math.round(mh * dpr);
  }

  resetCamera() {
    this.camera.x = FIELD.length / 2;
    this.camera.y = FIELD.width / 2;
  }

  updateCamera(match, dt) {
    const camMinX = this.viewW / 2 - FIELD.margin;
    const camMaxX = FIELD.length + FIELD.margin - this.viewW / 2;
    const camMinY = this.viewH / 2 - FIELD.margin;
    const camMaxY = FIELD.width + FIELD.margin - this.viewH / 2;
    const ball = match.ball;
    const tx = clamp(ball.x + ball.vx * 0.12, Math.min(camMinX, camMaxX), Math.max(camMinX, camMaxX));
    const ty = clamp(ball.y + ball.vy * 0.12, Math.min(camMinY, camMaxY), Math.max(camMinY, camMaxY));
    const t = clamp(dt * 3.2, 0, 1);
    this.camera.x = lerp(this.camera.x, tx, t);
    this.camera.y = lerp(this.camera.y, ty, t);
  }

  // Builds a look-at camera: elevated, sitting behind the near touchline, tracking the
  // smoothed ball position — a hand-rolled version of the classic side-on broadcast camera.
  buildCamera3D() {
    const camHeight = this.zoomUnits * 0.40;
    const camBack = this.zoomUnits * 0.74;
    const pos = { x: this.camera.x, y: camHeight, z: -camBack };
    const target = { x: this.camera.x, y: 0, z: this.camera.y };
    const forward = v3norm(v3sub(target, pos));
    let right = v3norm(v3cross(forward, { x: 0, y: 1, z: 0 }));
    if (!Number.isFinite(right.x) || (Math.abs(right.x) < 1e-6 && Math.abs(right.z) < 1e-6)) right = { x: 1, y: 0, z: 0 };
    const up = v3cross(right, forward);
    this.cam = { pos, forward, right, up };
  }

  // px = world length (x), ph = height above ground, pz = world depth/width (y)
  project(px, ph, pz) {
    const cam = this.cam;
    const rel = { x: px - cam.pos.x, y: ph - cam.pos.y, z: pz - cam.pos.z };
    // cam.right points toward world -X (an artifact of the cross-product order used to derive
    // it from `forward`); negate here so increasing world X moves rightward on screen, matching
    // the minimap/HUD convention, without touching the (already-correct) vertical basis.
    const cx = -v3dot(rel, cam.right);
    const cy = v3dot(rel, cam.up);
    const cz = v3dot(rel, cam.forward);
    const zc = cz > 5 ? cz : 5;
    const scale = this.focal / zc;
    return {
      sx: this.canvas.width / 2 + cx * scale,
      sy: this.canvas.height / 2 - cy * scale,
      scale,
      cz,
      visible: cz > 5,
    };
  }

  projectCircle(cx, cz, r, startA, endA, segs) {
    const pts = [];
    const span = endA - startA;
    for (let i = 0; i <= segs; i++) {
      const a = startA + span * (i / segs);
      pts.push(this.project(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
    }
    return pts;
  }

  strokeRect3D(ctx, x0, x1, y0, y1) {
    const pts = [this.project(x0, 0, y0), this.project(x1, 0, y0), this.project(x1, 0, y1), this.project(x0, 0, y1)];
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    ctx.stroke();
  }

  drawSky(ctx, walled, celebrating) {
    const w = this.canvas.width, h = this.canvas.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    if (walled) {
      grad.addColorStop(0, '#182028');
      grad.addColorStop(1, '#2b3038');
    } else {
      grad.addColorStop(0, '#0a1712');
      grad.addColorStop(1, '#163826');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const farL = this.project(0, 0, FIELD.width + FIELD.margin);
    const farR = this.project(FIELD.length, 0, FIELD.width + FIELD.margin);
    const horizonY = Math.min(Math.max(farL.sy, 0), Math.max(farR.sy, 0), h * 0.5);

    // A tall, three-tier stand so the stadium reads as packed rather than a thin strip.
    const bandH = h * (walled ? 0.16 : 0.30);
    const bandTop = Math.max(0, horizonY - bandH);
    const upperH = bandH * 0.26;
    const midH = bandH * 0.32;
    const upperBot = bandTop + upperH;
    const midBot = upperBot + midH;

    ctx.fillStyle = walled ? '#0d1114' : '#0a120d';
    ctx.fillRect(0, bandTop, w, upperH);
    ctx.fillStyle = walled ? '#141a1e' : '#101f16';
    ctx.fillRect(0, upperBot, w, midH);
    ctx.fillStyle = walled ? '#1b2227' : '#17301f';
    ctx.fillRect(0, midBot, w, Math.max(0, horizonY - midBot + 2));

    if (!walled) {
      // Blocks of fans in different section colors, stable per-frame (no per-frame randomness),
      // covering the two nearer tiers — the most distant tier reads as a plain dim crowd.
      const patchColors = ['#2c3f6b', '#6b2c3f', '#2c6b4a', '#6b5a2c', '#3f2c6b', '#2c5a6b'];
      const blockW = 40;
      ctx.globalAlpha = 0.6;
      for (let x = 0, bi = 0; x < w; x += blockW, bi++) {
        const hash = Math.abs(Math.sin(bi * 12.9898)) * 43758.5453;
        ctx.fillStyle = patchColors[Math.floor(hash) % patchColors.length];
        ctx.fillRect(x, upperBot, blockW - 2, horizonY - upperBot);
      }
      ctx.globalAlpha = 1;
    }

    if (walled) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = bandTop + 3; y < horizonY; y += 5) {
        const rowShift = ((y * 13) % 9);
        for (let x = -10 + rowShift; x < w; x += 9) ctx.fillRect(x, y, 3, 3);
      }
    } else {
      // Individual fans (tiny head + body), packed tighter in the nearer tiers, rippling in a
      // traveling wave that livens up into a bigger cheer while a goal is being celebrated.
      const t = performance.now() / 1000;
      const amp = celebrating ? 3.4 : 1.1;
      const speed = celebrating ? 8 : 2.1;
      const rowH = 5;
      let ri = 0;
      for (let y = bandTop + 3; y < horizonY; y += rowH, ri++) {
        const nearness = y < upperBot ? 0 : (y < midBot ? 1 : 2);
        const colStep = nearness === 0 ? 12 : (nearness === 1 ? 8 : 6);
        const tierBright = 0.4 + nearness * 0.28;
        const rowShift = (ri % 2) * (colStep / 2);
        let fi = 0;
        for (let x = rowShift; x < w; x += colStep, fi++) {
          const hash = Math.abs(Math.sin((fi * 7 + ri * 13.1) * 12.9898)) % 1;
          const bob = Math.sin(t * speed - x * 0.045 + hash * 6.28) * amp;
          const bright = (0.45 + hash * 0.4) * tierBright;
          ctx.fillStyle = `rgba(255,236,220,${0.17 * bright})`;
          ctx.beginPath();
          ctx.arc(x, y + bob, 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x - 1.1, y + bob + 1.3, 2.2, 2.5);
        }
      }
    }

    if (!walled) {
      ctx.fillStyle = 'rgba(255, 244, 214, 0.10)';
      const lights = 4;
      for (let i = 0; i < lights; i++) {
        const lx = w * ((i + 0.5) / lights);
        ctx.beginPath();
        ctx.ellipse(lx, bandTop - 4, w * 0.05, h * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawGround(ctx, walled) {
    const m = FIELD.margin;
    const stripeW = walled ? 46 : 72;
    const colorA = walled ? '#3f464d' : '#1a5228';
    const colorB = walled ? '#363c42' : '#124020';
    let toggle = 0;
    for (let x = -m; x < FIELD.length + m; x += stripeW) {
      const x2 = Math.min(x + stripeW, FIELD.length + m);
      const p1 = this.project(x, 0, -m);
      const p2 = this.project(x2, 0, -m);
      const p3 = this.project(x2, 0, FIELD.width + m);
      const p4 = this.project(x, 0, FIELD.width + m);
      ctx.fillStyle = toggle % 2 === 0 ? colorA : colorB;
      fillQuad(ctx, p1, p2, p3, p4);
      toggle++;
    }
  }

  drawBoarding(ctx) {
    const m = FIELD.margin;
    const wallH = 46;
    const segs = [
      [-m, -m, FIELD.length + m, -m],
      [-m, FIELD.width + m, FIELD.length + m, FIELD.width + m],
      [-m, -m, -m, FIELD.width + m],
      [FIELD.length + m, -m, FIELD.length + m, FIELD.width + m],
    ];
    ctx.fillStyle = '#20262b';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (const [x0, y0, x1, y1] of segs) {
      const g0 = this.project(x0, 0, y0), g1 = this.project(x1, 0, y1);
      const t0 = this.project(x0, wallH, y0), t1 = this.project(x1, wallH, y1);
      fillQuad(ctx, g0, g1, t1, t0);
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const gx = lerp(x0, x1, t), gy = lerp(y0, y1, t);
        segLine(ctx, this.project(gx, 0, gy), this.project(gx, wallH, gy));
      }
    }
  }

  drawAdBoards(ctx) {
    const m = FIELD.margin;
    const boardH = 22;
    const inset = m * 0.32;
    const segs = [
      [-inset, -inset, FIELD.length + inset, -inset],
      [-inset, FIELD.width + inset, FIELD.length + inset, FIELD.width + inset],
      [-inset, -inset, -inset, FIELD.width + inset],
      [FIELD.length + inset, -inset, FIELD.length + inset, FIELD.width + inset],
    ];
    const panelLen = 130;
    let colorIdx = 0, nameIdx = 0;
    for (const [x0, y0, x1, y1] of segs) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const count = Math.max(1, Math.round(len / panelLen));
      for (let i = 0; i < count; i++) {
        const t0 = i / count, t1 = (i + 1) / count;
        const ax = lerp(x0, x1, t0), ay = lerp(y0, y1, t0);
        const bx = lerp(x0, x1, t1), by = lerp(y0, y1, t1);
        const g0 = this.project(ax, 0, ay), g1 = this.project(bx, 0, by);
        if (!g0.visible && !g1.visible) { colorIdx++; nameIdx++; continue; }
        const t0top = this.project(ax, boardH, ay), t1top = this.project(bx, boardH, by);
        ctx.fillStyle = AD_BOARD_COLORS[colorIdx % AD_BOARD_COLORS.length];
        fillQuad(ctx, g0, g1, t1top, t0top);

        const panelPxLen = Math.hypot(g1.sx - g0.sx, g1.sy - g0.sy);
        const midTopX = (t0top.sx + t1top.sx) / 2, midTopY = (t0top.sy + t1top.sy) / 2;
        const midBotX = (g0.sx + g1.sx) / 2, midBotY = (g0.sy + g1.sy) / 2;
        const panelPxH = Math.hypot(midTopX - midBotX, midTopY - midBotY);
        if (panelPxLen > 24 && panelPxH > 4) {
          const angle = Math.atan2(g1.sy - g0.sy, g1.sx - g0.sx);
          ctx.save();
          ctx.translate((midTopX + midBotX) / 2, (midTopY + midBotY) / 2);
          ctx.rotate(angle);
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.font = `700 ${Math.max(5, panelPxH * 0.55)}px Segoe UI, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(AD_BOARDS[nameIdx % AD_BOARDS.length], 0, 0);
          ctx.restore();
        }
        colorIdx++; nameIdx++;
      }
    }
  }

  drawPitchWear(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    const spots = [
      [FIELD.length / 2, FIELD.width / 2, FIELD.centerCircleR * 0.5],
      [FIELD.penSpotDist, FIELD.width / 2, 60],
      [FIELD.length - FIELD.penSpotDist, FIELD.width / 2, 60],
      [FIELD.goalBoxDepth * 0.5, FIELD.width / 2, 34],
      [FIELD.length - FIELD.goalBoxDepth * 0.5, FIELD.width / 2, 34],
    ];
    for (const [cx, cz, r] of spots) {
      const pts = this.projectCircle(cx, cz, r, 0, Math.PI * 2, 20);
      ctx.beginPath();
      ctx.moveTo(pts[0].sx, pts[0].sy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawFloodlightGlow(ctx) {
    const focus = this.project(this.camera.x, 0, this.camera.y);
    const w = this.canvas.width, h = this.canvas.height;
    const r = Math.max(w, h) * 0.7;
    const glow = ctx.createRadialGradient(focus.sx, focus.sy * 0.7, r * 0.05, focus.sx, focus.sy * 0.7, r);
    glow.addColorStop(0, 'rgba(255, 250, 230, 0.10)');
    glow.addColorStop(1, 'rgba(255, 250, 230, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  drawVignette(ctx) {
    const w = this.canvas.width, h = this.canvas.height;
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawLines(ctx, walled) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    this.strokeRect3D(ctx, 0, FIELD.length, 0, FIELD.width);
    segLine(ctx, this.project(FIELD.length / 2, 0, 0), this.project(FIELD.length / 2, 0, FIELD.width));
    strokePolyline(ctx, this.projectCircle(FIELD.length / 2, FIELD.width / 2, FIELD.centerCircleR, 0, Math.PI * 2, 48));

    const cs = this.project(FIELD.length / 2, 0, FIELD.width / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cs.sx, cs.sy, Math.max(1, 3.4 * cs.scale), 0, Math.PI * 2); ctx.fill();

    if (walled) { this.drawBoarding(ctx); return; }

    const midY = FIELD.width / 2;
    for (const side of [0, 1]) {
      const baseX = side === 0 ? 0 : FIELD.length;
      const penX0 = side === 0 ? 0 : FIELD.length - FIELD.penaltyDepth;
      const penX1 = side === 0 ? FIELD.penaltyDepth : FIELD.length;
      this.strokeRect3D(ctx, penX0, penX1, midY - FIELD.penaltyWidth / 2, midY + FIELD.penaltyWidth / 2);
      const gbX0 = side === 0 ? 0 : FIELD.length - FIELD.goalBoxDepth;
      const gbX1 = side === 0 ? FIELD.goalBoxDepth : FIELD.length;
      this.strokeRect3D(ctx, gbX0, gbX1, midY - FIELD.goalBoxWidth / 2, midY + FIELD.goalBoxWidth / 2);

      const spotX = side === 0 ? FIELD.penSpotDist : FIELD.length - FIELD.penSpotDist;
      const sp = this.project(spotX, 0, midY);
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, Math.max(1, 3.2 * sp.scale), 0, Math.PI * 2); ctx.fill();

      const startA = side === 0 ? -0.93 : Math.PI - 0.93;
      const endA = side === 0 ? 0.93 : Math.PI + 0.93;
      strokePolyline(ctx, this.projectCircle(spotX, midY, FIELD.centerCircleR, startA, endA, 24));

      for (const cy of [0, FIELD.width]) {
        const top = cy === 0;
        const a0 = side === 0 ? (top ? 0 : -Math.PI / 2) : (top ? Math.PI / 2 : Math.PI);
        strokePolyline(ctx, this.projectCircle(baseX, cy, FIELD.cornerR, a0, a0 + Math.PI / 2, 12));
      }
    }
  }

  drawGoal3D(ctx, side) {
    const midY = FIELD.width / 2;
    const baseX = side === 0 ? 0 : FIELD.length;
    const backX = side === 0 ? -FIELD.goalDepth : FIELD.length + FIELD.goalDepth;
    const gy0 = midY - FIELD.goalWidth / 2, gy1 = midY + FIELD.goalWidth / 2;
    const H = FIELD.crossbarHeight;
    const P = (x, h, z) => this.project(x, h, z);

    const fl0 = P(baseX, 0, gy0), fl1 = P(baseX, H, gy0);
    const fr0 = P(baseX, 0, gy1), fr1 = P(baseX, H, gy1);
    const bl0 = P(backX, 0, gy0), bl1 = P(backX, H, gy0);
    const br0 = P(backX, 0, gy1), br1 = P(backX, H, gy1);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    fillQuad(ctx, bl0, br0, br1, bl1);
    fillQuad(ctx, fl0, bl0, bl1, fl1);
    fillQuad(ctx, fr0, br0, br1, fr1);
    fillQuad(ctx, fl1, fr1, br1, bl1);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.6;
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      segLine(ctx, P(backX, H * t, gy0), P(backX, H * t, gy1));
      segLine(ctx, P(backX, 0, lerp(gy0, gy1, t)), P(backX, H, lerp(gy0, gy1, t)));
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.97)';
    ctx.lineWidth = 3.4;
    segLine(ctx, fl0, fl1);
    segLine(ctx, fr0, fr1);
    segLine(ctx, fl1, fr1);
  }

  drawGoalkeeperDive(ctx, p, colorDef, ground, top, scale) {
    const kit = { primary: '#1d2126', secondary: colorDef.primary, text: '#ffffff' };
    const dur = p.diveDuration || 0.4;
    const elapsed = clamp(1 - p.diveTimer / dur, 0, 1);
    const rot = Math.min(1, elapsed / 0.3) * 1.3; // fast snap into a stretched pose, then hold

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy, 16 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const H = Math.max(6, ground.sy - top.sy);
    const bodyW = Math.max(2, 13 * scale);
    const headR = bodyW * 0.62;

    ctx.save();
    ctx.translate(ground.sx, ground.sy - H * 0.08);
    ctx.rotate(rot);

    ctx.fillStyle = '#e3b590';
    roundRectPath(ctx, -bodyW * 0.55, -H * 0.22, bodyW * 0.4, H * 0.22, bodyW * 0.18);
    ctx.fill();
    roundRectPath(ctx, bodyW * 0.15, -H * 0.24, bodyW * 0.4, H * 0.24, bodyW * 0.18);
    ctx.fill();

    ctx.fillStyle = kit.secondary;
    roundRectPath(ctx, -bodyW * 0.5, -H * 0.42, bodyW, H * 0.2, bodyW * 0.25);
    ctx.fill();

    ctx.fillStyle = kit.primary;
    ctx.strokeStyle = kit.secondary;
    ctx.lineWidth = Math.max(0.6, 1.3 * scale);
    roundRectPath(ctx, -bodyW * 0.5, -H * 0.72, bodyW, H * 0.3, bodyW * 0.3);
    ctx.fill();
    ctx.stroke();

    // reaching arm, extended past the head, with a glove
    ctx.strokeStyle = kit.primary;
    ctx.lineWidth = Math.max(1.5, bodyW * 0.34);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.3, -H * 0.66);
    ctx.lineTo(bodyW * 1.5, -H * 0.98);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(bodyW * 1.55, -H * 1.0, headR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -H * 0.86, headR, 0, Math.PI * 2);
    ctx.fillStyle = '#e3b590';
    ctx.fill();
    ctx.strokeStyle = kit.secondary;
    ctx.lineWidth = Math.max(0.6, 1.1 * scale);
    ctx.stroke();
    this.drawFace(ctx, 0, -H * 0.86, headR);

    ctx.restore();
  }

  drawFace(ctx, cx, cy, headR) {
    if (headR < 3) return; // too small to read — keep distant heads a clean blob
    const eyeDX = headR * 0.34;
    const eyeY = cy - headR * 0.04;
    ctx.fillStyle = '#241a12';
    ctx.beginPath(); ctx.arc(cx - eyeDX, eyeY, Math.max(0.4, headR * 0.12), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + eyeDX, eyeY, Math.max(0.4, headR * 0.12), 0, Math.PI * 2); ctx.fill();
    if (headR < 5) return; // skip the mouth at very small sizes, eyes alone read fine
    ctx.strokeStyle = '#9a5a48';
    ctx.lineWidth = Math.max(0.4, headR * 0.09);
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.24, headR * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  drawPlayer3D(ctx, p, colorDef, isControlled, isThrowingIn) {
    const H = p.role === 'GK' ? GK_BILLBOARD_HEIGHT : BILLBOARD_HEIGHT;
    const ground = this.project(p.x, 0, p.y);
    if (!ground.visible) return;
    const top = this.project(p.x, H, p.y);
    const scale = ground.scale;

    if (p.isDiving()) {
      this.drawGoalkeeperDive(ctx, p, colorDef, ground, top, scale);
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy, 13 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isControlled) {
      const pulse = 1 + Math.sin(performance.now() / 160) * 0.08;
      ctx.strokeStyle = 'rgba(255, 207, 77, 0.9)';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      strokePolyline(ctx, this.projectCircle(p.x, p.y, 22 * pulse, 0, Math.PI * 2, 24));
    }

    const faceEnd = this.project(p.x + Math.cos(p.facing) * 15, 0, p.y + Math.sin(p.facing) * 15);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, 2 * scale);
    segLine(ctx, ground, faceEnd);

    // Goalkeepers wear a distinct kit (dark shirt, team-colored trim) and gloves, like real keepers.
    const kit = p.role === 'GK' ? { primary: '#1d2126', secondary: colorDef.primary, text: '#ffffff' } : colorDef;
    const handColor = p.role === 'GK' ? '#ffe14d' : '#e3b590';

    const bodyW = Math.max(2, 14 * scale);
    const shoulderW = bodyW * 1.22;
    const headR = bodyW * 0.56;
    const bodyTopY = top.sy;
    const bodyBotY = ground.sy;
    const headCenterY = bodyTopY + headR * 1.0;
    const torsoTopY = headCenterY + headR * 0.82;
    const torsoH = Math.max(2, bodyBotY - torsoTopY);

    const shirtH = torsoH * 0.46;
    const shortsH = torsoH * 0.20;
    const legsY0 = torsoTopY + shirtH + shortsH;
    const legsH = Math.max(1, bodyBotY - legsY0);
    const legW = bodyW * 0.24;
    const legOffset = bodyW * 0.19;
    const bootH = Math.max(1, legsH * 0.22);

    // Kicking-leg swing (see kickBall() in entities.js) overrides the idle running-cycle swing
    // that plays continuously while the player is moving, for a bit of life even off the ball.
    const kickT = p.kickAnimTimer > 0 ? clamp(1 - p.kickAnimTimer / PHYS.kickAnimDuration, 0, 1) : 0;
    const kickSwing = kickT > 0 ? Math.sin(kickT * Math.PI) * 0.95 : 0;
    const moveLen = Math.hypot(p.vx, p.vy);
    const runSwing = moveLen > 25 ? Math.sin(p.runPhase) * clamp(moveLen / 260, 0.25, 1) * 0.55 : 0;
    const legSwingR = kickSwing !== 0 ? -kickSwing : runSwing;
    const legSwingL = kickSwing !== 0 ? 0 : -runSwing;
    const armSwingR = kickSwing !== 0 ? kickSwing * 0.5 : -runSwing * 0.8;
    const armSwingL = kickSwing !== 0 ? -kickSwing * 0.3 : runSwing * 0.8;

    const drawLeg = (offsetX, swing) => {
      ctx.save();
      ctx.translate(ground.sx + offsetX, legsY0);
      if (swing) ctx.rotate(-swing);
      ctx.fillStyle = '#e3b590';
      roundRectPath(ctx, -legW / 2, 0, legW, legsH, legW * 0.3);
      ctx.fill();
      ctx.fillStyle = '#20201f';
      roundRectPath(ctx, -legW / 2, legsH - bootH, legW, bootH, legW * 0.3);
      ctx.fill();
      ctx.restore();
    };
    drawLeg(-legOffset, legSwingL);
    drawLeg(legOffset, legSwingR);

    // shorts
    ctx.fillStyle = kit.secondary;
    roundRectPath(ctx, ground.sx - bodyW / 2, torsoTopY + shirtH, bodyW, shortsH + 1, bodyW * 0.22);
    ctx.fill();

    // arms (sleeves), drawn from the shoulder down to a small skin/glove hand near hip level
    const armW = bodyW * 0.24;
    const armLen = shirtH * 0.86 + shortsH * 0.35;
    const shoulderY = torsoTopY + shirtH * 0.08;
    const drawArmSeg = (shoulderX, angle, len) => {
      ctx.save();
      ctx.translate(shoulderX, shoulderY);
      ctx.rotate(angle);
      ctx.fillStyle = kit.primary;
      ctx.strokeStyle = kit.secondary;
      ctx.lineWidth = Math.max(0.5, scale);
      roundRectPath(ctx, -armW / 2, 0, armW, len, armW * 0.35);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = handColor;
      ctx.beginPath();
      ctx.arc(0, len + armW * 0.32, armW * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const drawArm = (offsetX, swing) => drawArmSeg(ground.sx + offsetX, swing * 0.6, armLen);
    if (isThrowingIn) {
      // Both hands go up and together overhead for a throw-in, as the laws of the game require.
      const targetX = ground.sx, targetY = bodyTopY - headR * 0.7;
      const drawArmToOverhead = (offsetX) => {
        const shoulderX = ground.sx + offsetX;
        const dx = targetX - shoulderX, dy = targetY - shoulderY;
        drawArmSeg(shoulderX, Math.atan2(-dx, dy), Math.hypot(dx, dy));
      };
      drawArmToOverhead(-shoulderW / 2 + armW * 0.2);
      drawArmToOverhead(shoulderW / 2 - armW * 0.2);
    } else {
      drawArm(-shoulderW / 2 + armW * 0.2, armSwingL);
      drawArm(shoulderW / 2 - armW * 0.2, armSwingR);
    }

    // shirt: tapered (shoulders wider than waist) with a light-to-dark vertical shade
    const shirtGrad = ctx.createLinearGradient(0, torsoTopY, 0, torsoTopY + shirtH);
    shirtGrad.addColorStop(0, shadeColor(kit.primary, 14));
    shirtGrad.addColorStop(1, shadeColor(kit.primary, -12));
    ctx.fillStyle = shirtGrad;
    ctx.strokeStyle = kit.secondary;
    ctx.lineWidth = Math.max(0.6, 1.4 * scale);
    taperedTorsoPath(ctx, ground.sx, torsoTopY, shirtH + 2, shoulderW, bodyW * 0.86, bodyW * 0.28);
    ctx.fill();
    ctx.stroke();

    // head + simple hair cap
    ctx.beginPath();
    ctx.ellipse(ground.sx, headCenterY, headR * 0.92, headR, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e3b590';
    ctx.fill();
    ctx.strokeStyle = shadeColor('#e3b590', -18);
    ctx.lineWidth = Math.max(0.5, scale * 0.6);
    ctx.stroke();

    ctx.fillStyle = HAIR_COLORS[p.number % HAIR_COLORS.length];
    ctx.beginPath();
    ctx.ellipse(ground.sx, headCenterY - headR * 0.32, headR * 0.94, headR * 0.62, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    this.drawFace(ctx, ground.sx, headCenterY, headR);

    if (bodyW > 8) {
      ctx.fillStyle = kit.text;
      ctx.font = `700 ${Math.max(6, bodyW * 0.6)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number), ground.sx, torsoTopY + shirtH * 0.56);
    }

    if (isControlled) {
      const arrowY = bodyTopY - 9 * scale;
      ctx.fillStyle = '#ffcf4d';
      ctx.beginPath();
      ctx.moveTo(ground.sx - 5 * scale, arrowY);
      ctx.lineTo(ground.sx + 5 * scale, arrowY);
      ctx.lineTo(ground.sx, arrowY + 7 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawBall3D(ctx, ball) {
    const ground = this.project(ball.x, 0, ball.y);
    if (!ground.visible) return;

    const trail = this.ballTrail;
    for (let i = 0; i < trail.length; i++) {
      const tp = this.project(trail[i].x, trail[i].z, trail[i].y);
      if (!tp.visible) continue;
      const frac = (i + 1) / (trail.length + 1);
      ctx.fillStyle = `rgba(244,246,242,${frac * 0.3})`;
      ctx.beginPath();
      ctx.arc(tp.sx, tp.sy, Math.max(1, PHYS.ballRadius * tp.scale * (0.5 + 0.4 * frac)), 0, Math.PI * 2);
      ctx.fill();
    }

    const pos = this.project(ball.x, ball.z, ball.y);
    const shadowScale = clamp(1 - ball.z / 260, 0.3, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy, 6 * ground.scale * shadowScale, 2.8 * ground.scale * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const r = Math.max(1.4, PHYS.ballRadius * pos.scale);
    ctx.save();
    ctx.translate(pos.sx, pos.sy);
    ctx.rotate(ball.spin % (Math.PI * 2));
    ctx.fillStyle = '#f4f6f2';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(match, dt) {
    if (match.cameraZoom && this.zoomUnits !== match.cameraZoom) {
      this.zoomUnits = match.cameraZoom;
      this.resize();
    }
    this.updateCamera(match, dt);
    this.buildCamera3D();

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawSky(ctx, match.walled, match.state === 'GOAL');
    this.drawGround(ctx, match.walled);
    if (!match.walled) this.drawPitchWear(ctx);
    this.drawFloodlightGlow(ctx);
    this.drawLines(ctx, match.walled);
    this.drawGoal3D(ctx, 0);
    this.drawGoal3D(ctx, 1);
    if (!match.walled) this.drawAdBoards(ctx);

    if (match.ball.speed() > 260) {
      this.ballTrail.push({ x: match.ball.x, y: match.ball.y, z: match.ball.z });
      if (this.ballTrail.length > 5) this.ballTrail.shift();
    } else if (this.ballTrail.length) {
      this.ballTrail.shift();
    }

    const throwTaker = (match.state === 'OUT' && match.restartType === 'throwin' && match.pendingRestart)
      ? match.pendingRestart.taker : null;

    const drawables = [];
    for (const p of match.home) drawables.push({ p, def: match.homeDef, cz: this.project(p.x, 0, p.y).cz });
    for (const p of match.away) drawables.push({ p, def: match.awayDef, cz: this.project(p.x, 0, p.y).cz });
    const ballCz = this.project(match.ball.x, 0, match.ball.y).cz;
    drawables.push({ ball: true, cz: ballCz });
    drawables.sort((a, b) => b.cz - a.cz);
    for (const d of drawables) {
      if (d.ball) this.drawBall3D(ctx, match.ball);
      else this.drawPlayer3D(ctx, d.p, d.def, d.p === match.controlled, d.p === throwTaker);
    }

    if (Input.shootCharging && match.ball.owner === match.controlled) {
      const p = match.controlled;
      const t = Input.shootChargeT;
      ctx.strokeStyle = `rgba(255, 82, 82, ${0.4 + t * 0.5})`;
      ctx.lineWidth = 3;
      const pts = this.projectCircle(p.x, p.y, 24 + t * 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(t + 0.08, 0, 1), 24);
      strokePolyline(ctx, pts);
    }

    this.drawVignette(ctx);

    this.drawMinimap(match);
    this.updateHUD(match);
  }

  drawMinimap(match) {
    const ctx = this.miniCtx;
    const w = this.miniCanvas.width, h = this.miniCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const sx = w / FIELD.length, sy = h / FIELD.width;

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();

    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const p of match.home) dot(p.x, p.y, p === match.controlled ? '#ffd23f' : match.homeDef.primary, p === match.controlled ? 2.6 : 2);
    for (const p of match.away) dot(p.x, p.y, match.awayDef.primary, 2);
    dot(match.ball.x, match.ball.y, '#ffffff', 1.6);

    const vx0 = (this.camera.x - this.viewW / 2) * sx;
    const vy0 = (this.camera.y - this.viewH / 2) * sy;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(vx0, vy0, this.viewW * sx, this.viewH * sy);
  }

  updateHUD(match) {
    const hud = this.hud;
    hud.score.textContent = `${match.score.home} - ${match.score.away}`;
    hud.clock.textContent = fmtMatchMinute(match.matchMinute());
    hud.homeName.textContent = match.homeDef.code;
    hud.awayName.textContent = match.awayDef.code;
    hud.homeBadge.style.background = match.homeDef.primary;
    hud.homeBadge.style.color = match.homeDef.text;
    hud.homeBadge.textContent = match.homeDef.code.slice(0, 3);
    hud.awayBadge.style.background = match.awayDef.primary;
    hud.awayBadge.style.color = match.awayDef.text;
    hud.awayBadge.textContent = match.awayDef.code.slice(0, 3);

    const b = match.getBanner();
    if (b) {
      hud.banner.classList.remove('hidden');
      hud.banner.innerHTML = b.main + (b.sub ? `<span class="sub">${b.sub}</span>` : '');
    } else {
      hud.banner.classList.add('hidden');
    }
  }
}
