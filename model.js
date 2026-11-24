/**
 * TMG regenerator stroke trade-off model.
 *
 * Compares a plain annular gap with a finned (slotted) regenerator liner, as parallel
 * laminar passages in quasi-steady oscillating flow. Works in the browser (window.RegenModel)
 * and in Node (require('./model.js')).
 *
 * Units: inputs in mm, °C, Pa, Hz as noted; internal calculations in SI.
 * Intended for comparing designs and trends. Confirm final numbers in Sage.
 */
(function (root) {
  'use strict';

  const R_HE = 2077;   // J/kg·K, helium gas constant
  const CP_HE = 5193;  // J/kg·K, helium specific heat

  /** Helium viscosity (Pa·s) and thermal conductivity (W/m·K) at temperature T (K). */
  function heliumProps(T) {
    return { mu: 1.99e-5 * Math.pow(T / 300, 0.68), k: 0.155 * Math.pow(T / 300, 0.71) };
  }

  /** Laminar Darcy f·Re for a rectangular duct, aspect a = short/long side (Shah & London fit). */
  function fReRect(a) {
    return 96 * (1 - 1.3553 * a + 1.9467 * a ** 2 - 1.7012 * a ** 3 + 0.9564 * a ** 4 - 0.2537 * a ** 5);
  }

  /** Constant-wall-temperature laminar Nusselt number for a rectangular duct (Shah & London table). */
  function nuRect(a) {
    const xs = [0, 0.125, 0.25, 0.5, 1];
    const ys = [7.54, 5.60, 4.44, 3.39, 2.98];
    a = Math.min(1, Math.max(0, a));
    for (let i = 0; i < xs.length - 1; i++) {
      if (a <= xs[i + 1]) {
        const t = (a - xs[i]) / (xs[i + 1] - xs[i]);
        return ys[i] + t * (ys[i + 1] - ys[i]);
      }
    }
    return ys[ys.length - 1];
  }

  /** Thin annular passage between diameters DoMM > DiMM (mm). Returns SI passage or null. */
  function annulus(name, DoMM, DiMM) {
    if (!(DoMM > DiMM)) return null;
    const Do = DoMM / 1000, Di = DiMM / 1000;
    return { name, A: Math.PI / 4 * (Do * Do - Di * Di), dh: Do - Di, C: 96, Nu: 7.54, P: Math.PI * (Do + Di) };
  }

  /** N radial slots between fin-tip diameter DtMM and root diameter DrMM, fins of thickness tMM. */
  function slotSet(N, DtMM, DrMM, tMM) {
    const h = (DrMM - DtMM) / 2;
    const b = Math.PI * (DtMM + DrMM) / (2 * N) - tMM; // slot width at mean diameter
    if (!(h > 0 && b > 0 && N > 0)) return null;
    const a = Math.min(b, h) / Math.max(b, h);
    const hm = h / 1000, bm = b / 1000;
    return {
      name: 'Slots', A: N * bm * hm, dh: 4 * bm * hm / (2 * hm + bm),
      C: fReRect(a), Nu: nuRect(a), P: N * (2 * hm + bm), bMM: b, hMM: h,
    };
  }

  /** Mean conductivity of 304 stainless between two temperatures (°C), W/m·K (linear fit). */
  function steel304k(TcC, ThC) {
    return 14.9 + 0.01325 * (TcC + ThC) / 2;
  }

  /**
   * Core model for one design at one stroke.
   * @param op        { f (Hz), p (Pa), ThC, TcC (°C), LMM (mm) }
   * @param strokeMM  displacer stroke, peak to peak (mm)
   * @param DdMM      displacer diameter (mm)
   * @param passages  array of passages from annulus()/slotSet() (nulls ignored)
   * @param steelMM2  added steel cross-section conducting hot to cold (mm²)
   */
  function regen(op, strokeMM, DdMM, passages, steelMM2) {
    const Th = op.ThC + 273.15, Tc = op.TcC + 273.15, L = op.LMM / 1000;
    const Tr = (Th - Tc) / Math.log(Th / Tc);          // log-mean regenerator temperature
    const rho = op.p / (R_HE * Tr);
    const { mu, k } = heliumProps(Tr);
    const w = 2 * Math.PI * op.f;
    const Ve = Math.PI / 4 * (DdMM / 1000) ** 2 * (strokeMM / 1000); // swept volume
    const Vhat = Ve / 2;                                // volume amplitude
    const Q = w * Vhat;                                 // volume-flow amplitude

    const ps = passages.filter(Boolean);
    const G = ps.map(q => 2 * q.A * q.dh * q.dh / (q.C * mu * L)); // laminar conductance
    const Gt = G.reduce((s, g) => s + g, 0);
    const dp = Q / Gt;                                  // pressure-drop amplitude
    const Pflow = Math.PI * op.f * dp * Vhat;           // pumping loss = 2π² f² V̂² / ΣG

    let ineff = 0;
    const detail = [];
    ps.forEach((q, i) => {
      const phi = G[i] / Gt;
      const NTU = q.Nu * k * q.P * L / (q.dh * rho * phi * Q * CP_HE);
      ineff += phi * 2 / (NTU + 2);
      detail.push({ name: q.name, share: phi, NTU, u: phi * Q / q.A });
    });
    const NTU = 2 / ineff - 2;                          // flow-weighted equivalent NTU
    const Qregen = ineff * (2 / Math.PI) * rho * Q * CP_HE * (Th - Tc);
    const ks = steel304k(op.TcC, op.ThC);
    const Qcond = ks * Math.max(0, steelMM2) * 1e-6 * (Th - Tc) / L;

    return {
      Ve, dp, Pflow, NTU, ineff, Qregen, Qcond, total: Qregen + Qcond, detail, rho, Tr, ks,
      deltaG: Math.sqrt(2 * k / (rho * CP_HE) / w),     // gas thermal penetration depth (m)
    };
  }

  /**
   * Build both designs from geometry g (all mm):
   * { Dh housing bore, Dd0 today's displacer, Dd new displacer, Dt fin tips, Dr slot roots,
   *   N fins, t fin thickness, Do liner OD, steelOverride (mm², 0 = compute),
   *   thin housing wall removed behind liner, Vm, Vh (cc) }
   */
  function designs(op, g) {
    const exist = [annulus('1 mm gap', g.Dh, g.Dd0)];
    const sl = slotSet(g.N, g.Dt, g.Dr, g.t);
    const liner = [annulus('Tip clearance', g.Dt, g.Dd), sl, annulus('OD clearance', g.Dh, g.Do)];
    const hFin = (g.Dr - g.Dt) / 2;
    const linerSteelCalc = Math.PI / 4 * (g.Do ** 2 - g.Dr ** 2) + g.N * g.t * Math.max(0, hFin);
    const linerSteel = g.steelOverride > 0 ? g.steelOverride : linerSteelCalc;
    const housingRemoved = Math.PI * g.Dh * g.thin;     // thin-wall approximation, mm²
    const netSteel = linerSteel - housingRemoved;
    const gasOld = Math.PI / 4 * (g.Dh ** 2 - g.Dd0 ** 2) * op.LMM / 1000;              // cc
    const gasNew = (Math.PI / 4 * (g.Dh ** 2 - g.Dd ** 2) - linerSteel) * op.LMM / 1000; // cc
    return { exist, liner, sl, linerSteelCalc, linerSteel, housingRemoved, netSteel, gasOld, gasNew };
  }

  /** Evaluate both designs at stroke s (mm), plus pressure-swing ratio from Chapter 6 Eq. 6.1. */
  function evaluate(op, g, s) {
    const d = designs(op, g);
    const a = regen(op, s, g.Dd0, d.exist, 0);
    const b = regen(op, s, g.Dd, d.liner, d.netSteel);
    const F = (op.ThC - op.TcC) / (op.ThC + 273.15);
    const V0 = g.Vm - g.Vh * F;
    const dV = d.gasNew - d.gasOld;
    const swing = (b.Ve / a.Ve) * V0 / (V0 + dV * (1 - F / 2));
    return { d, a, b, swing, dV };
  }

  /** Smallest stroke (mm) where the liner's total heat loss drops below the plain gap's, or null. */
  function breakEven(op, g, sMin = 0.2, sMax = 5, step = 0.01) {
    let prev = null;
    for (let s = sMin; s <= sMax + 1e-9; s += step) {
      const e = evaluate(op, g, s);
      const diff = e.b.total - e.a.total;
      if (prev !== null && prev > 0 && diff <= 0) return s;
      prev = diff;
    }
    return null;
  }

  const api = {
    R_HE, CP_HE, heliumProps, fReRect, nuRect, annulus, slotSet, steel304k,
    regen, designs, evaluate, breakEven,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RegenModel = api;
})(typeof self !== 'undefined' ? self : this);
