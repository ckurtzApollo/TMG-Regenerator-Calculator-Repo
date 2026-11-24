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

  /**
   * Working gases. R gas constant (J/kg·K); cp(T) specific heat (J/kg·K); mu(T) viscosity (Pa·s);
   * k(T) thermal conductivity (W/m·K); T in kelvin. Power-law fits, good to a few percent at 300–900 K.
   */
  const GASES = {
    helium: { name: 'Helium', R: 2077, cp: () => 5193,
      mu: T => 1.99e-5 * Math.pow(T / 300, 0.68), k: T => 0.155 * Math.pow(T / 300, 0.71) },
    air: { name: 'Air', R: 287, cp: T => 1007 + 0.13 * (T - 300),
      mu: T => 1.846e-5 * Math.pow(T / 300, 0.7), k: T => 0.0263 * Math.pow(T / 300, 0.8) },
  };
  function gasProps(gas, T) {
    const gp = GASES[gas] || GASES.helium;
    return { R: gp.R, cp: gp.cp(T), mu: gp.mu(T), k: gp.k(T), name: gp.name };
  }

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

  /**
   * Flow passage made of N identical EDM slots, from the slot shape in finGeometry():
   * per-slot area aMM2 and wetted perimeter pMM (the open face toward the bore excluded),
   * slot width bMM and depth hMM (for the duct aspect ratio).
   */
  function slotSet(N, aMM2, pMM, bMM, hMM) {
    if (!(N > 0 && aMM2 > 0 && pMM > 0 && bMM > 0 && hMM > 0)) return null;
    const a = Math.min(bMM, hMM) / Math.max(bMM, hMM);
    const A1 = aMM2 * 1e-6, P1 = pMM / 1000;
    return {
      name: 'Slots', A: N * A1, dh: 4 * A1 / P1, C: fReRect(a), Nu: nuRect(a), P: N * P1, bMM, hMM,
    };
  }

  /**
   * Fin geometry produced by the EDM slots. Inputs (mm): g.Dt liner ID (fin tips), g.h slot depth
   * (from the bore to the deepest point), g.b slot width, g.N slot count, g.Do liner OD,
   * g.Dd displacer OD, g.LMM length (optional), g.wire wire diameter, g.overcut spark gap per side,
   * g.minFin minimum allowed fin thickness (default 0.25), g.mode 'contour' (wire traverses to cut a slot of width b with radiused root corners) or
   * 'plunge' (wire fed straight to depth: width = kerf = wire + 2·spark gap, full-round bottom).
   */
  function finGeometry(g) {
    const ring = (Do, Di) => Math.PI / 4 * (Do * Do - Di * Di);
    const mode = g.mode === 'plunge' ? 'plunge' : 'contour';
    const wire = g.wire || 0, overcut = g.overcut || 0;
    const kerf = wire + 2 * overcut;                 // narrowest slot the wire can cut
    const rWire = kerf / 2;                          // radius the wire leaves in a corner
    const b = mode === 'plunge' ? kerf : g.b;
    const h = g.h, N = g.N;
    const Dr = g.Dt + 2 * h;                         // diameter at the deepest point of the slot
    // Root shape: plunge = semicircle of radius b/2; contour = two corner radii (at most b/2).
    const rRoot = mode === 'plunge' ? b / 2 : Math.min(rWire, b / 2);
    const cornerArea = mode === 'plunge'
      ? (2 - Math.PI / 2) * rRoot * rRoot            // full round: b·r rectangle minus half circle
      : (2 - Math.PI / 2) * rRoot * rRoot;           // two corners, each (1 − π/4)·r²
    const aSlot = b * h - cornerArea;                 // one slot's cross-section, mm²
    const pSlot = 2 * h + b - 2 * (2 - Math.PI / 2) * rRoot; // walls + bottom, open face excluded
    const tAt = D => Math.PI * D / N - b;            // fin thickness at diameter D
    const Dwall = g.Dt + 2 * (h - rRoot);            // where the straight slot walls end
    const tTip = tAt(g.Dt), tRoot = tAt(Dwall), tMean = (tAt(g.Dt) + tAt(Dr)) / 2;
    const slotArea = N * aSlot;
    const finSteel = ring(Dr, g.Dt) - slotArea;
    const wallSteel = ring(g.Do, Dr);
    const wall = (g.Do - Dr) / 2;
    // Wire travel per slot: contour = down one wall, across, up the other; plunge = straight in.
    const travelSlot = mode === 'plunge' ? Math.max(0, h - rRoot) : 2 * (h - rRoot) + Math.max(0, b - 2 * rRoot) + Math.PI * rRoot;
    const travel = N * travelSlot;
    const warnings = [], errors = [];
    if (tTip <= 0) errors.push('Slots overlap at the bore. Reduce the slot count or width.');
    if (Dr >= g.Do) errors.push('Slots cut through the regenerator OD. Reduce the slot depth.');
    if (g.Dd !== undefined && g.Dt <= g.Dd) errors.push('Regenerator ID is not larger than the displacer.');
    if (h <= rRoot) errors.push('Slot depth must be larger than the root radius.');
    if (!(b > 0)) errors.push(mode === 'plunge' ? 'Enter a wire diameter: a plunged slot is as wide as the kerf.' : 'Enter a slot width.');
    if (mode === 'contour' && wire > 0 && g.b < kerf) warnings.push(`Slot is narrower than the wire kerf (${kerf.toFixed(3)} mm with this wire). Use the plunge cut or a thinner wire.`);
    if (mode === 'contour' && wire > 0 && g.b >= kerf && g.b < 2 * rWire + 1e-9) warnings.push('Slot width equals the kerf, so the bottom is fully round: same as a plunge cut.');
    const minFin = g.minFin > 0 ? g.minFin : 0.25;     // shop minimum fin thickness, mm
    const inch = x => (x / 25.4).toFixed(4) + '"';
    if (tTip > 0 && tTip < minFin) warnings.push(`Fins are ${tTip.toFixed(3)} mm (${inch(tTip)}) thick at the bore, below the ${minFin.toFixed(3)} mm (${inch(minFin)}) minimum: too flimsy to cut straight over the full length.`);
    if (wall > 0 && wall < 0.5) warnings.push('Wall under the slots is below 0.5 mm: high distortion risk during EDM.');
    return {
      mode, minFin, Dr, h, b, N, kerf, rRoot, tTip, tRoot, tMean, wall, aSlot, pSlot,
      pitchDeg: 360 / N, pitchTip: Math.PI * g.Dt / N,
      tipClearance: g.Dd !== undefined ? (g.Dt - g.Dd) / 2 : NaN,
      slotArea, finSteel, wallSteel, steel: finSteel + wallSteel,
      minSlot: kerf, minCornerR: rWire, travel, cutArea: g.LMM ? travel * g.LMM : NaN,
      warnings, errors, valid: errors.length === 0,
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
    const { R, cp, mu, k } = gasProps(op.gas, Tr);      // op.gas: 'helium' (default) or 'air'
    const rho = op.p / (R * Tr);
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
      const NTU = q.Nu * k * q.P * L / (q.dh * rho * phi * Q * cp);
      ineff += phi * 2 / (NTU + 2);
      detail.push({ name: q.name, share: phi, NTU, u: phi * Q / q.A });
    });
    const NTU = 2 / ineff - 2;                          // flow-weighted equivalent NTU
    const Qregen = ineff * (2 / Math.PI) * rho * Q * cp * (Th - Tc);
    const ks = steel304k(op.TcC, op.ThC);
    const Qcond = ks * Math.max(0, steelMM2) * 1e-6 * (Th - Tc) / L;

    return {
      Ve, dp, Pflow, NTU, ineff, Qregen, Qcond, total: Qregen + Qcond, detail, rho, Tr, ks,
      deltaG: Math.sqrt(2 * k / (rho * cp) / w),        // gas thermal penetration depth (m)
    };
  }

  /**
   * Build both designs from geometry g (all mm):
   * { Dh housing bore, Dd0 today's displacer, Dd new displacer, Dt liner ID (fin tips),
   *   h slot depth, b slot width, N slot count, Do liner OD, steelOverride (mm², 0 = compute),
   *   thin housing wall removed behind liner, Vm, Vh (cc) }
   */
  function designs(op, g) {
    const exist = [annulus('1 mm gap', g.Dh, g.Dd0)];
    const fin = finGeometry(g);
    const sl = slotSet(g.N, fin.aSlot, fin.pSlot, fin.b, fin.h);
    const liner = [annulus('Tip clearance', g.Dt, g.Dd), sl, annulus('OD clearance', g.Dh, g.Do)];
    const linerSteelCalc = fin.steel;
    const linerSteel = g.steelOverride > 0 ? g.steelOverride : linerSteelCalc;
    const housingRemoved = Math.PI * g.Dh * g.thin;     // thin-wall approximation, mm²
    const netSteel = linerSteel - housingRemoved;
    const gasOld = Math.PI / 4 * (g.Dh ** 2 - g.Dd0 ** 2) * op.LMM / 1000;              // cc
    const gasNew = (Math.PI / 4 * (g.Dh ** 2 - g.Dd ** 2) - linerSteel) * op.LMM / 1000; // cc
    return { exist, liner, sl, fin, linerSteelCalc, linerSteel, housingRemoved, netSteel, gasOld, gasNew };
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

  /**
   * Lossless TMG cycle, Chapter 6 (Cooke-Yarborough): power = P·ω·V0·Ve·sinθ / (8·Veff) · (Th − Tc)/Th,
   * with Veff = Vm − Vh·(Th − Tc)/Th. Heat taken in by the ideal cycle = the same without the Carnot term.
   * Volumes in cc, pressure in Pa, temperatures in K. Returns W.
   */
  function idealCycle(p, f, V0cc, Vecc, VeffCC, thetaDeg, ThK, TcK) {
    const F = (ThK - TcK) / ThK;
    const Qin = p * 2 * Math.PI * f * (V0cc * 1e-6) * (Vecc * 1e-6) * Math.sin(thetaDeg * Math.PI / 180) / (8 * VeffCC * 1e-6);
    return { P: Qin * F, Qin, F };
  }

  /**
   * Engine performance for today's plain gap and the finned liner at stroke s (mm).
   * Engine inputs on g (defaults are 25 W TMG values): V0 diaphragm swept volume (cc), theta phase (deg),
   * otherLoss other mechanical losses (% of ideal power; otherLossAir used instead when op.gas is air), etaAlt alternator efficiency (%),
   * Qother other heat leaks common to both designs (W).
   * Mechanical: net = ideal − regenerator pumping − other losses; electrical = net × alternator efficiency.
   * Heat input = ideal-cycle heat + regenerator leak + liner steel conduction + other heat leaks.
   */
  function performance(op, g, s) {
    const e = evaluate(op, g, s);
    const Th = op.ThC + 273.15, Tc = op.TcC + 273.15, F = (Th - Tc) / Th;
    const V0 = g.V0 > 0 ? g.V0 : 45, theta = Number.isFinite(g.theta) ? g.theta : 90;
    const otherPct = op.gas === 'air' && Number.isFinite(g.otherLossAir) ? g.otherLossAir : g.otherLoss;
    const kOther = (Number.isFinite(otherPct) ? otherPct : 20) / 100;
    const etaAlt = (g.etaAlt > 0 ? g.etaAlt : 90) / 100;
    const Qo = Number.isFinite(g.Qother) ? g.Qother : 0;
    const VeffBase = g.Vm - g.Vh * F;
    const VeffLiner = VeffBase + e.dV * (1 - F / 2);
    const one = (Ve, Veff, r) => {
      const ic = idealCycle(op.p, op.f, V0, Ve * 1e6, Veff, theta, Th, Tc);
      const Pother = kOther * ic.P;
      const Pnet = ic.P - r.Pflow - Pother;
      const Pelec = Math.max(0, Pnet) * etaAlt;
      const Qin = ic.Qin + r.Qregen + r.Qcond + Qo;
      return { Pideal: ic.P, Pflow: r.Pflow, Pother, Pnet, Pelec, Qideal: ic.Qin, Qregen: r.Qregen, Qcond: r.Qcond,
               Qother: Qo, Qin, eta: Pelec / Qin, heatPerW: Pelec > 0 ? Qin / Pelec : Infinity, Veff };
    };
    return { e, F, base: one(e.a.Ve, VeffBase, e.a), liner: one(e.b.Ve, VeffLiner, e.b) };
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

  /**
   * Radial layer stack from the displacer surface to the housing bore, and the effect of
   * the displacer sitting off center by eMM. All inputs in mm (same geometry object as designs()).
   * Laminar flow in a thin eccentric annulus rises by (1 + 1.5·ε²), with ε = e / c.
   */
  function gapGeometry(g, eMM = 0) {
    const c = (g.Dt - g.Dd) / 2;
    const layers = {
      tipGap: c,
      fins: g.h,
      wall: (g.Do - g.Dt - 2 * g.h) / 2,
      odClearance: (g.Dh - g.Do) / 2,
    };
    const total = (g.Dh - g.Dd) / 2;
    const e = Math.max(0, Math.min(eMM, c));
    const eps = c > 0 ? e / c : 0;
    return {
      c, layers, total, e,
      gMin: c - e, gMax: c + e,
      flowFactor: 1 + 1.5 * eps * eps,
      tipArea: Math.PI / 4 * (g.Dt ** 2 - g.Dd ** 2),
      finPitch: Math.PI * g.Dt / g.N,
      areas: gapAreas(g),
      valid: c > 0 && (g.plain || (layers.fins > 0 && layers.wall > 0 && layers.odClearance >= 0)),
    };
  }

  /**
   * Total gas volume at mid-stroke (cc) for each configuration, from the baseline engine's Vm:
   * plain = Vm (Vm is measured with the plain-gap displacer Dd0); finned = Vm + gas added by the
   * smaller displacer and regenerator passages.
   */
  function totalGasVolume(op, g) {
    const d = designs(op, g);
    return { plain: g.Vm, finned: g.Vm + d.gasNew - d.gasOld };
  }

  /**
   * Cross-sectional areas in the plane of the top view (mm²):
   * emptyGap  = whole annulus between displacer and housing, with no regenerator
   * flow      = gas flow area with the regenerator installed (tip gap + slots + OD clearance)
   * liner     = steel cross-section of the regenerator (wall + fins), from geometry
   * emptyGap = flow + liner.
   */
  function gapAreas(g) {
    const ring = (Do, Di) => Math.PI / 4 * (Do * Do - Di * Di);
    if (g.plain) {                                   // no regenerator: the whole annulus is gas
      const a = ring(g.Dh, g.Dd);
      return { tip: a, slots: 0, od: 0, flow: a, wall: 0, finSteel: 0, liner: 0, emptyGap: a, today: ring(g.Dh, g.Dd0) };
    }
    const fin = finGeometry(g);
    const slots = fin.slotArea, finSteel = fin.finSteel, wall = fin.wallSteel;
    const tip = ring(g.Dt, g.Dd);
    const od = ring(g.Dh, g.Do);
    return {
      tip, slots, od, flow: tip + slots + od,
      wall, finSteel, liner: wall + finSteel,
      emptyGap: ring(g.Dh, g.Dd),
      today: ring(g.Dh, g.Dd0),
    };
  }

  const api = {
    R_HE, CP_HE, heliumProps, GASES, gasProps, fReRect, nuRect, annulus, slotSet, steel304k,
    regen, designs, evaluate, breakEven, gapGeometry, gapAreas, finGeometry, idealCycle, performance, totalGasVolume,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RegenModel = api;
})(typeof self !== 'undefined' ? self : this);
