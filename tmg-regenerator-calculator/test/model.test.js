// Run with: npm test   (Node 18+, no dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/model.js');

const geom = {
  Dh: 155.8, Dd0: 153.8, Dd: 149.8, Dt: 150.8, h: 1.1, b: 0.7095, N: 350,
  Do: 155.673, steelOverride: 905.77, thin: 0, Vm: 180, Vh: 50,
};
const op = (ThC = 700, f = 98) => ({ f, p: 101325, ThC, TcC: 40, LMM: 110.78 });

test('pumping loss scales with stroke squared (laminar)', () => {
  const a = m.evaluate(op(), geom, 1.0), b = m.evaluate(op(), geom, 2.0);
  assert.ok(Math.abs(b.a.Pflow / a.a.Pflow - 4) < 1e-9);
});

test('pumping loss scales with frequency squared', () => {
  const a = m.evaluate(op(700, 50), geom, 1.6), b = m.evaluate(op(700, 100), geom, 1.6);
  assert.ok(Math.abs(b.a.Pflow / a.a.Pflow - 4) < 1e-9);
});

test('regenerator leak approaches stroke squared at high NTU', () => {
  const a = m.evaluate(op(), geom, 1.0), b = m.evaluate(op(), geom, 2.0);
  const r = b.a.Qregen / a.a.Qregen;
  assert.ok(r > 3.5 && r < 4.0, `ratio ${r}`);
});

test('conduction does not depend on stroke', () => {
  const a = m.evaluate(op(), geom, 1.0), b = m.evaluate(op(), geom, 2.2);
  assert.equal(a.b.Qcond, b.b.Qcond);
});

test('slot geometry matches the drawing', () => {
  const d = m.designs(op(), geom);
  assert.ok(Math.abs(d.sl.bMM - 0.709) < 0.001);
  assert.ok(Math.abs(d.sl.hMM - 1.10) < 1e-9);
});

test('break-even strokes match published values', () => {
  assert.ok(Math.abs(m.breakEven(op(700, 98), geom) - 2.29) < 0.015);
  assert.ok(Math.abs(m.breakEven(op(400, 98), geom) - 1.63) < 0.015);
  assert.ok(Math.abs(m.breakEven(op(700, 110), geom) - 2.04) < 0.015);
});

test('thinning the housing lowers the break-even stroke', () => {
  const be0 = m.breakEven(op(), geom), be1 = m.breakEven(op(), { ...geom, thin: 1.0 });
  assert.ok(be1 < be0);
});

test('annular gap stack from the drawing', () => {
  const gg = m.gapGeometry(geom, 0);
  assert.ok(Math.abs(gg.c - 0.5) < 1e-9);
  assert.ok(Math.abs(gg.total - 3.0) < 1e-9);
  const sum = gg.layers.tipGap + gg.layers.fins + gg.layers.wall + gg.layers.odClearance;
  assert.ok(Math.abs(sum - gg.total) < 1e-9);
  assert.ok(Math.abs(gg.tipArea - 236.1) < 0.1);
});

test('eccentric gap: min, max and laminar flow factor', () => {
  const gg = m.gapGeometry(geom, 0.25);
  assert.ok(Math.abs(gg.gMin - 0.25) < 1e-9 && Math.abs(gg.gMax - 0.75) < 1e-9);
  assert.ok(Math.abs(gg.flowFactor - 1.375) < 1e-9);
  assert.equal(m.gapGeometry(geom, 9).gMin, 0); // offset is clamped at contact
});

test('cross-sectional areas: flow + regenerator steel = empty gap', () => {
  const a = m.gapAreas(geom);
  assert.ok(Math.abs(a.flow + a.liner - a.emptyGap) < 1e-6);
  assert.ok(Math.abs(a.emptyGap - 1440.1) < 0.1);
  assert.ok(Math.abs(a.tip - 236.1) < 0.1);
  assert.ok(Math.abs(a.slots - 273.1) < 0.1);
  assert.ok(Math.abs(a.od - 31.1) < 0.1);
  assert.ok(Math.abs(a.liner - 899.8) < 0.1);
  assert.ok(Math.abs(a.today - 486.3) < 0.1);
});

