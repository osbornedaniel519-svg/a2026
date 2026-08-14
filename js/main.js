// ===================== Bootstrap: menu wiring + game loop =====================
(function () {
  const sel = { homeIdx: 0, awayIdx: 1, diff: 'Normal', len: 'Normal' };

  const screens = {
    menu: document.getElementById('menu'),
    howto: document.getElementById('howto'),
    game: document.getElementById('gameScreen'),
    pause: document.getElementById('pauseOverlay'),
  };

  function renderTeamPicker(containerId, isHome) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    TEAMS.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'teamCard';
      card.innerHTML = `<div class="swatch" style="background:${t.primary};color:${t.text};border-color:${t.secondary}">${t.code}</div>${t.name}`;
      card.addEventListener('click', () => {
        if (isHome) {
          if (i === sel.awayIdx) sel.awayIdx = sel.homeIdx;
          sel.homeIdx = i;
        } else {
          if (i === sel.homeIdx) sel.homeIdx = sel.awayIdx;
          sel.awayIdx = i;
        }
        refreshPickers();
      });
      el.appendChild(card);
    });
  }

  function refreshPickers() {
    const homeEl = document.getElementById('homePicker');
    const awayEl = document.getElementById('awayPicker');
    [...homeEl.children].forEach((c, i) => c.classList.toggle('selected', i === sel.homeIdx));
    [...awayEl.children].forEach((c, i) => c.classList.toggle('selected', i === sel.awayIdx));
  }

  function renderPillGroup(containerId, options, current, onPick) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    options.forEach(({ key, label }) => {
      const pill = document.createElement('div');
      pill.className = 'pill' + (key === current() ? ' selected' : '');
      pill.textContent = label;
      pill.addEventListener('click', () => {
        onPick(key);
        [...el.children].forEach(c => c.classList.remove('selected'));
        pill.classList.add('selected');
      });
      el.appendChild(pill);
    });
  }

  renderTeamPicker('homePicker', true);
  renderTeamPicker('awayPicker', false);
  refreshPickers();

  renderPillGroup('diffPicker', [
    { key: 'Easy', label: 'Easy' },
    { key: 'Normal', label: 'Normal' },
    { key: 'Hard', label: 'Hard' },
  ], () => sel.diff, (k) => { sel.diff = k; });

  renderPillGroup('lenPicker', [
    { key: 'Quick', label: 'Quick · 1m' },
    { key: 'Normal', label: 'Normal · 2.5m' },
    { key: 'Long', label: 'Long · 5m' },
  ], () => sel.len, (k) => { sel.len = k; });

  document.getElementById('howToBtn').addEventListener('click', () => {
    screens.menu.classList.add('hidden');
    screens.howto.classList.remove('hidden');
  });
  document.getElementById('closeHowto').addEventListener('click', () => {
    screens.howto.classList.add('hidden');
    screens.menu.classList.remove('hidden');
  });

  // ---------------- Game loop ----------------
  let match = null;
  let renderer = null;
  let paused = false;
  let running = false;
  let lastTime = null;

  function loop(ts) {
    if (!running) return;
    if (lastTime === null) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    dt = clamp(dt, 0, 1 / 20);
    if (match && !paused) match.update(dt);
    if (match && renderer) renderer.draw(match, paused ? 0 : dt);
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastTime = null;
  });

  function startMatch() {
    SFX.resume();
    SFX.startAmbientCrowd();
    const homeDef = TEAMS[sel.homeIdx];
    const awayDef = TEAMS[sel.awayIdx];
    match = new Match(homeDef, awayDef, sel.diff, sel.len);

    screens.menu.classList.add('hidden');
    screens.howto.classList.add('hidden');
    screens.game.classList.remove('hidden');
    screens.pause.classList.add('hidden');
    paused = false;

    if (!renderer) {
      renderer = new Renderer(
        document.getElementById('pitchCanvas'),
        document.getElementById('miniMap'),
        document.getElementById('pitchWrap')
      );
    }
    renderer.resize();

    if (!running) { running = true; lastTime = null; requestAnimationFrame(loop); }
    window.DEBUG_GAME = { get match() { return match; }, get renderer() { return renderer; } };
  }

  document.getElementById('kickoffBtn').addEventListener('click', startMatch);

  function setPaused(v) {
    paused = v;
    screens.pause.classList.toggle('hidden', !v);
    if (!v) lastTime = null;
  }

  document.getElementById('pauseBtn').addEventListener('click', () => setPaused(true));
  document.getElementById('resumeBtn').addEventListener('click', () => setPaused(false));
  document.getElementById('quitBtn').addEventListener('click', () => {
    setPaused(false);
    screens.game.classList.add('hidden');
    screens.menu.classList.remove('hidden');
    match = null;
  });

  Input.init();
  Input.onPause = () => {
    if (screens.game.classList.contains('hidden')) return;
    setPaused(!paused);
  };
})();
