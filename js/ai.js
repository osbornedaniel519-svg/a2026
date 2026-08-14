// ===================== AI: formations, off-ball movement, CPU decisions, goalkeepers =====================
// Design: the human always controls the outfield player on the home team nearest the ball.
// Every other player on the pitch (both teams) is driven by the logic in this file.

function nearestTo(list, x, y) {
  let best = null, bestD = Infinity;
  for (const p of list) {
    const d = dist2(p.x, p.y, x, y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function nearestDistTo(list, x, y) {
  let bestD = Infinity;
  for (const p of list) {
    const d = dist(p.x, p.y, x, y);
    if (d < bestD) bestD = d;
  }
  return bestD === Infinity ? 9999 : bestD;
}

function steerTo(p, tx, ty, tolerance, sprintAllowed) {
  const d = dist(p.x, p.y, tx, ty);
  if (d < (tolerance || 8)) {
    p.moveDir = { x: 0, y: 0 };
  } else {
    const n = normalize(tx - p.x, ty - p.y);
    p.moveDir = { x: n.x, y: n.y };
  }
  p.wantsSprint = !!sprintAllowed && d > 46;
}

function computeSupportTarget(p, state, possessionTeam) {
  const slot = p.slot;
  const ball = state.ball;
  let fx = slot.fx, fy = slot.fy;

  const ballFx = p.team === 'home' ? ball.x / FIELD.length : 1 - ball.x / FIELD.length;
  const ballFy = ball.y / FIELD.width;

  const attacking = possessionTeam === p.team;
  const shiftAmount = attacking ? 0.24 : 0.16;
  fx = fx + (ballFx - fx) * shiftAmount;
  fy = fy + (ballFy - fy) * 0.32;

  if (possessionTeam && !attacking) fx -= 0.05; // sit deeper without the ball
  if (attacking && slot.role === 'FWD') fx += 0.05;
  if (attacking && slot.role === 'MID') fx += 0.03;

  fx = clamp(fx, 0.03, 0.97);
  fy = clamp(fy, 0.05, 0.95);

  const worldX = p.team === 'home' ? fx * FIELD.length : (1 - fx) * FIELD.length;
  const worldY = fy * FIELD.width;
  return { x: worldX, y: worldY };
}

function attemptPassiveTackle(presser, carrier, state, dt) {
  if (presser.tackleCooldown > 0) return;
  const d = dist(presser.x, presser.y, carrier.x, carrier.y);
  if (d > PHYS.tackleRadius) return;
  presser.tackleCooldown = 0.28;
  const chance = state.diff.tackleSkill * presser.skill * 0.5;
  if (Math.random() < chance) {
    winTackle(state.ball, presser, carrier);
    presser.tackleCooldown = 0.9;
  }
}

function winTackle(ball, winner, loser) {
  ball.owner = null;
  const away = normalize(ball.x - loser.x + rand(-8, 8), ball.y - loser.y + rand(-8, 8));
  ball.vx = away.x * rand(90, 180);
  ball.vy = away.y * rand(90, 180);
  ball.vz = rand(20, 90);
  ball.lastTouchTeam = winner.team;
  ball.lastToucher = winner;
  SFX.tackleThud();
}

function doShoot(p, state, goalX, goalY) {
  const spread = FIELD.goalWidth * 0.34 * (1.05 - state.diff.shootSkill * 0.55);
  const targetY = clamp(goalY + rand(-1, 1) * spread, goalY - FIELD.goalWidth / 2 + 8, goalY + FIELD.goalWidth / 2 - 8);
  const angle = Math.atan2(targetY - p.y, goalX - p.x);
  const power = rand(560, 780) * p.skill;
  kickBall(state.ball, p, angle, power, rand(0.1, 0.3));
  SFX.kick();
}

function doPass(p, state, target) {
  const leadT = 0.32;
  const tx = target.x + target.vx * leadT;
  const ty = target.y + target.vy * leadT;
  const d = dist(p.x, p.y, tx, ty);
  const inaccuracy = (1 - state.diff.passSkill) * 0.2;
  const angle = Math.atan2(ty - p.y, tx - p.x) + rand(-1, 1) * inaccuracy;
  const power = clamp(Math.sqrt(2 * PHYS.groundFriction * d) + 70, 260, 780);
  kickBall(state.ball, p, angle, power, 0.02);
  SFX.pass();
}

function doClear(p, state, goalX, goalY) {
  const angle = Math.atan2((goalY + rand(-220, 220)) - p.y, goalX - p.x);
  const power = rand(650, 860);
  kickBall(state.ball, p, angle, power, 0.5);
  SFX.kick();
}

function updateCarrierAI(p, state, dt) {
  const ball = state.ball;
  if (p.decisionTimer === undefined) p.decisionTimer = rand(0.2, 0.4);
  p.decisionTimer -= dt;

  const oppTeam = p.team === 'home' ? state.away : state.home;
  const nearestOpp = nearestTo(oppTeam, p.x, p.y);
  const nearestOppDist = nearestOpp ? dist(p.x, p.y, nearestOpp.x, nearestOpp.y) : 9999;

  const goalX = p.team === 'home' ? FIELD.length - 8 : 8;
  const goalY = FIELD.width / 2;

  // Continuous dribble steering: toward goal, nudged away from the closest defender.
  const toGoal = normalize(goalX - p.x, goalY - p.y);
  let steerX = toGoal.x, steerY = toGoal.y;
  if (nearestOpp && nearestOppDist < 150) {
    const away = normalize(p.x - nearestOpp.x, p.y - nearestOpp.y);
    steerX = steerX * 0.5 + away.x * 0.95;
    steerY = steerY * 0.5 + away.y * 0.95;
  }
  const n = normalize(steerX, steerY);
  p.moveDir = { x: n.x, y: n.y };
  p.wantsSprint = nearestOppDist > 85;

  if (p.decisionTimer > 0 && nearestOppDist > 45) return;
  p.decisionTimer = Math.max(0.15, rand(0.35, 0.65) - state.diff.reaction * 0.5);

  const distToGoal = dist(p.x, p.y, goalX, goalY);
  const central = Math.abs(p.y - FIELD.width / 2) < 290;
  const inShotRange = distToGoal < (p.role === 'GK' ? 0 : 430) && central;

  if (inShotRange && Math.random() < state.diff.shootSkill) {
    doShoot(p, state, goalX, goalY);
    return;
  }

  const teammates = (p.team === 'home' ? state.home : state.away).filter(t => t !== p && t.role !== 'GK');
  let best = null, bestScore = -1e9;
  for (const t of teammates) {
    const passDist = dist(p.x, p.y, t.x, t.y);
    if (passDist > 620 || passDist < 40) continue;
    const advance = p.team === 'home' ? (t.x - p.x) : (p.x - t.x);
    const openness = nearestDistTo(oppTeam, t.x, t.y);
    const score = advance * 0.6 + openness * 0.9 - passDist * 0.15;
    if (score > bestScore) { bestScore = score; best = t; }
  }

  const underPressure = nearestOppDist < 70;
  if (p.role === 'GK') {
    if (best) doPass(p, state, best); else doClear(p, state, goalX, goalY);
    return;
  }
  if (best && (bestScore > 30 || underPressure)) {
    doPass(p, state, best);
  } else if (underPressure) {
    doClear(p, state, goalX, goalY);
  }
}

function updateGoalkeeper(gk, state, dt) {
  const ball = state.ball;
  const dir = gk.team === 'home' ? 1 : -1;
  const ownGoalX = gk.team === 'home' ? 0 : FIELD.length;
  const lineX = ownGoalX + dir * 24;
  const gkMinX = Math.min(ownGoalX, ownGoalX + dir * 150);
  const gkMaxX = Math.max(ownGoalX, ownGoalX + dir * 150);

  let targetX = lineX;
  let targetY = clamp(ball.y, FIELD.width / 2 - FIELD.goalWidth / 2 + 12, FIELD.width / 2 + FIELD.goalWidth / 2 - 12);

  const distBallToGoal = Math.abs(ball.x - ownGoalX);
  const ballInFrontOfGoal = Math.abs(ball.y - FIELD.width / 2) < FIELD.goalWidth * 0.9;

  if (!ball.owner && distBallToGoal < 260 && ballInFrontOfGoal && !gk.isDiving()) {
    targetX = ball.x - dir * 8;
    targetY = ball.y;
  } else if (ball.owner && ball.owner.team !== gk.team && distBallToGoal < 320) {
    targetX = lineX + dir * clamp(320 - distBallToGoal, 0, 70) * 0.18;
  }
  targetX = clamp(targetX, gkMinX, gkMaxX);

  // Reactive diving save for fast shots heading toward goal.
  if (!gk.isDiving() && !ball.owner) {
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    const movingTowardGoal = gk.team === 'home' ? ball.vx < -60 : ball.vx > 60;
    if (ballSpeed > 160 && movingTowardGoal) {
      const t = Math.abs((ball.x - lineX) / (ball.vx || 1));
      if (t > 0 && t < 0.65) {
        const predictedY = ball.y + ball.vy * t;
        if (Math.abs(predictedY - FIELD.width / 2) < FIELD.goalWidth / 2 + 40 && distBallToGoal < 340) {
          const dx = predictedY > gk.y ? 1 : -1;
          gk.startDive(0, dx, 0.4);
        }
      }
    }
  }

  if (!gk.isDiving()) {
    steerTo(gk, targetX, targetY, 6, dist(gk.x, gk.y, targetX, targetY) > 40);
  } else {
    gk.moveDir = { x: 0, y: 0 };
  }

  if (ball.owner === gk) updateCarrierAI(gk, state, dt);
}

function updateOnePlayer(p, state, possessionTeam, isPresser, dt) {
  if (p.role === 'GK') { updateGoalkeeper(p, state, dt); return; }

  if (state.ball.owner === p) { updateCarrierAI(p, state, dt); return; }

  const defending = possessionTeam && possessionTeam !== p.team;
  if (defending && isPresser && state.ball.owner) {
    steerTo(p, state.ball.owner.x, state.ball.owner.y, 4, true);
    attemptPassiveTackle(p, state.ball.owner, state, dt);
  } else {
    const target = computeSupportTarget(p, state, possessionTeam);
    steerTo(p, target.x, target.y, 18, dist(p.x, p.y, target.x, target.y) > 90);
  }
}

function runTeamAI(state, dt) {
  const { home, away, ball, controlled } = state;
  const possessionTeam = ball.owner ? ball.owner.team : null;

  const homeOutfield = home.filter(p => p.role !== 'GK' && p !== controlled);
  const awayOutfield = away.filter(p => p.role !== 'GK');

  const homePresser = nearestTo(homeOutfield, ball.x, ball.y);
  const awayPresser = nearestTo(awayOutfield, ball.x, ball.y);

  for (const p of home) {
    if (p === controlled) continue;
    updateOnePlayer(p, state, possessionTeam, p === homePresser, dt);
  }
  for (const p of away) {
    updateOnePlayer(p, state, possessionTeam, p === awayPresser, dt);
  }
}