const { presets, defaultId } = require('../src/presets.js');
const fromPreset = id => {
  const v = presets.find(p => p.id === id).values;
  return {
    op: { f: v.f, p: v.p, ThC: v.ThC, TcC: v.TcC, LMM: v.LMM, gas: v.gas },
    g: { Dh: v.Dh, Dd0: v.Dd0, Dd: v.Dd, Dt: v.Dt, h: v.h, b: v.b, N: v.N, Do: v.Do, wire: v.wire, overcut: v.overcut, LMM: v.LMM, mode: v.mode, minFin: v.minFin,
         steelOverride: v.steelOverride, thin: v.thin, Vm: v.Vm, Vh: v.Vh },
  };
};

test('presets: default is design 4 and all designs are present', () => {
  assert.equal(defaultId, 'design4');
  assert.deepEqual(presets.map(p => p.id).sort(), ['design1', 'design2', 'design3', 'design3p', 'design4', 'design4t']);
});

test('design 4: fins meet the 0.015 in minimum with 0.25 mm wire', () => {
  for (const id of ['design4', 'design4t']) {
    const { g } = fromPreset(id);
    const f = m.finGeometry(g);
    assert.ok(f.tTip >= 0.015 * 25.4, `${id} fin ${f.tTip}`);
    assert.equal(f.warnings.length, 0, id);
    assert.ok(Math.abs(f.kerf - 0.30) < 1e-12);
  }
  const d4 = fromPreset('design4'), d4t = fromPreset('design4t');
  assert.ok(Math.abs(m.breakEven(d4.op, d4.g) - 0.77) < 0.015);
  assert.ok(Math.abs(m.breakEven(d4t.op, d4t.g) - 0.87) < 0.015);
});

test('minimum fin thickness: designs 2 and 3 are flagged under 0.015 in', () => {
  for (const id of ['design2', 'design3']) {
    const f = m.finGeometry(fromPreset(id).g);
    assert.ok(f.warnings.some(w => w.includes('minimum')), id);
  }
});

test('design 3 (0.25 mm wire): contoured 620 × 0.470 × 0.90, fins ≥ 0.30, break-even ~0.74 mm', () => {
  const { op: o, g } = fromPreset('design3');
  const f = m.finGeometry(g);
  assert.equal(f.mode, 'contour');
  assert.ok(Math.abs(f.kerf - 0.30) < 1e-12 && Math.abs(f.rRoot - 0.15) < 1e-12);
  assert.ok(f.tTip >= 0.30 && Math.abs(f.tTip - 0.304) < 0.001);
  assert.ok(Math.abs(f.wall - 0.5365) < 1e-4);
  assert.ok(Math.abs(m.breakEven(o, g) - 0.74) < 0.015);
});

test('design 3P (0.25 mm wire): plunged slots are one kerf wide', () => {
  const { op: o, g } = fromPreset('design3p');
  const f = m.finGeometry(g);
  assert.equal(f.mode, 'plunge');
  assert.ok(Math.abs(f.b - 0.30) < 1e-12);
  assert.ok(f.tTip >= 0.30);
  assert.ok(Math.abs(m.breakEven(o, g) - 0.82) < 0.015);
  assert.ok(f.travel < m.finGeometry(fromPreset('design3').g).travel);
});

test('preset break-even strokes match the design study', () => {
  const d1 = fromPreset('design1'), d2 = fromPreset('design2');
  // Presets include the 0.125 mm root corner radii left by a 0.20 mm wire, which trims the slot
  // flow area slightly versus the sharp-cornered fixture above (2.29 mm).
  assert.ok(Math.abs(m.breakEven(d1.op, d1.g) - 2.42) < 0.015);
  assert.ok(Math.abs(m.breakEven(d2.op, d2.g) - 0.73) < 0.015);
});

