// ===================== World / field constants =====================
// All spatial units are arbitrary "world units" (~ 1 unit ≈ 10cm) tuned for feel, not strict scale.
// Two pitch presets exist (full Stadium, small-sided walled Outside/street); FIELD is a single
// mutable object so every other module can keep reading `FIELD.x` live instead of caching a copy.
const STADIUM_FIELD = {
  length: 1400,        // x-axis (goal to goal)
  width: 900,           // y-axis (touchline to touchline)
  margin: 60,            // run-off space drawn outside the lines
  goalWidth: 190,
  goalDepth: 34,
  postThickness: 5,
  crossbarHeight: 90,    // z-height a shot must stay under to count once past the line
  penaltyDepth: 220,
  penaltyWidth: 560,
  goalBoxDepth: 80,
  goalBoxWidth: 260,
  centerCircleR: 128,
  penSpotDist: 165,
  cornerR: 14,
};

// A small walled cage/court: ball bounces off the boards instead of going out, so there are
// no throw-ins, corners or goal-kicks — just kickoffs and goals, like a pickup game outside.
const STREET_FIELD = {
  length: 520,
  width: 340,
  margin: 26,
  goalWidth: 88,
  goalDepth: 22,
  crossbarHeight: 80,
};

// A tight 1v1 court: two small goals, no keepers, walled like the street court (bounces, no
// restarts) — a duel decided by dribbling skill, not team shape.
const ONE_V_ONE_FIELD = {
  length: 260,
  width: 180,
  margin: 16,
  goalWidth: 58,
  goalDepth: 14,
  crossbarHeight: 54,
};

const FIELD_PRESETS = { stadium: STADIUM_FIELD, street: STREET_FIELD, character: ONE_V_ONE_FIELD };

const FIELD = Object.assign({}, STADIUM_FIELD);

function applyFieldMode(mode) {
  Object.assign(FIELD, FIELD_PRESETS[mode] || STADIUM_FIELD);
}

const PHYS = {
  gravity: 1500,
  groundFriction: 330,
  bounceRestitution: 0.48,
  minBounceSpeed: 60,
  ballRadius: 8,
  playerRadius: 15,
  gkRadius: 16,
  pickupRadius: 24,
  dribbleLead: 24,
  dribbleFollow: 14, // how fast (units/s per unit distance) the ball springs to the dribble spot
  tackleRadius: 30,
  playerAccel: 950,
  playerBaseSpeed: 190,
  playerSprintSpeed: 300,
  gkBaseSpeed: 175,
  gkSprintSpeed: 250,
  kickAnimDuration: 0.32, // seconds the kicking-leg swing animation plays for
};

// reaction = base decision latency in seconds (lower = sharper); cpuSpeedMul scales the CPU
// (away) team's speed directly, since the human never controls that side.
const DIFFICULTY = {
  Easy:   { cpuSpeedMul: 0.94, reaction: 0.30, tackleSkill: 0.48, shootSkill: 0.60, passSkill: 0.68 },
  Normal: { cpuSpeedMul: 1.02, reaction: 0.17, tackleSkill: 0.63, shootSkill: 0.75, passSkill: 0.83 },
  Hard:   { cpuSpeedMul: 1.10, reaction: 0.08, tackleSkill: 0.76, shootSkill: 0.88, passSkill: 0.93 },
};

const HALF_LENGTHS = {
  Quick:  60,   // real seconds per half
  Normal: 150,
  Long:   300,
};

// A mix of individual supporter colors (clothing, scarves, flags) so the crowd reads as many
// different fans rather than one uniform texture.
const FAN_COLORS = ['#d0483f', '#4a72c9', '#e0b23c', '#3fae7a', '#9a4fc9', '#e8e8e8', '#e0803c', '#3c3c3c', '#4fb8c9', '#c94f8a'];

// Fictional pitchside sponsor boards (Stadium mode only) — original made-up brand names, not real
// companies, same policy as the team kits.
const AD_BOARDS = ['ATLAS BANK', 'NOVA AIR', 'ORBIT TELECOM', 'VERTEX SPORT', '2026 CUP', 'SOLAR ENERGY', 'PRIME COLA', 'GLOBAL FC'];
const AD_BOARD_COLORS = ['#1c3fae', '#c81c3a', '#0f8a4c', '#e0a90c', '#7a1cc8', '#0c8ac8'];

