/* ─────────────────────────────────────────────────────────────
   ALIEN / ambient audio — Web Audio API, no external files
   - low engine hum
   - distant air system rumble
   - random metallic clanks
   - motion-tracker pings (called by tracker.js)
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let started = false;
  let enabled = false;

  // node bank
  let humOsc, humGain;
  let noiseSrc, noiseLP, noiseGain;
  let clankTimer = null;

  function makeNoiseBuffer() {
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // brown noise
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  function clank() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // metallic burst — bandpassed noise with quick decay
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100 + Math.random() * 1400;
    bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    src.connect(bp).connect(g).connect(master);
    src.start(now);
    src.stop(now + 0.6);

    // schedule next clank in 6–18s
    const next = 6000 + Math.random() * 12000;
    clankTimer = setTimeout(clank, next);
  }

  function ping(isXeno) {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isXeno ? 660 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(isXeno ? 220 : 360, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(isXeno ? 0.18 : 0.13, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.3);

    // double-tap for xenos
    if (isXeno) {
      setTimeout(() => ping(false), 60);
    }
  }

  function start() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    // ambient hum
    humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 55;
    const humLP = ctx.createBiquadFilter();
    humLP.type = 'lowpass';
    humLP.frequency.value = 180;
    humGain = ctx.createGain();
    humGain.gain.value = 0.07;
    humOsc.connect(humLP).connect(humGain).connect(master);
    humOsc.start();

    // brown noise
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = makeNoiseBuffer();
    noiseSrc.loop = true;
    noiseLP = ctx.createBiquadFilter();
    noiseLP.type = 'lowpass';
    noiseLP.frequency.value = 700;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noiseSrc.connect(noiseLP).connect(noiseGain).connect(master);
    noiseSrc.start();

    enabled = true;
    clankTimer = setTimeout(clank, 3000);
  }

  function toggle() {
    if (!started) { start(); return true; }
    enabled = !enabled;
    if (master) master.gain.linearRampToValueAtTime(enabled ? 0.6 : 0, ctx.currentTime + 0.4);
    return enabled;
  }

  function shot() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // pulse rifle bark — short noise burst with low thump
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.04));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.32, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp).connect(g).connect(master);
    src.start(now); src.stop(now + 0.2);
    // sub thump
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.001, now);
    gg.gain.exponentialRampToValueAtTime(0.25, now + 0.003);
    gg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gg).connect(master);
    osc.start(now); osc.stop(now + 0.16);
  }

  function splat() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.pow(1 - i / d.length, 2);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(bp).connect(g).connect(master);
    src.start(now); src.stop(now + 0.5);
  }

  window.AlienAudio = { start, toggle, ping, shot, splat, get on() { return enabled; } };

  // UI button
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('audio-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = toggle();
      btn.classList.toggle('on', on);
      btn.querySelector('.lbl').textContent = on ? 'AUDIO ONLINE' : 'AUDIO OFFLINE';
    });
  });
})();
