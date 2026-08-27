# 2026

A realistic arcade soccer game for the browser, pushed as far as a single canvas and vanilla
JavaScript will take it. No build step, no dependencies, no external assets — every visual is
drawn on `<canvas>` and every sound is synthesized with the Web Audio API.

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
- `js/ai.js` — 4-3-3 formation shape that breathes with the ball, pressing/marking on defense,
  and a decision loop (shoot / pass / dribble / clear) for every AI-controlled player, including
  a reactive diving goalkeeper
- `js/match.js` — the match state machine: kickoff, goals, throw-ins, corners, goal kicks (or
  wall bounces in Outside mode), halftime, full time, and human pass/shoot/tackle actions with
  light aim-assist
- `js/render.js` — pitch markings for both grass stadium and walled concrete court, camera that
  follows the ball, aspect-ratio-adaptive viewport (fills the screen on any device with no
  letterboxing), and a minimap
- `js/input.js` — keyboard and touch (virtual joystick + buttons) input
- `js/audio.js` — kicks, whistles, tackles, and crowd noise, all synthesized, no audio files

## Known simplifications

This is a from-scratch arcade implementation, not a licensed simulation. To keep scope sane it
skips: offside, fouls/cards, and end-swapping at halftime; throw-ins/corners/goal-kicks are
instant restarts rather than animated set pieces. Everything else — movement, dribbling, passing,
shooting, tackling, goalkeeping, and full match flow — is fully playable.
