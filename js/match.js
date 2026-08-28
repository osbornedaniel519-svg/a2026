// ===================== Match: state machine tying everything together =====================

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

class Match {
  constructor(homeDef, awayDef, diffKey, halfLenKey, modeKey) {
    this.homeDef = homeDef;
    this.awayDef = awayDef;
    this.mode = GAME_MODES[modeKey] ? modeKey : 'stadium';
    const modeDef = GAME_MODES[this.mode];
    applyFieldMode(this.mode);

    this.walled = modeDef.walled;
    this.cameraZoom = modeDef.cameraZoom;
    this.ambientCrowd = modeDef.ambientCrowd;

    this.home = makeSquad('home', homeDef, hashCode(homeDef.code) + 11, modeDef.formation);
    this.away = makeSquad('away', awayDef, hashCode(awayDef.code) + 97, modeDef.formation);
    this.ball = new Ball(FIELD.length / 2, FIELD.width / 2);

    this.diffKey = diffKey;
    this.diff = DIFFICULTY[diffKey] || DIFFICULTY.Normal;
    // The human never controls the away side, so difficulty scales its speed directly —
    // the most direct lever for a tougher (or gentler) CPU opponent.
    for (const p of this.away) {
      p.baseSpeed *= this.diff.cpuSpeedMul;
      p.sprintSpeed *= this.diff.cpuSpeedMul;
    }
    this.halfLenKey = halfLenKey;
    this.halfLenSeconds = HALF_LENGTHS[halfLenKey] || HALF_LENGTHS.Normal;

    this.score = { home: 0, away: 0 };
    this.half = 1;
    this.clockReal = 0;
    const wbMargin = this.walled ? 14 : 30;
    this.worldBounds = { minX: -wbMargin, maxX: FIELD.length + wbMargin, minY: -wbMargin, maxY: FIELD.width + wbMargin };
    this.manualLockTimer = 0;
    this.firstHalfKickoffTeam = Math.random() < 0.5 ? 'home' : 'away';
    this.controlled = this.home.find(p => p.role !== 'GK');
    this.lastGoal = null;

    this.setupKickoff(this.firstHalfKickoffTeam);
  }

  allPlayers() { return [...this.home, ...this.away]; }

  aiState() {
    return { home: this.home, away: this.away, ball: this.ball, controlled: this.controlled, diff: this.diff };
  }

  resetFormation() {
    for (const p of this.home) {
      p.x = p.slot.fx * FIELD.length; p.y = p.slot.fy * FIELD.width;
      p.vx = 0; p.vy = 0; p.moveDir = { x: 0, y: 0 }; p.diveTimer = 0;
    }
    for (const p of this.away) {
      p.x = (1 - p.slot.fx) * FIELD.length; p.y = p.slot.fy * FIELD.width;
      p.vx = 0; p.vy = 0; p.moveDir = { x: 0, y: 0 }; p.diveTimer = 0;
    }
  }

  setupKickoff(team) {
    this.resetFormation();
    const ball = this.ball;
    ball.x = FIELD.length / 2; ball.y = FIELD.width / 2; ball.z = 0;
    ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.owner = null;

    const pool = (team === 'home' ? this.home : this.away).filter(p => p.role !== 'GK');
    const taker = nearestTo(pool, ball.x, ball.y);
    if (taker) {
      taker.x = ball.x - (team === 'home' ? 18 : -18);
      taker.y = ball.y + (Math.random() < 0.5 ? -1 : 1) * 12;
    }
    this.pendingKickoffTaker = taker;
    this.kickoffTeam = team;
    this.state = 'KICKOFF';
    this.stateTimer = 1.1;
    if (SFX) SFX.whistle(true);
  }

  scoreGoal(scoringTeam) {
    this.score[scoringTeam]++;
    this.lastGoal = { team: scoringTeam, minute: Math.round(this.matchMinute()) };
    this.nextKickoffTeam = scoringTeam === 'home' ? 'away' : 'home';
    this.state = 'GOAL';
    this.stateTimer = 2.8;
    this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0; this.ball.owner = null;
    if (SFX) SFX.crowdCheer();
  }

