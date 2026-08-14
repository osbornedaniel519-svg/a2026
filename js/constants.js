// ===================== World / field constants =====================
// All spatial units are arbitrary "world units" (~ 1 unit ≈ 10cm) tuned for feel, not strict scale.
const FIELD = {
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
};

const DIFFICULTY = {
  Easy:   { cpuSpeedMul: 0.90, reaction: 0.34, tackleSkill: 0.42, shootSkill: 0.55, passSkill: 0.62 },
  Normal: { cpuSpeedMul: 0.98, reaction: 0.22, tackleSkill: 0.55, shootSkill: 0.68, passSkill: 0.75 },
  Hard:   { cpuSpeedMul: 1.06, reaction: 0.12, tackleSkill: 0.68, shootSkill: 0.80, passSkill: 0.86 },
};

const HALF_LENGTHS = {
  Quick:  60,   // real seconds per half
  Normal: 150,
  Long:   300,
};

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

const FIRST_NAMES = ['Alex','Marco','Leo','Diego','Sam','Kai','Theo','Noah','Luca','Omar','Ben','Josh','Enzo','Yuto','Mateo','Ryo','Tariq','Nico','Owen','Iker','Hugo','Milo','Zane','Rico'];
const LAST_NAMES = ['Silva','Novak','Reyes','Kessler','Hartmann','Bianchi','Okafor','Suzuki','Moreno','Whitfield','Dubois','Larsen','Petrov','Nakamura','Alvarez','Sato','Kimura','Costa','Fischer','Delgado','Aguilar','Voss','Reyes','Park'];