test('design 2 geometry: 0.5 mm tip gap, 0.90 fins, 0.54 wall, ~433 mm² steel', () => {
  const { op: o, g } = fromPreset('design2');
  const gg = m.gapGeometry(g, 0);
  assert.ok(Math.abs(gg.c - 0.5) < 1e-9);
  assert.ok(Math.abs(gg.layers.fins - 0.9) < 1e-9);
  assert.ok(Math.abs(gg.layers.wall - 0.5365) < 1e-4);
  assert.ok(Math.abs(m.designs(o, g).linerSteelCalc - 433) < 1);
});

test('fins from EDM slots: design 1 matches the drawn 0.654 mm fins', () => {
  const f = m.finGeometry({ ...geom, wire: 0.2, overcut: 0.025 });
  assert.ok(Math.abs(f.Dr - 153.0) < 1e-9);
  assert.ok(Math.abs(f.tMean - 0.654) < 0.001);
  assert.ok(f.tTip < f.tRoot);                       // parallel slots leave tapered fins
  assert.ok(Math.abs(f.wall - 1.3365) < 1e-4);
  assert.ok(Math.abs(f.pitchDeg - 360 / 350) < 1e-12);
  assert.equal(f.errors.length, 0);
});

test('fins from EDM slots: design 2 and manufacturability checks', () => {
  const { g } = fromPreset('design2');
  const f = m.finGeometry(g);
  assert.ok(Math.abs(f.tTip - 0.295) < 0.001 && Math.abs(f.tRoot - 0.304) < 0.001);
  assert.ok(Math.abs(f.minSlot - 0.25) < 1e-9 && Math.abs(f.minCornerR - 0.125) < 1e-9);
  assert.equal(f.errors.length, 0);
  const tooMany = m.finGeometry({ ...g, N: 1100 });
  assert.ok(tooMany.errors.length > 0);              // slots overlap at the bore
  const tooNarrow = m.finGeometry({ ...g, b: 0.2 });
  assert.ok(tooNarrow.warnings.some(w => w.includes('kerf')));
  // Root corners: a 0.20 mm wire with 0.025 mm spark gap leaves R0.125
  assert.ok(Math.abs(f.rRoot - 0.125) < 1e-9);
  assert.ok(Math.abs(f.aSlot - (0.479 * 0.9 - (2 - Math.PI / 2) * 0.125 ** 2)) < 1e-12);
});

test('plunge cut: slot is one kerf wide with a full-round bottom', () => {
  const { g } = fromPreset('design2');
  const f = m.finGeometry({ ...g, mode: 'plunge' });
  assert.ok(Math.abs(f.b - 0.25) < 1e-12);                       // 0.20 wire + 2 × 0.025
  assert.ok(Math.abs(f.rRoot - 0.125) < 1e-12);
  const r = 0.125, expected = 0.25 * (0.9 - r) + Math.PI * r * r / 2; // walls + half circle
  assert.ok(Math.abs(f.aSlot - expected) < 1e-12);
  assert.ok(Math.abs(f.pSlot - (2 * (0.9 - r) + Math.PI * r)) < 1e-12);
  assert.ok(f.travel < m.finGeometry(g).travel);                // straight in is less wire travel
  assert.ok(m.finGeometry({ ...g, mode: 'plunge', h: 0.1 }).errors.length > 0); // deeper than root radius required
});

test('slot area + fin steel = ring between bore and slot root (both cut modes)', () => {
  const { g } = fromPreset('design2');
  for (const mode of ['contour', 'plunge']) {
    const f = m.finGeometry({ ...g, mode });
    const ring = Math.PI / 4 * (f.Dr ** 2 - g.Dt ** 2);
    assert.ok(Math.abs(f.slotArea + f.finSteel - ring) < 1e-9);
  }
});

const S = require('../src/storage.js');
test('design files: round trip, cleaning and bad input', () => {
  const v = { ...presets.find(p => p.id === 'design2').values, mode: 'plunge', junk: 'x', N: '620' };
  const rec = S.makeRecord('  Design 3: 620 plunge  ', v);
  assert.equal(rec.id, 'design-3-620-plunge');
  assert.equal(rec.name, 'Design 3: 620 plunge');
  assert.equal(rec.values.junk, undefined);           // unknown keys dropped
  assert.equal(rec.values.N, 620);                    // numbers coerced
  const back = S.parseFile(S.toFile([rec]));
  assert.equal(back.length, 1);
  assert.deepEqual(back[0].values, rec.values);
  assert.throws(() => S.parseFile('not json'), /valid JSON/);
  assert.throws(() => S.parseFile('{"format":"other"}'), /design file/);
  assert.equal(S.cleanValues({ mode: '<script>' }).mode, undefined);
});

