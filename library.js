/* ECG Lab - pattern library (77 patterns). Each entry: morphology + rhythm builder + teaching notes. */
(function (root) {
  'use strict';
  const E = root.ECGEngine, { IDX, L, baseMorph, ventMorph } = E;
  const cur = () => E.cur();
  const last = () => cur().dur - .5;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const LIB = [];
  const CATS = ['Normal', 'Rhythm', 'Arrest & VT', 'Conduction', 'Ischaemia', 'Metabolic & Drugs', 'Other'];
  const A = (m, k, o) => { for (const l in o) m[k][IDX[l]] = o[l]; return m; };
  const SC = (m, k, f) => { for (let i = 0; i < 12; i++) m[k][i] *= f; return m; };
  const meas = (hr, pr, qrs, qtc, axis) => ({ hr, pr, qrs, qtc, axis });
  const def = o => { LIB.push(o); return o; };

  /* regular beats; pr = PR (s) to auto-place a P wave, null for none */
  function reg(rate, off, pr, R, jit, m) {
    const rr = 60 / (rate * cur().k), b = []; let t = off;
    while (t < last()) { const o = { t, m: m || 'main' }; if (pr != null) o.pr = pr; b.push(o); t += rr * (1 + (jit ? (R() - .5) * jit : 0)); }
    return b;
  }
  /* sinus slots with some slots replaced by a PVC (full compensatory pause) */
  function slots(rate, off, pr, isPvc) {
    const rr = 60 / (rate * cur().k), beats = [], ps = []; let i = 0;
    for (let t = off; t < last(); t += rr, i++) {
      if (isPvc(i)) { beats.push({ t: t - .35 * rr, m: 'pvc' }); ps.push({ t: t - .038 - pr + .045 }); }
      else beats.push({ t, m: 'main', pr });
    }
    return { beats, ps };
  }
  function mkRBBB() {
    const m = baseMorph({ axis: 70, M: 1.1, qrsD: .13 });
    A(m, 'r', { V1: .2, V2: .4, V3: .6 });
    A(m, 's', { V1: -.35, V2: -.5, V3: -.7, V4: -.6, V5: -.5, V6: -.4, I: -.2 });
    A(m, 'rp', { V1: 1.3, V2: 1.1, V3: .5, I: -.6, V5: -.7, V6: -.6, II: -.2, aVL: -.3, aVR: .3 });
    A(m, 't', { V1: -.5, V2: -.4, V3: -.15 });
    A(m, 'st', { V1: -.06, V2: -.08 });
    return m;
  }
  function mkLBBB() {
    const m = baseMorph({ axis: -10, M: 1.2, qrsD: .14 });
    m.q.fill(0);
    A(m, 'r', { V1: .05, V2: .08, V3: .2, V4: .6, V5: 1.2, V6: 1.1 });
    A(m, 's', { V1: -1.7, V2: -2.4, V3: -1.9, V4: -1.3, V5: -.15, V6: -.05 });
    A(m, 'rp', { I: .5, aVL: .5, V5: .6, V6: .55 });
    m.st = L({ V1: .25, V2: .45, V3: .35, V4: .15, I: -.1, aVL: -.12, V5: -.12, V6: -.12 });
    m.t = L({ V1: .4, V2: .6, V3: .5, V4: .15, I: -.4, aVL: -.4, V5: -.5, V6: -.5, II: -.05, aVF: .05, III: .1, aVR: .2 });
    m.tw = 1.3;
    return m;
  }

  /* ================= NORMAL ================= */
  def({
    id: 'nsr', name: 'Normal Sinus Rhythm', cat: 'Normal', lead: 'II', qtc: .40,
    meas: meas('75', '160 ms', '90 ms', '400 ms', '+60°'),
    morphs: { main: baseMorph() },
    build: c => ({ beats: reg(75, .45, .16, c.R, .03) }),
    desc: 'The reference trace: P before every QRS, normal intervals.',
    find: ['P wave before every QRS: upright in I, II, aVF and inverted in aVR', 'Rate 60–100/min and regular (mild respiratory variation is normal)', 'PR 120–200 ms, QRS under 120 ms, QTc under about 450 ms (men) / 460 ms (women)', 'R-wave progression V1 to V6 with transition near V3–V4'],
    pearls: ['Use it as the mental template when you read any other trace', 'Normal variants: early repolarisation, persistent juvenile T inversion in V1–V3, sinus arrhythmia'],
    ddx: ['Early repolarisation', 'Dextrocardia / limb-lead reversal (if P is inverted in I)'],
    act: 'Read systematically: rate, rhythm, axis, intervals, P, QRS, ST, T. Compare with the previous ECG.'
  });

  /* ================= RHYTHM ================= */
  def({
    id: 'sinus-brady', name: 'Sinus Bradycardia', cat: 'Rhythm', lead: 'II', qtc: .40,
    meas: meas('42', '180 ms', '90 ms', '400 ms', '+60°'),
    morphs: { main: baseMorph() },
    build: c => ({ beats: reg(42, .6, .18, c.R, .03) }),
    desc: 'Normal sinus P waves at a rate under 60.',
    find: ['Sinus P before every QRS, rate under 60/min', 'Normal PR and QRS; long diastolic baseline between beats', 'T waves are often more prominent and a U wave may appear'],
    pearls: ['Common causes in ICU: beta-blockers, dexmedetomidine, opioids, hypothermia, hypothyroidism, raised ICP (Cushing response), inferior MI', 'Normal in athletes and during sleep'],
    ddx: ['Sinus pause / SA exit block', 'Junctional rhythm', '2:1 AV block (P waves in pairs)'],
    act: 'Treat only if symptomatic or hypotensive: remove the cause, then atropine, chronotrope infusion or pacing per local protocol.'
  });
  def({
    id: 'sinus-tachy', name: 'Sinus Tachycardia', cat: 'Rhythm', lead: 'II', qtc: .40,
    meas: meas('128', '130 ms', '90 ms', '420 ms', '+60°'),
    morphs: { main: baseMorph() },
    build: c => ({ beats: reg(128, .35, .13, c.R, .02) }),
    desc: 'Fast sinus rhythm; P merges into the preceding T wave.',
    find: ['Rate over 100/min (adult sinus rarely exceeds ~160)', 'P wave of normal axis before each QRS, often on the tail of the previous T', 'Gradual onset and offset, rate varies with the stimulus', 'Shortened PR and QT'],
    pearls: ['It is a response, not a diagnosis: pain, fever, sepsis, hypovolaemia, bleeding, PE, thyrotoxicosis, withdrawal, drugs', 'Fixed rate near 150 should make you think of atrial flutter 2:1'],
    ddx: ['Atrial flutter 2:1', 'Atrial tachycardia', 'AVNRT (abrupt onset, no visible P)'],
    act: 'Look for and treat the cause. Do not slow a compensatory tachycardia with rate-control drugs.'
  });
  (function () {
    const m = baseMorph();
    def({
      id: 'pac', name: 'Premature Atrial Contractions', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('~77', '160 ms', '90 ms', '400 ms', '+60°'),
      morphs: { main: m },
      build: c => {
        const rr = 60 / (75 * c.k), b = []; let t = .45, i = 0;
        while (t < last()) {
          if (i % 5 === 3) { const tp = t - .3 * rr; b.push({ t: tp, m: 'main', pr: .13, pamp: m.p.map(v => v * .55) }); t = tp + rr * 1.06; }
          else { b.push({ t, m: 'main', pr: .16 }); t += rr; }
          i++;
        }
        return { beats: b };
      },
      desc: 'Early narrow beats with an abnormal P wave and a pause.',
      find: ['Early beat with a differently shaped P wave, often buried in the preceding T wave', 'Narrow QRS identical to the sinus beats (unless aberrantly conducted)', 'Pause after the early beat is usually not fully compensatory'],
      pearls: ['Very common in ICU: electrolyte disturbance (K, Mg), catecholamines, atrial stretch, hypoxia', 'Blocked PACs can mimic sinus pauses: look for a notched T wave'],
      ddx: ['PVC (wide, no P)', 'Sinus pause'],
      act: 'Usually needs no treatment. Correct K and Mg, reduce catecholamines if possible; frequent PACs can precede AF.'
    });
  })();
  (function () {
    const mk = () => ({ main: baseMorph(), pvc: ventMorph({ axis: 80, v1: 'neg', qrsD: .16, M: 1.4, tk: .4 }) });
    def({
      id: 'pvc', name: 'Premature Ventricular Contractions', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('~78', '160 ms', '90 / 160 ms', '400 ms', '+60°'), morphs: mk(),
      build: () => slots(78, .5, .16, i => i === 3 || i === 8),
      desc: 'Wide early beats with no P wave and a compensatory pause.',
      find: ['Early, wide (over 120 ms), bizarre QRS with no preceding P wave', 'ST-T opposite in direction to the QRS (discordant)', 'Full compensatory pause: the sinus rhythm carries on undisturbed', 'Unifocal: every PVC has the same shape'],
      pearls: ['Check K, Mg, hypoxia, acidosis, catheter or tube irritation, and catecholamine dose', 'Couplets, runs (NSVT), R-on-T and multifocal PVCs are higher-risk features'],
      ddx: ['Aberrantly conducted PAC', 'Fusion beat', 'Ventricular-paced beat'],
      act: 'Treat the trigger, not the PVC. Antiarrhythmics only for symptomatic or sustained runs.'
    });
    def({
      id: 'pvc-bigeminy', name: 'Ventricular Bigeminy', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('~80', '160 ms', '90 / 160 ms', '400 ms', '+60°'), morphs: mk(),
      build: () => slots(78, .5, .16, i => i % 2 === 1),
      desc: 'Every second beat is a PVC.',
      find: ['Pattern of one normal beat then one PVC, repeating', 'Long-short coupling: PVC follows each normal beat after a fixed interval', 'Pulse may be missed because PVCs generate weak output, so the palpated rate looks half the true rate'],
      pearls: ['Think digoxin toxicity, ischaemia, hypokalaemia, hypomagnesaemia', 'Pulse oximeter or arterial line often shows alternating waveform height'],
      ddx: ['Atrial bigeminy with aberrancy', '2:1 block'],
      act: 'Check electrolytes, drug list and ischaemia; correct what you find.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qrsD = .09;
    def({
      id: 'junctional', name: 'Junctional Rhythm', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('48', 'none', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(48, .6, null, c.R, .02).map(b => (b.retro = .13, b)) }),
      desc: 'Narrow regular beats with inverted P waves after the QRS.',
      find: ['Narrow, regular QRS at 40–60/min', 'P waves absent or inverted in II, III, aVF (retrograde), here just after the QRS', 'Accelerated junctional rhythm: 60–100/min'],
      pearls: ['Sinus node suppression: volatile anaesthetics, beta-blockers, digoxin toxicity, inferior MI, post-cardiac surgery', 'Loss of atrial kick can drop cardiac output in stiff ventricles'],
      ddx: ['Sinus bradycardia', 'Ectopic atrial rhythm with low atrial focus'],
      act: 'Stop contributing drugs; check K and digoxin level. Atropine or atrial pacing if haemodynamically significant.'
    });
  })();
  (function () {
    const m = baseMorph();
    def({
      id: 'af', name: 'Atrial Fibrillation', cat: 'Rhythm', lead: 'V1', qtc: .40,
      meas: meas('~95', 'none', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => {
        const b = []; let t = .35; while (t < last()) { b.push({ t, m: 'main' }); t += (.34 + c.R() * .48) / c.k; }
        return { beats: b, fib: L({ V1: .1, V2: .07, V3: .04, V4: .03, II: .05, III: .04, aVF: .05, I: .03, aVL: .02 }) };
      },
      desc: 'Irregularly irregular with no P waves.',
      find: ['Irregularly irregular R-R intervals', 'No distinct P waves; fine chaotic baseline (fibrillatory waves, best seen in V1)', 'Narrow QRS unless bundle branch block or pre-excitation', 'Ventricular rate often 100–160 when untreated'],
      pearls: ['Unstable (shock, ischaemia, pulmonary oedema): synchronised DC cardioversion', 'Stable: rate or rhythm control; assess stroke risk (CHA₂DS₂-VASc) and anticoagulation', 'Irregular, wide and very fast: think pre-excitation (WPW) and avoid AV-nodal blockers'],
      ddx: ['Atrial flutter with variable block', 'Multifocal atrial tachycardia (distinct P waves of 3+ shapes)', 'Sinus rhythm with frequent PACs'],
      act: 'Look for triggers: sepsis, electrolytes, thyrotoxicosis, catecholamines, fluid overload. Duration over 48 h or unknown needs anticoagulation or TOE before elective cardioversion.'
    });
  })();
  (function () {
    const m = baseMorph();
    const saw = L({ II: .14, III: .14, aVF: .14, I: .02, aVL: -.05, aVR: -.08, V1: -.07, V2: -.05, V3: -.03, V5: .03, V6: .03 });
    def({
      id: 'flutter-2to1', name: 'Atrial Flutter (2:1)', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('150 (A 300)', 'n/a', '90 ms', '–', '+60°'), morphs: { main: m },
      build: c => { const b = [], st = 120 / c.ctl.atr; for (let t = .3; t < last(); t += st) b.push({ t, m: 'main' }); return { beats: b, saw: { rate: c.ctl.atr, ph: .2, amp: saw } }; },
      desc: 'Sawtooth flutter waves with a fixed ventricular rate near 150.',
      find: ['Atrial rate about 300/min: sawtooth flutter waves, best in II, III, aVF', 'Every second flutter wave conducts: regular ventricular rate about 150', 'Narrow QRS; ST-T partly hidden by flutter waves'],
      pearls: ['A regular narrow tachycardia at exactly 150 is flutter until proven otherwise', 'Adenosine briefly slows the ventricular rate and unmasks the flutter waves', 'DC cardioversion works at low energy; ablation of the cavotricuspid isthmus is curative'],
      ddx: ['Sinus tachycardia', 'Atrial tachycardia with block', 'AVNRT'],
      act: 'Unstable: synchronised cardioversion. Otherwise rate control and anticoagulation as for AF.'
    });
    def({
      id: 'flutter-4to1', name: 'Atrial Flutter (4:1)', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('75 (A 300)', 'n/a', '90 ms', '–', '+60°'), morphs: { main: baseMorph() },
      build: c => { const b = [], st = 240 / c.ctl.atr; for (let t = .45; t < last(); t += st) b.push({ t, m: 'main' }); return { beats: b, saw: { rate: c.ctl.atr, ph: .1, amp: saw } }; },
      desc: 'Flutter with slower conduction; the saw-tooth is obvious.',
      find: ['Four flutter waves between each QRS: regular ventricular rate about 75', 'Continuous sawtooth baseline in the inferior leads', 'No isoelectric baseline between QRS complexes'],
      pearls: ['Slow flutter is easy to mistake for sinus rhythm with a wandering baseline: look at the inferior leads', 'Variable block gives an irregular rhythm that mimics AF'],
      ddx: ['Sinus rhythm', 'Coarse AF'],
      act: 'Same stroke-risk assessment as AF. Cavotricuspid isthmus ablation is the definitive treatment.'
    });
  })();
  (function () {
    const m = baseMorph(); A(m, 'st', { II: -.1, aVF: -.08, V4: -.15, V5: -.15, V6: -.12, I: -.06 }); A(m, 'rp', { V1: .3 }); SC(m, 't', .7);
    def({
      id: 'svt', name: 'SVT (AVNRT)', cat: 'Rhythm', lead: 'II', qtc: .36,
      meas: meas('188', 'not seen', '90 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(188, .35, null, c.R, 0) }),
      desc: 'Fast, regular, narrow with abrupt onset and no visible P wave.',
      find: ['Regular narrow-complex tachycardia, 150–250/min', 'P waves hidden in or just after the QRS; pseudo-r′ in V1', 'Rate-related ST depression is common and non-specific', 'Abrupt start and stop'],
      pearls: ['Stable: modified Valsalva, then adenosine with a rapid flush', 'Unstable (hypotension, ischaemia, failure, altered consciousness): synchronised cardioversion', 'Adenosine can be unsafe in asthma, heart transplant and WPW with AF'],
      ddx: ['Atrial flutter 2:1', 'Sinus tachycardia', 'Orthodromic AVRT (retrograde P in ST segment)'],
      act: 'Record a 12-lead during adenosine if you can; it helps diagnose the mechanism.'
    });
  })();
  def({
    id: 'aivr', name: 'Accelerated Idioventricular Rhythm', cat: 'Rhythm', lead: 'II', qtc: .40,
    meas: meas('72 (P 62)', 'dissociated', '140 ms', '–', '+70°'),
    morphs: { main: ventMorph({ axis: 70, v1: 'neg', qrsD: .14, M: 1.2, tk: .3 }) },
    build: c => { const b = reg(72, .45, null, c.R, .02), ps = []; for (let t = .15; t < last(); t += .968) ps.push({ t }); return { beats: b, ps }; },
    desc: 'Slow VT-like wide rhythm; sinus P waves march through.',
    find: ['Wide regular QRS at 50–110/min (slower than VT)', 'AV dissociation: P waves independent of QRS; fusion and capture beats may occur', 'Starts and stops gradually as sinus rate crosses the ventricular rate'],
    pearls: ['Classic after reperfusion in MI; also digoxin toxicity and cardiac surgery', 'Usually benign and self-limiting; suppression can remove the only perfusing rhythm'],
    ddx: ['VT (faster, 120+)', 'Ventricular escape rhythm', 'Paced rhythm'],
    act: 'Observe, correct electrolytes and ischaemia. Avoid reflex lidocaine or amiodarone if haemodynamically stable.'
  });

  /* ================= ARREST & VT ================= */
  def({
    id: 'vt', name: 'Ventricular Tachycardia', cat: 'Arrest & VT', lead: 'V1', qtc: .40,
    meas: meas('180', 'dissociated', '150 ms', '–', '–70° (superior)'),
    morphs: (function () { const m = ventMorph({ axis: -70, v1: 'pos', qrsD: .15, M: 1.4, tk: .3 }); m.qt = .24; return { main: m }; })(),
    build: c => ({ beats: reg(180, .25, null, c.R, 0) }),
    tag: { t: 'Shockable if pulseless', k: 'crit' },
    desc: 'Regular wide-complex tachycardia, treat as VT until proven otherwise.',
    find: ['Regular wide QRS (over 120 ms) at 120–250/min', 'RBBB-type pattern with superior axis here; V1 is a tall positive R', 'AV dissociation, fusion and capture beats are diagnostic when seen', 'Concordance across V1–V6 or extreme axis favours VT'],
    pearls: ['Wide-complex tachycardia = VT until proven otherwise; assume VT in structural heart disease or ischaemia', 'With a pulse and unstable: synchronised cardioversion. Stable: amiodarone or procainamide', 'Pulseless: defibrillate immediately (unsynchronised) and follow the ALS algorithm'],
    ddx: ['SVT with aberrancy', 'Pre-excited AF', 'Hyperkalaemia / sodium-channel blocker toxicity'],
    act: 'Pulse check first. Pulseless VT is a cardiac arrest: CPR and shock.'
  });
  (function () {
    const m = baseMorph({ qrsD: .09 }); m.tw = 1.5; m.qt = .58;
    SC(m, 't', 1.3);
    def({
      id: 'torsades', name: 'Torsades de Pointes', cat: 'Arrest & VT', lead: 'II', qtc: .40,
      meas: meas('~260', '–', 'wide, twisting', 'long', '–'),
      morphs: { main: m, pvc: ventMorph({ axis: 80, v1: 'neg', qrsD: .16, M: 1.4, tk: .4 }) },
      build: () => ({
        beats: [{ t: .5, m: 'main', pr: .16 }, { t: 1.45, m: 'main', pr: .16 }, { t: 2.4, m: 'main', pr: .16 }, { t: 2.92, m: 'pvc' }],
        custom: (leads, R, G) => G.addTorsades(leads, 3.1, cur().dur, 1.0)
      }),
      tag: { t: 'Shockable if pulseless', k: 'crit' },
      desc: 'Polymorphic VT twisting around the baseline, on a long QT.',
      find: ['Sinus beats with a long QT and a late, broad T wave', 'R-on-T PVC after a pause starts the run', 'Polymorphic VT: QRS amplitude waxes and wanes, axis seems to twist around the baseline', 'Often self-terminates but can degenerate to VF'],
      pearls: ['IV magnesium sulphate even when serum Mg is normal', 'Remove QT-prolonging drugs; correct K (aim high-normal) and Ca; bradycardia-dependent: pace or isoprenaline to shorten the pause', 'Sustained and unstable or pulseless: unsynchronised defibrillation'],
      ddx: ['Polymorphic VT with normal QT (ischaemia)', 'VF', 'Artefact from tremor'],
      act: 'Check QTc, K, Mg, Ca and the drug chart (antiemetics, antipsychotics, macrolides, fluoroquinolones, methadone).'
    });
  })();
  def({
    id: 'vf', name: 'Ventricular Fibrillation', cat: 'Arrest & VT', lead: 'II', qtc: .40,
    meas: meas('–', '–', '–', '–', '–'),
    morphs: { main: baseMorph() },
    build: c => ({ custom: (leads, R, G) => G.addVF(leads, R, 0, c.dur, c.ctl.sev) }),
    tag: { t: 'Shockable', k: 'crit' },
    desc: 'Chaotic electrical activity, no output.',
    find: ['Irregular, chaotic undulations with no identifiable P, QRS or T', 'Coarse (large amplitude) in this example; becomes finer with time', 'No organised rate: the patient is pulseless and unconscious'],
    pearls: ['Immediate CPR and unsynchronised defibrillation; minimise pauses', 'Follow the current ALS algorithm for drugs: adrenaline and amiodarone timing differs between guidelines', 'Fine VF can look like asystole: check the leads, gain and a second lead'],
    ddx: ['Torsades / polymorphic VT', 'Artefact (shivering, tremor, loose lead, CPR)'],
    act: 'Shock now. Search for reversible causes (4 Hs and 4 Ts) throughout the resuscitation.'
  });
  def({
    id: 'asystole', name: 'Asystole', cat: 'Arrest & VT', lead: 'II', qtc: .40,
    meas: meas('0', '–', '–', '–', '–'),
    morphs: { main: baseMorph() },
    build: () => ({}),
    tag: { t: 'Non-shockable', k: 'warn' },
    desc: 'No electrical activity: a flat line.',
    find: ['No P, QRS or T waves; flat baseline with slight drift', 'Confirm in two leads and check gain and lead connections', 'Pulseless and unresponsive'],
    pearls: ['Do not shock. CPR and adrenaline as early as possible', 'Reversible causes: hypoxia, hypovolaemia, hypo/hyperkalaemia, hypothermia, tension pneumothorax, tamponade, toxins, thrombosis', 'Look for P waves: ventricular standstill may respond to pacing'],
    ddx: ['Fine VF', 'Disconnected lead / zero gain', 'Pacemaker failure'],
    act: 'Non-shockable arrest pathway. Think reversible causes immediately.'
  });
  def({
    id: 'pea', name: 'Pulseless Electrical Activity', cat: 'Arrest & VT', lead: 'II', qtc: .40,
    meas: meas('34', '–', '200 ms', '–', '+70°'),
    morphs: { main: ventMorph({ axis: 70, v1: 'neg', qrsD: .2, M: .7, tk: .3 }) },
    build: c => ({ beats: reg(34, .8, null, c.R, .05) }),
    tag: { t: 'Pulseless · non-shockable', k: 'warn' },
    desc: 'Organised rhythm on the monitor, but no palpable pulse.',
    find: ['This example: slow, wide, low-amplitude QRS (any organised rhythm can be PEA)', 'The monitor shows rhythm; the patient has no pulse or output', 'Diagnosis is clinical: pulse check, arterial line or echo'],
    pearls: ['Treat as non-shockable arrest: CPR and adrenaline', 'POCUS during pulse checks: tamponade, RV dilatation (PE), empty heart (hypovolaemia), cardiac standstill', 'Pseudo-PEA: very weak pulse with mechanical activity on echo'],
    ddx: ['Severe hypotension with a detectable pressure', 'Agonal rhythm'],
    act: 'Do not be reassured by the monitor. Palpate the pulse; run through the reversible causes.'
  });

  /* ================= CONDUCTION ================= */
  def({
    id: 'av1', name: 'First-Degree AV Block', cat: 'Conduction', lead: 'II', qtc: .40,
    meas: meas('70', '320 ms', '90 ms', '400 ms', '+60°'),
    morphs: { main: baseMorph() },
    build: c => ({ beats: reg(70, .75, .32, c.R, .02) }),
    desc: 'Every P conducts, but the PR is long.',
    find: ['PR interval over 200 ms (here 320 ms) and constant', 'Every P wave is followed by a QRS', 'At faster rates the P can sit on the preceding T wave'],
    pearls: ['AV-nodal blockers, increased vagal tone, inferior MI, hyperkalaemia, myocarditis, digoxin', 'A very long PR can reduce filling when the P hits a closed valve (pacemaker-like syndrome)'],
    ddx: ['Sinus tachycardia (merged P and T)', 'Junctional rhythm with retrograde P'],
    act: 'Usually benign. Review AV-nodal drugs; watch for progression if new in acute MI.'
  });
  (function () {
    const m = baseMorph();
    def({
      id: 'mobitz1', name: '2nd-Degree AV Block, Mobitz I', cat: 'Conduction', lead: 'II', qtc: .40,
      meas: meas('~74 (4:3)', 'lengthening', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => {
        const PRs = [.16, .27, .35], b = [], ps = [];
        for (let k = 0, tp = .12; tp < last() - .5; k++, tp += .62 / c.k) {
          const pos = k % 4;
          if (pos < 3) b.push({ t: tp + PRs[pos] + .0378, m: 'main', pr: PRs[pos] }); else ps.push({ t: tp + .045 });
        }
        return { beats: b, ps };
      },
      desc: 'PR lengthens until a P wave fails to conduct.',
      find: ['Progressive PR prolongation then one dropped QRS (4:3 in this strip)', 'R-R intervals shorten before the pause', 'Group beating; the P-P interval stays regular', 'Narrow QRS: the block is in the AV node'],
      pearls: ['Usually benign: high vagal tone, inferior MI, drugs', 'Rarely progresses to complete heart block when the QRS is narrow'],
      ddx: ['Mobitz II (constant PR)', 'Blocked PACs'],
      act: 'Treat only if symptomatic. Stop AV-nodal drugs; atropine is usually effective.'
    });
    const w = mkRBBB();
    def({
      id: 'mobitz2', name: '2nd-Degree AV Block, Mobitz II', cat: 'Conduction', lead: 'II', qtc: .40,
      meas: meas('~57 (3:2)', '220 ms constant', '130 ms', '–', '+70°'), morphs: { main: w },
      build: c => {
        const b = [], ps = [];
        for (let k = 0, tp = .1; tp < last() - .5; k++, tp += .7 / c.k) {
          if (k % 3 < 2) b.push({ t: tp + .22 + .42 * .13, m: 'main', pr: .22 }); else ps.push({ t: tp + .045 });
        }
        return { beats: b, ps };
      },
      tag: { t: 'Urgent', k: 'warn' },
      desc: 'Constant PR then sudden dropped beats, wide QRS.',
      find: ['Constant PR on all conducted beats', 'Sudden non-conducted P waves (3:2 pattern here)', 'Wide QRS: block is below the AV node (His-Purkinje)'],
      pearls: ['High risk of progression to complete heart block and asystole', 'Atropine is unreliable and can worsen infranodal block', 'Needs pacing, often permanent'],
      ddx: ['Mobitz I with wide QRS', '2:1 AV block (type uncertain)'],
      act: 'Transcutaneous pads on, transvenous pacing wire if unstable or progressing; call cardiology.'
    });
  })();
  def({
    id: 'av2to1', name: '2:1 AV Block', cat: 'Conduction', lead: 'II', qtc: .40,
    meas: meas('~48 (P 97)', '200 ms', '90 ms', '400 ms', '+60°'),
    morphs: { main: baseMorph() },
    build: c => {
      const b = [], ps = [];
      for (let k = 0, tp = .1; tp < last() - .5; k++, tp += .62 / c.k) { if (k % 2 === 0) b.push({ t: tp + .2 + .0378, m: 'main', pr: .2 }); else ps.push({ t: tp + .045 }); }
      return { beats: b, ps };
    },
    tag: { t: 'Urgent', k: 'warn' },
    desc: 'Every second P wave is blocked.',
    find: ['Two P waves for each QRS, constant PR on conducted beats', 'Cannot be labelled type I or type II from this alone', 'Ventricular rate half the atrial rate'],
    pearls: ['Narrow QRS and long PR favours AV-nodal block; wide QRS favours infranodal', 'Exercise or atropine can help differentiate (nodal improves, infranodal worsens)'],
    ddx: ['Blocked atrial bigeminy', 'Sinus bradycardia with hidden P waves'],
    act: 'Treat as potentially infranodal if wide QRS or symptomatic: pacing pads on standby.'
  });
  (function () {
    const m = baseMorph();
    def({
      id: 'chb', name: 'Complete (3rd-Degree) AV Block', cat: 'Conduction', lead: 'II', qtc: .40,
      meas: meas('V 36 / A 84', 'dissociated', '150 ms', '–', '+20°'),
      morphs: { main: m, esc: ventMorph({ axis: 20, v1: 'neg', qrsD: .15, M: 1.1, tk: .35 }) },
      build: c => {
        const ps = []; for (let t = .2; t < last(); t += 60 / c.ctl.atr) ps.push({ t });
        const b = []; for (let t = .8; t < last(); t += 1.667 / c.k) b.push({ t, m: 'esc' });
        return { beats: b, ps };
      },
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'Atria and ventricles beat independently; slow wide escape.',
      find: ['Regular P waves (84/min) that bear no relation to QRS', 'Slow regular ventricular escape rhythm (36/min), wide here', 'PR interval varies randomly (AV dissociation)'],
      pearls: ['Narrow escape (junctional, 40–60) is more stable than wide escape (ventricular, 20–40)', 'Causes: inferior MI, degeneration, drugs, Lyme, post-valve surgery or TAVI', 'Syncope or Stokes–Adams attacks; risk of torsades with long pauses'],
      ddx: ['AV dissociation from VT or accelerated rhythm', 'Mobitz II with high-grade block'],
      act: 'Pads on and transcutaneous pacing if unstable; atropine seldom works. Transvenous pacing wire.'
    });
  })();
  def({
    id: 'rbbb', name: 'Right Bundle Branch Block', cat: 'Conduction', lead: 'V1', qtc: .40,
    meas: meas('78', '160 ms', '130 ms', '420 ms', '+70°'),
    morphs: { main: mkRBBB() },
    build: c => ({ beats: reg(78, .5, .16, c.R, .02) }),
    desc: 'rSR′ in V1 and a wide slurred S in the lateral leads.',
    find: ['QRS 120 ms or more', 'rSR′ ("M" shape) in V1–V3', 'Wide, slurred S wave in I, V5 and V6', 'Secondary ST depression and T inversion in V1–V3'],
    pearls: ['New RBBB with sinus tachycardia and T inversion V1–V4: consider pulmonary embolism', 'RBBB does not hide ST elevation: you can still diagnose MI', 'Brugada type 2 pattern can look like incomplete RBBB'],
    ddx: ['Right ventricular hypertrophy', 'Brugada pattern', 'Posterior MI (tall R in V1)'],
    act: 'Look for the cause: PE, right heart strain, cardiac surgery, ischaemia.'
  });
  def({
    id: 'lbbb', name: 'Left Bundle Branch Block', cat: 'Conduction', lead: 'V1', qtc: .40,
    meas: meas('80', '160 ms', '140 ms', '460 ms', '–10°'),
    morphs: { main: mkLBBB() },
    build: c => ({ beats: reg(80, .5, .16, c.R, .02) }),
    desc: 'Broad notched R laterally, QS in V1, discordant ST-T.',
    find: ['QRS 120 ms or more', 'Broad, notched R in I, aVL, V5–V6 with no septal Q waves', 'Deep S or QS in V1–V3', 'ST-T opposite to the QRS (discordant), expected'],
    pearls: ['Cannot read ST changes in the usual way: use Sgarbossa or the Smith-modified criteria for MI', 'New LBBB with acute heart failure or chest pain needs urgent assessment', 'Causes: ischaemia, cardiomyopathy, aortic valve disease, hyperkalaemia'],
    ddx: ['Ventricular-paced rhythm', 'LVH with wide QRS', 'Hyperkalaemia'],
    act: 'Compare with an old ECG. Echo for LV function; consider CRT if EF is low.'
  });
  (function () {
    const m = baseMorph({ axis: -55, M: 1.1, qrsD: .1 }); A(m, 'q', { I: -.1, aVL: -.12 });
    def({
      id: 'lafb', name: 'Left Anterior Fascicular Block', cat: 'Conduction', lead: 'II', qtc: .40,
      meas: meas('75', '160 ms', '100 ms', '400 ms', '–55°'), morphs: { main: m },
      build: c => ({ beats: reg(75, .5, .16, c.R, .02) }),
      desc: 'Marked left axis with rS in the inferior leads.',
      find: ['Left axis deviation (–45° to –90°)', 'qR in I and aVL; rS in II, III, aVF', 'QRS only slightly prolonged (under 120 ms)', 'S wave in III deeper than in II'],
      pearls: ['Bifascicular block = RBBB + LAFB: higher risk of progression to complete block', 'Common in ageing and with LVH, coronary disease, hyperkalaemia'],
      ddx: ['Inferior MI (Q waves in II, III, aVF)', 'LVH with left axis'],
      act: 'No treatment on its own. Mind perioperative pacing risk if combined with RBBB and syncope.'
    });
  })();

  /* ================= ISCHAEMIA ================= */
  (function () {
    const m = baseMorph(); A(m, 'r', { V1: 0, V2: .05, V3: .1 }); A(m, 's', { V1: -.9, V2: -1.0, V3: -.8 });
    A(m, 'st', { V1: .15, V2: .5, V3: .6, V4: .4, V5: .15, V6: .05, I: .1, aVL: .15, II: -.1, III: -.15, aVF: -.12, aVR: -.05 });
    A(m, 't', { V1: .5, V2: 1.0, V3: 1.1, V4: .9, V5: .5, V6: .35, I: .25, aVL: .3, III: -.15 });
    def({
      id: 'stemi-ant', name: 'Anterior STEMI (LAD)', cat: 'Ischaemia', lead: 'V3', qtc: .40,
      meas: meas('85', '160 ms', '90 ms', '430 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(85, .5, .16, c.R, .02) }),
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'ST elevation V1–V4 with hyperacute T and inferior reciprocal changes.',
      find: ['ST elevation V1–V4 (also I and aVL when proximal)', 'Hyperacute, broad T waves; loss of R waves with early Q/QS in V1–V3', 'Reciprocal ST depression in II, III, aVF'],
      pearls: ['STEMI pathway: aspirin and primary PCI target within 90 minutes of first contact; fibrinolysis if PCI is not available in time', 'Proximal LAD occlusion adds ST elevation in aVL and V1 with possible RBBB', 'Anterior STEMI has the largest infarct size and risk of cardiogenic shock'],
      ddx: ['Pericarditis (diffuse, PR depression)', 'LV aneurysm (persistent STE with Q waves)', 'Early repolarisation', 'Takotsubo cardiomyopathy'],
      act: 'Activate the cath lab. In ICU look for cardiogenic shock, mechanical complications and arrhythmia.'
    });
  })();
  (function () {
    const m = baseMorph(); A(m, 'q', { III: -.2, aVF: -.12 });
    A(m, 'st', { II: .25, III: .35, aVF: .3, I: -.1, aVL: -.22, V1: .05 });
    A(m, 't', { II: .6, III: .6, aVF: .6, aVL: -.3, I: .05 });
    def({
      id: 'stemi-inf', name: 'Inferior STEMI (RCA)', cat: 'Ischaemia', lead: 'III', qtc: .40,
      meas: meas('55–60', '180 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(58, .6, .18, c.R, .02) }),
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'ST elevation II, III, aVF; III greater than II; reciprocal aVL.',
      find: ['ST elevation in II, III, aVF with III > II (suggests RCA)', 'Reciprocal ST depression in I and aVL (very specific)', 'Slow rate with long PR (AV nodal ischaemia, vagal tone)'],
      pearls: ['Always record right-sided leads (V4R): RV infarction is preload dependent, so avoid nitrates and diuretics', 'Bradycardia, AV block and hypotension are common; atropine and fluids are first-line', 'II > III with ST depression V1–V3 suggests circumflex or posterior extension'],
      ddx: ['Pericarditis', 'Early repolarisation', 'Hyperkalaemia', 'Pulmonary embolism'],
      act: 'STEMI pathway. Check V4R and V7–V9; pacing pads if heart block.'
    });
  })();
  (function () {
    const m = baseMorph();
    A(m, 'st', { I: .2, aVL: .25, V5: .25, V6: .25, V4: .1, II: .08, III: -.15, aVF: -.1, aVR: -.1 });
    A(m, 't', { I: .55, aVL: .55, V5: .8, V6: .7, III: -.25 });
    def({
      id: 'stemi-lat', name: 'Lateral STEMI (LCx / Diagonal)', cat: 'Ischaemia', lead: 'V5', qtc: .40,
      meas: meas('80', '160 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(80, .5, .16, c.R, .02) }),
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'ST elevation I, aVL, V5–V6 with inferior reciprocal depression.',
      find: ['ST elevation in I, aVL, V5 and V6', 'Reciprocal ST depression in III and aVF', 'Prominent T waves in the lateral leads'],
      pearls: ['Circumflex occlusion may be "electrically silent": normal ECG with ongoing pain still needs posterior leads and serial ECGs', 'Isolated high lateral STEMI (I, aVL) can be a small diagonal branch'],
      ddx: ['Pericarditis', 'Early repolarisation', 'LBBB (not discordant)'],
      act: 'STEMI pathway. Record posterior leads and compare with serial tracings.'
    });
  })();
  (function () {
    const m = baseMorph();
    A(m, 'r', { V1: .8, V2: 1.2 }); A(m, 's', { V1: -.5, V2: -.8 });
    A(m, 'st', { V1: -.25, V2: -.35, V3: -.3, V4: -.15 });
    A(m, 't', { V1: .9, V2: 1.0, V3: .8 });
    def({
      id: 'stemi-post', name: 'Posterior STEMI', cat: 'Ischaemia', lead: 'V2', qtc: .40,
      meas: meas('80', '160 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(80, .5, .16, c.R, .02) }),
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'Horizontal ST depression V1–V3 with tall R and upright T.',
      find: ['Horizontal ST depression in V1–V3', 'Tall, broad R wave in V1–V2 (R/S ratio over 1)', 'Upright, prominent T waves in V1–V3', 'Mirror image of an anterior STEMI'],
      pearls: ['Treat as a STEMI equivalent: confirm with V7–V9 (ST elevation of 0.5 mm or more)', 'Usually accompanies an inferior or lateral MI (circumflex or RCA)', 'Turn the ECG upside down, or read it from behind, to see the ST elevation'],
      ddx: ['Anterior NSTEMI', 'RVH', 'WPW type A', 'RBBB'],
      act: 'Record posterior leads and activate the STEMI pathway.'
    });
  })();
  (function () {
    const m = baseMorph(); A(m, 't', { V1: -.2, V2: -.9, V3: -1.0, V4: -.65, V5: -.2 }); A(m, 'st', { V2: .06, V3: .06 });
    def({
      id: 'wellens-b', name: 'Wellens Syndrome (Type B)', cat: 'Ischaemia', lead: 'V3', qtc: .42,
      meas: meas('70', '160 ms', '90 ms', '440 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(70, .55, .16, c.R, .02) }),
      tag: { t: 'Urgent', k: 'warn' },
      desc: 'Deep, symmetric T inversion V2–V3 after chest pain.',
      find: ['Deeply inverted, symmetric T waves in V2–V3 (sometimes V1–V4)', 'No pathological Q waves; R-wave progression preserved', 'Little or no ST elevation, often pain-free at the time of the ECG'],
      pearls: ['Sign of critical proximal LAD stenosis: high risk of large anterior MI within days', 'Avoid stress testing: urgent angiography', 'Cardiac enzymes may be normal or only mildly raised'],
      ddx: ['Pulmonary embolism (V1–V4 T inversion)', 'Raised ICP / subarachnoid haemorrhage', 'Apical hypertrophic cardiomyopathy', 'Takotsubo'],
      act: 'Admit, serial ECGs and troponin, early angiography.'
    });
  })();
  (function () {
    const m = baseMorph(); A(m, 't', { V1: .15, V2: .4, V3: .45, V4: .25 }); A(m, 'tn', { V1: -.1, V2: -.6, V3: -.7, V4: -.25 });
    def({
      id: 'wellens-a', name: 'Wellens Syndrome (Type A)', cat: 'Ischaemia', lead: 'V3', qtc: .42,
      meas: meas('70', '160 ms', '90 ms', '440 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(70, .55, .16, c.R, .02) }),
      tag: { t: 'Urgent', k: 'warn' },
      desc: 'Biphasic T waves in V2–V3: up, then down.',
      find: ['Biphasic T waves in V2–V3: positive first, then negative', 'No Q waves; R-wave progression preserved', 'Less common than type B (about a quarter of cases)'],
      pearls: ['Same significance as type B: critical proximal LAD lesion', 'Can evolve to type B as the pain-free interval continues'],
      ddx: ['Hypokalaemia (flat or biphasic T)', 'Normal variant in young people'],
      act: 'Admit and plan early angiography; avoid exercise testing.'
    });
  })();
  (function () {
    const m = baseMorph();
    A(m, 'st', { I: -.15, II: -.2, III: -.15, aVF: -.18, V3: -.2, V4: -.3, V5: -.3, V6: -.25, aVR: .25, V1: .1, aVL: -.05 });
    A(m, 't', { V4: -.1, V5: -.15, V6: -.1 });
    def({
      id: 'diffuse-st', name: 'Diffuse ST Depression + aVR Elevation', cat: 'Ischaemia', lead: 'V5', qtc: .40,
      meas: meas('95', '150 ms', '90 ms', '430 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(95, .5, .15, c.R, .02) }),
      tag: { t: 'High risk', k: 'warn' },
      desc: 'Widespread subendocardial ischaemia pattern.',
      find: ['Horizontal or down-sloping ST depression in many leads (II, V3–V6 here)', 'ST elevation in aVR (and sometimes V1)', 'No territorial ST elevation'],
      pearls: ['Suggests left main or triple-vessel disease, or global ischaemia (severe hypotension, anaemia, tachyarrhythmia)', 'Treat as high-risk ACS; urgent cath if refractory pain or unstable', 'Look for a non-coronary cause in the ICU: sepsis, bleeding, tachycardia, hypoxia'],
      ddx: ['Demand ischaemia', 'Digoxin effect', 'LVH with strain', 'Hypokalaemia'],
      act: 'Fix supply–demand mismatch first (oxygen, Hb, rate, pressure) and discuss urgent angiography.'
    });
  })();
  (function () {
    const m = baseMorph();
    A(m, 'st', { I: .15, II: .22, III: .1, aVF: .2, aVL: .08, aVR: -.18, V1: -.05, V2: .22, V3: .3, V4: .3, V5: .28, V6: .22 });
    A(m, 'prs', { I: -.05, II: -.1, III: -.05, aVF: -.08, aVR: .1, V2: -.05, V3: -.07, V4: -.1, V5: -.1, V6: -.1 });
    def({
      id: 'pericarditis', name: 'Acute Pericarditis', cat: 'Ischaemia', lead: 'II', qtc: .40,
      meas: meas('96', '160 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(96, .5, .16, c.R, .02) }),
      desc: 'Diffuse concave ST elevation with PR depression.',
      find: ['Widespread concave ST elevation (I, II, aVF, V2–V6)', 'PR depression in most leads with PR elevation and ST depression in aVR', 'No reciprocal changes and no Q waves', 'Sinus tachycardia is common'],
      pearls: ['Treat with NSAIDs and colchicine; steroids only when needed', 'In ICU always look for effusion: low voltage and electrical alternans mean tamponade risk', 'Stages evolve over days: T inversion follows ST normalisation'],
      ddx: ['STEMI (convex, territorial, reciprocal)', 'Early repolarisation', 'Myocarditis'],
      act: 'Echo to exclude effusion; troponin to check for myopericarditis.'
    });
  })();

  /* ================= METABOLIC & DRUGS ================= */
  (function () {
    const m = baseMorph(); m.tsym = true; m.tw = .8;
    A(m, 't', { I: .45, II: .8, III: .35, aVF: .65, aVL: .1, aVR: -.5, V1: .35, V2: 1.3, V3: 1.4, V4: 1.25, V5: .95, V6: .65 });
    def({
      id: 'hyperk-mild', name: 'Hyperkalaemia, Mild (K⁺ ~6.0–6.5)', cat: 'Metabolic & Drugs', lead: 'V3', qtc: .40,
      meas: meas('75', '160 ms', '90 ms', '380 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(75, .5, .16, c.R, .02) }),
      tag: { t: 'Urgent', k: 'warn' },
      desc: 'Tall, narrow, symmetric peaked T waves.',
      find: ['Tall, narrow-based, symmetric T waves, best in V2–V4', 'T amplitude often greater than the R wave in V2–V3', 'Normal PR and QRS at this stage', 'Shortened QT'],
      pearls: ['ECG is not sensitive: severe hyperkalaemia can occur with a near-normal trace', 'Rate of rise, acidosis, renal failure and drugs matter more than the number alone'],
      ddx: ['Hyperacute T of early MI (broader, asymmetric)', 'LVH', 'Normal variant'],
      act: 'Repeat K⁺ on a blood gas, review potassium sources and drugs (ACE inhibitors, spironolactone, heparin, trimethoprim).'
    });
  })();
  (function () {
    const m = baseMorph({ qrsD: .12 }); m.tsym = true; m.tw = .85; SC(m, 'p', .35);
    A(m, 't', { I: .4, II: .7, III: .3, aVF: .55, aVL: .08, aVR: -.4, V1: .3, V2: 1.1, V3: 1.2, V4: 1.0, V5: .8, V6: .55 });
    def({
      id: 'hyperk-mod', name: 'Hyperkalaemia, Moderate (K⁺ ~7–8)', cat: 'Metabolic & Drugs', lead: 'V3', qtc: .40,
      meas: meas('58', '270 ms', '120 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(58, .6, .27, c.R, .02) }),
      tag: { t: 'Emergency', k: 'crit' },
      desc: 'Flat P, long PR, widening QRS, peaked T.',
      find: ['P waves low-amplitude or flat', 'PR prolonged (here 270 ms)', 'QRS widening as the conduction slows', 'Peaked T waves persist; bradycardia'],
      pearls: ['QRS widening is the sign that arrest is near', 'Can mimic bundle branch block or ventricular rhythms', 'Treat on the ECG, do not wait for the repeat potassium'],
      ddx: ['Sodium-channel blocker toxicity (TCA, flecainide)', 'LBBB', 'Ventricular escape'],
      act: 'IV calcium immediately to stabilise the membrane, then shift K⁺ in (insulin–glucose, β₂-agonist) and remove it (loop diuretic, binders, dialysis).'
    });
  })();
  def({
    id: 'hyperk-sev', name: 'Hyperkalaemia, Severe (Sine Wave)', cat: 'Metabolic & Drugs', lead: 'II', qtc: .40,
    meas: meas('~57', '–', 'merged', '–', '–'),
    morphs: { main: baseMorph() },
    build: () => ({ custom: (leads, R, G) => G.addSine(leads, .95, .8) }),
    tag: { t: 'Peri-arrest', k: 'crit' },
    desc: 'QRS and T have merged into a sine wave.',
    find: ['No P waves; very wide QRS merged with the T wave', 'Smooth sinusoidal oscillation at about 55–60/min', 'Pre-arrest: ventricular fibrillation or asystole may follow'],
    pearls: ['Medical emergency: give IV calcium first, do not wait for the lab', 'Dialysis is the definitive treatment in renal failure', 'Very high K⁺ with cardiac arrest: continue resuscitation and treat the cause'],
    ddx: ['Slow ventricular tachycardia', 'Sodium-channel blocker toxicity'],
    act: 'IV calcium now, then insulin–glucose, β₂-agonist and early renal replacement therapy.'
  });
  (function () {
    const m = baseMorph(); SC(m, 'p', 1.3);
    A(m, 't', { I: .05, II: .05, III: 0, aVF: .03, V2: -.05, V3: .05, V4: .03, V5: .08, V6: .1 });
    A(m, 'st', { II: -.12, III: -.08, aVF: -.1, V2: -.12, V3: -.2, V4: -.25, V5: -.22, V6: -.18 });
    A(m, 'u', { I: .1, II: .2, aVF: .2, V2: .35, V3: .45, V4: .45, V5: .3, V6: .2 });
    def({
      id: 'hypok', name: 'Hypokalaemia', cat: 'Metabolic & Drugs', lead: 'V3', qtc: .40,
      meas: meas('82', '180 ms', '90 ms', 'QU long', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(82, .55, .18, c.R, .02) }),
      desc: 'ST depression, flat T and prominent U waves.',
      find: ['ST depression with flattened or inverted T waves', 'Prominent U waves (V2–V4 here), often taller than the T wave', 'Prominent P waves; QU interval prolonged (appears as long QT)'],
      pearls: ['Replace K⁺ and check Mg²⁺: hypokalaemia is refractory without magnesium', 'Torsades and ventricular ectopy risk rises with K⁺ below 3.0 mmol/L', 'Common in ICU: diuretics, insulin, β-agonists, GI losses, refeeding'],
      ddx: ['Digoxin effect', 'Hypomagnesaemia', 'Long QT'],
      act: 'IV replacement via central line if rapid; continuous monitoring.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .47;
    def({
      id: 'hypoca', name: 'Hypocalcaemia', cat: 'Metabolic & Drugs', lead: 'II', qtc: .40,
      meas: meas('76', '160 ms', '90 ms', '525 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(76, .5, .16, c.R, .02) }),
      desc: 'Long QT from a long isoelectric ST segment.',
      find: ['QT prolonged because the ST segment is lengthened', 'T wave itself keeps a normal shape and width', 'Rate and QRS are normal'],
      pearls: ['Check ionised Ca²⁺, Mg²⁺ and albumin; correct for low albumin', 'Risk of torsades, hypotension and reduced contractility', 'Common after massive transfusion (citrate), pancreatitis, renal failure, sepsis'],
      ddx: ['Congenital or drug long QT (wide T wave)', 'Hypomagnesaemia'],
      act: 'IV calcium (gluconate or chloride) if symptomatic or ionised Ca²⁺ is low.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .30; SC(m, 't', 1.2);
    def({
      id: 'hyperca', name: 'Hypercalcaemia', cat: 'Metabolic & Drugs', lead: 'II', qtc: .40,
      meas: meas('76', '160 ms', '90 ms', '335 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(76, .5, .16, c.R, .02) }),
      desc: 'Short QT: the T wave starts right after the QRS.',
      find: ['Short QT (here about 300 ms) with no ST segment', 'T wave arises directly from the end of the QRS', 'Severe: J waves, AV block, bradyarrhythmia'],
      pearls: ['Think malignancy, hyperparathyroidism, vitamin D and thiazides', 'Caution with digoxin: sensitised to toxicity at high calcium'],
      ddx: ['Digoxin effect (scooped ST)', 'Congenital short QT'],
      act: 'Hydrate, treat the cause, bisphosphonate or calcitonin for severe cases.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .54; m.tw = 1.4; SC(m, 't', 1.2);
    def({
      id: 'longqt', name: 'Long QT Syndrome', cat: 'Metabolic & Drugs', lead: 'V3', qtc: .40,
      meas: meas('58', '160 ms', '90 ms', '560 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(58, .6, .16, c.R, .02) }),
      tag: { t: 'Torsades risk', k: 'warn' },
      desc: 'QTc over 500 ms with a broad late T wave.',
      find: ['QTc prolonged (here about 560 ms): measure from the QRS onset to the end of the T wave', 'Broad T waves, sometimes notched', 'Rate is slow: QT looks even longer when the rate falls'],
      pearls: ['Acquired causes dominate in ICU: QT-prolonging drugs (antiemetics, antipsychotics, macrolides, fluoroquinolones, methadone), hypoK, hypoMg, hypoCa', 'Use Fridericia at fast or slow rates; Bazett over-corrects at high rates', 'QTc over 500 ms or an increase of 60 ms or more carries a high torsades risk'],
      ddx: ['Hypocalcaemia (T normal, ST long)', 'Hypokalaemia (QU interval)', 'Pre-torsades'],
      act: 'Stop the offending drugs, correct K⁺ and Mg²⁺, avoid bradycardia and pauses.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .34; SC(m, 't', .35);
    A(m, 'sc', { I: -.25, II: -.35, aVF: -.3, III: -.15, V3: -.2, V4: -.4, V5: -.45, V6: -.4 });
    def({
      id: 'digoxin', name: 'Digoxin Effect', cat: 'Metabolic & Drugs', lead: 'V5', qtc: .40,
      meas: meas('72', '210 ms', '90 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(72, .6, .21, c.R, .02) }),
      desc: 'Scooped ST depression ("reverse tick").',
      find: ['Down-sloping, scooped ST depression (reverse tick) in lateral leads', 'Flattened or inverted T waves, short QT', 'PR may be mildly prolonged'],
      pearls: ['The ECG shows digoxin effect, not toxicity', 'Toxicity: junctional or ventricular ectopy, atrial tachycardia with block, bidirectional VT, AV block', 'Check K⁺, Mg²⁺ and level; digoxin-specific Fab fragments for life-threatening toxicity'],
      ddx: ['Subendocardial ischaemia', 'Hypokalaemia', 'LVH with strain'],
      act: 'If rhythm disturbance appears, stop digoxin, check electrolytes and consider Fab fragments.'
    });
  })();
  (function () {
    const m = baseMorph({ qrsD: .1 }); m.qt = .56;
    A(m, 'jw', { I: .2, II: .3, III: .15, aVF: .25, V2: .3, V3: .5, V4: .6, V5: .55, V6: .45 }); m.jws = .05;
    def({
      id: 'hypothermia', name: 'Hypothermia (Osborn Waves)', cat: 'Metabolic & Drugs', lead: 'V4', qtc: .40,
      meas: meas('44', '220 ms', '100 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(44, .7, .22, c.R, .03), fib: new Array(12).fill(.035), fibF: [8, 12] }),
      tag: { t: 'Handle gently', k: 'warn' },
      desc: 'Bradycardia, J (Osborn) waves and shivering artefact.',
      find: ['Osborn (J) wave: a hump after the QRS, best in V3–V5', 'Bradycardia with prolonged PR, QRS and QT', 'Fine shivering artefact on the baseline'],
      pearls: ['AF with a slow ventricular rate is common; VF risk rises below about 28–30 °C', 'Rough handling can trigger VF: move the patient gently', 'Resuscitation continues until the patient is warm; ECMO or bypass rewarming in arrest'],
      ddx: ['Hypercalcaemia (J waves)', 'Early repolarisation', 'Brugada pattern'],
      act: 'Measure core temperature, actively rewarm; avoid unnecessary stimulation.'
    });
  })();

  /* ================= OTHER ================= */
  (function () {
    const m = baseMorph({ axis: 50, M: 1.0, qrsD: .13 });
    A(m, 'r', { V1: .9, V2: 1.1 }); A(m, 's', { V1: -.3, V2: -.5 });
    for (let i = 0; i < 12; i++) { const net = m.r[i] + m.s[i]; m.dl[i] = .55 * net; m.r[i] *= .75; m.s[i] *= .75; m.t[i] = -.25 * net; }
    def({
      id: 'wpw', name: 'WPW (Pre-excitation)', cat: 'Other', lead: 'V2', qtc: .40,
      meas: meas('78', '~100 ms', '130 ms', '–', '+50°'), morphs: { main: m },
      build: c => ({ beats: reg(78, .6, .15, c.R, .02) }),
      tag: { t: 'Avoid AV-nodal blockers in AF', k: 'warn' },
      desc: 'Short PR, delta wave and wide QRS.',
      find: ['Short PR (under 120 ms) with a slurred upstroke: the delta wave', 'Wide QRS fused with the delta wave', 'Secondary ST-T changes opposite to the delta wave', 'Type A pattern here: tall R in V1–V2'],
      pearls: ['AF with a pre-excited, irregular broad-complex tachycardia: do not give adenosine, β-blockers, CCB or digoxin; use procainamide or synchronised cardioversion', 'Orthodromic AVRT (narrow, regular) uses the accessory pathway backwards: adenosine is acceptable', 'Delta waves may mimic Q waves of MI or bundle branch block'],
      ddx: ['Posterior MI (tall R V1)', 'RVH', 'Bundle branch block'],
      act: 'EP referral for ablation. In emergencies treat pre-excited AF as described.'
    });
  })();
  (function () {
    const m = baseMorph({ qrsD: .11 });
    A(m, 'r', { V1: .2, V2: .25 }); A(m, 's', { V1: -.2, V2: -.3 }); A(m, 'rp', { V1: .65, V2: .6, I: -.2, V6: -.25 });
    A(m, 'jw', { V1: .5, V2: .45 }); m.jws = .085; A(m, 't', { V1: -.5, V2: -.35, V3: .2 });
    def({
      id: 'brugada', name: 'Brugada Pattern (Type 1)', cat: 'Other', lead: 'V2', qtc: .40,
      meas: meas('70', '170 ms', '110 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(70, .6, .17, c.R, .02) }),
      tag: { t: 'Sudden death risk', k: 'warn' },
      desc: 'Coved ST elevation and T inversion in V1–V2.',
      find: ['Coved ST elevation of 2 mm or more in V1–V2 falling into an inverted T wave', 'RBBB-like terminal R′ in V1', 'Type 1 pattern only is diagnostic; types 2–3 (saddle-back) are not'],
      pearls: ['Fever, sodium-channel blockers, some anaesthetics and alcohol can unmask it: treat fever aggressively', 'Risk of VF and sudden death; ICD for high-risk patients', 'Avoid drugs listed on brugadadrugs.org in known patients'],
      ddx: ['RBBB', 'Right ventricular infarction', 'Pulmonary embolism', 'Hyperkalaemia', 'LV aneurysm'],
      act: 'Treat fever and electrolyte disorders; keep external pads available.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 95, M: 1.0, qrsD: .1 }); m.p[IDX.II] = .26; m.p[IDX.III] = .2; m.p[IDX.aVF] = .24;
    A(m, 'r', { I: .15, V1: .2 }); A(m, 's', { I: -.55, V1: -.5 }); A(m, 'q', { III: -.35 }); A(m, 'rp', { V1: .55 });
    A(m, 't', { III: -.35, V1: -.4, V2: -.45, V3: -.4, V4: -.25 });
    def({
      id: 'pe', name: 'Pulmonary Embolism (S1Q3T3)', cat: 'Other', lead: 'III', qtc: .38,
      meas: meas('116', '140 ms', '100 ms', '–', '+95°'), morphs: { main: m },
      build: c => ({ beats: reg(116, .4, .14, c.R, .02) }),
      tag: { t: 'Think PE', k: 'warn' },
      desc: 'Sinus tachycardia with right heart strain.',
      find: ['Sinus tachycardia (the commonest finding)', 'S wave in I, Q wave and inverted T in III (S1Q3T3)', 'T inversion in V1–V4, incomplete RBBB, right axis, tall P in II (P pulmonale)'],
      pearls: ['S1Q3T3 is neither sensitive nor specific; the ECG can be normal', 'New RBBB with right-ventricular strain pattern carries a poorer prognosis', 'Use clinical probability, D-dimer and CTPA; POCUS: dilated RV, D-sign'],
      ddx: ['Wellens syndrome', 'RV hypertrophy / pulmonary hypertension', 'Anterior ischaemia', 'COPD exacerbation'],
      act: 'Haemodynamic support, anticoagulation and escalation (thrombolysis / thrombectomy) per risk class.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: -15, M: 1.3, qrsD: .1 });
    A(m, 'r', { V1: .4, V2: .5, V3: .9, V4: 2.3, V5: 3.0, V6: 2.4 }); A(m, 's', { V1: -2.4, V2: -3.0, V3: -1.8, V4: -.6, V5: -.2, V6: -.1 });
    A(m, 'st', { I: -.15, aVL: -.2, V4: -.15, V5: -.25, V6: -.25 });
    A(m, 't', { I: -.2, aVL: -.3, V4: -.2, V5: -.55, V6: -.55 }); A(m, 'pn', { V1: -.07 });
    def({
      id: 'lvh', name: 'Left Ventricular Hypertrophy (Strain)', cat: 'Other', lead: 'V5', qtc: .40,
      meas: meas('76', '170 ms', '100 ms', '430 ms', '–15°'), morphs: { main: m },
      build: c => ({ beats: reg(76, .55, .17, c.R, .02) }),
      desc: 'High voltage with lateral ST-T strain.',
      find: ['S in V1 + R in V5/V6 over 35 mm (Sokolow–Lyon)', 'Asymmetric ST depression and T inversion in I, aVL, V5–V6 (strain)', 'Left axis; broad terminal negative P wave in V1 (left atrial enlargement)'],
      pearls: ['Strain pattern can mimic ischaemia: compare with old ECGs', 'LVH raises ventricular arrhythmia and AF risk', 'Hypertensive heart disease, aortic stenosis, HCM are the main causes'],
      ddx: ['Subendocardial ischaemia', 'Digoxin effect', 'LBBB'],
      act: 'Echo to document wall thickness and LV function.'
    });
  })();
  (function () {
    const v = ventMorph({ axis: -60, v1: 'neg', qrsD: .16, M: 1.2, tk: .35 });
    A(v, 'sp', { I: .3, II: .35, III: .3, aVR: -.3, aVL: .2, aVF: .3, V1: .3, V2: .35, V3: .35, V4: .35, V5: .3, V6: .3 });
    def({
      id: 'paced-v', name: 'Ventricular Paced Rhythm (VVI)', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('70 (P 62)', 'dissociated', '160 ms', '–', '–60°'), morphs: { main: v },
      build: c => { const ps = []; for (let t = .1; t < last(); t += .968) ps.push({ t }); return { beats: reg(70, .45, null, c.R, 0), ps }; },
      desc: 'Pacing spike, then a wide LBBB-like QRS.',
      find: ['Narrow pacing spike before each wide QRS', 'LBBB morphology with a superior axis (right ventricular apical lead)', 'Discordant ST-T; P waves dissociated from the paced QRS', 'Look for failure to capture (spike with no QRS) or failure to sense'],
      pearls: ['Use Smith-modified Sgarbossa criteria to look for MI in paced rhythm', 'Magnet over the generator gives asynchronous pacing, useful in emergencies', 'Pacing syndrome and RV pacing-induced cardiomyopathy with chronic pacing'],
      ddx: ['LBBB', 'Ventricular rhythm without a pacemaker'],
      act: 'Check capture, sensing and thresholds with the pacing team. Pads on and clear skin if unstable.'
    });
  })();

  /* ================= ADDED: ICU set (v4) ================= */
  const SPK = L({ I: .3, II: .35, III: .3, aVR: -.3, aVL: .2, aVF: .3, V1: .3, V2: .35, V3: .35, V4: .35, V5: .3, V6: .3 });
  const spike = (leads, G, t) => { for (let l = 0; l < 12; l++) G.addG(leads[l], t, .0012, .0012, SPK[l]); };
  const pacedMorph = () => { const v = ventMorph({ axis: -60, v1: 'neg', qrsD: .16, M: 1.2, tk: .35 }); for (let i = 0; i < 12; i++) v.sp[i] = SPK[i]; return v; };

  (function () {
    const m = baseMorph();
    const PV = [m.p, m.p.map((v, i) => (i === 1 || i === 2 || i === 5) ? -v * .8 : v * .6), m.p.map(v => v * 1.6), m.p.map((v, i) => i === 6 ? v * 3 : v * .35), m.p.map((v, i) => i < 6 ? v * (i % 2 ? 1.3 : -.4) : v)];
    def({
      id: 'mat', name: 'Multifocal Atrial Tachycardia', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('~120', 'variable', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => {
        const b = []; let t = .4, i = 0;
        while (t < last()) { const k = Math.floor(c.R() * PV.length); b.push({ t, m: 'main', pr: .11 + c.R() * .1, pamp: PV[k] }); t += (.38 + c.R() * .24) / c.k; i++; }
        return { beats: b };
      },
      desc: 'Irregular narrow rhythm over 100 with at least three different P-wave shapes.',
      find: ['Rate over 100/min, irregularly irregular', 'Three or more distinct P-wave morphologies in the same lead', 'Varying PR and P-P intervals; isoelectric baseline between P waves', 'Narrow QRS'],
      pearls: ['Classic in decompensated COPD, sepsis, hypoxia, hypokalaemia, hypomagnesaemia and theophylline toxicity', 'Treat the underlying illness; cardioversion does not work', 'Magnesium and correcting K⁺ often slow it; verapamil or a cardioselective beta-blocker if needed'],
      ddx: ['Atrial fibrillation (no discrete P waves)', 'Sinus tachycardia with frequent PACs', 'Wandering atrial pacemaker (same picture, rate under 100)'],
      act: 'Treat hypoxia, bronchospasm and sepsis; replace K⁺ and Mg²⁺; review theophylline and beta-agonist doses.'
    });
  })();
  (function () {
    const m = baseMorph();
    const pre = f => { const x = baseMorph({ axis: 50, M: 1.1, qrsD: .1 + .06 * f }); A(x, 'r', { V1: .9, V2: 1.1 }); A(x, 's', { V1: -.3, V2: -.5 });
      for (let i = 0; i < 12; i++) { const net = x.r[i] + x.s[i]; x.dl[i] = (.3 + .5 * f) * net; x.r[i] *= 1.2 - .4 * f; x.s[i] *= 1.2 - .4 * f; x.t[i] = -.3 * f * net; } return x; };
    def({
      id: 'af-wpw', name: 'Pre-excited AF (AF with WPW)', cat: 'Rhythm', lead: 'II', qtc: .38,
      meas: meas('~220', 'none', '100–180 ms', '–', 'variable'), morphs: { main: m, p1: pre(.5), p2: pre(.85), p3: pre(1) },
      tag: { t: 'Avoid AV-nodal blockers', k: 'crit' },
      build: c => {
        const b = []; let t = .3; const K = ['main', 'p1', 'p2', 'p3', 'p3', 'p2'];
        while (t < last()) { b.push({ t, m: K[Math.floor(c.R() * K.length)] }); t += (.2 + c.R() * .2) / c.k; }
        return { beats: b, fib: L({ V1: .06, II: .03, III: .03 }) };
      },
      desc: 'Very fast, irregular, wide complexes that keep changing width.',
      find: ['Irregularly irregular, rate often over 200/min (shortest R-R can be under 250 ms)', 'QRS width and shape vary beat to beat, from narrow to very wide', 'Delta-like slurred upstroke on the widest beats', 'No organised P waves'],
      pearls: ['The accessory pathway lets atrial fibrillation reach the ventricles at very high rates and can degenerate to VF', 'AV-nodal blockers (adenosine, verapamil, diltiazem, beta-blockers, digoxin, IV amiodarone) can speed conduction down the pathway', 'Unstable: synchronised cardioversion. Stable: procainamide (or ibutilide), then refer for ablation'],
      ddx: ['Polymorphic VT', 'AF with bundle branch block (constant QRS shape)', 'Ventricular tachycardia'],
      act: 'Defibrillator pads on. Synchronised DC cardioversion if unstable; otherwise procainamide. Do not give AV-nodal blockers.'
    });
  })();
  (function () {
    const n = baseMorph(), v = pacedMorph();
    def({
      id: 'pace-capture', name: 'Pacemaker: Failure to Capture', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('~42', 'dissociated', '160 ms (paced)', '–', '–60°'), morphs: { main: v, esc: ventMorph({ axis: 90, v1: 'pos', qrsD: .15, M: 1, tk: .35 }) },
      tag: { t: 'Urgent', k: 'warn' },
      build: c => {
        const pp = 60 / (70 * c.k), b = [], sp = []; let i = 0;
        for (let t = .4; t < last(); t += pp, i++) { if (i % 3 === 1 || i % 5 === 3) sp.push(t + .008); else b.push({ t, m: 'main' }); }
        const ps = []; for (let t = .15; t < last(); t += .9) ps.push({ t });
        return { beats: b, ps, custom: (leads, R, G) => sp.forEach(t => spike(leads, G, t)) };
      },
      desc: 'Pacing spikes on time, but some are not followed by a QRS.',
      find: ['Regular pacing spikes at the programmed rate', 'Some spikes are not followed by a wide paced QRS (non-capture)', 'Pauses and bradycardia where capture fails', 'Native P waves march through independently'],
      pearls: ['Causes: lead displacement or fracture, raised threshold (hyperkalaemia, acidosis, ischaemia, antiarrhythmics), low output, battery depletion', 'Temporary wires lose capture frequently: check threshold daily', 'Electrical capture needs a matching pulse (mechanical capture)'],
      ddx: ['Failure to sense', 'Pseudo-malfunction from fusion beats', 'Oversensing with pauses (no spikes at all)'],
      act: 'Check pulse; increase output (mA) and check connections; correct K⁺ and acidosis; transcutaneous pacing as a bridge; get the pacing team and a chest X-ray for lead position.'
    });
  })();
  (function () {
    const n = baseMorph(), v = pacedMorph();
    def({
      id: 'pace-sense', name: 'Pacemaker: Failure to Sense', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('~80', '160 ms', 'mixed', '–', 'mixed'), morphs: { main: n, pace: v },
      tag: { t: 'R-on-T risk', k: 'warn' },
      build: c => {
        const rr = 60 / (78 * c.k), pp = 60 / (60 * c.k), nat = [];
        for (let t = .4; t < last(); t += rr) nat.push(t);
        const b = [], sp = [], ps = [];
        for (let t = .7; t < last(); t += pp) {
          const prev = nat.filter(x => x <= t).pop(), nxt = nat.find(x => x > t);
          if (prev != null && t - prev < .38) sp.push(t);
          else if (nxt != null && nxt - t < .12) sp.push(t);
          else { b.push({ t: t + .008, m: 'pace', nohr: true }); for (let k = nat.length - 1; k >= 0; k--) if (nat[k] > t && nat[k] - t < .42) { ps.push({ t: nat[k] - .16 + .045 }); nat.splice(k, 1); } }
        }
        nat.forEach(t => b.push({ t, m: 'main', pr: .16 }));
        return { beats: b, ps, custom: (leads, R, G) => sp.forEach(t => spike(leads, G, t)) };
      },
      desc: 'Pacing spikes fire at a fixed rate and ignore the patient\'s own beats.',
      find: ['Native narrow beats are present, yet pacing spikes still appear', 'Spikes land in the QRS, ST segment or on the T wave', 'Some spikes capture and produce wide paced beats, competing with sinus rhythm', 'Effectively asynchronous (VOO-like) behaviour'],
      pearls: ['A spike on the T wave (R-on-T) can trigger VF', 'Causes: sensitivity set too high (less sensitive), lead displacement, low-amplitude native signals, magnet applied', 'Temporary pacing box: lower the mV number to make it more sensitive'],
      ddx: ['Failure to capture', 'Magnet mode (intentional asynchronous pacing)', 'Fusion and pseudofusion beats'],
      act: 'Increase sensitivity (lower mV setting) or turn pacing down if the native rhythm is adequate; check the lead; watch for R-on-T VT/VF.'
    });
  })();
  (function () {
    const m = baseMorph({ M: .38 }); SC(m, 'r', .4); SC(m, 's', .4); SC(m, 'q', .4); SC(m, 't', .5); SC(m, 'p', .7);
    const alt = JSON.parse(JSON.stringify(m)); ['r', 's', 'q'].forEach(k => SC(alt, k, .45)); SC(alt, 't', .8);
    for (let i = 6; i < 12; i++) { alt.r[i] = m.r[i] * .25; alt.s[i] = m.s[i] * 1.7; }
    def({
      id: 'effusion', name: 'Pericardial Effusion (Electrical Alternans)', cat: 'Other', lead: 'V3', qtc: .40,
      meas: meas('110', '140 ms', '90 ms', '410 ms', '+60°'), morphs: { main: m, alt },
      tag: { t: 'Think tamponade', k: 'crit' },
      build: c => { const b = reg(110, .3, .14, c.R, .01); b.forEach((x, i) => { if (i % 2) x.m = 'alt'; }); return { beats: b }; },
      desc: 'Small complexes that alternate in height every other beat, with sinus tachycardia.',
      find: ['Sinus tachycardia', 'Low QRS voltage (limb leads under 5 mm, chest leads under 10 mm)', 'QRS amplitude alternates beat to beat (electrical alternans), best in the chest leads', 'Sometimes PR depression from associated pericarditis'],
      pearls: ['Alternans comes from the heart swinging inside a large effusion', 'Triad of tachycardia, low voltage and alternans is specific for a large effusion and tamponade', 'Bedside echo: RA or RV diastolic collapse, plethoric IVC'],
      ddx: ['Low voltage from obesity, COPD, hypothyroidism, amyloid', 'Alternans in fast SVT (rate-related)', 'Recording artefact'],
      act: 'Echo now; fluids to support preload; avoid positive pressure where possible; urgent pericardiocentesis if tamponade.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 100, qrsD: .13 });
    A(m, 'rp', { aVR: .55, I: -.35, aVL: -.3, II: -.1, V1: .15, V5: -.25, V6: -.3 }); A(m, 's', { I: -.5, aVL: -.45 });
    m.qt = .44;
    def({
      id: 'tca', name: 'TCA / Sodium-Channel Blocker Toxicity', cat: 'Metabolic & Drugs', lead: 'aVR', qtc: .50,
      meas: meas('122', '160 ms', '130 ms', '500 ms', '+110° (terminal)'), morphs: { main: m },
      tag: { t: 'Give bicarbonate', k: 'crit' },
      build: c => ({ beats: reg(122, .35, .16, c.R, .01) }),
      desc: 'Sinus tachycardia with a wide QRS and a tall terminal R wave in aVR.',
      find: ['Sinus tachycardia (anticholinergic effect)', 'QRS over 100 ms; over 160 ms predicts VT/VF', 'Terminal R wave in aVR over 3 mm (R/S over 0.7)', 'Deep slurred S in I and aVL (terminal right axis), prolonged QTc'],
      pearls: ['QRS over 100 ms predicts seizures; over 160 ms predicts ventricular arrhythmia', 'Same pattern with other sodium-channel blockers: flecainide, cocaine, carbamazepine, local anaesthetics, quinine', 'Avoid class Ia/Ic antiarrhythmics and physostigmine'],
      ddx: ['Brugada pattern', 'Hyperkalaemia', 'RBBB'],
      act: 'Sodium bicarbonate 8.4% 1–2 mmol/kg IV bolus, repeat to narrow the QRS (target pH 7.45–7.55); intubate and hyperventilate if needed; benzodiazepines for seizures.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .62; m.tw = 1.9;
    A(m, 't', { V1: -.3, V2: -1.1, V3: -1.4, V4: -1.3, V5: -1.0, V6: -.8, I: -.5, II: -.6, aVL: -.3, aVF: -.5, III: -.3, aVR: .5 });
    A(m, 'u', { V2: .15, V3: .2, V4: .2, V5: .12 });
    def({
      id: 'cerebral-t', name: 'Raised ICP / SAH (Cerebral T Waves)', cat: 'Other', lead: 'V3', qtc: .60,
      meas: meas('48', '170 ms', '90 ms', '~600 ms', '+60°'), morphs: { main: m },
      tag: { t: 'Neuro emergency', k: 'warn' },
      build: c => ({ beats: reg(48, .6, .17, c.R, .03) }),
      desc: 'Giant, wide, deeply inverted T waves with a very long QT and bradycardia.',
      find: ['Deep, broad T wave inversion, often widespread (precordial most striking)', 'Markedly prolonged QT; prominent U waves', 'Sinus bradycardia (Cushing response with hypertension)', 'May show ST changes or arrhythmia'],
      pearls: ['Caused by a catecholamine surge after SAH, stroke, head injury or raised ICP', 'Troponin can rise and echo may show takotsubo-like dysfunction with normal coronaries', 'Bradycardia + hypertension + irregular breathing = Cushing triad: herniation risk'],
      ddx: ['Wellens syndrome', 'Takotsubo cardiomyopathy', 'Apical HCM', 'Post-ischaemic T inversion'],
      act: 'CT brain; treat raised ICP (head up 30°, osmotherapy, PaCO₂ control); do not treat the bradycardia alone with atropine.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 50 });
    A(m, 'st', { V1: -.1, V2: -.3, V3: -.35, V4: -.32, V5: -.22, V6: -.15, aVR: .1, I: -.08, II: -.08 });
    A(m, 't', { V2: 1.3, V3: 1.4, V4: 1.25, V5: .9, V6: .6 }); m.tsym = true; m.tw = .8;
    def({
      id: 'de-winter', name: 'De Winter T Waves', cat: 'Ischaemia', lead: 'V3', qtc: .40,
      meas: meas('82', '160 ms', '95 ms', '410 ms', '+50°'), morphs: { main: m },
      tag: { t: 'STEMI equivalent', k: 'crit' },
      build: c => ({ beats: reg(82, .4, .16, c.R, .02) }),
      desc: 'Upsloping ST depression at the J point running into tall symmetric T waves across V1–V6.',
      find: ['1–3 mm upsloping ST depression at the J point in V1–V6', 'Tall, prominent, symmetric T waves', 'Slight ST elevation in aVR', 'No classic ST elevation in the chest leads'],
      pearls: ['Seen in about 2% of acute LAD occlusions', 'A STEMI equivalent: activate the cath lab', 'Pattern is often static rather than evolving'],
      ddx: ['Hyperacute T waves', 'Hyperkalaemia (narrow, peaked T, no ST depression)', 'Normal tall T waves'],
      act: 'Treat as anterior STEMI: aspirin, anticoagulation, emergency angiography.'
    });
  })();
  (function () {
    const m = baseMorph(); m.tw = 1.55; m.tsym = true;
    A(m, 't', { V1: .4, V2: 1.4, V3: 1.6, V4: 1.35, V5: .8, I: .45, aVL: .4 });
    A(m, 'st', { V2: .08, V3: .1, V4: .07, III: -.05, aVF: -.03 });
    def({
      id: 'hyperacute', name: 'Hyperacute T Waves (Early MI)', cat: 'Ischaemia', lead: 'V3', qtc: .41,
      meas: meas('80', '160 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      tag: { t: 'Emergency', k: 'crit' },
      build: c => ({ beats: reg(80, .4, .16, c.R, .02) }),
      desc: 'Broad-based, bulky T waves that look too big for the QRS: the earliest sign of occlusion.',
      find: ['T waves broad at the base, tall and symmetric, out of proportion to the QRS', 'Subtle ST straightening or early ST elevation', 'Localised to a coronary territory (here anterior)', 'Reciprocal ST depression may be present'],
      pearls: ['Appear in the first minutes of coronary occlusion and are often missed', 'Repeat the ECG every 15–30 minutes while symptoms continue', 'Compare with previous ECG and T/QRS ratio'],
      ddx: ['Hyperkalaemia (narrow, pointed T)', 'Early repolarisation', 'De Winter T waves', 'LVH'],
      act: 'Treat as possible occlusion MI: serial ECGs, aspirin, early cardiology discussion and angiography.'
    });
  })();
  (function () {
    const m = mkLBBB();
    A(m, 'st', { I: .2, aVL: .22, V5: .25, V6: .25, V1: -.2, V2: -.25, V3: -.2, II: -.05, III: -.1, aVF: -.08 });
    A(m, 't', { I: .3, aVL: .3, V5: .35, V6: .3, V1: -.3, V2: -.35, V3: -.2 });
    def({
      id: 'lbbb-mi', name: 'LBBB with Acute MI (Sgarbossa)', cat: 'Ischaemia', lead: 'V5', qtc: .42,
      meas: meas('84', '170 ms', '140 ms', '450 ms', '–15°'), morphs: { main: m },
      tag: { t: 'Emergency', k: 'crit' },
      build: c => ({ beats: reg(84, .4, .17, c.R, .02) }),
      desc: 'LBBB in which ST segments move in the SAME direction as the QRS (concordant).',
      find: ['LBBB morphology: QRS ≥ 120 ms, broad R in I, aVL, V5–V6, deep S in V1–V3', 'Concordant ST elevation ≥ 1 mm in leads with positive QRS (I, aVL, V5, V6): 5 points', 'Concordant ST depression ≥ 1 mm in V1–V3: 3 points', 'Normal LBBB would show discordant ST changes'],
      pearls: ['Sgarbossa score ≥ 3 is highly specific for acute MI', 'Smith-modified criterion: discordant ST elevation ≥ 25% of the preceding S depth', 'New LBBB alone is no longer treated as a STEMI equivalent'],
      ddx: ['Uncomplicated LBBB (discordant changes)', 'Paced rhythm (same criteria apply)', 'LVH with strain'],
      act: 'Treat as STEMI: emergency reperfusion.'
    });
  })();
  (function () {
    const m = mkRBBB(), b = baseMorph({ axis: -60, M: 1.1, qrsD: .13 });
    for (let i = 0; i < 6; i++) { m.r[i] = b.r[i]; m.s[i] = b.s[i]; m.q[i] = b.q[i]; m.t[i] = b.t[i] * .7; }
    A(m, 'q', { aVL: -.1, I: -.05 }); A(m, 'rp', { I: -.35, aVL: -.25, II: -.15, III: .1, aVF: .05, aVR: .35 });
    def({
      id: 'bifascicular', name: 'Bifascicular Block (RBBB + LAFB)', cat: 'Conduction', lead: 'V1', qtc: .42,
      meas: meas('76', '180 ms', '140 ms', '440 ms', '–60°'), morphs: { main: m },
      build: c => ({ beats: reg(76, .45, .18, c.R, .02) }),
      desc: 'RBBB pattern in V1 together with marked left axis deviation.',
      find: ['RBBB: QRS ≥ 120 ms, rSR′ in V1, wide S in I and V6', 'Left axis deviation beyond −45°', 'qR in aVL, rS in II, III and aVF (LAFB)', 'Only the left posterior fascicle is conducting'],
      pearls: ['Bifascicular block + 1st-degree AV block is often called "trifascicular" block', 'In syncope it may hide intermittent complete heart block: monitor and consider EP study or pacing', 'Can appear after TAVI, septal ablation or in anterior MI'],
      ddx: ['RBBB with LPFB (right axis)', 'LBBB', 'Ventricular rhythm'],
      act: 'Monitor; pads available in an acutely unwell patient; investigate syncope; pacing if Mobitz II or CHB develops.'
    });
  })();
  (function () {
    const m = baseMorph({ qrsD: .12 });
    def({
      id: 'high-grade', name: 'High-Grade AV Block (3:1)', cat: 'Conduction', lead: 'II', qtc: .40,
      meas: meas('30 (P 90)', '200 ms', '120 ms', '–', '+40°'), morphs: { main: m },
      tag: { t: 'Pace', k: 'crit' },
      build: c => {
        const pp = 60 / c.ctl.rate, b = [], ps = [];
        for (let k = 0, tp = .15; tp < last() - .3; k++, tp += pp) { if (k % 3 === 2) b.push({ t: tp - .045 + .2 + .42 * .12, m: 'main', pr: .2 }); else ps.push({ t: tp }); }
        return { beats: b, ps };
      },
      desc: 'Two or more consecutive P waves fail to conduct, but some P waves still conduct with a fixed PR.',
      find: ['Regular P waves (here at 90/min)', 'Only every third P wave is followed by a QRS (3:1)', 'Constant PR in the conducted beats, so it is not complete heart block', 'Slow ventricular rate'],
      pearls: ['Behaves like Mobitz II: high risk of progression to complete heart block or asystole', 'Atropine is often ineffective', 'Look for inferior MI, drugs (beta-blockers, calcium-channel blockers, digoxin) and hyperkalaemia'],
      ddx: ['Complete heart block (PR varies, no relation)', 'Blocked PACs', '2:1 AV block'],
      act: 'Pads on; transcutaneous pacing if unstable; transvenous pacing wire; correct drugs and K⁺.'
    });
  })();
  (function () {
    def({
      id: 'vent-escape', name: 'Ventricular Escape Rhythm', cat: 'Rhythm', lead: 'II', qtc: .44,
      meas: meas('32', 'none', '170 ms', '–', '–30°'), morphs: { main: ventMorph({ axis: -30, v1: 'neg', qrsD: .17, M: 1.1, tk: .4 }) },
      tag: { t: 'Peri-arrest', k: 'crit' },
      build: c => ({ beats: reg(32, .6, null, c.R, .03) }),
      desc: 'Slow, wide, regular complexes with no P waves: the ventricle is the last back-up pacemaker.',
      find: ['Rate 20–40/min', 'Wide bizarre QRS (often over 160 ms)', 'No P waves (sinus arrest) or dissociated P waves', 'Discordant ST-T'],
      pearls: ['It is a rescue rhythm: never suppress it with lidocaine or amiodarone', 'Often seen in severe hyperkalaemia, profound hypoxia, drug toxicity and as an agonal rhythm', 'Check for a pulse: without one this is PEA'],
      ddx: ['AIVR (rate 60–110)', 'Complete heart block with ventricular escape', 'Hyperkalaemia (sine wave)'],
      act: 'Check pulse. If perfusing: pads on, pacing, adrenaline or isoprenaline infusion, treat the cause (K⁺, hypoxia, drugs). If no pulse: CPR (PEA).'
    });
  })();
  (function () {
    const m = baseMorph();
    def({
      id: 'sinus-pause', name: 'Sinus Pause / Sinus Arrest', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('~60', '160 ms', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => {
        const rr = 60 / (72 * c.k), b = []; let t = .45, n = 0;
        while (t < last()) { b.push({ t, m: 'main', pr: .16 }); n++; t += (n % 9 === 4) ? 3.1 : rr; }
        return { beats: b };
      },
      desc: 'Normal sinus beats interrupted by a long flat gap with no P wave.',
      find: ['Normal sinus rhythm with sudden pauses', 'No P wave during the pause', 'The pause is not an exact multiple of the P-P interval (sinus arrest)', 'Sinus rhythm resumes after the pause (here about 3 s)'],
      pearls: ['Pauses over 3 s, or symptomatic pauses, suggest sick sinus syndrome', 'If the pause is exactly 2× the P-P interval, think SA exit block', 'ICU causes: vagal stimulation (suction, intubation), hypoxia, beta-blockers, dexmedetomidine, inferior MI, raised ICP'],
      ddx: ['Blocked PAC (look for a P wave in the T wave)', 'SA exit block', 'Mobitz II (P waves present)'],
      act: 'Stop the trigger; atropine if symptomatic; pacing for recurrent symptomatic pauses.'
    });
  })();
  (function () {
    const m = baseMorph();
    def({
      id: 'artefact-tremor', name: 'Artefact: Tremor / Shivering', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('80', '160 ms', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      tag: { t: 'Check the patient', k: 'warn' },
      build: c => ({
        beats: reg(80, .4, .16, c.R, .02),
        custom: (leads, R) => {
          const W = L({ I: .45, II: .9, III: .7, aVR: .6, aVL: .3, aVF: .8, V1: .08, V2: .1, V3: .12, V4: .12, V5: .1, V6: .1 });
          const n = leads[0].length, f = 5.2;
          for (let i = 0; i < n; i++) {
            const t = i / 500, env = Math.max(0, Math.sin(2 * Math.PI * t / 7 + .6)) ** .6;
            const s = Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * 2.03 * f * t + 1) + .25 * (R() - .5);
            for (let l = 0; l < 12; l++) leads[l][i] += W[l] * env * s * .55;
          }
        }
      }),
      desc: 'Fast irregular oscillations in the limb leads that look like VT or VF, while sinus QRS complexes march through on time.',
      find: ['Rapid baseline oscillation, worst in limb leads and fluctuating over seconds', 'The true QRS complexes can still be seen marching through at a regular rate', 'Chest leads relatively clean (if the limbs are shaking)', 'Patient is awake and has a normal arterial or SpO₂ waveform'],
      pearls: ['Common in ICU: shivering after surgery or cooling, rigors, Parkinsonian tremor, seizures, physiotherapy, tooth-brushing', 'Never shock a monitor: look at the patient, pulse and arterial line first', 'Move limb electrodes to the torso to reduce artefact'],
      ddx: ['Ventricular tachycardia', 'Ventricular fibrillation', 'Atrial flutter'],
      act: 'Look at the patient and the arterial or pleth trace; reposition electrodes; treat shivering (warming, pethidine, dexmedetomidine).'
    });
  })();
  (function () {
    const m = baseMorph();
    def({
      id: 'artefact-lead', name: 'Artefact: Loose Lead and 50 Hz Interference', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('75', '160 ms', '90 ms', '400 ms', '+60°'), morphs: { main: m },
      build: c => ({
        beats: reg(75, .45, .16, c.R, .02),
        custom: (leads, R) => {
          const n = leads[0].length;
          for (let i = 0; i < n; i++) {
            const t = i / 500;
            for (let l = 0; l < 12; l++) leads[l][i] += .06 * Math.sin(2 * Math.PI * 50 * t + l);
          }
          const LA = [IDX.I, IDX.III, IDX.aVL, IDX.aVR, IDX.aVF, IDX.II];
          const WT = { [IDX.I]: 1, [IDX.III]: -1, [IDX.aVL]: 1, [IDX.aVR]: -.5, [IDX.aVF]: -.5, [IDX.II]: .1 };
          for (let k = 0; k < Math.floor(n / 500 / 6); k++) {
            const t0 = 2.5 + k * 6 + R() * 1.5, t1 = t0 + 1.4 + R();
            for (let i = Math.floor(t0 * 500); i < Math.min(n, t1 * 500); i++) {
              const x = (i / 500 - t0) / (t1 - t0), w = 1.4 * Math.sin(Math.PI * x) * (1 + .4 * Math.sin(37 * x)) + .2 * (R() - .5);
              LA.forEach(l => { leads[l][i] = leads[l][i] * (1 - Math.sin(Math.PI * x) * .9) + WT[l] * w; });
            }
          }
        }
      }),
      desc: 'A thick fuzzy baseline (mains interference) and bursts of wandering or flat trace from a poorly attached electrode.',
      find: ['Regular fine 50 Hz oscillation thickens the whole baseline', 'Sudden large wandering swings and loss of QRS in the leads that share the loose electrode (here left arm: I, III, aVL)', 'Lead II, which does not use the left arm, stays clean', 'Underlying sinus rhythm continues'],
      pearls: ['A flat line in one lead can be lead-off, not asystole: always confirm in a second lead and check the patient', 'Mains artefact: dried gel, poor skin contact, nearby equipment; use the monitor filter', 'Work out which electrode is faulty from the leads it affects'],
      ddx: ['Asystole (if a lead disconnects)', 'Atrial flutter or fibrillation (fine artefact)', 'Ventricular fibrillation'],
      act: 'Check the patient first; replace electrodes with fresh gel, clean and dry the skin; route cables away from infusion pumps and warmers.'
    });
  })();

  /* ================= ADDED: v5 set ================= */
  const RLAB = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1R', 'V2R', 'V3R', 'V4R', 'V5R', 'V6R'];
  const PLAB = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V7', 'V8', 'V9'];
  /* right-sided chest leads: small r, deep S, low T */
  function rightChest(m, ste) {
    const r = [.2, .25, .25, .22, .2, .18], s = [-1.0, -.9, -.75, -.6, -.5, -.4], t = [-.05, .05, .1, .1, .1, .08];
    for (let i = 0; i < 6; i++) { m.r[6 + i] = r[i]; m.s[6 + i] = s[i]; m.q[6 + i] = 0; m.t[6 + i] = t[i] + (ste ? ste[i] * 1.2 : 0); m.st[6 + i] = ste ? ste[i] : 0; m.u[6 + i] = 0; }
    return m;
  }
  (function () {
    const m = baseMorph(); A(m, 'q', { III: -.2, aVF: -.12 });
    A(m, 'st', { II: .22, III: .35, aVF: .28, I: -.1, aVL: -.22, V1: .12, V2: .02 });
    A(m, 't', { II: .55, III: .65, aVF: .6, aVL: -.3, I: .05, V1: .25 });
    const r = JSON.parse(JSON.stringify(m)); rightChest(r, [.15, .18, .2, .22, .18, .14]);
    def({
      id: 'stemi-rv', name: 'Inferior STEMI with RV Infarction', cat: 'Ischaemia', lead: 'III', qtc: .40,
      meas: meas('56', '180 ms', '90 ms', '420 ms', '+60°'), morphs: { main: m },
      alt: { name: 'Right-sided leads (V1R–V6R)', labels: RLAB, morphs: { main: r } },
      tag: { t: 'No nitrates', k: 'crit' },
      build: c => ({ beats: reg(56, .6, .18, c.R, .02) }),
      desc: 'Inferior ST elevation with ST elevation in V1; the right-sided ECG shows ST elevation in V4R.',
      find: ['ST elevation II, III, aVF with III greater than II', 'ST elevation in V1 (the only standard lead facing the RV)', 'Right-sided leads: ST elevation ≥ 1 mm in V4R (most sensitive)', 'Reciprocal ST depression in aVL'],
      pearls: ['Record right-sided leads in every inferior STEMI', 'RV infarct is preload-dependent: nitrates, diuretics and morphine can cause profound hypotension', 'Bradycardia and AV block are common (RCA supplies the AV node)'],
      ddx: ['Inferior STEMI alone', 'Posterior extension', 'Acute PE with RV strain'],
      act: 'Avoid nitrates; give fluids to support RV preload; maintain AV synchrony (atrial pacing if needed); emergency reperfusion.'
    });
  })();
  (function () {
    const e = LIB.find(x => x.id === 'stemi-post');
    const m0 = typeof e.morphs === 'function' ? null : e.morphs.main, p = JSON.parse(JSON.stringify(m0));
    const q = [-.25, -.28, -.25], st = [.12, .15, .12], t = [.25, .3, .25], r = [.7, .5, .35], s = [-.1, -.1, -.05];
    for (let k = 0; k < 3; k++) { p.q[9 + k] = q[k]; p.st[9 + k] = st[k]; p.t[9 + k] = t[k]; p.r[9 + k] = r[k]; p.s[9 + k] = s[k]; p.u[9 + k] = 0; }
    e.alt = { name: 'Posterior leads (V7–V9)', labels: PLAB, morphs: { main: p } };
  })();
  (function () {
    const m = baseMorph();
    A(m, 'q', { II: -.25, III: -.45, aVF: -.38 }); SC(m, 'r', 1); A(m, 'r', { III: .15, aVF: .2, II: .5 });
    A(m, 't', { II: -.1, III: -.25, aVF: -.2 }); A(m, 'st', {});
    def({
      id: 'old-mi', name: 'Old Inferior MI (Q Waves)', cat: 'Ischaemia', lead: 'III', qtc: .41,
      meas: meas('72', '160 ms', '95 ms', '420 ms', '–10°'), morphs: { main: m },
      build: c => ({ beats: reg(72, .45, .16, c.R, .02) }),
      desc: 'Deep, wide Q waves in the inferior leads without ST elevation: a completed infarct.',
      find: ['Pathological Q waves in II, III and aVF (≥ 40 ms or ≥ 25% of the R wave)', 'No acute ST elevation', 'Flat or inverted inferior T waves', 'Axis shifted leftward'],
      pearls: ['Q waves mean established necrosis; they can appear within hours and persist for life', 'An isolated small Q in III is often normal: look for Q in II and aVF too', 'Compare with old ECGs before calling new ischaemia'],
      ddx: ['Acute inferior STEMI (ST elevation)', 'LAFB (small q in I, aVL)', 'HCM septal Q waves'],
      act: 'Secondary prevention and echo for wall motion; treat as acute only if symptoms or evolving changes.'
    });
  })();
  (function () {
    const m = baseMorph();
    A(m, 'q', { V1: -.6, V2: -1.0, V3: -1.1, V4: -.7 }); A(m, 'r', { V1: 0, V2: 0, V3: 0, V4: .2 }); A(m, 's', { V1: 0, V2: 0, V3: 0, V4: -.2 });
    A(m, 'st', { V1: .1, V2: .2, V3: .22, V4: .15 }); A(m, 't', { V1: .05, V2: .2, V3: .25, V4: .2 });
    def({
      id: 'lv-aneurysm', name: 'LV Aneurysm (Persistent ST Elevation)', cat: 'Ischaemia', lead: 'V3', qtc: .42,
      meas: meas('76', '160 ms', '100 ms', '430 ms', '+40°'), morphs: { main: m },
      build: c => ({ beats: reg(76, .45, .16, c.R, .02) }),
      desc: 'QS complexes across the anterior leads with modest ST elevation and small T waves, weeks after an anterior MI.',
      find: ['Deep QS waves V1–V4', 'Persistent mild ST elevation in the same leads', 'Small T waves (T/QRS amplitude ratio < 0.36 favours aneurysm)', 'No reciprocal ST depression'],
      pearls: ['ST elevation persisting > 2 weeks after MI suggests aneurysm', 'Use the T/QRS ratio rule and old ECGs to avoid unnecessary thrombolysis', 'Risks: LV thrombus, VT, heart failure'],
      ddx: ['Acute anterior STEMI (tall T waves, evolving)', 'LBBB', 'Early repolarisation'],
      act: 'Compare with previous ECGs; echo for aneurysm and thrombus; treat as acute only with new symptoms and dynamic change.'
    });
  })();
  (function () {
    const m = baseMorph(); m.qt = .46;
    A(m, 'st', { V2: .15, V3: .22, V4: .22, V5: .18, V6: .12, I: .08, II: .12, aVL: .05, aVF: .08, aVR: -.15 });
    A(m, 't', { V2: .5, V3: .6, V4: .55, V5: .45, V6: .35, II: .45 });
    def({
      id: 'takotsubo', name: 'Takotsubo Cardiomyopathy', cat: 'Ischaemia', lead: 'V4', qtc: .48,
      meas: meas('96', '150 ms', '90 ms', '480 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(96, .4, .15, c.R, .02) }),
      desc: 'Widespread anterolateral ST elevation without reciprocal change, with ST depression in aVR.',
      find: ['ST elevation across V2–V6, often also I and II', 'ST depression in aVR, no reciprocal inferior ST depression', 'No initial Q waves', 'Later: deep diffuse T inversion with QT prolongation'],
      pearls: ['Triggered by physical or emotional stress, catecholamines, critical illness, SAH and sepsis', 'Cannot be distinguished from STEMI reliably on ECG: angiography is needed', 'Watch for LVOT obstruction (avoid inotropes), QT prolongation and torsades'],
      ddx: ['Anterior STEMI', 'Pericarditis', 'Cerebral T waves'],
      act: 'Treat as STEMI until coronary angiography; echo for apical ballooning; avoid catecholamines if LVOT obstruction.'
    });
  })();
  (function () {
    const m = baseMorph(), v = ventMorph({ axis: -80, v1: 'pos', qrsD: .14, M: 1.2, tk: .35 });
    def({
      id: 'nsvt', name: 'Non-Sustained VT', cat: 'Arrest & VT', lead: 'II', qtc: .41,
      meas: meas('80 (run 170)', '160 ms', 'run 140 ms', '410 ms', '+60°'), morphs: { main: m, vt: v },
      tag: { t: 'Check K⁺ and Mg²⁺', k: 'warn' },
      build: c => {
        const rr = 60 / (80 * c.k), b = []; let t = .45, n = 0;
        while (t < last()) { if (n % 12 === 5) { for (let k = 0; k < 6 && t < last(); k++) { b.push({ t: t - .25 * rr * (k === 0) + 0, m: 'vt' }); t += .35; } t += rr * .6; } b.push({ t, m: 'main', pr: .16 }); t += rr; n++; }
        return { beats: b.filter(x => x.t < last()) };
      },
      desc: 'Sinus rhythm interrupted by a short run of wide beats at a fast rate that stops by itself.',
      find: ['Three or more consecutive ventricular beats at over 100/min', 'Lasts less than 30 seconds and terminates spontaneously', 'Uniform wide QRS during the run (monomorphic)', 'Sinus rhythm before and after'],
      pearls: ['Common after cardiac surgery and MI, and with low K⁺ or Mg²⁺, catecholamines or central lines in the heart', 'Correct K⁺ to 4.0–4.5 and Mg²⁺ to ≥ 1.0 mmol/L', 'Frequent runs with structural heart disease need cardiology input'],
      ddx: ['Sustained VT (> 30 s)', 'AF with aberrancy', 'Artefact'],
      act: 'Check the patient and pulse; correct K⁺ and Mg²⁺; check catheter and line positions; reduce catecholamines; beta-blocker if appropriate.'
    });
  })();
  (function () {
    const m = baseMorph(), pv = ventMorph({ axis: 100, v1: 'neg', qrsD: .15, M: 1.4, tk: .4 });
    def({
      id: 'trigeminy', name: 'Ventricular Trigeminy', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('78', '160 ms', '90 / 150 ms', '400 ms', '+60°'), morphs: { main: m, pvc: pv },
      build: c => {
        const rr = 60 / (78 * c.k), b = [], ps = []; let t = .45, n = 0;
        while (t < last()) { if (n % 3 === 2) { b.push({ t: t - .3 * rr, m: 'pvc' }); ps.push({ t: t - .16 + .045 }); t += rr * 1.3; } else { b.push({ t, m: 'main', pr: .16 }); t += rr; } n++; }
        return { beats: b, ps };
      },
      desc: 'Two normal beats followed by one PVC, repeating.',
      find: ['Pattern: normal, normal, PVC, repeating', 'PVC is wide with no preceding P wave', 'Compensatory pause after each PVC', 'Same PVC shape each time (unifocal)'],
      pearls: ['Same causes as other ectopy: K⁺, Mg²⁺, ischaemia, catecholamines, central line tip', 'Pulse oximeter may count fewer beats than the ECG', 'Usually benign if the heart is structurally normal'],
      ddx: ['Bigeminy', 'Atrial trigeminy (narrow early beats)', 'Mobitz I grouped beating'],
      act: 'Check electrolytes, drug doses and line positions; treat the cause.'
    });
  })();
  (function () {
    const m = baseMorph(), j = baseMorph();
    def({
      id: 'tachy-brady', name: 'Sick Sinus (Tachy-Brady Syndrome)', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('variable', 'variable', '90 ms', '400 ms', '+60°'), morphs: { main: m, j },
      tag: { t: 'May need pacing', k: 'warn' },
      build: c => {
        const b = []; let t = .3; const end1 = 4.5;
        while (t < end1) { b.push({ t, m: 'main' }); t += .3 + c.R() * .22; }
        t += 3.4; b.push({ t, m: 'j' }); t += 1.4; b.push({ t, m: 'j' }); t += 1.25;
        while (t < last()) { b.push({ t, m: 'main', pr: .17 }); t += 60 / 46; }
        return { beats: b, fib: L({ V1: .05, II: .03 }), fibEnd: end1 + .2 };
      },
      desc: 'A burst of fast AF stops, followed by a long pause, junctional escape and slow sinus beats.',
      find: ['Paroxysm of fast irregular atrial fibrillation', 'Long pause (here over 3 s) when it terminates: sinus node fails to recover', 'Junctional escape beats, then sinus bradycardia', 'Symptoms: dizziness or syncope after palpitations'],
      pearls: ['Rate-control drugs for the fast phase worsen the slow phase', 'Often needs a permanent pacemaker, which then allows rate-control drugs', 'In ICU look for drugs, hypothyroidism, hypothermia and raised ICP'],
      ddx: ['Paroxysmal AF alone', 'Sinus arrest', 'Blocked PACs'],
      act: 'Treat the pause first (atropine, pacing if symptomatic); avoid unopposed AV-nodal blockers; refer for pacemaker.'
    });
  })();
  (function () {
    const m = baseMorph();
    def({
      id: 'avrt', name: 'AVRT (Orthodromic, WPW circuit)', cat: 'Rhythm', lead: 'II', qtc: .38,
      meas: meas('200', 'RP ~120 ms', '85 ms', '–', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(200, .3, null, c.R, .002).map(b => Object.assign(b, { retro: .13 })) }),
      desc: 'Regular narrow tachycardia with a retrograde P wave clearly separate from the QRS, sitting in the ST segment.',
      find: ['Regular narrow-complex tachycardia, often over 180/min', 'Retrograde P wave visible in the ST segment (RP > 70 ms)', 'QRS alternans may be seen at fast rates', 'Delta wave returns in sinus rhythm after conversion'],
      pearls: ['Orthodromic AVRT goes down the AV node and up the accessory pathway, so the QRS is narrow', 'Treat like SVT: vagal manoeuvres and adenosine work', 'Have a defibrillator ready: adenosine can trigger AF, which may conduct rapidly down the pathway'],
      ddx: ['AVNRT (P hidden in QRS, RP < 70 ms)', 'Atrial tachycardia (long RP)', 'Atrial flutter 2:1'],
      act: 'Vagal manoeuvre, then adenosine with defibrillator ready; synchronised cardioversion if unstable; refer for ablation.'
    });
  })();
  (function () {
    const m = baseMorph({ paxis: -70, pM: .14 });
    def({
      id: 'atrial-tach', name: 'Focal Atrial Tachycardia', cat: 'Rhythm', lead: 'II', qtc: .40,
      meas: meas('160', '140 ms', '85 ms', '410 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(160, .4, .14, c.R, .003) }),
      desc: 'Regular narrow tachycardia with an abnormal P wave in front of every QRS (inverted in the inferior leads).',
      find: ['Regular rate 150–250/min', 'One P wave before each QRS but with an abnormal shape and axis', 'Long RP interval (P closer to the next QRS)', 'Isoelectric baseline between P waves (unlike flutter)'],
      pearls: ['ICU triggers: catecholamines, theophylline, hypokalaemia, digoxin toxicity (atrial tachycardia with block)', 'Adenosine may cause AV block while the atrial tachycardia continues', 'Treat the cause; beta-blocker or calcium-channel blocker for rate'],
      ddx: ['Sinus tachycardia (normal P axis, gradual onset)', 'Atrial flutter', 'AVRT'],
      act: 'Reduce triggers (catecholamines), correct K⁺ and Mg²⁺, check digoxin; rate control; cardioversion if unstable.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 70 }); A(m, 'jw', { V2: .1, V3: .15, V4: .18, V5: .12, II: .06 }); m.jws = .02;
    A(m, 'st', { V2: .12, V3: .18, V4: .15, V5: .1, II: .06, aVF: .05 }); A(m, 't', { V2: .8, V3: .9, V4: .8, V5: .6 });
    def({
      id: 'early-repol', name: 'Benign Early Repolarisation', cat: 'Normal', lead: 'V4', qtc: .38,
      meas: meas('62', '150 ms', '90 ms', '380 ms', '+70°'), morphs: { main: m },
      build: c => ({ beats: reg(62, .5, .15, c.R, .03) }),
      desc: 'Concave ST elevation with a notched J point and tall T waves in a young, well person.',
      find: ['Concave (smiley) ST elevation, most marked V2–V5', 'Notching or slurring at the J point ("fish hook")', 'Tall, slightly asymmetric T waves', 'No reciprocal ST depression; stable over time'],
      pearls: ['Common in young men, athletes and Afro-Caribbean people', 'ST elevation is usually < 25% of the T-wave height in V6 (helps against pericarditis)', 'Always compare with old ECGs and the clinical story'],
      ddx: ['Acute pericarditis', 'Anterior STEMI', 'LV aneurysm'],
      act: 'No treatment; repeat ECG if symptoms; treat as STEMI only if the clinical picture fits or the ECG evolves.'
    });
  })();
  (function () {
    const n = baseMorph(), m = JSON.parse(JSON.stringify(n));
    const sw = (k) => { const a = m[k]; const I = -a[0], II = a[2], III = a[1], aVR = a[4], aVL = a[3], aVF = a[5]; a[0] = I; a[1] = II; a[2] = III; a[3] = aVR; a[4] = aVL; a[5] = aVF; };
    ['q', 'r', 's', 'st', 't', 'p', 'u'].forEach(sw);
    for (let i = 0; i < 6; i++) { if (m.r[i] < 0 || m.s[i] > 0) { const r = m.r[i], s2 = m.s[i]; m.r[i] = Math.max(.05, s2); m.s[i] = Math.min(-.04, r); m.q[i] = 0; } }
    def({
      id: 'lead-reversal', name: 'Limb Lead Reversal (LA/RA)', cat: 'Other', lead: 'I', qtc: .40,
      meas: meas('75', '160 ms', '90 ms', '400 ms', 'apparent +150°'), morphs: { main: m },
      build: c => ({ beats: reg(75, .45, .16, c.R, .02) }),
      desc: 'Lead I is completely inverted (P, QRS and T) while the chest leads look normal.',
      find: ['Inverted P, QRS and T in lead I', 'Upright P and QRS in aVR', 'Leads II and III, and aVL and aVF, appear swapped', 'Normal R-wave progression in V1–V6 (unlike dextrocardia)'],
      pearls: ['The commonest recording error and a classic exam trap', 'Dextrocardia also inverts lead I but R waves shrink across the chest leads', 'Simply re-site the electrodes and repeat the ECG'],
      ddx: ['Dextrocardia', 'Lateral MI', 'Right axis deviation'],
      act: 'Check the electrode positions and repeat the ECG before drawing any conclusion.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 100, M: .55, pM: .3, paxis: 75 });
    A(m, 'r', { V1: .1, V2: .2, V3: .3, V4: .4, V5: .4, V6: .35 }); A(m, 's', { V1: -.6, V2: -.7, V3: -.7, V4: -.6, V5: -.55, V6: -.45 });
    A(m, 'p', { II: .3, III: .28, aVF: .3, V1: .12 }); SC(m, 't', .7);
    def({
      id: 'copd', name: 'COPD Pattern (P Pulmonale)', cat: 'Other', lead: 'II', qtc: .40,
      meas: meas('98', '150 ms', '90 ms', '400 ms', '+100°'), morphs: { main: m },
      build: c => ({ beats: reg(98, .4, .15, c.R, .015) }),
      desc: 'Tall peaked P waves in the inferior leads with right axis, low voltage and poor R-wave progression.',
      find: ['P pulmonale: P wave ≥ 2.5 mm in II, III, aVF (right atrial enlargement)', 'Right axis deviation', 'Low QRS voltage in the limb leads', 'Poor R-wave progression with persistent S waves to V6'],
      pearls: ['Hyperinflated lungs push the heart down and insulate it, lowering voltages', 'Look for MAT, AF and sinus tachycardia during exacerbations', 'P mitrale (broad notched P, LA enlargement) is the left-sided counterpart'],
      ddx: ['RVH', 'PE', 'Anterior MI (poor R progression)'],
      act: 'Treat the exacerbation; check for arrhythmias, PE and cor pulmonale.'
    });
  })();
  (function () {
    const m = baseMorph({ axis: 115, M: 1.1, pM: .26, paxis: 70 });
    A(m, 'r', { V1: 1.1, V2: .9, V3: .7, V4: .6, V5: .5, V6: .3 }); A(m, 's', { V1: -.1, V2: -.4, V3: -.6, V4: -.7, V5: -.8, V6: -.7 }); A(m, 'q', { V1: -.1 });
    A(m, 'st', { V1: -.12, V2: -.12, V3: -.08 }); A(m, 't', { V1: -.4, V2: -.35, V3: -.2, II: .1, III: -.1, aVF: 0 });
    def({
      id: 'rvh', name: 'Right Ventricular Hypertrophy', cat: 'Other', lead: 'V1', qtc: .40,
      meas: meas('88', '160 ms', '95 ms', '400 ms', '+115°'), morphs: { main: m },
      build: c => ({ beats: reg(88, .4, .16, c.R, .02) }),
      desc: 'Right axis deviation with a dominant R wave in V1 and right-sided strain.',
      find: ['Right axis deviation (> +110°)', 'Dominant R wave in V1 (R/S > 1), deep S in V5–V6', 'RV strain: ST depression and T inversion V1–V3', 'Often P pulmonale'],
      pearls: ['Causes: pulmonary hypertension, chronic lung disease, mitral stenosis, congenital heart disease, chronic PE', 'Other causes of dominant R in V1: RBBB, posterior MI, WPW, HCM, dextrocardia', 'Echo for RV size and pulmonary pressures'],
      ddx: ['Posterior MI', 'RBBB', 'WPW (left-sided pathway)'],
      act: 'Echo; look for the cause of pulmonary hypertension; avoid hypoxia, hypercapnia and acidosis in the ICU.'
    });
  })();
  (function () {
    const m = baseMorph({ M: 1.5 });
    A(m, 'q', { I: -.4, aVL: -.45, V5: -.45, V6: -.45, II: -.3, III: -.25, aVF: -.3 });
    A(m, 'r', { V1: .3, V2: .6, V4: 2.6, V5: 2.8, V6: 2.2 }); A(m, 's', { V1: -2.0, V2: -2.6, V3: -2.0 });
    A(m, 't', { V4: -.3, V5: -.4, V6: -.35, I: -.15, aVL: -.15 }); A(m, 'st', { V5: -.08, V6: -.08 });
    def({
      id: 'hcm', name: 'Hypertrophic Cardiomyopathy', cat: 'Other', lead: 'V5', qtc: .43,
      meas: meas('70', '160 ms', '100 ms', '430 ms', '+60°'), morphs: { main: m },
      build: c => ({ beats: reg(70, .45, .16, c.R, .02) }),
      desc: 'Very large voltages with deep, narrow "dagger" Q waves in the lateral and inferior leads.',
      find: ['Deep narrow Q waves in I, aVL, V5–V6 and inferior leads (septal hypertrophy)', 'Large QRS voltages meeting LVH criteria', 'Lateral T inversion and ST depression', 'Sometimes giant T inversion in V3–V5 (apical HCM)'],
      pearls: ['Commonest cause of sudden cardiac death in young athletes', 'In ICU: avoid hypovolaemia, tachycardia and inotropes if LVOT obstruction; use fluids, phenylephrine and beta-blockers', 'AF is poorly tolerated: early cardioversion'],
      ddx: ['LVH from hypertension', 'Old MI (wide Q waves)', 'Athlete\'s heart'],
      act: 'Echo for septal thickness and LVOT gradient; in shock with LVOT obstruction give fluids and a pure vasoconstrictor, stop inotropes.'
    });
  })();

  /* ================= SIMULATOR CONTROLS ================= */
  /* serum-K model shared by the three hyperkalaemia entries */
  const PEAK_T = { I: .45, II: .8, III: .35, aVF: .65, aVL: .1, aVR: -.5, V1: .35, V2: 1.3, V3: 1.45, V4: 1.3, V5: 1.0, V6: .7 };
  function hyperKMorph(K) {
    const w = cl((K - 6.8) / 2.2, 0, 1), tp = cl((K - 5.2) / 1.3, 0, 1.15), pf = cl((K - 6.3) / 1.9, 0, 1);
    const m = baseMorph({ qrsD: .09 + .085 * w, pd: .09 + .03 * pf });
    const pk = L(PEAK_T);
    for (let i = 0; i < 12; i++) {
      m.t[i] = m.t[i] + (pk[i] - m.t[i]) * tp;
      m.p[i] *= 1 - pf;
      m.r[i] *= 1 - .25 * w; m.s[i] *= 1 + .15 * w;
    }
    m.tw = 1 - .22 * Math.min(tp, 1); m.tsym = tp > .45;
    return m;
  }
  function hyperKBuild(c) {
    const K = c.ctl.sev;
    if (K >= 9) return { custom: (leads, R, G) => G.addSine(leads, c.ctl.rate / 60, .8) };
    const pr = .16 + .14 * cl((K - 6.3) / 2, 0, 1);
    return { beats: reg(c.e.rate.def, .5, pr, c.R, .02) };
  }
  const KSEV = (d) => ({ generic: false, label: 'Serum K⁺', unit: 'mmol/L', min: 5, max: 10, step: .1, def: d });
  [['hyperk-mild', 75, 6.2], ['hyperk-mod', 58, 7.6], ['hyperk-sev', 57, 9.3]].forEach(([id, r, k]) => {
    const e = LIB.find(x => x.id === id);
    e.morphs = c => ({ main: hyperKMorph(c.sev) }); e.build = hyperKBuild;
    e.rate = { min: 35, max: 130, def: r }; e.sev = KSEV(k);
    e.live = c => { const K = c.sev, w = cl((K - 6.8) / 2.2, 0, 1); return { pr: K >= 8.2 ? '–' : Math.round(160 + 140 * cl((K - 6.3) / 2, 0, 1)) + ' ms', qrs: K >= 9 ? 'merged' : Math.round(90 + 85 * w) + ' ms', qtc: K < 8 ? '380 ms' : '–', axis: K >= 9 ? '–' : '+60°' }; };
  });

  const RATE = {
    nsr: [40, 160, 75], 'sinus-brady': [30, 59, 42], 'sinus-tachy': [100, 180, 128], pvc: [50, 130, 78], 'pvc-bigeminy': [50, 130, 78],
    junctional: [35, 110, 48], af: [50, 190, 100], svt: [140, 250, 188], aivr: [45, 120, 72], vt: [120, 260, 180], pea: [20, 100, 34],
    av1: [40, 130, 70], rbbb: [40, 160, 78], lbbb: [40, 160, 80], lafb: [40, 160, 75],
    'stemi-ant': [40, 150, 85], 'stemi-inf': [30, 130, 58], 'stemi-lat': [40, 150, 80], 'stemi-post': [40, 150, 80],
    'wellens-b': [40, 140, 70], 'wellens-a': [40, 140, 70], 'diffuse-st': [50, 170, 95], pericarditis: [50, 150, 96],
    hypok: [40, 150, 82], hypoca: [40, 150, 76], hyperca: [40, 150, 76], longqt: [35, 120, 58], digoxin: [40, 150, 72],
    hypothermia: [28, 80, 44], wpw: [40, 150, 78], brugada: [40, 150, 70], pe: [60, 170, 116], lvh: [40, 150, 76], 'paced-v': [40, 130, 70],
    'mobitz1': [60, 140, 97, 'Atrial rate'], 'stemi-rv': [35, 110, 56], 'old-mi': [45, 130, 72], 'lv-aneurysm': [45, 130, 76], takotsubo: [60, 140, 96], nsvt: [55, 110, 80], trigeminy: [55, 110, 78], avrt: [150, 250, 200], 'atrial-tach': [120, 220, 160], 'early-repol': [45, 110, 62], 'lead-reversal': [50, 120, 75], copd: [60, 140, 98], rvh: [55, 130, 88], hcm: [45, 120, 70], mat: [100, 170, 120], 'af-wpw': [150, 300, 220], 'pace-capture': [50, 100, 70, 'Pacing rate'], 'pace-sense': [50, 120, 78, 'Native rate'], effusion: [80, 150, 110], tca: [90, 160, 122], 'cerebral-t': [35, 90, 48], 'de-winter': [50, 130, 82], hyperacute: [50, 130, 80], 'lbbb-mi': [50, 140, 84], bifascicular: [40, 150, 76], 'high-grade': [60, 140, 90, 'Atrial rate'], 'vent-escape': [15, 45, 32], 'sinus-pause': [50, 110, 72], 'artefact-tremor': [50, 140, 80], 'artefact-lead': [50, 140, 75], mobitz2: [55, 130, 86, 'Atrial rate'], av2to1: [60, 140, 97, 'Atrial rate'], chb: [20, 60, 36, 'Ventricular rate']
  };
  Object.keys(RATE).forEach(id => { const r = RATE[id], e = LIB.find(x => x.id === id); if (e && !e.rate) e.rate = { min: r[0], max: r[1], def: r[2], label: r[3] || 'Heart rate' }; });
  LIB.find(x => x.id === 'chb').atr = { min: 50, max: 150, def: 84, label: 'Atrial rate' };
  LIB.find(x => x.id === 'flutter-2to1').atr = { min: 240, max: 340, def: 300, label: 'Flutter rate' };
  LIB.find(x => x.id === 'flutter-4to1').atr = { min: 240, max: 340, def: 300, label: 'Flutter rate' };

  const SEV = {
    'stemi-ant': 'ST elevation', 'stemi-inf': 'ST elevation', 'stemi-lat': 'ST elevation', 'stemi-post': 'ST depression V1–V3',
    'wellens-b': 'Severity', 'wellens-a': 'Severity', 'diffuse-st': 'ST shift', pericarditis: 'Severity',
    hypok: 'K⁺ depletion', hypoca: 'Ca²⁺ depletion', hyperca: 'Ca²⁺ excess', longqt: 'QT prolongation', digoxin: 'Digoxin effect',
    hypothermia: 'Cooling', 'stemi-rv': 'ST elevation', takotsubo: 'ST elevation', 'early-repol': 'Severity', hcm: 'Hypertrophy', tca: 'Sodium-channel block', 'cerebral-t': 'Severity', 'de-winter': 'Severity', hyperacute: 'Severity', wpw: 'Pre-excitation', brugada: 'Brugada pattern', pe: 'RV strain', lvh: 'Hypertrophy / strain',
    rbbb: 'Degree of block', lbbb: 'Degree of block', lafb: 'Axis shift'
  };
  Object.keys(SEV).forEach(id => { const e = LIB.find(x => x.id === id); e.sev = { min: 0, max: 1.5, def: 1, step: .05, label: SEV[id], generic: true }; });
  { const e = LIB.find(x => x.id === 'vf'); e.sev = { generic: false, unit: 'mV', min: .08, max: 1.8, def: 1.25, step: .02, label: 'Amplitude (fine ↔ coarse)' }; }

  /* index & pre-flight sanity */
  const byId = {}; LIB.forEach(e => { byId[e.id] = e; });
  root.ECGLib = { list: LIB, byId, CATS };
})(typeof window !== 'undefined' ? window : globalThis);