// Generic, original national-style squads themed around the 2026 World Cup hosts + a few others.
// No real crests, kits or player likenesses are used — colors and codes only.
const TEAMS = [
  { code: 'USA', name: 'United States', primary: '#2c3e8c', secondary: '#ffffff', text: '#ffffff' },
  { code: 'MEX', name: 'Mexico',        primary: '#0f7a3c', secondary: '#ffffff', text: '#ffffff' },
  { code: 'CAN', name: 'Canada',        primary: '#d3242a', secondary: '#ffffff', text: '#ffffff' },
  { code: 'BRA', name: 'Brazil',        primary: '#f4c300', secondary: '#0a6c2e', text: '#0a2e10' },
  { code: 'ARG', name: 'Argentina',     primary: '#75c1e8', secondary: '#ffffff', text: '#0a2e4a' },
  { code: 'FRA', name: 'France',        primary: '#1035a6', secondary: '#e0273b', text: '#ffffff' },
  { code: 'GER', name: 'Germany',       primary: '#1a1a1a', secondary: '#e0272c', text: '#ffffff' },
  { code: 'ENG', name: 'England',       primary: '#e7e7e7', secondary: '#c8102e', text: '#111111' },
  { code: 'JPN', name: 'Japan',         primary: '#0a3fa3', secondary: '#ffffff', text: '#ffffff' },
  { code: 'ESP', name: 'Spain',         primary: '#c8272c', secondary: '#f4c300', text: '#ffffff' },
  { code: 'MAR', name: 'Morocco',       primary: '#c8102e', secondary: '#0a6c2e', text: '#ffffff' },
  { code: 'KOR', name: 'South Korea',   primary: '#c8102e', secondary: '#1a1a1a', text: '#ffffff' },
];

// Formation (4-3-3): fx = 0 own goal line -> 1 opponent goal line, fy = 0..1 across width.
const FORMATION_433 = [
  { role: 'GK', fx: 0.04, fy: 0.50 },
  { role: 'DEF', fx: 0.18, fy: 0.14 },
  { role: 'DEF', fx: 0.16, fy: 0.38 },
  { role: 'DEF', fx: 0.16, fy: 0.62 },
  { role: 'DEF', fx: 0.18, fy: 0.86 },
  { role: 'MID', fx: 0.44, fy: 0.24 },
  { role: 'MID', fx: 0.42, fy: 0.50 },
  { role: 'MID', fx: 0.44, fy: 0.76 },
  { role: 'FWD', fx: 0.74, fy: 0.20 },
  { role: 'FWD', fx: 0.78, fy: 0.50 },
  { role: 'FWD', fx: 0.74, fy: 0.80 },
];

// Outside/street mode: 4-a-side (1 GK + 3 outfield) loose triangle on a small walled court.
const FORMATION_STREET = [
  { role: 'GK', fx: 0.06, fy: 0.50 },
  { role: 'DEF', fx: 0.32, fy: 0.26 },
  { role: 'MID', fx: 0.56, fy: 0.74 },
  { role: 'FWD', fx: 0.80, fy: 0.42 },
];

// 1v1 Character mode: a single outfield player per side, no goalkeeper — a duel, not a team shape.
const FORMATION_1V1 = [
  { role: 'FWD', fx: 0.42, fy: 0.5 },
];

const GAME_MODES = {
  stadium: { label: 'Stadium', formation: FORMATION_433, walled: false, cameraZoom: 600, ambientCrowd: true },
  street: { label: 'Outside', formation: FORMATION_STREET, walled: true, cameraZoom: 400, ambientCrowd: false },
  character: { label: '1v1 Street', formation: FORMATION_1V1, walled: true, cameraZoom: 220, ambientCrowd: false },
};

// ===================== Character creator (1v1 mode) =====================
const SKIN_TONES = ['#f0c8a0', '#e3b590', '#c68863', '#a86b42', '#8d5a3c', '#5c3a24'];
const KIT_PRESETS = [
  { primary: '#e0273b', secondary: '#ffffff', text: '#ffffff' },
  { primary: '#1035a6', secondary: '#f4c300', text: '#ffffff' },
  { primary: '#0a6c2e', secondary: '#ffffff', text: '#ffffff' },
  { primary: '#1a1a1a', secondary: '#e0273b', text: '#ffffff' },
  { primary: '#f4c300', secondary: '#111111', text: '#111111' },
  { primary: '#7a1cc8', secondary: '#ffffff', text: '#ffffff' },
  { primary: '#0c8ac8', secondary: '#ffffff', text: '#ffffff' },
  { primary: '#e0803c', secondary: '#1a1a1a', text: '#111111' },
];
const STREET_RIVAL = { code: 'CPU', name: 'Street Rival', primary: '#2a2a2e', secondary: '#e0273b', text: '#ffffff', skin: '#a86b42', hair: '#0f0d0b' };

const FIRST_NAMES = ['Alex','Marco','Leo','Diego','Sam','Kai','Theo','Noah','Luca','Omar','Ben','Josh','Enzo','Yuto','Mateo','Ryo','Tariq','Nico','Owen','Iker','Hugo','Milo','Zane','Rico'];
const LAST_NAMES = ['Silva','Novak','Reyes','Kessler','Hartmann','Bianchi','Okafor','Suzuki','Moreno','Whitfield','Dubois','Larsen','Petrov','Nakamura','Alvarez','Sato','Kimura','Costa','Fischer','Delgado','Aguilar','Voss','Reyes','Park'];