test('ideal cycle reproduces the 25 W TMG lossless power (Chapter 6: 48 W)', () => {
  const Th = 723, Tc = 313, F = (Th - Tc) / Th;
  const ic = m.idealCycle(100000, 110, 45, 33, 180 - 50 * F, 90, Th, Tc);
  assert.ok(Math.abs(ic.P - 48) < 0.6, `P = ${ic.P}`);
});

test('performance: bookkeeping and design 4 beats the plain gap on efficiency', () => {
  const { op: o, g } = fromPreset('design4');
  const perf = m.performance(o, { ...g, V0: 45, theta: 90, otherLoss: 20, etaAlt: 90, Qother: 0 }, 1.6);
  for (const k of ['base', 'liner']) {
    const x = perf[k];
    assert.ok(Math.abs(x.Pnet - (x.Pideal - x.Pflow - x.Pother)) < 1e-9);
    assert.ok(Math.abs(x.Qin - (x.Qideal + x.Qregen + x.Qcond + x.Qother)) < 1e-9);
    assert.ok(Math.abs(x.eta - x.Pelec / x.Qin) < 1e-12);
  }
  assert.equal(perf.base.Qcond, 0);
  assert.ok(perf.liner.eta > perf.base.eta);
  assert.ok(perf.liner.Qin < perf.base.Qin);
});

test('gas properties: air at 300 K', () => {
  const a = m.gasProps('air', 300);
  assert.equal(a.R, 287);
  assert.ok(Math.abs(a.cp - 1007) < 1 && Math.abs(a.mu - 1.846e-5) < 1e-8 && Math.abs(a.k - 0.0263) < 1e-6);
  assert.equal(m.gasProps(undefined, 300).R, 2077);     // helium is the default
});

test('air versus helium: same geometry regenerates far worse in air', () => {
  const { op: o, g } = fromPreset('design4');
  const he = m.evaluate({ ...o, gas: 'helium' }, g, 1.6), air = m.evaluate({ ...o, gas: 'air' }, g, 1.6);
  assert.ok(air.b.NTU < he.b.NTU / 4);                  // ~8× lower thermal diffusivity
  assert.ok(air.b.Qregen > he.b.Qregen);
  assert.ok(air.b.deltaG < he.b.deltaG);
  assert.equal(air.b.Qcond, he.b.Qcond);                // steel conduction doesn't depend on the gas
  const pHe = m.performance({ ...o, gas: 'helium' }, g, 1.6), pAir = m.performance({ ...o, gas: 'air' }, g, 1.6);
  assert.ok(Math.abs(pHe.liner.Pideal - pAir.liner.Pideal) < 1e-9); // Chapter 6 ideal power is gas-independent
  assert.ok(pAir.liner.eta < pHe.liner.eta);
});

test('no-regenerator configuration: plain gap geometry and areas', () => {
  const { g } = fromPreset('design4');
  const plain = { ...g, Dd: g.Dd0, Dt: g.Dh, h: 0, Do: g.Dh, plain: true };
  const gg = m.gapGeometry(plain, 0);
  assert.ok(gg.valid);
  assert.ok(Math.abs(gg.c - 1.0) < 1e-9);
  assert.equal(gg.areas.liner, 0);
  assert.ok(Math.abs(gg.areas.flow - gg.areas.emptyGap) < 1e-9);
});

test('total gas volume: plain = Vm, finned adds the regenerator and smaller-displacer gas', () => {
  const { op: o, g } = fromPreset('design4');
  const v = m.totalGasVolume(o, g);
  assert.equal(v.plain, g.Vm);
  const d = m.designs(o, g);
  assert.ok(Math.abs(v.finned - (g.Vm + d.gasNew - d.gasOld)) < 1e-9);
});
