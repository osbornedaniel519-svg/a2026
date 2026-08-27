// ===================== Small math / helper utilities =====================

function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

function lerp(a, b, t) { return a + (b - a) * t; }

function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }

// Moves `v` toward `target` by at most `maxDelta`.
function approach(v, target, maxDelta) {
  if (v < target) return Math.min(v + maxDelta, target);
  if (v > target) return Math.max(v - maxDelta, target);
  return v;
}

function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0, len: 0 };
  return { x: x / len, y: y / len, len };
}

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Seeded PRNG so squads are stable within a session but deterministic per seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Minimal 3D vector helpers, used only for the perspective camera projection. ----
function v3sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function v3cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function v3dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function v3norm(a) {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function fmtClock(totalSeconds) {
  const m = Math.floor(totalSeconds);
  const s = Math.floor((totalSeconds - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtMatchMinute(min) {
  return `${Math.min(90, Math.max(0, Math.floor(min)))}'`;
}
