// ===================== Player & Ball entities =====================

let __playerId = 1;

class Player {
  constructor(team, role, number, name, x, y) {
    this.id = __playerId++;
    this.team = team;           // 'home' | 'away'
    this.role = role;           // 'GK' | 'DEF' | 'MID' | 'FWD'
    this.number = number;
    this.name = name;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = team === 'home' ? 0 : Math.PI;
    this.radius = role === 'GK' ? PHYS.gkRadius : PHYS.playerRadius;
    this.baseSpeed = (role === 'GK' ? PHYS.gkBaseSpeed : PHYS.playerBaseSpeed) * rand(0.94, 1.06);
    this.sprintSpeed = (role === 'GK' ? PHYS.gkSprintSpeed : PHYS.playerSprintSpeed) * rand(0.94, 1.08);

    this.moveDir = { x: 0, y: 0 };
    this.wantsSprint = false;

    this.kickCooldown = 0;
    this.tackleCooldown = 0;
    this.diveTimer = 0;
    this.diveDuration = 0;
    this.diveDir = { x: 0, y: 0 };
    this.kickAnimTimer = 0;   // >0 while the kicking-leg swing animation is playing
    this.runPhase = 0;       // running-cycle phase for the arm/leg swing while moving
    this.staminaFatigue = 1; // multiplier that dips while sprinting hard and recovers at rest

    // Simple ability spread so squads aren't perfectly uniform.
    this.skill = rand(0.85, 1.12);
  }

  update(dt, worldBounds) {
    if (this.diveTimer > 0) {
      this.diveTimer -= dt;
      this.x += this.diveDir.x * 260 * dt;
      this.y += this.diveDir.y * 260 * dt;
    } else {
      const sprinting = this.wantsSprint && (this.moveDir.x !== 0 || this.moveDir.y !== 0);
      const speed = (this.wantsSprint ? this.sprintSpeed : this.baseSpeed) * this.staminaFatigue;
      this.staminaFatigue = sprinting
        ? Math.max(0.8, this.staminaFatigue - 0.045 * dt)
        : Math.min(1, this.staminaFatigue + 0.1 * dt);
      const targetVX = this.moveDir.x * speed;
      const targetVY = this.moveDir.y * speed;
      const accel = PHYS.playerAccel * dt;
      this.vx = approach(this.vx, targetVX, accel);
      this.vy = approach(this.vy, targetVY, accel);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const moveLen = Math.hypot(this.vx, this.vy);
      if (moveLen > 8) this.facing = Math.atan2(this.vy, this.vx);
      this.runPhase += moveLen * dt * 0.045;
    }

    if (worldBounds) {
      this.x = clamp(this.x, worldBounds.minX, worldBounds.maxX);
      this.y = clamp(this.y, worldBounds.minY, worldBounds.maxY);
    }

    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.tackleCooldown > 0) this.tackleCooldown -= dt;
    if (this.kickAnimTimer > 0) this.kickAnimTimer -= dt;
  }

  startDive(dirX, dirY, duration) {
    this.diveTimer = duration;
    this.diveDuration = duration;
    const n = normalize(dirX, dirY);
    this.diveDir = { x: n.x, y: n.y };
  }

  isDiving() { return this.diveTimer > 0; }
}

class Ball {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.radius = PHYS.ballRadius;
    this.owner = null;
    this.lastTouchTeam = null;
    this.lastToucher = null;
    this.spin = 0; // purely visual roll accumulator
  }

  update(dt) {
    this.spin += Math.hypot(this.vx, this.vy) * dt * 0.02;

    if (this.owner) {
      const p = this.owner;
      const lead = PHYS.dribbleLead;
      const tx = p.x + Math.cos(p.facing) * lead;
      const ty = p.y + Math.sin(p.facing) * lead;
      const dx = tx - this.x, dy = ty - this.y;
      const followRate = clamp(PHYS.dribbleFollow * Math.hypot(dx, dy), 0, 620);
      const d = normalize(dx, dy);
      this.x += d.x * followRate * dt;
      this.y += d.y * followRate * dt;
      this.z = approach(this.z, 0, 400 * dt);
      this.vx = p.vx; this.vy = p.vy; this.vz = 0;
      return;
    }

    // Free flight physics
    this.vz -= PHYS.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    if (this.z <= 0) {
      this.z = 0;
      if (Math.abs(this.vz) > PHYS.minBounceSpeed) {
        this.vz = -this.vz * PHYS.bounceRestitution;
      } else {
        this.vz = 0;
      }
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0) {
        const drop = PHYS.groundFriction * dt;
        const f = Math.max(0, speed - drop) / speed;
        this.vx *= f;
        this.vy *= f;
      }
    } else {
      // light air drag
      this.vx *= (1 - 0.06 * dt);
      this.vy *= (1 - 0.06 * dt);
    }
  }

  speed() { return Math.hypot(this.vx, this.vy); }
}

// Kicks the ball away from `player` in `dirAngle` with the given ground `power`
// and an upward `liftFactor` (0..1-ish) used for lobs/shots.
function kickBall(ball, player, dirAngle, power, liftFactor) {
  ball.owner = null;
  ball.x = player.x + Math.cos(dirAngle) * (player.radius + ball.radius + 3);
  ball.y = player.y + Math.sin(dirAngle) * (player.radius + ball.radius + 3);
  ball.vx = Math.cos(dirAngle) * power;
  ball.vy = Math.sin(dirAngle) * power;
  ball.vz = (liftFactor || 0) * power * 0.62;
  ball.lastTouchTeam = player.team;
  ball.lastToucher = player;
  player.kickCooldown = 0.28;
  player.kickAnimTimer = PHYS.kickAnimDuration;
}

function makeSquad(team, teamDef, seed, formation) {
  formation = formation || FORMATION_433;
  const rng = mulberry32(seed);
  const players = [];
  for (let i = 0; i < formation.length; i++) {
    const slot = formation[i];
    const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const worldX = team === 'home' ? slot.fx * FIELD.length : (1 - slot.fx) * FIELD.length;
    const worldY = slot.fy * FIELD.width;
    const p = new Player(team, slot.role, i + 1, `${fn[0]}. ${ln}`, worldX, worldY);
    p.slot = slot;
    players.push(p);
  }
  return players;
}