  setRestart(type, team, x, y) {
    const ball = this.ball;
    ball.owner = null; ball.vx = 0; ball.vy = 0; ball.vz = 0;
    // A throw-in is held overhead for the pause, ready to arc down into the throw itself.
    ball.z = type === 'throwin' ? 50 : 0;
    ball.x = clamp(x, 6, FIELD.length - 6);
    ball.y = clamp(y, 6, FIELD.width - 6);

    let taker;
    if (type === 'goalkick') {
      taker = (team === 'home' ? this.home : this.away).find(p => p.role === 'GK');
    } else {
      const pool = (team === 'home' ? this.home : this.away).filter(p => p.role !== 'GK');
      taker = nearestTo(pool, ball.x, ball.y);
    }
    if (taker) {
      taker.x = clamp(ball.x - (team === 'home' ? 16 : -16), 4, FIELD.length - 4);
      taker.y = clamp(ball.y, 4, FIELD.width - 4);
    }
    this.pendingRestart = { type, team, taker };
    this.state = 'OUT';
    this.stateTimer = type === 'throwin' ? 1.15 : 0.85;
    this.restartType = type;
    if (SFX) SFX.whistle(true);
  }

  // A throw must use both hands and go overhead, so the taker lobs it in toward the nearest
  // open teammate rather than just handing over possession.
  takeThrowIn(taker) {
    const teammates = (taker.team === 'home' ? this.home : this.away).filter(t => t !== taker && t.role !== 'GK');
    const target = nearestTo(teammates, taker.x, taker.y);
    let angle = target ? Math.atan2(target.y - taker.y, target.x - taker.x) : (taker.team === 'home' ? 0 : Math.PI);
    angle += taker.y <= FIELD.width / 2 ? 0.35 : -0.35; // aim back in from the touchline
    kickBall(this.ball, taker, angle, rand(280, 380), 0.3);
  }

  // Corners are delivered as a real cross into the box, near or far post at random.
  takeCorner(taker) {
    const midY = FIELD.width / 2;
    const targetX = taker.team === 'home' ? FIELD.length - FIELD.goalBoxDepth * 1.3 : FIELD.goalBoxDepth * 1.3;
    const targetY = midY + (Math.random() < 0.5 ? -1 : 1) * FIELD.goalWidth * 0.6;
    const d = dist(taker.x, taker.y, targetX, targetY);
    const angle = Math.atan2(targetY - taker.y, targetX - taker.x);
    kickBall(this.ball, taker, angle, clamp(d * 0.95 + 140, 420, 760), 0.42);
  }

  // The keeper punts a goal kick upfield rather than just picking up possession.
  takeGoalKick(taker) {
    const targetX = taker.team === 'home' ? FIELD.length * 0.62 : FIELD.length * 0.38;
    const targetY = FIELD.width / 2 + rand(-220, 220);
    const angle = Math.atan2(targetY - taker.y, targetX - taker.x);
    kickBall(this.ball, taker, angle, rand(680, 860), 0.55);
  }

  resumeFromRestart() {
    const r = this.pendingRestart;
    if (r && r.taker) {
      if (r.type === 'throwin') this.takeThrowIn(r.taker);
      else if (r.type === 'corner') this.takeCorner(r.taker);
      else if (r.type === 'goalkick') this.takeGoalKick(r.taker);
    }
    this.pendingRestart = null;
    this.state = 'PLAYING';
  }

  startSecondHalf() {
    this.half = 2;
    this.clockReal = 0;
    this.setupKickoff(this.firstHalfKickoffTeam === 'home' ? 'away' : 'home');
  }

  matchMinute() {
    const frac = clamp(this.clockReal / this.halfLenSeconds, 0, 1);
    const base = this.half === 1 ? 0 : 45;
    return base + frac * 45;
  }

  updateControlledSelection() {
    if (this.manualLockTimer > 0) return;
    const homeOutfield = this.home.filter(p => p.role !== 'GK');
    const nearest = nearestTo(homeOutfield, this.ball.x, this.ball.y);
    if (nearest) this.controlled = nearest;
  }

  handleHumanInput() {
    const p = this.controlled;
    if (!p) return;
    p.moveDir = { x: Input.dir.x, y: Input.dir.y };
    p.wantsSprint = Input.sprint && (p.moveDir.x !== 0 || p.moveDir.y !== 0);

    if (Input.consume('switch')) {
      const homeOutfield = this.home.filter(x => x.role !== 'GK');
      const sorted = homeOutfield.slice().sort((a, b) => dist2(a.x, a.y, this.ball.x, this.ball.y) - dist2(b.x, b.y, this.ball.x, this.ball.y));
      const idx = sorted.indexOf(p);
      const next = sorted[(idx + 1) % sorted.length];
      if (next) { this.controlled = next; this.manualLockTimer = 1.0; }
    }

    const hasBall = this.ball.owner === p;
    if (Input.consume('pass')) { if (hasBall) this.humanPass(p, 'ground'); }
    if (Input.consume('through')) { if (hasBall) this.humanPass(p, 'through'); }
    if (Input.consume('shoot')) { if (hasBall) this.humanShoot(p, Input.shootChargeT); }
    if (Input.consume('tackle')) { if (!hasBall) this.humanTackle(p); }
  }

