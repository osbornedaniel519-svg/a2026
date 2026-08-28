// ===================== Bootstrap: menu wiring + game loop =====================
(function () {
  const sel = { homeIdx: 0, awayIdx: 1, diff: 'Normal', len: 'Normal', mode: 'stadium' };
  const charSel = { skinIdx: 1, hairIdx: 0, kitIdx: 0, number: 10 };

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

  function renderSwatchGroup(containerId, colors, currentIdx, onPick, kitStyle) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    colors.forEach((color, i) => {
      const sw = document.createElement('div');
      const bg = kitStyle ? color.primary : color;
      sw.className = 'colorSwatch' + (kitStyle ? ' kit' : '') + (i === currentIdx() ? ' selected' : '');
      sw.style.background = bg;
      sw.addEventListener('click', () => {
        onPick(i);
        [...el.children].forEach(c => c.classList.remove('selected'));
        sw.classList.add('selected');
      });
      el.appendChild(sw);
    });
  }

  function updateModeVisibility() {
    const isChar = sel.mode === 'character';
    document.getElementById('teamPickers').classList.toggle('hidden', isChar);
    document.getElementById('characterCreator').classList.toggle('hidden', !isChar);
  }

  renderTeamPicker('homePicker', true);
  renderTeamPicker('awayPicker', false);
  refreshPickers();

  renderSwatchGroup('skinPicker', SKIN_TONES, () => charSel.skinIdx, (i) => { charSel.skinIdx = i; });
  renderSwatchGroup('hairPicker', HAIR_COLORS, () => charSel.hairIdx, (i) => { charSel.hairIdx = i; });
  renderSwatchGroup('kitPicker', KIT_PRESETS, () => charSel.kitIdx, (i) => { charSel.kitIdx = i; }, true);

  document.getElementById('numDown').addEventListener('click', () => {
    charSel.number = Math.max(1, charSel.number - 1);
    document.getElementById('numValue').textContent = charSel.number;
  });
  document.getElementById('numUp').addEventListener('click', () => {
    charSel.number = Math.min(99, charSel.number + 1);
    document.getElementById('numValue').textContent = charSel.number;
  });

  renderPillGroup('modePicker', [
    { key: 'stadium', label: 'Stadium · 11v11' },
    { key: 'street', label: 'Outside · 4v4' },
    { key: 'character', label: '1v1 Street' },
  ], () => sel.mode, (k) => { sel.mode = k; updateModeVisibility(); });
  updateModeVisibility();

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
    let homeDef, awayDef;
    if (sel.mode === 'character') {
      const kit = KIT_PRESETS[charSel.kitIdx];
      const nick = (document.getElementById('charName').value || 'YOU').trim().toUpperCase().slice(0, 10) || 'YOU';
      homeDef = {
        code: nick.slice(0, 3) || 'YOU',
        name: nick,
        primary: kit.primary,
        secondary: kit.secondary,
        text: kit.text,
        skin: SKIN_TONES[charSel.skinIdx],
        hair: HAIR_COLORS[charSel.hairIdx],
      };
      awayDef = STREET_RIVAL;
    } else {
      homeDef = TEAMS[sel.homeIdx];
      awayDef = TEAMS[sel.awayIdx];
    }
    match = new Match(homeDef, awayDef, sel.diff, sel.len, sel.mode);
    if (sel.mode === 'character') {
      match.home[0].number = charSel.number;
      match.home[0].name = homeDef.name;
    }
    if (match.ambientCrowd) SFX.startAmbientCrowd();

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
    renderer.zoomUnits = match.cameraZoom;
    renderer.resize();
    renderer.resetCamera();

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
