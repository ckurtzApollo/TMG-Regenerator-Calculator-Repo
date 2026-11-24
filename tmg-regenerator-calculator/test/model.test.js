// Run with: npm test   (Node 18+, no dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/model.js');

const geom = {
  Dh: 155.8, Dd0: 153.8, Dd: 149.8, Dt: 150.8, Dr: 153.0, N: 350, t: 0.654,
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
