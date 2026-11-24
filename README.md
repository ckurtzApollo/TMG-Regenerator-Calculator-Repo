# TMG regenerator stroke trade-off calculator

Compares a TMG (diaphragm free-piston Stirling) engine's existing **plain 1 mm annular gap** with a
**finned 304 stainless regenerator liner** in a 3 mm annular gap, as a function of displacer stroke.

The fins reduce the gas-side regenerator leak, but the liner's steel adds a fixed hot-to-cold
conduction path. The leak grows roughly with stroke², conduction does not depend on stroke, so there
is a **break-even stroke** above which the liner wins.

## Run it

No build step and no dependencies. Open `src/index.html` in a browser, or serve the folder:

```bash
npm run serve        # http://localhost:8080 (uses npx http-server)
```

## Test it

```bash
npm test             # Node 18+, uses the built-in node:test runner
```

The tests check the scaling laws (pumping loss ∝ f²·s², leak → s² at high NTU, conduction independent
of stroke), the slot geometry from drawing 0601-1174, and the break-even strokes.

## Project layout

| Path | Purpose |
|---|---|
| `src/model.js` | All physics. Works in the browser (`window.RegenModel`) and in Node (`require`). |
| `src/app.js` | UI: reads inputs, calls the model, draws the SVG chart and results table. |
| `src/index.html` | Page markup. **Default input values are the `value` attributes here**; the reset button restores them. |
| `src/styles.css` | Styles, with light and dark themes. |
| `test/model.test.js` | Unit tests for the model. |

To change a default (for example, a new displacer diameter), edit the input's `value` in
`src/index.html`. To change the physics, edit `src/model.js` and add a test.

## Model summary

Each design is a set of parallel laminar passages (today: one annulus; liner: tip clearance, slots,
OD clearance). Quasi-steady, sinusoidal flow.

| Quantity | Equation |
|---|---|
| Swept volume, flow amplitude | V_e = (π/4)·D_d²·s, Q̂ = 2πf·V_e/2 |
| Regenerator mean temperature | T_r = (T_h − T_c) / ln(T_h/T_c), ρ = p/(R·T_r) |
| Passage conductance | G_i = 2·A_i·d_h,i² / (C_i·μ·L) |
| Pressure drop, flow share | Δp̂ = Q̂/ΣG, φ_i = G_i/ΣG |
| Pumping loss | P_flow = π·f·Δp̂·V̂ = 2π²·f²·V̂²/ΣG ∝ f²·s² |
| NTU per passage | NTU_i = Nu_i·k_g·P_i·L / (d_h,i·ρ·φ_i·Q̂·c_p) |
| Leak fraction | ε′ = Σ φ_i · 2/(NTU_i + 2) |
| Regenerator leak | Q_regen = ε′·(2/π)·ρ·Q̂·c_p·(T_h − T_c) ≈ c·s² at high NTU |
| Steel conduction | Q_cond = k_s·(A_liner − A_housing removed)·(T_h − T_c)/L |
| Pressure swing (Chapter 6, Eq. 6.1) | Δp_swing ∝ V_e / (V_m − V_h·F), F = (T_h − T_c)/T_h |

Correlations: rectangular-duct f·Re and constant-wall-temperature Nu from Shah & London; annulus
treated as parallel plates (f·Re = 96, Nu = 7.54); helium μ and k as power laws in temperature;
304 conductivity as a linear fit in temperature.

## Assumptions and limits

- Laminar, quasi-steady flow. Check that the Valensi number stays near 1 or below.
- Infinite matrix heat capacity (valid when fins are thicker than ~2× the steel penetration depth).
- Slots treated as closed rectangular ducts.
- Pumping loss and heat loss are reported separately because they cost different things (work vs. heat).
- Regenerator-leak magnitudes are approximate; use the model to compare designs and trends.
  Conduction numbers are reliable. Confirm final designs in Sage.
- `Vm` and `Vh` defaults (180 cc, 50 cc) are placeholders from the 25 W Harwell TMG; replace them
  with measured values for your engine.

## References

- Cooke-Yarborough, E. H., *Free Piston Stirling Engines*, Chapter 6 (TMG design, Eq. 6.1, regenerator losses).
- Shah, R. K. and London, A. L., *Laminar Flow Forced Convection in Ducts* (1978).
