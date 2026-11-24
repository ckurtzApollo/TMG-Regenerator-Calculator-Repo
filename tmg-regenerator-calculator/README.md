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
npm run build        # writes dist/tmg-regenerator-calculator.html, one self-contained file
```

## Test it

```bash
npm test             # Node 18+, uses the built-in node:test runner
```

The page also has a top-down view of the annular gap: a full view with the radial layers
exaggerated, a true-proportion zoom of the narrowest point, and a displacer-offset slider with an
orbit animation. The displacer, regenerator and housing are labeled, and three area cards
(gas flow area with the regenerator, annular gap without it, regenerator steel cross-section)
highlight each area in both views. It redraws from the same geometry inputs as the loss model.

The tests check the scaling laws (pumping loss ∝ f²·s², leak → s² at high NTU, conduction independent
of stroke), the slot geometry from drawing 0601-1174, and the break-even strokes.

## Project layout

| Path | Purpose |
|---|---|
| `src/model.js` | All physics. Works in the browser (`window.RegenModel`) and in Node (`require`). |
| `src/app.js` | UI: reads inputs, calls the model, draws the SVG chart and results table. |
| `src/storage.js` | Saving, loading, exporting and importing named designs. |
| `src/presets.js` | Design presets for the dropdown. **Edit or add designs here**; the reset button restores the selected design. |
| `src/index.html` | Page markup. |
| `src/styles.css` | Styles, with light and dark themes. |
| `test/model.test.js` | Unit tests for the model. |
| `scripts/build.js` | Inlines CSS and JS into one shareable HTML file in `dist/`. |

## Design presets

The dropdown at the top of the inputs loads a complete design. "Reset to design values" restores
the selected design after you've edited inputs.

| Preset | Conditions | Geometry |
|---|---|---|
| Design 4 (default) | 1.5 bar absolute, 110 Hz, 700 °C, 0.25 mm wire, fins ≥ 0.015 in | Ø151.8 displacer, liner ID Ø152.80, 550 contoured slots 0.470 wide × 0.90 deep → 0.403–0.411 mm fins, 0.54 mm wall |
| Design 4T | same, thicker fins | Ø150.8 displacer, liner ID Ø151.80, 480 contoured slots 0.430 × 1.40 deep → 0.564–0.580 mm fins |
| Design 3 | 1.5 bar absolute, 110 Hz, 700 °C, 0.25 mm wire | Ø151.8 displacer, liner ID Ø152.80, 620 contoured slots 0.470 wide × 0.90 deep → 0.304–0.312 mm fins, R0.15 corners, 0.54 mm wall |
| Design 3P | same, plunge cut | Ø150.8 displacer, liner ID Ø151.60, 780 plunged slots 0.30 × 1.45 deep → 0.311–0.321 mm fins, 0.59 mm wall |
| Design 2 | 1.5 bar absolute, 110 Hz, 700 °C | Ø151.8 displacer (2 mm gap), liner ID Ø152.80, 620 slots 0.479 wide × 0.90 deep → 0.295–0.304 mm fins, 0.54 mm wall |
| Design 1 | 1 atm, 98 Hz, 700 °C | Drawing 0601-1174: Ø149.8 displacer (3 mm gap), liner ID Ø150.8, 350 slots 0.7095 wide × 1.10 deep → 0.644–0.664 mm fins, measured steel 905.77 mm² |

## Page layout

On a wide screen the inputs sit in a left sidebar that scrolls on its own, so the results stay in
view while you edit. The stroke slider, gas switch and verdict sit across the top, followed by two
dashboard rows:

| Row | Columns |
|---|---|
| Top | Loss chart (heat loss, pumping loss, electrical output or efficiency vs. stroke) with the loss table · Top-down gap view · Engine performance |
| Second | Resulting fins · EDM detail · Helium vs. air |

Columns wrap to two, then one, on narrower screens. Charts and drawings redraw when their column
width changes so their text stays readable.

## Finned regenerator or no regenerator

The **Engine** buttons in the top bar switch the page between the finned regenerator and the engine
with no regenerator: the plain annular gap between the baseline displacer (Dd0) and the housing,
named by its actual size (for example "1.00 mm gap, no regenerator"). In the no-regenerator view the
verdict, performance cards, gap drawing and dead-volume plot show the plain-gap engine, and the cards
compare it with the finned regenerator. The plain gap still regenerates a little against the
displacer and housing walls; the model includes that.

## Output power vs. dead volume

This plot sweeps one part at a time and plots electrical output against the engine's total gas volume
at mid-stroke:

- **Other engine components**: gas volume added or removed elsewhere (cavities, ports, spring space).
- **Regenerator slot depth** (finned view): deeper slots hold more gas but also change pumping loss
  and regeneration.
- **Displacer diameter**: changes the annular gap volume and the swept volume; at small gaps the
  pumping loss dominates.

The filled dot is the current design; the open dot is the other configuration. Power falls with dead
volume because it raises V_eff in Chapter 6's ideal-power equation. Results depend on Vm, Vh and V0,
which default to 25 W TMG placeholders.

## Engine performance comparison

The "Engine performance" panel compares the finned liner with today's 1 mm gap at the same operating
point and stroke: electrical output, efficiency (heat to electricity), heat input and heat per watt,
with a full power and heat breakdown. The chart can also plot electrical output and efficiency
against stroke.

| Quantity | Equation |
|---|---|
| Ideal power (Chapter 6) | P_ideal = p·ω·V0·Ve·sinθ / (8·Veff) · (Th − Tc)/Th, Veff = Vm − Vh·F (+ liner gas × (1 − F/2)) |
| Electrical output | P_elec = η_alt·(P_ideal − P_flow − k_other·P_ideal) |
| Heat input | Q_in = P_ideal·Th/(Th − Tc) + Q_regen + Q_cond + Q_other |
| Efficiency | η = P_elec / Q_in |

Engine inputs (diaphragm swept volume V0, phase θ, other mechanical losses, alternator efficiency,
other heat leaks) default to 25 W Harwell TMG values. The results depend strongly on V0: replace it
with your engine's value.

## Helium or air

The **Helium / Air** buttons under the stroke slider switch the working gas for every result on the page.
A "Helium vs. air" table in the performance panel shows both gases side by side for both designs.
Chapter 6's ideal power doesn't depend on the gas, so the differences come from the regenerator: air's
thermal diffusivity is about 8 times lower than helium's at the same pressure, so passages sized for
helium regenerate much worse in air. Cavity heat-transfer losses also grow in air; set "Other mechanical
losses in air" above the helium value (the default of 20% is optimistic).

## Saving your own designs

Under the design menu, name the current inputs and select **Save design**. Saved designs appear in
the menu under "Your saved designs"; saving again with the same name updates it, and **Delete saved
design** removes it (select twice to confirm).

Where designs are kept depends on how the page is opened:

| Opened from | Saved designs are kept |
|---|---|
| The published claude.ai artifact | Privately in your Claude account for this calculator (artifact `db`, under your own `data/users/<id>/` path) |
| The git repo or a downloaded HTML file | In that browser's localStorage, on that computer |
| A view with neither | For the session only |

**Export design file** writes the current inputs to a `.json` file; **Import design file** loads one
or more designs from such a file. Use files to move designs between computers or teammates, or commit
them to the repo (for example in a `designs/` folder). To make a design a built-in for everyone, copy
its values into `src/presets.js`.

## Liner inputs follow the wire EDM process

The liner is defined the way it is cut: liner ID (fin tips), liner OD, number of slots, slot width
(constant, parallel sides), slot depth, wire diameter and spark gap. The fins are outputs: because the
slots are parallel-sided, each fin tapers from t = π·D_ID/N − b at the bore to π·D_root/N − b at the
root. The page also reports the wall under the slots, slot pitch, steel areas, the smallest slot and
root radius the wire can make, and the EDM contour length and cut area, and it flags invalid or risky
geometry (overlapping slots, slot narrower than the kerf, fins under the minimum fin thickness input,
which defaults to the shop's 0.015 in = 0.381 mm, and a wall under 0.5 mm).

Two slot cuts are modeled:

- **Contour**: the wire traverses to cut a slot of width b. The two root corners take the radius the
  wire leaves, r = wire/2 + spark gap. Slot area = b·d − (2 − π/2)·r².
- **Plunge**: the wire is fed straight to depth and backed out. The slot is one kerf wide
  (wire + 2·spark gap) with a full-round bottom. Slot area = b·(d − r) + π·r²/2. Much less wire travel.

The EDM detail view draws the slots, the tapered fins and the wire path at true proportions, and can
animate the wire.

To add a design, add an entry to the `presets` array in `src/presets.js` with every input value,
and add a test for it. To change the physics, edit `src/model.js` and add a test.

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
| Annular gap | c = (D_tip − D_d)/2, g_min = c − e, g_max = c + e |
| Fins from EDM slots | D_root = D_ID + 2d, t_fin(D) = πD/N − b, A_fins = π/4·(D_root² − D_ID²) − N·b·d |
| Cross-sectional areas | A_gap = π/4·(D_h² − D_d²) = A_flow + A_regen; A_flow = tip gap + slots + OD clearance |
| Off-center flow factor | Q_off-center / Q_centered = 1 + 1.5·(e/c)² |
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
