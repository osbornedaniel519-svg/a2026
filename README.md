# 2026

A realistic arcade soccer game for the browser, pushed as far as a single canvas and vanilla
JavaScript will take it. Rendered in true perspective 3D — a hand-rolled camera (no WebGL or
engine) projects the pitch, players and ball through a look-at/FOV camera that follows the ball
like a broadcast camera, giving real depth, scale-with-distance and occlusion. No build step, no
dependencies, no external assets — every visual is drawn on `<canvas>` and every sound is
synthesized with the Web Audio API.

Originally-designed teams only: generic national-style kits (colors + codes, themed around the
2026 World Cup hosts and a few other footballing nations), original procedurally-named rosters,
and no real club crests, kits, or player likenesses.

## Play it

Open `index.html` directly in a browser, or serve the folder locally:

```
npx http-server -p 8080 -c-1 .
# or
python3 -m http.server 8080
```

then visit `http://localhost:8080`.

## Game modes

Pick one under "Where to Play" in the menu:
- **Stadium · 11v11** — the full pitch, 4-3-3 formations, throw-ins/corners/goal-kicks.
- **Outside · 4v4** — a small walled cage/court pickup game (1 keeper + 3 outfield each). The
  ball bounces off the boards instead of going out, so there's no stoppage besides kickoffs and
  goals — quick, chaotic, arcade street football against NPCs.

## Controls

**Keyboard**
- `WASD` / Arrow keys — move
- `Shift` — sprint
- `Z` — pass
- `X` — through ball / lofted pass
- `C` (hold, release to strike) — shoot; longer hold = more power and lift
- `Space` — tackle / slide when defending
- `Q` — switch controlled player
- `Esc` — pause

**Touch** — an on-screen joystick plus PASS / THRU / SHOT (hold-and-release) / SPR buttons
appear automatically on touch devices.

You always control the outfield player on your team nearest the ball; control switches
automatically as play moves. Goalkeepers are always AI-controlled.

## How it works

- `js/constants.js` — field/physics/difficulty tuning and team data
- `js/entities.js` — `Player` and `Ball`, with an owner-follow dribble model and a real
  gravity/bounce/friction simulation for the ball (height included, so shots can clear the bar)
- `js/ai.js` — 4-3-3 formation shape that breathes with the ball, double-team pressing near goal
  on Normal/Hard, and a decision loop (shoot / pass / dribble / clear) for every AI-controlled
  player, including a reactive diving goalkeeper. Difficulty scales CPU speed, reaction latency,
  tackling, passing and shot accuracy — Hard is a genuinely tough, fast-reacting opponent
- `js/match.js` — the match state machine: kickoff, goals, halftime, full time, and human
  pass/shoot/tackle actions with light aim-assist. Throw-ins, corners and goal kicks are real set
  pieces, not instant hand-offs: a throw-in taker holds the ball overhead through the restart
  pause and then actually throws it (both hands, arced) to the nearest teammate; corners are
  delivered as a real crossed kick into the box; goal kicks are punted upfield. Because these just
  put a normal moving ball back into play, the existing goal check (any shot/cross/throw that
  crosses the line under the bar scores) applies to them exactly as it does in open play
- `js/render.js` — a small hand-rolled 3D camera (look-at + perspective projection, no
  WebGL/engine) that follows the ball like a broadcast camera; the pitch, goals and players are
  projected through it for both the grass stadium and the walled concrete court. Players are
  billboarded sprites with a tapered shirt, shorts, legs, arms, hair, and a simple face (eyes +
  mouth, up close), a running-cycle limb swing while moving, and a distinct goalkeeper kit with
  gloves; they play a leg-swing kick animation whenever they strike the ball (including at
  corners and goal kicks), raise both arms overhead for a throw-in, and goalkeepers snap into a
  stretched, arm-reaching dive pose for saves. Stadium mode adds perimeter sponsor boards
  (fictional brands), a tall three-tier stand packed with individual fans that ripple in a
  traveling wave (and cheer harder on goals), floodlight glow, pitch wear patches, a fast ball
  motion trail, and a vignette; plus an aspect-ratio-adaptive viewport (fills the screen on any
  device with no letterboxing) and a 2D top-down minimap
- `js/input.js` — keyboard and touch (virtual joystick + buttons) input
- `js/audio.js` — kicks, whistles, tackles, and crowd noise, all synthesized, no audio files

## Known simplifications

This is a from-scratch arcade implementation, not a licensed simulation. To keep scope sane it
skips offside and fouls/cards/end-swapping at halftime, and — unlike the real laws of the game,
which disallow scoring directly from a throw-in — any restart that ends up crossing the line
under the bar counts as a goal here, same as a shot from open play. Everything else — movement,
dribbling, passing, shooting, tackling, goalkeeping, throw-ins, corners, goal kicks, and full
match flow — is fully playable.
