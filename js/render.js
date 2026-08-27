// ===================== Rendering: pitch, players, ball, HUD, minimap =====================
// The visible window into the pitch (in world units) adapts to the container's aspect ratio
// so the canvas always fills the available space with no letterboxing, on any screen shape.
const UNIT_PER_MIN_DIM = 600;

class Renderer {
  constructor(canvas, miniCanvas, wrapEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = miniCanvas;
    this.miniCtx = miniCanvas.getContext('2d');
    this.wrap = wrapEl;
    this.camera = { x: FIELD.length / 2, y: FIELD.width / 2 };
    this.dpr = 1;
    this.viewW = 1000;
    this.viewH = 640;
    this.zoomUnits = UNIT_PER_MIN_DIM;
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

  worldTransform() {
    const scale = this.canvas.width / this.viewW;
    const ox = (this.viewW / 2 - this.camera.x) * scale;
    const oy = (this.viewH / 2 - this.camera.y) * scale;
    return { scale, ox, oy };
  }

  drawPitch(ctx, walled) {
    const m = FIELD.margin;

    if (walled) {
      // Concrete court + chain-link boarding, no stadium markings — just goals and a halfway line.
      ctx.fillStyle = '#3b4249';
      ctx.fillRect(-m, -m, FIELD.length + m * 2, FIELD.width + m * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = -m; x < FIELD.length + m; x += 26) {
        ctx.fillRect(x, -m, 1.5, FIELD.width + m * 2);
      }

      ctx.fillStyle = '#20262b';
      ctx.fillRect(-m, -m, FIELD.length + m * 2, m - 4);
      ctx.fillRect(-m, FIELD.width - m + 4, FIELD.length + m * 2, m);
      ctx.fillRect(-m, -m, m - 4, FIELD.width + m * 2);
      ctx.fillRect(FIELD.length - m + 4, -m, m, FIELD.width + m * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      const mesh = 9;
      for (let x = -m; x < FIELD.length + m; x += mesh) {
        ctx.beginPath(); ctx.moveTo(x, -m); ctx.lineTo(x + mesh, -m + mesh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, FIELD.width + m); ctx.lineTo(x + mesh, FIELD.width + m - mesh); ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, FIELD.length, FIELD.width);
      ctx.beginPath();
      ctx.moveTo(FIELD.length / 2, 0); ctx.lineTo(FIELD.length / 2, FIELD.width);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(FIELD.length / 2, FIELD.width / 2, FIELD.centerCircleR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#164a24';
      ctx.fillRect(-m, -m, FIELD.length + m * 2, FIELD.width + m * 2);

      const stripeW = 70;
      let toggle = 0;
      for (let x = -m; x < FIELD.length + m; x += stripeW) {
        ctx.fillStyle = toggle % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
        ctx.fillRect(x, -m, stripeW, FIELD.width + m * 2);
        toggle++;
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 3.4;
      ctx.strokeRect(0, 0, FIELD.length, FIELD.width);

      ctx.beginPath();
      ctx.moveTo(FIELD.length / 2, 0);
      ctx.lineTo(FIELD.length / 2, FIELD.width);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(FIELD.length / 2, FIELD.width / 2, FIELD.centerCircleR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(FIELD.length / 2, FIELD.width / 2, 3.4, 0, Math.PI * 2); ctx.fill();

    const midY = FIELD.width / 2;
    for (const side of [0, 1]) {
      const baseX = side === 0 ? 0 : FIELD.length;

      if (!walled) {
        // Penalty boxes, goal boxes, arcs, spots (stadium only)
        const penX = side === 0 ? 0 : FIELD.length - FIELD.penaltyDepth;
        ctx.strokeRect(penX, midY - FIELD.penaltyWidth / 2, FIELD.penaltyDepth, FIELD.penaltyWidth);
        const gbX = side === 0 ? 0 : FIELD.length - FIELD.goalBoxDepth;
        ctx.strokeRect(gbX, midY - FIELD.goalBoxWidth / 2, FIELD.goalBoxDepth, FIELD.goalBoxWidth);

        const spotX = side === 0 ? FIELD.penSpotDist : FIELD.length - FIELD.penSpotDist;
        ctx.beginPath(); ctx.arc(spotX, midY, 3.2, 0, Math.PI * 2); ctx.fill();

        ctx.beginPath();
        const startA = side === 0 ? -0.93 : Math.PI - 0.93;
        const endA = side === 0 ? 0.93 : Math.PI + 0.93;
        ctx.arc(spotX, midY, FIELD.centerCircleR, startA, endA);
        ctx.stroke();

        // corner arcs (quarter circles swept into the field of play)
        for (const cy of [0, FIELD.width]) {
          const top = cy === 0;
          const a0 = side === 0 ? (top ? 0 : -Math.PI / 2) : (top ? Math.PI / 2 : Math.PI);
          const a1 = a0 + Math.PI / 2;
          ctx.beginPath();
          ctx.arc(baseX, cy, FIELD.cornerR, a0, a1);
          ctx.stroke();
        }
      }

      // Goal frame + net (both modes)
      const gx0 = side === 0 ? -FIELD.goalDepth : FIELD.length;
      const gx1 = side === 0 ? 0 : FIELD.length + FIELD.goalDepth;
      const gy0 = midY - FIELD.goalWidth / 2, gy1 = midY + FIELD.goalWidth / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(Math.min(gx0, gx1), gy0, Math.abs(gx1 - gx0), gy1 - gy0);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      ctx.strokeRect(Math.min(gx0, gx1), gy0, Math.abs(gx1 - gx0), gy1 - gy0);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      const netStep = 8;
      for (let ny = gy0; ny <= gy1; ny += netStep) {
        ctx.beginPath(); ctx.moveTo(Math.min(gx0, gx1), ny); ctx.lineTo(Math.max(gx0, gx1), ny); ctx.stroke();
      }
      for (let nx = Math.min(gx0, gx1); nx <= Math.max(gx0, gx1); nx += netStep) {
        ctx.beginPath(); ctx.moveTo(nx, gy0); ctx.lineTo(nx, gy1); ctx.stroke();
      }
      ctx.lineWidth = walled ? 3 : 3.4;
      ctx.strokeStyle = walled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.92)';
    }
  }

  drawPlayer(ctx, p, colorDef, isControlled) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, p.radius * 0.55, p.radius * 0.85, p.radius * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isControlled) {
      const pulse = 1 + Math.sin(performance.now() / 160) * 0.08;
      ctx.strokeStyle = 'rgba(255, 207, 77, 0.9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, (p.radius + 6) * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = colorDef.primary;
    ctx.strokeStyle = colorDef.secondary;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorDef.text;
    ctx.font = '700 10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.number), 0, 1);

    // facing tick
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.facing) * (p.radius - 2), Math.sin(p.facing) * (p.radius - 2));
    ctx.lineTo(Math.cos(p.facing) * (p.radius + 4), Math.sin(p.facing) * (p.radius + 4));
    ctx.stroke();

    ctx.restore();

    if (isControlled) {
      ctx.save();
      ctx.translate(p.x, p.y - p.radius - 16);
      ctx.fillStyle = '#ffcf4d';
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawBall(ctx, ball) {
    const liftY = ball.z * 0.62;
    const shadowScale = clamp(1 - ball.z / 260, 0.35, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y, ball.radius * 1.1 * shadowScale, ball.radius * 0.6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ball.x, ball.y - liftY);
    ctx.rotate(ball.spin % (Math.PI * 2));
    ctx.fillStyle = '#f4f6f2';
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * ball.radius * 0.5, Math.sin(a) * ball.radius * 0.5, ball.radius * 0.22, 0, Math.PI * 2);
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
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { scale, ox, oy } = this.worldTransform();
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    this.drawPitch(ctx, match.walled);

    const behind = [];
    const front = [];
    for (const p of match.home) (p.y < match.ball.y ? behind : front).push([p, match.homeDef]);
    for (const p of match.away) (p.y < match.ball.y ? behind : front).push([p, match.awayDef]);
    behind.sort((a, b) => a[0].y - b[0].y);
    front.sort((a, b) => a[0].y - b[0].y);

    for (const [p, def] of behind) this.drawPlayer(ctx, p, def, p === match.controlled);
    this.drawBall(ctx, match.ball);
    for (const [p, def] of front) this.drawPlayer(ctx, p, def, p === match.controlled);

    if (Input.shootCharging && match.ball.owner === match.controlled) {
      const p = match.controlled;
      const t = Input.shootChargeT;
      ctx.strokeStyle = `rgba(255, 82, 82, ${0.4 + t * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10 + t * 10, 0, Math.PI * 2 * clamp(t + 0.08, 0, 1));
      ctx.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
