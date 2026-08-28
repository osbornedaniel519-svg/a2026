// ===================== Synthesized sound effects (no external assets) =====================
const SFX = (() => {
  let ctx = null;
  let master = null;
  let crowdSource = null;
  let enabled = true;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone(freq, dur, type, gainVal, glideTo) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), c.currentTime + dur);
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, gainVal, filterFreq) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return src;
  }

  function kick() { noiseBurst(0.09, 0.35, 900); tone(180, 0.07, 'triangle', 0.18, 90); }
  function pass() { noiseBurst(0.06, 0.22, 1400); }
  function whistle(short) {
    tone(2200, short ? 0.12 : 0.35, 'sine', 0.25, short ? 2000 : 1800);
  }
  function post() { tone(900, 0.18, 'square', 0.2, 400); }
  function crowdCheer() {
    // layered noise swell to approximate a crowd roar
    for (let i = 0; i < 3; i++) {
      setTimeout(() => noiseBurst(0.9 + i * 0.1, 0.16, 500 + i * 400), i * 40);
    }
    tone(440, 0.5, 'sawtooth', 0.05, 220);
  }
  function tackleThud() { noiseBurst(0.12, 0.3, 300); }

  function startAmbientCrowd() {
    const c = ensureCtx();
    if (!c || crowdSource) return;
    const bufferSize = 2 * c.sampleRate;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = c.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    crowdSource = src;
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.55 : 0;
  }

  return { resume, kick, pass, whistle, post, crowdCheer, tackleThud, startAmbientCrowd, setEnabled };
})();