  humanPass(p, kind) {
    const teammates = this.home.filter(t => t !== p && t.role !== 'GK');
    const aimDir = (Input.dir.x !== 0 || Input.dir.y !== 0) ? Input.dir : { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    let best = null, bestScore = -1e9;
    for (const t of teammates) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < 30 || d > (kind === 'through' ? 820 : 660)) continue;
      const toT = normalize(t.x - p.x, t.y - p.y);
      const align = toT.x * aimDir.x + toT.y * aimDir.y;
      if (align < 0.1) continue;
      const oppDist = nearestDistTo(this.away, t.x, t.y);
      const score = align * 220 + oppDist * (kind === 'through' ? 1.1 : 0.6) - d * 0.1;
      if (score > bestScore) { bestScore = score; best = t; }
    }

    if (!best) {
      const angle = Math.atan2(aimDir.y, aimDir.x);
      kickBall(this.ball, p, angle, 380, kind === 'through' ? 0.32 : 0.02);
      if (SFX) SFX.pass();
      return;
    }

    if (kind === 'through') {
      const leadT = 0.55;
      const tx = best.x + best.vx * leadT + aimDir.x * 90;
      const ty = best.y + best.vy * leadT + aimDir.y * 90;
      const d = dist(p.x, p.y, tx, ty);
      const angle = Math.atan2(ty - p.y, tx - p.x);
      const power = clamp(d * 1.15 + 220, 380, 900);
      kickBall(this.ball, p, angle, power, 0.34);
    } else {
      const d = dist(p.x, p.y, best.x, best.y);
      const angle = Math.atan2(best.y - p.y, best.x - p.x);
      const power = clamp(Math.sqrt(2 * PHYS.groundFriction * d) + 80, 280, 780);
      kickBall(this.ball, p, angle, power, 0.02);
    }
    if (SFX) SFX.pass();
  }

  humanShoot(p, chargeT) {
    const goalX = p.team === 'home' ? FIELD.length : 0;
    const goalY = FIELD.width / 2;
    const aimDir = (Input.dir.x !== 0 || Input.dir.y !== 0) ? Input.dir : { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    const baseAngle = Math.atan2(goalY - p.y, goalX - p.x);
    const nudge = clamp(angleDiff(baseAngle, Math.atan2(aimDir.y, aimDir.x)), -0.55, 0.55) * 0.6;
    const angle = baseAngle + nudge;
    const t = clamp(chargeT, 0.22, 1);
    const power = lerp(440, 900, t);
    const lift = lerp(0.08, 0.34, t);
    kickBall(this.ball, p, angle, power, lift);
    if (SFX) SFX.kick();
  }

  humanTackle(p) {
    if (p.tackleCooldown > 0) return;
    const carrier = this.ball.owner;
    if (!carrier || carrier.team === p.team) return;
    const d = dist(p.x, p.y, carrier.x, carrier.y);
    if (d > PHYS.tackleRadius + 8) return;
    p.tackleCooldown = 0.55;
    const chance = clamp(this.diff.tackleSkill * 0.75 + 0.2, 0, 0.93);
    if (Math.random() < chance) { winTackle(this.ball, p, carrier); p.tackleCooldown = 0.85; }
  }

  resolveCollisions() {
    const all = this.allPlayers();
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.isDiving()) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.isDiving()) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy);
        const minD = a.radius + b.radius - 5;
        if (dd > 0.001 && dd < minD) {
          const overlap = (minD - dd) / 2;
          const nx = dx / dd, ny = dy / dd;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
        }
      }
    }
  }

  updatePossessionPickup() {
    const ball = this.ball;
    if (ball.owner || ball.z > 30) return;
    let best = null, bestD = Infinity;
    for (const p of this.allPlayers()) {
      const reach = PHYS.pickupRadius + (p.role === 'GK' && p.isDiving() ? 20 : 0);
      const d = dist(p.x, p.y, ball.x, ball.y);
      if (d < reach && d < bestD) { bestD = d; best = p; }
    }
    if (best) {
      ball.owner = best;
      ball.lastTouchTeam = best.team;
      ball.lastToucher = best;
    }
  }

  bounceBallX() {
    const ball = this.ball;
    ball.x = clamp(ball.x, 3, FIELD.length - 3);
    ball.vx = -ball.vx * 0.58;
    ball.vy *= 0.9;
    if (SFX) SFX.post();
  }

  bounceBallY() {
    const ball = this.ball;
    ball.y = clamp(ball.y, 3, FIELD.width - 3);
    ball.vy = -ball.vy * 0.58;
    ball.vx *= 0.9;
    if (SFX) SFX.post();
  }

  checkOutOfBounds() {
    const ball = this.ball;
    const inGoalMouthY = Math.abs(ball.y - FIELD.width / 2) < FIELD.goalWidth / 2;

    if (ball.x <= 0 || ball.x >= FIELD.length) {
      if (inGoalMouthY && ball.z <= FIELD.crossbarHeight + 4 && !ball.owner) {
        this.scoreGoal(ball.x <= 0 ? 'away' : 'home');
        return;
      }
      if (ball.owner) return;
      if (this.walled) { this.bounceBallX(); return; }
      const defendingTeam = ball.x <= 0 ? 'home' : 'away';
      const lastTeam = ball.lastTouchTeam;
      if (lastTeam === defendingTeam) {
        const attackers = defendingTeam === 'home' ? 'away' : 'home';
        const cornerY = ball.y < FIELD.width / 2 ? 6 : FIELD.width - 6;
        this.setRestart('corner', attackers, ball.x <= 0 ? 4 : FIELD.length - 4, cornerY);
      } else {
        const gkX = defendingTeam === 'home' ? FIELD.goalBoxDepth * 0.7 : FIELD.length - FIELD.goalBoxDepth * 0.7;
        this.setRestart('goalkick', defendingTeam, gkX, FIELD.width / 2);
      }
      return;
    }

    if (ball.y <= 0 || ball.y >= FIELD.width) {
      if (ball.owner) return;
      if (this.walled) { this.bounceBallY(); return; }
      const lastTeam = ball.lastTouchTeam;
      const restartTeam = lastTeam === 'home' ? 'away' : 'home';
      this.setRestart('throwin', restartTeam, clamp(ball.x, 24, FIELD.length - 24), ball.y <= 0 ? 4 : FIELD.width - 4);
    }
  }

  update(dt) {
    if (this.state === 'HALFTIME') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.startSecondHalf();
      return;
    }
    if (this.state === 'FULLTIME') return;

    this.clockReal += dt;
    if (this.clockReal >= this.halfLenSeconds) {
      this.clockReal = this.halfLenSeconds;
      if (this.half === 1) { this.state = 'HALFTIME'; this.stateTimer = 3; if (SFX) SFX.whistle(); }
      else { this.state = 'FULLTIME'; if (SFX) SFX.whistle(); }
      return;
    }

    if (this.state === 'KICKOFF' || this.state === 'GOAL' || this.state === 'OUT') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === 'KICKOFF') {
          this.state = 'PLAYING';
          if (this.pendingKickoffTaker) {
            this.ball.owner = this.pendingKickoffTaker;
            this.ball.x = this.pendingKickoffTaker.x; this.ball.y = this.pendingKickoffTaker.y;
          }
        } else if (this.state === 'GOAL') {
          this.setupKickoff(this.nextKickoffTeam);
        } else if (this.state === 'OUT') {
          this.resumeFromRestart();
        }
      }
      return;
    }

    // ---- PLAYING ----
    if (this.manualLockTimer > 0) this.manualLockTimer -= dt;
    this.updateControlledSelection();
    this.handleHumanInput();
    runTeamAI(this.aiState(), dt);
    for (const p of this.allPlayers()) p.update(dt, this.worldBounds);
    this.resolveCollisions();
    this.ball.update(dt);
    this.updatePossessionPickup();
    this.checkOutOfBounds();
  }

  getBanner() {
    if (this.state === 'KICKOFF' && this.clockReal < 1.3) return { main: 'KICK OFF', sub: null };
    if (this.state === 'GOAL') return { main: 'GOAL!', sub: `${this.lastGoal.team === 'home' ? this.homeDef.name : this.awayDef.name} ${this.lastGoal.minute}'` };
    if (this.state === 'HALFTIME') return { main: 'HALF TIME', sub: `${this.score.home} - ${this.score.away}` };
    if (this.state === 'FULLTIME') return { main: 'FULL TIME', sub: `${this.score.home} - ${this.score.away}` };
    if (this.state === 'OUT') {
      const label = this.restartType === 'corner' ? 'CORNER' : this.restartType === 'goalkick' ? 'GOAL KICK' : 'THROW-IN';
      return { main: label, sub: null };
    }
    return null;
  }
}
