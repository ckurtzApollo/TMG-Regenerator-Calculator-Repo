/**
 * Design presets for the calculator. Each preset sets every input on the page.
 * Add a new design by adding an entry here; the dropdown is built from this list.
 * Works in the browser (window.RegenPresets) and in Node (require('./presets.js')).
 */
(function (root) {
  'use strict';
  const shared = {
    ThC: 700, TcC: 40, LMM: 110.78,        // operating temperatures (°C) and regenerator length (mm)
    Dh: 155.8, Dd0: 153.8, Vm: 180, Vh: 50, // today's engine; Vm, Vh are 25 W TMG placeholders
    Do: 155.673, thin: 0,                  // regenerator OD (clearance fit) and housing thinning (mm)
    s: 1.6, ecc: 0.15,                     // stroke and displacer offset sliders (mm)
    wire: 0.20, overcut: 0.025,            // EDM wire diameter and spark gap per side (mm)
    mode: 'contour',                       // 'contour' (wire traverses to width) or 'plunge' (straight in)
    minFin: 0.381,                         // shop minimum fin thickness: 0.015 in
    V0: 45, theta: 90,                     // diaphragm swept volume (cc) and phase (deg): 25 W TMG placeholders
    otherLoss: 20, etaAlt: 90, Qother: 0,  // other mech. losses (% of ideal), alternator eff. (%), other heat leaks (W)
    otherLossAir: 20,                      // other mech. losses when charged with air (%): likely higher, see README
    gas: 'helium',                         // working gas: 'helium' or 'air'
  };
  const presets = [
    {
      id: 'design4',
      name: 'Design 4: 550 slots, fins ≥ 0.015 in',
      summary: 'Re-optimized for 0.25 mm wire and a 0.015 in (0.381 mm) minimum fin at 1.5 bar absolute and 110 Hz: Ø151.8 displacer, Ø152.80 regenerator ID, 550 contoured slots 0.470 wide × 0.90 deep, leaving 0.403–0.411 mm (0.0159–0.0162 in) fins and a 0.54 mm wall.',
      values: { ...shared, f: 110, p: 150000, Dd: 151.8, Dt: 152.8, N: 550, b: 0.47, h: 0.9, wire: 0.25, overcut: 0.025, mode: 'contour', steelOverride: 0 },
    },
    {
      id: 'design4t',
      name: 'Design 4T: 480 slots, thicker fins',
      summary: 'Thicker-fin alternative for 0.25 mm wire at 1.5 bar and 110 Hz: Ø150.8 displacer (2.5 mm gap), Ø151.80 regenerator ID, 480 contoured slots 0.430 wide × 1.40 deep, leaving 0.564–0.580 mm (0.0222–0.0228 in) fins and a 0.54 mm wall. Scores 2% better on heat but gives about 4% less pressure swing than Design 4.',
      values: { ...shared, f: 110, p: 150000, Dd: 150.8, Dt: 151.8, N: 480, b: 0.43, h: 1.4, wire: 0.25, overcut: 0.025, mode: 'contour', steelOverride: 0 },
    },
    {
      id: 'design3',
      name: 'Design 3: 620 slots, 0.25 mm wire',
      summary: 'Re-optimized for the vendor’s 0.25 mm wire (0.30 mm kerf, R0.15 root corners) at 1.5 bar absolute and 110 Hz: Ø151.8 displacer, Ø152.80 regenerator ID, 620 contoured slots 0.470 wide × 0.90 deep, leaving 0.304–0.312 mm fins and a 0.54 mm wall.',
      values: { ...shared, f: 110, p: 150000, Dd: 151.8, Dt: 152.8, N: 620, b: 0.47, h: 0.9, wire: 0.25, overcut: 0.025, mode: 'contour', steelOverride: 0 },
    },
    {
      id: 'design3p',
      name: 'Design 3P: 780 plunge slots, 0.25 mm wire',
      summary: 'Plunge-cut alternative for the 0.25 mm wire at 1.5 bar and 110 Hz: Ø150.8 displacer, Ø151.60 regenerator ID, 780 plunged slots 0.30 wide × 1.45 deep, leaving 0.311–0.321 mm fins and a 0.59 mm wall. About 25% less wire travel than Design 3, but about twice the pumping loss.',
      values: { ...shared, f: 110, p: 150000, Dd: 150.8, Dt: 151.6, N: 780, b: 0.30, h: 1.45, wire: 0.25, overcut: 0.025, mode: 'plunge', steelOverride: 0 },
    },
    {
      id: 'design2',
      name: 'Design 2: 620 fins, 2 mm gap',
      summary: 'Optimized for 1.5 bar absolute and 110 Hz: Ø151.8 displacer, Ø152.80 regenerator ID, 620 slots 0.479 wide × 0.90 deep, leaving 0.30 mm fins and a 0.54 mm wall.',
      values: { ...shared, f: 110, p: 150000, Dd: 151.8, Dt: 152.8, N: 620, b: 0.479, h: 0.9, steelOverride: 0 },
    },
    {
      id: 'design1',
      name: 'Design 1: 350 fins, 3 mm gap',
      summary: 'Drawing 0601-1174 at today’s 1 atm and 98 Hz: Ø149.8 displacer, Ø150.8 regenerator ID, 350 slots 0.7095 wide × 1.10 deep (equal to the drawn 0.654 mm fins), 1.34 mm wall, measured steel 905.77 mm².',
      values: { ...shared, f: 98, p: 101325, Dd: 149.8, Dt: 150.8, N: 350, b: 0.7095, h: 1.1, steelOverride: 905.77 },
    },
  ];
  const api = { presets, defaultId: 'design4' };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RegenPresets = api;
})(typeof self !== 'undefined' ? self : this);
