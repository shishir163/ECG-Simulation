/* ECG Lab - synthetic 12-lead ECG engine
   Every beat is built from Gaussian components whose amplitude is set per lead (mV).
   Rhythms are described as lists of QRS beats and P waves, so AV dissociation,
   blocks and ectopy fall out naturally. */
(function (root) {
  'use strict';
  const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  const IDX = {}; LEADS.forEach((l, i) => IDX[l] = i);
  const FS = 500;
  let N = FS * 10;
  let CURR = { dur: 10, k: 1, ka: 1, ctl: {} };
  const ANG = [0, 60, 120, -150, -30, 90];
  const LW = [[1, 0, 0], [.5, .866, 0], [-.5, .866, 0], [-.866, -.5, 0], [.866, -.5, 0], [0, 1, 0],
    [-.35, .1, .9], [0, .1, 1], [.4, .15, .9], [.7, .2, .65], [.9, .25, .35], [1, .3, .1]];
  const rad = d => d * Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sig = x => 1 / (1 + Math.exp(-x));
  const zeros = () => new Array(12).fill(0);
  function L(o, base) { const a = base ? base.slice() : zeros(); for (const k in o) a[IDX[k]] = o[k]; return a; }
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const limbAmp = (axis, M) => ANG.map(a => M * Math.cos(rad(axis - a)));

  /* ---------- morphology ---------- */
  function baseMorph(o) {
    o = Object.assign({ axis: 60, M: 1.1, qrsD: .09, taxis: 45, tM: .38, paxis: 55, pM: .16, pd: .09 }, o || {});
    const m = { qrsD: o.qrsD, pd: o.pd, tw: 1, tsym: false, qt: null, jws: .035 };
    ['q', 'r', 's', 'rp', 'st', 't', 'tn', 'u', 'p', 'pn', 'dl', 'jw', 'sp', 'prs', 'sc'].forEach(k => m[k] = zeros());
    const A = limbAmp(o.axis, o.M);
    for (let i = 0; i < 6; i++) {
      const a = A[i];
      if (a >= .2) { m.r[i] = a; m.s[i] = -.04; }
      else if (a <= -.2) { m.s[i] = a; m.r[i] = .05; }
      else { m.r[i] = .22 + .6 * a; m.s[i] = -.22 + .6 * a; }
    }
    [0, 1, 4].forEach(i => { if (m.r[i] > .35) m.q[i] = -.07; });
    const pr_r = [.25, .5, .85, 1.35, 1.5, 1.1], pr_s = [-1, -1.6, -1, -.4, -.2, -.1], pr_q = [0, 0, 0, 0, -.1, -.12];
    const pr_t = [-.05, .45, .5, .55, .45, .35], pr_p = [.05, .07, .09, .11, .12, .11];
    for (let i = 0; i < 6; i++) { m.r[6 + i] = pr_r[i]; m.s[6 + i] = pr_s[i]; m.q[6 + i] = pr_q[i]; m.t[6 + i] = pr_t[i]; m.p[6 + i] = pr_p[i]; }
    for (let i = 0; i < 6; i++) { m.t[i] = o.tM * Math.cos(rad(o.taxis - ANG[i])); m.p[i] = o.pM * Math.cos(rad(o.paxis - ANG[i])); }
    m.u[7] = .04; m.u[8] = .05; m.u[9] = .04;
    return m;
  }
  /* wide-complex (ventricular-origin) morphology with discordant ST-T */
  function ventMorph(o) {
    o = Object.assign({ axis: 80, v1: 'neg', qrsD: .16, M: 1.2, tk: .35, pd: .09 }, o || {});
    const m = baseMorph({ axis: o.axis, M: o.M, qrsD: o.qrsD, pd: o.pd });
    m.q.fill(0);
    const r = o.v1 === 'neg' ? [.05, .08, .15, .35, .55, .6] : [1.1, 1.0, 1.0, .8, .55, .3];
    const s = o.v1 === 'neg' ? [-1.5, -1.8, -1.4, -.8, -.4, -.2] : [-.1, -.3, -.6, -.9, -1.1, -1.0];
    for (let i = 0; i < 6; i++) { m.r[6 + i] = r[i]; m.s[6 + i] = s[i]; }
    for (let i = 0; i < 12; i++) { const net = m.r[i] + m.s[i]; m.t[i] = -o.tk * net; m.st[i] = -.1 * net; }
    m.tw = 1.3;
    return m;
  }

  /* ---------- drawing primitives (write into lead arrays) ---------- */
  function addG(a, c, sl, sr, amp) {
    if (!amp) return;
    const i0 = Math.max(0, Math.floor((c - 5 * sl) * FS)), i1 = Math.min(N - 1, Math.ceil((c + 5 * sr) * FS));
    for (let i = i0; i <= i1; i++) { const t = i / FS, z = (t - c) / (t < c ? sl : sr); a[i] += amp * Math.exp(-.5 * z * z); }
  }
  function addBox(a, t0, t1, e, amp) {
    if (!amp || t1 <= t0) return;
    const i0 = Math.max(0, Math.floor((t0 - 6 * e) * FS)), i1 = Math.min(N - 1, Math.ceil((t1 + 6 * e) * FS));
    for (let i = i0; i <= i1; i++) { const t = i / FS; a[i] += amp * sig((t - t0) / e) * (1 - sig((t - t1) / e)); }
  }
  function addP(leads, tc, amps, s, pd, pn) {
    const sg = pd / 5.2;
    for (let l = 0; l < 12; l++) {
      addG(leads[l], tc, sg, sg, amps[l] * s);
      if (pn && pn[l]) addG(leads[l], tc + .026, .014, .014, pn[l] * s);
    }
  }
  function renderBeat(leads, tc, m, qt, amp) {
    const d = m.qrsD, sg = .12 * d, t0 = tc - .42 * d, hasRp = m.rp.some(v => Math.abs(v) > .05), J = tc + (hasRp ? .95 : .68) * d;
    const sr = .1 * Math.min(qt, .40) * (m.tw || 1), sl = sr * (m.tsym ? 1 : 1.5);
    const Tc = t0 + qt - 2.4 * sr;
    for (let l = 0; l < 12; l++) {
      const a = leads[l], k = amp ? amp[l] : 1;
      addG(a, tc - .3 * d, sg, sg, m.q[l] * k);
      addG(a, tc, sg, sg, m.r[l] * k);
      addG(a, tc + .3 * d, sg, sg, m.s[l] * k);
      addG(a, tc + .6 * d, sg, sg, m.rp[l] * k);
      if (m.dl[l]) addG(a, tc - .3 * d, .22 * d, .12 * d, m.dl[l] * k);
      if (m.st[l]) addBox(a, J - .004, Tc - 1.6 * sl, .007, m.st[l]);
      if (m.tn[l]) { addG(a, Tc - .045, .035, .035, m.t[l]); addG(a, Tc + .05, .04, .04, m.tn[l]); }
      else addG(a, Tc, sl, sr, m.t[l]);
      if (m.u[l]) addG(a, t0 + qt + .09, .035, .04, m.u[l]);
      if (m.sc[l]) addG(a, t0 + .42 * qt, .045, .045, m.sc[l]);
      if (m.jw[l]) addG(a, J + .012, .01, m.jws, m.jw[l]);
      if (m.sp[l]) addG(a, t0 - .008, .0012, .0012, m.sp[l]);
    }
    return { t0, J };
  }

  /* ---------- continuous / chaotic generators ---------- */
  function addFib(leads, R, amp, fmin, fmax, tEnd) {
    const comps = []; for (let k = 0; k < 6; k++) comps.push({ f: (fmin || 5.5) + R() * ((fmax || 9) - (fmin || 5.5)), ph: R() * 6.28, mf: .2 + R() * .8, mp: R() * 6.28 });
    const iEnd = tEnd ? Math.min(N, Math.round(tEnd * FS)) : N;
    for (let i = 0; i < iEnd; i++) {
      const t = i / FS; let w = 0;
      for (const c of comps) w += Math.sin(2 * Math.PI * c.f * t + c.ph) * (.65 + .35 * Math.sin(2 * Math.PI * c.mf * t + c.mp));
      w /= 3.2; if (tEnd) w *= Math.min(1, Math.max(0, (tEnd - t) / .25));
      for (let l = 0; l < 12; l++) if (amp[l]) leads[l][i] += amp[l] * w;
    }
  }
  function addSaw(leads, rate, ph, amp) {
    const per = 60 / rate, w = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = (((i / FS) / per + ph) % 1 + 1) % 1; w[i] = p < .85 ? 1 - 2 * p / .85 : -1 + 2 * (p - .85) / .15; }
    for (let i = 1; i < N - 1; i++) { const v = (w[i - 1] + 2 * w[i] + w[i + 1]) / 4; for (let l = 0; l < 12; l++) if (amp[l]) leads[l][i] += amp[l] * v; }
  }
  function addVF(leads, R, t0, t1, amp) {
    const ch = [0, 1, 2].map(() => { const c = []; for (let k = 0; k < 5; k++) c.push({ f: 3.5 + R() * 4.5, ph: R() * 6.28, mf: .3 + R() * .9, mp: R() * 6.28, a: .5 + R() }); return c; });
    const i1 = Math.min(N, Math.floor(t1 * FS));
    for (let i = Math.floor(t0 * FS); i < i1; i++) {
      const t = i / FS, env = amp * (.8 + .2 * Math.sin(2 * Math.PI * .13 * t));
      const v = ch.map(c => c.reduce((s, k) => s + k.a * Math.sin(2 * Math.PI * k.f * t + k.ph + 1.5 * Math.sin(2 * Math.PI * k.mf * t + k.mp)), 0) / 4.5);
      for (let l = 0; l < 12; l++) leads[l][i] += env * (LW[l][0] * v[0] + LW[l][1] * v[1] + LW[l][2] * v[2]);
    }
  }
  function addTorsades(leads, t0, t1, A) {
    const f = 4.4, Tm = 3.1, i1 = Math.min(N, Math.floor(t1 * FS));
    for (let i = Math.floor(t0 * FS); i < i1; i++) {
      const t = i / FS, u = t - t0, fade = clamp(u / .6, 0, 1), E = 2 * Math.PI * u / Tm + .5;
      const sh = Math.sin(2 * Math.PI * f * t) + .35 * Math.sin(4 * Math.PI * f * t + .8);
      for (let l = 0; l < 12; l++) leads[l][i] += A * fade * sh * (LW[l][0] * Math.cos(E) + LW[l][1] * Math.sin(E) + .3 * LW[l][2] * Math.cos(E));
    }
  }
  function addSine(leads, f, A) {
    for (let i = 0; i < N; i++) {
      const t = i / FS, env = 1 + .08 * Math.sin(2 * Math.PI * .21 * t);
      const sh = Math.sin(2 * Math.PI * f * t) + .18 * Math.sin(4 * Math.PI * f * t + .9);
      for (let l = 0; l < 12; l++) leads[l][i] += A * env * sh * (.8 * LW[l][0] + .6 * LW[l][1] + .7 * LW[l][2]);
    }
  }
  const GEN = { addFib, addSaw, addVF, addTorsades, addSine, addG };

  /* ---------- severity interpolation between two morphologies ---------- */
  const ARR = ['q', 'r', 's', 'rp', 'st', 't', 'tn', 'u', 'p', 'pn', 'dl', 'jw', 'sc', 'prs', 'sp'];
  function lerpMorph(a, b, k) {
    k = Math.max(0, k); const kq = Math.min(k, 1.25), m = {};
    ARR.forEach(n => { const kk = (n === 'q' || n === 'r' || n === 's' || n === 'rp') ? kq : k; m[n] = a[n].map((v, i) => v + (b[n][i] - v) * kk); });
    m.qrsD = a.qrsD + (b.qrsD - a.qrsD) * kq; m.pd = a.pd + (b.pd - a.pd) * Math.min(k, 1); m.tw = a.tw + (b.tw - a.tw) * Math.min(k, 1.2);
    m.jws = a.jws + (b.jws - a.jws) * Math.min(k, 1); m.tsym = k > .5 ? b.tsym : a.tsym;
    const qa = a.qt == null ? .36 : a.qt, qb = b.qt == null ? .36 : b.qt;
    m.qt = (a.qt == null && b.qt == null) ? null : qa + (qb - qa) * k;
    return m;
  }
  function defaults(e) { return { rate: e.rate ? e.rate.def : undefined, atr: e.atr ? e.atr.def : undefined, sev: e.sev ? e.sev.def : undefined }; }

  /* ---------- synth ---------- */
  let NORMAL = null, REAL = 0;
  function synth(e, opts) {
    opts = opts || {};
    const dur = opts.dur || 10; N = FS * dur;
    const ctl = Object.assign(defaults(e), opts.ctl || {});
    const k = e.rate && ctl.rate ? ctl.rate / e.rate.def : 1, ka = e.atr && ctl.atr ? ctl.atr / e.atr.def : 1;
    CURR = { dur, ctl, k, ka };
    let morphs = typeof e.morphs === 'function' ? e.morphs(ctl) : e.morphs;
    if (e.sev && e.sev.generic !== false && typeof e.morphs !== 'function') {
      NORMAL = NORMAL || baseMorph();
      morphs = Object.assign({}, morphs, { main: lerpMorph(NORMAL, morphs.main, ctl.sev) });
    }
    const R = mulberry(hash(e.id));
    const plan = e.build({ R, morphs, e, dur, ctl, k, ka }) || {};
    const leads = Array.from({ length: 12 }, () => new Float32Array(N));
    const beats = (plan.beats || []).map(b => Object.assign({}, b)).sort((a, b) => a.t - b.t);
    const mm = morphs.main, real = opts.real != null ? opts.real : REAL;
    const RW = [-.6, .7, 1, -.2, -.9, .9, .3, .2, .1, -.1, -.3, -.4], RP = 4.2;
    if (real) {
      const R2 = mulberry(hash(e.id) + 77);
      beats.forEach(b => { b.t += (R2() - .5) * .022 + .018 * Math.sin(2 * Math.PI * b.t / RP); });
      for (let i = 1; i < beats.length; i++) if (beats[i].t < beats[i - 1].t + .2) beats[i].t = beats[i - 1].t + .2;
    }
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i], m = morphs[b.m || 'main'];
      const prev = i > 0 ? b.t - beats[i - 1].t : (beats[1] ? beats[1].t - b.t : 1);
      const rr = clamp(prev, .3, 1.8);
      const qt = b.qt || m.qt || ((e.qtc || .40) * Math.sqrt(rr));
      const r = renderBeat(leads, b.t, m, qt, real ? RW.map(w => 1 + .11 * w * Math.sin(2 * Math.PI * b.t / RP + .4)) : null);
      if (b.pr != null) {
        const pc = r.t0 - b.pr + m.pd / 2;
        addP(leads, pc, b.pamp || m.p, b.ps || 1, m.pd, m.pn);
        for (let l = 0; l < 12; l++) if (m.prs[l]) addBox(leads[l], pc + m.pd * .5, r.t0 - .003, .006, m.prs[l]);
      }
      if (b.retro != null) addP(leads, b.t + b.retro, mm.p.map(v => -v), 1, mm.pd, null);
    }
    (plan.ps || []).forEach(p => addP(leads, p.t, p.amp || mm.p, p.s || 1, mm.pd, mm.pn));
    if (plan.fib) addFib(leads, R, plan.fib, plan.fibF && plan.fibF[0], plan.fibF && plan.fibF[1], plan.fibEnd);
    if (plan.saw) addSaw(leads, plan.saw.rate, plan.saw.ph || 0, plan.saw.amp);
    if (plan.custom) plan.custom(leads, R, GEN);
    if (real) for (let l = 0; l < 12; l++) { const a = leads[l], ph = l * .7; for (let i = 0; i < N; i++) { const t = i / FS; a[i] += .05 * Math.sin(2 * Math.PI * t / RP + ph) + .025 * Math.sin(2 * Math.PI * t * .11 + ph * 2); } }
    let hr = null;
    const vb = beats.filter(b => !b.nohr);
    if (vb.length >= 3) hr = Math.round(60 * (vb.length - 1) / (vb[vb.length - 1].t - vb[0].t));
    return { leads, beats, hr, fs: FS, n: N, dur, ps: (plan.ps || []).map(p => p.t) };
  }

  /* shared acquisition noise (baseline wander + small hiss), added at draw time */
  let NOISE = null;
  const NN = FS * 30;
  function noise() {
    if (NOISE) return NOISE;
    const R = mulberry(7);
    NOISE = Array.from({ length: 12 }, (_, l) => {
      const a = new Float32Array(NN), ph = R() * 6.28, ph2 = R() * 6.28, am = .03 + R() * .02;
      let s = 0;
      for (let i = 0; i < NN; i++) {
        const t = i / FS; s = s * .6 + (R() - .5) * .02;
        a[i] = am * Math.sin(2 * Math.PI * .22 * t + ph) + .015 * Math.sin(2 * Math.PI * .08 * t + ph2) + s;
      }
      return a;
    });
    return NOISE;
  }

  root.ECGEngine = { LEADS, IDX, FS, DUR: 10, N: FS * 10, L, LW, clamp, baseMorph, ventMorph, mulberry, synth, noise, limbAmp, GEN, lerpMorph, defaults, ARR, cur: () => CURR, setReal: v => { REAL = v ? 1 : 0; }, isReal: () => !!REAL };
})(typeof window !== 'undefined' ? window : globalThis);
