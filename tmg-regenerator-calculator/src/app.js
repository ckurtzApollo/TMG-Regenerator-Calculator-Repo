// UI for the TMG regenerator stroke trade-off calculator.
// All physics lives in model.js; this file only reads inputs, calls the model and draws results.
// Built-in designs live in presets.js; saved designs are handled by storage.js.
'use strict';
const { evaluate, breakEven, gapGeometry, finGeometry, performance, gasProps, totalGasVolume } = window.RegenModel;
const { presets, defaultId } = window.RegenPresets;
const Store = window.RegenStorage;

const $ = id => document.getElementById(id);
const ids = ['f','p','ThC','TcC','LMM','Dh','Dd0','Vm','Vh','Dd','Dt','Do','N','b','h','wire','overcut','minFin','steelOverride','thin','V0','theta','otherLoss','otherLossAir','etaAlt','Qother'];
let gas = 'helium';                 // working gas, switched with the Helium / Air buttons
let config = 'finned';              // engine shown: 'finned' regenerator or 'plain' gap with no regenerator
// Descriptive names built from the actual geometry (no "today's gap" or "liner").
const plainGapMM = g => (g.Dh - g.Dd0) / 2;
const finGapMM = g => (g.Dh - g.Dd) / 2;
const NAMES = {
  plain: g => `${fmt(plainGapMM(g), 2)} mm gap, no regenerator`,
  plainShort: g => `${fmt(plainGapMM(g), 2)} mm gap`,
  finned: g => `Finned regenerator (${fmt(finGapMM(g), 2)} mm gap)`,
  finnedShort: () => 'Finned regenerator',
};
function setNames(g) {
  document.querySelectorAll('.hA').forEach(th => { th.textContent = NAMES.plainShort(g); });
  document.querySelectorAll('.hB').forEach(th => { th.textContent = th.closest('table.gasCmp') ? 'Finned regen.' : NAMES.finnedShort(); });
  $('cfgPlain').textContent = `No regenerator (${NAMES.plainShort(g)})`;
  $('perfh').textContent = config === 'plain'
    ? `Engine performance: ${NAMES.plain(g)}`
    : `Engine performance: finned regenerator vs. ${NAMES.plainShort(g)}`;
}
let metric = 'heat';
let lastContourB = null;            // slot width to restore when switching back from plunge
function syncCutMode() {
  const plunge = $('cut').value === 'plunge';
  const kerf = (parseFloat($('wire').value) || 0) + 2 * (parseFloat($('overcut').value) || 0);
  $('b').disabled = plunge;
  $('bHint').textContent = plunge ? 'set by the kerf in a plunge cut' : 'constant, parallel sides';
  if (plunge) $('b').value = kerf.toFixed(3);
  $('cutNote').textContent = plunge
    ? 'Wire fed straight to depth: slot = one kerf wide, full-round bottom.'
    : 'Wire traverses to cut the slot width; root corners take the wire radius.';
}
function read() {
  const v = {}; ids.forEach(i => v[i] = parseFloat($(i).value));
  const op = { f: v.f, p: v.p, ThC: v.ThC, TcC: v.TcC, LMM: v.LMM, gas };
  const g = { Dh: v.Dh, Dd0: v.Dd0, Dd: v.Dd, Dt: v.Dt, Do: v.Do, N: Math.round(v.N), b: v.b, h: v.h,
              wire: v.wire || 0, overcut: v.overcut || 0, minFin: v.minFin || 0, LMM: v.LMM, mode: $('cut').value,
              steelOverride: v.steelOverride || 0, thin: v.thin || 0, Vm: v.Vm, Vh: v.Vh,
              V0: v.V0, theta: v.theta, otherLoss: v.otherLoss, otherLossAir: v.otherLossAir, etaAlt: v.etaAlt, Qother: v.Qother };
  g.Dr = g.Dt + 2 * g.h;   // slot root diameter, derived from the EDM inputs
  return { op, g, s: parseFloat($('s').value) };
}
const fmt = (x, d = 1) => (isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
function cls(better) { return better ? 'better' : 'worse'; }
function row(label, a, b, d, lowerIsBetter, unit = '') {
  const ch = b - a, good = lowerIsBetter === null ? null : (lowerIsBetter ? ch < 0 : ch > 0);
  const c = good === null ? '' : ` class="${cls(good)}"`;
  return `<tr><td>${label}</td><td>${fmt(a, d)}${unit}</td><td>${fmt(b, d)}${unit}</td><td${c}>${ch > 0 ? '+' : ''}${fmt(ch, d)}${unit}</td></tr>`;
}
function chart(op, g, sNow, be) {
  const svg = $('chart');
  const W = Math.round(Math.min(900, Math.max(320, svg.clientWidth || 760))), H = Math.round(W * 0.62);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const m = { l: 52, r: 14, t: 14, b: 44 };
  const xs = [], a = [], b = [], bl = [];
  for (let s = 0.5; s <= 3.0001; s += 0.05) {
    const e = evaluate(op, g, s); xs.push(s);
    if (metric === 'heat') { a.push(e.a.total); b.push(e.b.total); bl.push(e.b.Qregen); }
    else if (metric === 'flow') { a.push(e.a.Pflow); b.push(e.b.Pflow); }
    else { const r = performance(op, g, s); if (metric === 'power') { a.push(r.base.Pelec); b.push(r.liner.Pelec); } else { a.push(r.base.eta * 100); b.push(r.liner.eta * 100); } }
  }
  const ymax = Math.max(...a, ...b) * 1.08;
  const X = s => m.l + (s - 0.5) / 2.5 * (W - m.l - m.r);
  const Y = y => H - m.b - y / ymax * (H - m.t - m.b);
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(n).trim();
  const path = arr => arr.map((y, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
  let s = `<rect x="${X(1.0)}" y="${m.t}" width="${X(2.2) - X(1.0)}" height="${H - m.t - m.b}" fill="${C('--band')}"/>`;
  const step = niceStep(ymax);
  for (let y = 0; y <= ymax; y += step) {
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="${C('--rule')}" stroke-width="1"/>`;
    s += `<text x="${m.l - 8}" y="${Y(y) + 4}" text-anchor="end" font-size="12" fill="${C('--muted')}">${Math.round(y)}</text>`;
  }
  for (let x = 0.5; x <= 3.0001; x += 0.5) s += `<text x="${X(x)}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" fill="${C('--muted')}">${x.toFixed(1)}</text>`;
  s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" font-size="13" fill="${C('--muted')}">Displacer stroke, mm (shaded: 1.0 to 2.2 mm bracket)</text>`;
  s += `<text transform="translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="13" fill="${C('--muted')}">${{ heat: 'Heat loss, W', flow: 'Pumping loss, W', power: 'Electrical output, W', eff: 'Efficiency, %' }[metric]}</text>`;
  const wA = config === 'plain' ? 3.5 : 2, wB = config === 'plain' ? 1.5 : 3, oA = config === 'plain' ? 1 : 0.75, oB = config === 'plain' ? 0.55 : 1;
  s += `<path d="${path(a)}" fill="none" stroke="${C('--cold')}" stroke-width="${wA}" opacity="${oA}"/>`;
  s += `<path d="${path(b)}" fill="none" stroke="${C('--hot')}" stroke-width="${wB}" opacity="${oB}"/>`;
  if (metric === 'heat') s += `<path d="${path(bl)}" fill="none" stroke="${C('--hot')}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  if (metric === 'heat' && be && be <= 3) {
    const e = evaluate(op, g, be);
    s += `<circle cx="${X(be)}" cy="${Y(e.a.total)}" r="5" fill="${C('--panel')}" stroke="${C('--ink')}" stroke-width="2"/>`;
    const lft = X(be) < m.l + 140;
    s += `<text x="${X(be) + (lft ? 10 : -10)}" y="${Y(e.a.total) - 12}" text-anchor="${lft ? 'start' : 'end'}" font-size="13" fill="${C('--ink')}" paint-order="stroke" stroke="${C('--panel')}" stroke-width="4">Break-even ${be.toFixed(2)} mm</text>`;
  }
  s += `<line x1="${X(sNow)}" x2="${X(sNow)}" y1="${m.t}" y2="${H - m.b}" stroke="${C('--ink')}" stroke-width="1.5" stroke-dasharray="2 3"/>`;
  svg.innerHTML = s;
  $('legend').innerHTML = metric === 'heat'
    ? `<span><i style="background:${C('--cold')}"></i>${NAMES.plain(g)} (wall regeneration leak)</span><span><i style="background:${C('--hot')}"></i>Finned regenerator, leak + steel conduction</span><span><i style="border-top:2px dashed ${C('--hot')};height:0"></i>Finned regenerator, leak only</span>`
    : `<span><i style="background:${C('--cold')}"></i>${NAMES.plain(g)}</span><span><i style="background:${C('--hot')}"></i>${NAMES.finned(g)}</span>`;
  $('chartTitle').textContent = { heat: 'Heat lost hot to cold vs. stroke', flow: 'Pumping loss (displacer damping) vs. stroke',
    power: 'Electrical output vs. stroke', eff: 'Efficiency, heat to electricity, vs. stroke' }[metric];
}
function niceStep(max) {
  const raw = max / 6, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
function renderFins(g) {
  const f = finGeometry(g);
  const rows = [
    ['Number of fins', fmt(g.N, 0)],
    ['Fin height (slot depth)', fmt(f.h, 3) + ' mm'],
    ['Fin thickness at the bore', `${fmt(f.tTip, 3)} mm (${fmt(f.tTip / 25.4, 4)} in)`],
    ['Fin thickness where the slot walls end', `${fmt(f.tRoot, 3)} mm (${fmt(f.tRoot / 25.4, 4)} in)`],
    ['Slot width × depth', `${fmt(f.b, 3)} × ${fmt(f.h, 3)} mm`],
    ['Slot root radius', `R${fmt(f.rRoot, 3)} ${f.mode === 'plunge' ? '(full round)' : '(two corners)'}`],
    ['Slot root Ø', fmt(f.Dr, 3) + ' mm'],
    ['Wall under the slots', fmt(f.wall, 3) + ' mm'],
    ['Slot pitch', `${fmt(f.pitchDeg, 4)}°, ${fmt(f.pitchTip, 3)} mm at bore`],
    ['Tip clearance to displacer', fmt(f.tipClearance, 3) + ' mm'],
    ['Steel area: fins + wall', `${fmt(f.finSteel, 0)} + ${fmt(f.wallSteel, 0)} = ${fmt(f.steel, 0)} mm²`],
    ['Wire travel × length', `${fmt(f.travel, 0)} mm × ${fmt(g.LMM, 1)} = ${fmt(f.cutArea / 1e3, 0)}k mm²`],
  ];

  $('finOut').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('finWarn').innerHTML = f.errors.map(x => `<li class="err">${x}</li>`).join('') +
                           f.warnings.map(x => `<li class="warn">${x}</li>`).join('');
  return f;
}
function update() {
  const { op, g, s } = read();
  const fin = renderFins(g);
  buildEdm(g, fin);
  if (!fin.valid) {
    $('verdict').textContent = 'The slot geometry isn’t valid yet. See the notes under “Resulting fins from the EDM slots.”';
    $('beNote').textContent = '';
    return;
  }
  $('sval').innerHTML = s.toFixed(2) + '<span>mm</span>';
  const e = evaluate(op, g, s), d = e.d;
  if (!d.sl || !e.a.Ve || !isFinite(e.b.total)) {
    $('verdict').textContent = 'Check the regenerator geometry: the regenerator ID must be larger than the displacer.';
    return;
  }
  const be = breakEven(op, g);
  const diff = e.b.total - e.a.total;
  const gasName = gasProps(gas, 300).name.toLowerCase();
  setNames(g);
  if (config === 'plain') {
    const r = performance(op, g, s);
    $('verdict').innerHTML = `With ${gasName} at ${s.toFixed(2)} mm, the engine with a plain ${NAMES.plainShort(g)} and no regenerator makes <b>${fmt(r.base.Pelec, 1)} W</b> at <b>${fmt(r.base.eta * 100, 1)}%</b> efficiency. The annulus walls still regenerate a little (NTU ${fmt(e.a.NTU, 1)}), leaking ${fmt(e.a.Qregen, 0)} W.`;
  } else {
    $('verdict').innerHTML = diff > 0
      ? `With ${gasName} at ${s.toFixed(2)} mm, the finned regenerator loses <b>${fmt(diff, 0)} W more</b> heat than the plain ${NAMES.plainShort(g)}: its steel conduction outweighs the leak it saves.`
      : `With ${gasName} at ${s.toFixed(2)} mm, the finned regenerator loses <b>${fmt(-diff, 0)} W less</b> heat than the plain ${NAMES.plainShort(g)}: the leak it saves outweighs its steel conduction.`;
  }
  $('beNote').textContent = be
    ? `Break-even stroke: ${be.toFixed(2)} mm at ${fmt(op.ThC, 0)} °C. Below it, the plain ${NAMES.plainShort(g)} loses less heat; above it, the finned regenerator does.`
    : 'No break-even between 0.2 and 5 mm with these inputs.';
  $('geomNote').textContent = `Net added steel ${fmt(d.netSteel, 0)} mm² after any housing thinning. Gas thermal penetration depth ${fmt(e.b.deltaG * 1000, 2)} mm, so the slot width is ${fmt(g.b / (e.b.deltaG * 1000), 2)} of it.`;
  const sh = e.b.detail.map(x => `${x.name} ${Math.round(x.share * 100)}%`).join(', ');
  $('tbody').innerHTML =
    row('Displacer swept volume, cc', e.a.Ve * 1e6, e.b.Ve * 1e6, 1, null) +
    row('Gas volume in the gap, cc', d.gasOld, d.gasNew, 1, true) +
    row('Pressure drop amplitude, Pa', e.a.dp, e.b.dp, 0, true) +
    row('Pumping loss, W', e.a.Pflow, e.b.Pflow, 1, true) +
    row('NTU (flow-weighted)', e.a.NTU, e.b.NTU, 1, false) +
    row('Leak fraction, %', e.a.ineff * 100, e.b.ineff * 100, 1, true) +
    row('Regenerator leak, W', e.a.Qregen, e.b.Qregen, 0, true) +
    row('Added steel conduction, W', 0, e.b.Qcond, 0, true) +
    row('Total heat loss, W', e.a.total, e.b.total, 0, true) +
    `<tr><td>Pressure swing vs. plain gap (Eq. 6.1)</td><td>100%</td><td>${fmt(e.swing * 100, 1)}%</td><td class="${cls(e.swing >= 1)}">${e.swing >= 1 ? '+' : ''}${fmt((e.swing - 1) * 100, 1)}%</td></tr>` +
    `<tr><td>Regenerator flow split</td><td colspan="3" style="text-align:left">${sh}</td></tr>`;
  renderPerformance(op, g, s);
  chart(op, g, s, be);
  buildGap(config === 'plain' ? { ...g, Dd: g.Dd0, Dt: g.Dh, Dr: g.Dh, h: 0, Do: g.Dh, plain: true } : g);
  deadVolumePlot(op, g, s);
}


// ---------- Engine performance: finned regenerator vs. plain gap ----------
function pct(x, base) { return base ? (x / base - 1) * 100 : NaN; }
function signed(x, d = 1, unit = '') { return (x > 0 ? '+' : '') + fmt(x, d) + unit; }
function renderGasCompare(op, g, s) {
  const H = performance({ ...op, gas: 'helium' }, g, s), Ai = performance({ ...op, gas: 'air' }, g, s);
  const cols = [[H.base, H.e.a], [H.liner, H.e.b], [Ai.base, Ai.e.a], [Ai.liner, Ai.e.b]];
  const selHe = gas === 'helium';
  const cell = (x, i) => `<td class="${(i < 2) === selHe ? 'sel' : ''}">${x}</td>`;
  const line = (label, f) => `<tr><td>${label}</td>${cols.map((c, i) => cell(f(c[0], c[1]), i)).join('')}</tr>`;
  $('gasBody').innerHTML =
    line('Electrical output, W', p => fmt(p.Pelec, 1)) +
    line('Efficiency, %', p => fmt(p.eta * 100, 1)) +
    line('Heat input, W', p => fmt(p.Qin, 0)) +
    line('Regenerator NTU', (p, e) => fmt(e.NTU, 1)) +
    line('Regenerator leak, W', p => fmt(p.Qregen, 0)) +
    line('Pumping loss, W', p => fmt(p.Pflow, 1)) +
    line('Gas penetration depth, mm', (p, e) => fmt(e.deltaG * 1000, 2));
  $('thHe').className = selHe ? 'sel' : '';
  $('thAir').className = selHe ? '' : 'sel';
  document.querySelectorAll('table.gasCmp thead tr:nth-child(2) th').forEach((th, i) => { th.className = (i < 2) === selHe ? 'sel' : ''; });
  $('gasNote').textContent = `Shaded columns: the gas selected above. Ideal power is the same for both gases (Chapter 6), so the differences come from the regenerator: air’s thermal diffusivity is about 8 times lower, so the same passages regenerate much worse. Air uses “Other mechanical losses in air” (${fmt(g.otherLossAir, 0)}%), which you should set above the helium value, so the air columns are optimistic.`;
}
function renderPerformance(op, g, s) {
  renderGasCompare(op, g, s);
  const r = performance(op, g, s), A = r.base, B = r.liner;
  // Cards show the selected engine; the second line compares it with the other configuration.
  const X = config === 'plain' ? A : B, Y = config === 'plain' ? B : A;
  const other = config === 'plain' ? 'the finned regenerator' : `the plain ${NAMES.plainShort(g)}`;
  const setCard = (id, val, delta, good) => {
    $(id).textContent = val;
    const d = $(id + 'd'); d.textContent = delta; d.className = 'd ' + (good ? 'better' : 'worse');
  };
  setCard('pcP', `${fmt(X.Pelec, 1)} W`, `${signed(pct(X.Pelec, Y.Pelec), 1, '%')} vs. ${other}`, X.Pelec >= Y.Pelec);
  setCard('pcE', `${fmt(X.eta * 100, 1)}%`, `${signed((X.eta - Y.eta) * 100, 1, ' points')} vs. ${other}`, X.eta >= Y.eta);
  setCard('pcQ', `${fmt(X.Qin, 0)} W`, `${signed(pct(X.Qin, Y.Qin), 1, '%')} vs. ${other}`, X.Qin <= Y.Qin);
  setCard('pcH', `${fmt(X.heatPerW, 1)} W/W`, `${signed(pct(X.heatPerW, Y.heatPerW), 1, '%')} vs. ${other}`, X.heatPerW <= Y.heatPerW);
  document.querySelectorAll('.perfBox table th.hA').forEach(th => th.classList.toggle('sel', config === 'plain'));
  document.querySelectorAll('.perfBox table th.hB').forEach(th => th.classList.toggle('sel', config !== 'plain'));
  const R = (label, a, b, d, lowerIsBetter, unit = '', cls = '') => row(label, a, b, d, lowerIsBetter, unit).replace('<tr>', `<tr class="${cls}">`);
  $('perfBody').innerHTML =
    R('Ideal (lossless) power', A.Pideal, B.Pideal, 1, false) +
    R('− Regenerator pumping', A.Pflow, B.Pflow, 1, true, '', 'sub') +
    R('− Other mech. losses', A.Pother, B.Pother, 1, true, '', 'sub') +
    R('Net mechanical', A.Pnet, B.Pnet, 1, false) +
    R('Electrical output', A.Pelec, B.Pelec, 1, false, '', 'sum') +
    R('Ideal-cycle heat', A.Qideal, B.Qideal, 0, true) +
    R('+ Regenerator leak', A.Qregen, B.Qregen, 0, true, '', 'sub') +
    R('+ Steel conduction', A.Qcond, B.Qcond, 0, true, '', 'sub') +
    R('+ Other heat leaks', A.Qother, B.Qother, 0, null, '', 'sub') +
    R('Total heat input', A.Qin, B.Qin, 0, true, '', 'sum') +
    R('Efficiency, %', A.eta * 100, B.eta * 100, 1, false, '', 'sum') +
    R('Heat per W out, W/W', A.heatPerW, B.heatPerW, 1, true);
  const powerUp = B.Pelec >= A.Pelec, effUp = B.eta >= A.eta;
  $('perfNote').textContent = `${effUp && !powerUp ? 'The finned regenerator needs less heat per watt but gives less power: its pumping loss and the smaller displacer cost more work than they save. ' : ''}${effUp && powerUp ? 'The finned regenerator improves both output and efficiency at this stroke. ' : ''}${!effUp ? 'At this stroke the finned regenerator doesn’t pay off: its steel conduction and pumping loss outweigh the better regeneration. ' : ''}Ideal power uses Chapter 6’s lossless TMG equation with your diaphragm swept volume (${fmt(g.V0, 0)} cc), phase (${fmt(g.theta, 0)}°) and gas volumes, so replace the 25 W TMG placeholders with your engine’s values. Losses outside the regenerator are a fixed ${fmt(gas === 'air' ? g.otherLossAir : g.otherLoss, 0)}% of ideal power for both configurations with ${gas}.`;
}


// ---------- Output power vs. dead volume ----------
// Sweeps one part at a time and plots electrical output against the engine's total gas volume:
//  - other components: add or remove gas volume elsewhere (cavities, ports, displacer spring space)
//  - regenerator: slot depth (deeper slots hold more gas, but also change pumping and regeneration)
//  - displacer: diameter (changes the annular gap volume and the swept volume)
function deadVolumePlot(op, g, s) {
  const svg = $('dvSvg');
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(n).trim();
  const Wd = Math.round(Math.min(900, Math.max(320, svg.clientWidth || 480))), Hd = Math.round(Wd * 0.62);
  svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
  const ring = (Do, Di) => Math.PI / 4 * (Do * Do - Di * Di) * op.LMM / 1000;   // cc of gas in an annulus
  const series = [];
  const plain = config === 'plain';
  const P = gg => { const r = performance(op, gg, s); return plain ? r.base.Pelec : r.liner.Pelec; };
  const V = gg => { const v = totalGasVolume(op, gg); return plain ? v.plain : v.finned; };
  const push = (name, color, pts) => series.push({ name, color, pts: pts.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]) });
  // Other components
  const other = [];
  for (let dv = -0.4 * g.Vm; dv <= 0.8 * g.Vm + 1e-9; dv += g.Vm / 40) { const gg = { ...g, Vm: g.Vm + dv }; other.push([V(gg), P(gg)]); }
  push('Other engine components (cavities, ports)', C('--steel'), other);
  if (plain) {
    // Displacer diameter with the plain gap: Vm follows the annulus volume
    const pts = [];
    for (let c = 0.2; c <= 3.0001; c += 0.05) {
      const Dd0 = g.Dh - 2 * c, gg = { ...g, Dd0, Vm: g.Vm + ring(g.Dh, Dd0) - ring(g.Dh, g.Dd0) };
      pts.push([V(gg), P(gg)]);
    }
    push('Displacer Ø (plain gap 0.2 to 3.0 mm)', C('--cold'), pts);
  } else {
    const fin = finGeometry(g), hMax = (g.Do - g.Dt) / 2 - 0.3, pts = [];
    for (let h = Math.max(fin.rRoot + 0.05, 0.2); h <= hMax + 1e-9; h += 0.05) {
      const gg = { ...g, h }; if (!finGeometry(gg).valid) continue; pts.push([V(gg), P(gg)]);
    }
    push('Regenerator slot depth', C('--hot'), pts);
    const dpts = [];
    for (let c = 0.15; c <= 2.0001; c += 0.05) {
      const gg = { ...g, Dd: g.Dt - 2 * c }; if (!finGeometry(gg).valid) continue; dpts.push([V(gg), P(gg)]);
    }
    push('Displacer Ø (tip clearance 0.15 to 2.0 mm)', C('--cold'), dpts);
  }
  const allPts = series.flatMap(sr => sr.pts);
  if (!allPts.length) { svg.innerHTML = ''; return; }
  const cur = [V(g), P(g)];
  const alt = (() => { const r = performance(op, g, s), v = totalGasVolume(op, g); return plain ? [v.finned, r.liner.Pelec] : [v.plain, r.base.Pelec]; })();
  const xs = allPts.map(p => p[0]).concat([cur[0], alt[0]]), ys = allPts.map(p => p[1]).concat([cur[1], alt[1]]);
  const xmin = Math.min(...xs) * 0.97, xmax = Math.max(...xs) * 1.02, ymax = Math.max(...ys) * 1.1;
  const m = { l: 46, r: 12, t: 12, b: 40 };
  const X = x => m.l + (x - xmin) / (xmax - xmin) * (Wd - m.l - m.r);
  const Y = y => Hd - m.b - Math.max(0, y) / ymax * (Hd - m.t - m.b);
  let out = '';
  const ys0 = niceStep(ymax), xs0 = niceStep(xmax - xmin);
  for (let y = 0; y <= ymax; y += ys0) {
    out += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="${C('--rule')}"/>`;
    out += `<text x="${m.l - 6}" y="${Y(y) + 4}" text-anchor="end" font-size="12" fill="${C('--muted')}">${Math.round(y)}</text>`;
  }
  for (let x = Math.ceil(xmin / xs0) * xs0; x <= xmax; x += xs0) {
    out += `<text x="${X(x)}" y="${Hd - m.b + 16}" text-anchor="middle" font-size="12" fill="${C('--muted')}">${Math.round(x)}</text>`;
  }
  out += `<text x="${(m.l + Wd - m.r) / 2}" y="${Hd - 6}" text-anchor="middle" font-size="12" fill="${C('--muted')}">Total gas volume at mid-stroke, cc</text>`;
  out += `<text transform="translate(13 ${(m.t + Hd - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${C('--muted')}">Electrical output, W</text>`;
  for (const sr of series) {
    if (sr.pts.length < 2) continue;
    out += `<path d="${sr.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${sr.color}" stroke-width="2.5"/>`;
  }
  out += `<circle cx="${X(alt[0])}" cy="${Y(alt[1])}" r="5" fill="${C('--panel')}" stroke="${C('--muted')}" stroke-width="2"/>`;
  out += `<circle cx="${X(cur[0])}" cy="${Y(cur[1])}" r="5.5" fill="${C('--ink')}"/>`;
  svg.innerHTML = out;
  $('dvLegend').innerHTML = series.map(sr => `<span><i style="background:${sr.color}"></i>${sr.name}</span>`).join('') +
    `<span><i style="background:${C('--ink')};height:8px;width:8px;border-radius:50%"></i>This design</span>` +
    `<span><i style="border:2px solid ${C('--muted')};height:8px;width:8px;border-radius:50%;background:none"></i>${plain ? 'Finned regenerator' : NAMES.plain(g)}</span>`;
  // Sensitivity: watts lost per 10 cc added elsewhere, around the current point
  const g1 = { ...g, Vm: g.Vm + 10 }, dP = P(g1) - cur[1];
  $('dvNote').textContent = `At ${s.toFixed(2)} mm stroke with ${gas}: every 10 cc of extra gas volume elsewhere in the engine changes output by ${signed(dP, 1, ' W')} (${signed(cur[1] ? dP / cur[1] * 100 : 0, 1, '%')}). Dead volume raises V_eff in Chapter 6’s ideal power, so the pressure swing and power fall. The regenerator and displacer curves also include their effect on pumping loss and swept volume, so they don’t follow the same line. Vm and Vh are 25 W TMG placeholders until you enter your engine’s values.`;
}

// Fixed-geometry drawings keep their coordinate system; their text is scaled up when the drawing is
// shown narrower than its design width, so labels stay readable in the dashboard columns.
function textScale(svg, designWidth = 680) {
  const w = svg.clientWidth || designWidth;
  return Math.min(2.2, Math.max(1, designWidth / w));
}
// ---------- Top-down gap view ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const gapState = { g: null, phi: 0, playing: false, last: 0, el: {}, hl: null };
function sv(parent, tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}
function buildGap(g) {
  const svg = $('gapSvg');
  svg.innerHTML = '';
  gapState.g = g;
  const gg = gapGeometry(g, 0);
  if (!gg.valid) {
    $('gapNote').textContent = 'Check the regenerator geometry: the diameters must increase from displacer to fin tips, slot roots, regenerator OD and housing bore.';
    gapState.el = {};
    return;
  }
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(n).trim();
  const ks = Math.min(1.6, textScale(svg));
  const role = (e, r) => { e.setAttribute('data-role', r); return e; };
  const txt = (x, y, s, anchor = 'middle', extra = {}) => {
    const t = sv(svg, 'text', Object.assign({ x, y, 'text-anchor': anchor, 'font-size': 12 * ks, fill: C('--muted') }, extra));
    t.textContent = s; return t;
  };
  const leader = (x1, y1, x2, y2) => sv(svg, 'line', { x1, y1, x2, y2, stroke: C('--muted'), 'stroke-width': 0.7, 'stroke-dasharray': '3 2' });
  // ----- Left: full top view, radial layers exaggerated so the gap is visible -----
  const cx = 175, cy = 222, RD = 90, span = 66;
  const rD = g.Dd / 2, K = span / gg.total;
  const rm = rMM => RD + (rMM - rD) * K;
  const rTip = rm(g.Dt / 2), rRoot = rm(g.Dr / 2), rOD = rm(g.Do / 2), rBore = rm(g.Dh / 2), rOut = rBore + 14;
  const exaggeration = K / (RD / rD);
  const ringD = (r1, r2) => `M${cx - r2},${cy}a${r2},${r2} 0 1,0 ${2 * r2},0a${r2},${r2} 0 1,0 ${-2 * r2},0` +
    `M${cx - r1},${cy}a${r1},${r1} 0 1,1 ${2 * r1},0a${r1},${r1} 0 1,1 ${-2 * r1},0`;
  role(sv(svg, 'circle', { cx, cy, r: rBore, fill: C('--gas') }), 'gas');
  role(sv(svg, 'path', { d: ringD(rBore, rOut), 'fill-rule': 'evenodd', fill: C('--housing'), stroke: C('--rule'), 'stroke-width': 0.5 }), 'housing');
  role(sv(svg, 'path', { d: ringD(rRoot, rOD), 'fill-rule': 'evenodd', fill: C('--steelFill'), stroke: C('--rule'), 'stroke-width': 0.5 }), 'regen');
  let fins = '';
  const N = Math.max(1, Math.round(g.N));
  for (let i = 0; i < N; i++) {
    const t = i / N * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    fins += `M${(cx + rTip * c).toFixed(1)},${(cy + rTip * s).toFixed(1)}L${(cx + rRoot * c).toFixed(1)},${(cy + rRoot * s).toFixed(1)}`;
  }
  role(sv(svg, 'path', { d: fins, stroke: C('--steelFill'), 'stroke-width': 1.1, fill: 'none' }), 'regen');
  role(sv(svg, 'path', { d: ringD(RD, rBore), 'fill-rule': 'evenodd', fill: C('--flowHi'), opacity: 0.6 }), 'gapOverlay');
  const disp = role(sv(svg, 'circle', { cx, cy, r: RD, fill: C('--disp'), stroke: C('--dispEdge'), 'stroke-width': 0.8 }), 'disp');
  const dispLabel = txt(cx, cy + 5, 'Displacer', 'middle', { 'font-size': 14 * ks, fill: C('--ink') });
  const mark = sv(svg, 'circle', { cx, cy, r: 4.5, fill: C('--hot') });
  // Labels for regenerator and housing, with leaders to their rings.
  const pol = (r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
  const [rx, ry] = pol((rRoot + rOD) / 2, -128);
  if (!g.plain) { txt(14, 26, 'Finned regenerator', 'start', { fill: C('--ink') }); leader(60, 32, rx, ry); }
  else txt(14, 26, 'No regenerator', 'start', { fill: C('--ink') });
  const [hx, hy] = pol((rBore + rOut) / 2, -52);
  txt(340, 26, 'Housing', 'end', { fill: C('--ink') });
  leader(318, 32, hx, hy);
  txt(cx, 404, `Full view, radial layers ×${Math.round(exaggeration)}`);
  // ----- Right: true-proportion strip from the displacer face to the housing -----
  const x0 = 395, x1 = 668, top = 62, H = 236;
  const S = (x1 - x0 - 30) / gg.total;
  const X = r => x0 + 15 + r * S;
  const clip = sv(sv(svg, 'defs', {}), 'clipPath', { id: 'gapClip' });
  sv(clip, 'rect', { x: x0, y: top, width: x1 - x0, height: H });
  const strip = sv(svg, 'g', { 'clip-path': 'url(#gapClip)' });
  role(sv(strip, 'rect', { x: x0, y: top, width: x1 - x0, height: H, fill: C('--gas') }), 'gas');
  const L = gg.layers, rFinIn = L.tipGap, rFinOut = rFinIn + L.fins, rWallOut = rFinOut + L.wall;
  const pitch = gg.finPitch * S, fw = Math.max(0, Math.PI * g.Dt / g.N - g.b) * S;  // fin thickness at the bore
  for (let y = top - pitch / 2; y < top + H; y += pitch) {
    role(sv(strip, 'rect', { x: X(rFinIn), y, width: X(rFinOut) - X(rFinIn), height: fw, fill: C('--steelFill'), stroke: C('--rule'), 'stroke-width': 0.5 }), 'regen');
  }
  role(sv(strip, 'rect', { x: X(rFinOut), y: top, width: X(rWallOut) - X(rFinOut), height: H, fill: C('--steelFill'), stroke: C('--rule'), 'stroke-width': 0.5 }), 'regen');
  role(sv(strip, 'rect', { x: X(gg.total), y: top, width: x1 - X(gg.total), height: H, fill: C('--housing'), stroke: C('--rule'), 'stroke-width': 0.5 }), 'housing');
  role(sv(strip, 'rect', { x: X(0), y: top, width: X(gg.total) - X(0), height: H, fill: C('--flowHi'), opacity: 0.6 }), 'gapOverlay');
  const stripDisp = role(sv(strip, 'rect', { x: x0, y: top, width: X(0) - x0, height: H, fill: C('--disp'), stroke: C('--dispEdge'), 'stroke-width': 0.8 }), 'disp');
  sv(svg, 'rect', { x: x0, y: top, width: x1 - x0, height: H, fill: 'none', stroke: C('--rule'), 'stroke-width': 1 });
  // Column labels above the strip.
  txt(x0, top - 22, 'Displacer', 'start', { fill: C('--ink') });
  leader(x0 + 8, top - 16, x0 + 8, top - 2);
  if (!g.plain) {
    txt((X(rFinIn) + X(rWallOut)) / 2, top - 44, 'Regenerator', 'middle', { fill: C('--ink') });
    leader((X(rFinIn) + X(rWallOut)) / 2, top - 38, (X(rFinIn) + X(rWallOut)) / 2, top - 2);
  }
  txt(x1, top - 22, 'Housing', 'end', { fill: C('--ink') });
  leader((X(gg.total) + x1) / 2, top - 16, (X(gg.total) + x1) / 2, top - 2);
  // Dimension ticks and labels under the strip.
  [rFinIn, rFinOut, rWallOut, gg.total].forEach(r => sv(svg, 'line', { x1: X(r), x2: X(r), y1: top + H + 2, y2: top + H + 14, stroke: C('--muted'), 'stroke-width': 0.7 }));
  const tick0 = sv(svg, 'line', { x1: X(0), x2: X(0), y1: top + H + 2, y2: top + H + 14, stroke: C('--muted'), 'stroke-width': 0.7 });
  const gapLabel = txt(x0 + 2, top + H + 30, '', 'start');
  if (!g.plain) {
    txt((X(rFinIn) + X(rFinOut)) / 2, top + H + 50, `Fins ${fmt(L.fins, 2)}`);
    txt((X(rFinOut) + X(rWallOut)) / 2, top + H + 30, `Wall ${fmt(L.wall, 2)}`);
    txt(x1, top + H + 70, `OD clr ${fmt(L.odClearance, 3)}`, 'end');
  }
  txt((x0 + x1) / 2, top + H + 92, 'Narrowest point, true scale (mm)');
  gapState.el = { disp, dispLabel, mark, stripDisp, tick0, gapLabel, left: { cx, cy, RD, K, rTip }, strip: { X, x0 } };
  // Text summaries and area cards.
  $('gapNote').textContent = g.plain
    ? `No regenerator. Gap c = (${fmt(g.Dh, 3)} − ${fmt(g.Dd, 3)})/2 = ${fmt(gg.c, 3)} mm between the displacer and the housing bore.`
    : `Gap c = (${fmt(g.Dt, 3)} − ${fmt(g.Dd, 3)})/2 = ${fmt(gg.c, 3)} mm. Displacer to housing: (${fmt(g.Dh, 3)} − ${fmt(g.Dd, 3)})/2 = ${fmt(gg.total, 3)} mm = ${fmt(L.tipGap, 3)} gap + ${fmt(L.fins, 3)} fins + ${fmt(L.wall, 4)} wall + ${fmt(L.odClearance, 4)} clearance.`;
  const A = gg.areas;
  $('aFlow').textContent = fmt(A.flow, 1) + ' mm²';
  document.querySelector('.areaCard[data-hl=flow] .l').textContent = g.plain ? 'Gas flow area, plain gap' : 'Gas flow area with regenerator';
  $('aFlowD').textContent = g.plain
    ? `Whole annulus between displacer and housing.`
    : `Tip gap ${fmt(A.tip, 1)} + slots ${fmt(A.slots, 1)} + OD clearance ${fmt(A.od, 1)}. Plain ${fmt(plainGapMM(g), 2)} mm gap: ${fmt(A.today, 1)}.`;
  $('aGap').textContent = fmt(A.emptyGap, 1) + ' mm²';
  $('aGapD').textContent = `π/4 × (${fmt(g.Dh, 3)}² − ${fmt(g.Dd, 3)}²)`;
  $('aSteel').textContent = fmt(A.liner, 1) + ' mm²';
  $('aSteelD').textContent = g.plain ? 'No regenerator installed.' : `Wall ${fmt(A.wall, 1)} + fins ${fmt(A.finSteel, 1)}` + (g.steelOverride > 0 ? `. Model uses your measured ${fmt(g.steelOverride, 1)}.` : '.');
  svg.setAttribute('class', gapState.hl ? 'hl-' + gapState.hl : '');
  $('gNom').textContent = fmt(gg.c, 2) + ' mm';
  const ecc = $('ecc');
  ecc.max = Math.max(0.01, gg.c).toFixed(2);
  if (parseFloat(ecc.value) > gg.c) ecc.value = gg.c.toFixed(2);
  drawGap();
}
function drawGap() {
  const { g, el } = gapState;
  if (!g || !el.disp) return;
  const gg = gapGeometry(g, parseFloat($('ecc').value));
  const { cx, cy, RD, K, rTip } = el.left;
  const ox = gg.e * K * Math.cos(gapState.phi), oy = gg.e * K * Math.sin(gapState.phi);
  el.disp.setAttribute('cx', (cx + ox).toFixed(2));
  el.disp.setAttribute('cy', (cy + oy).toFixed(2));
  el.dispLabel.setAttribute('x', (cx + ox).toFixed(2));
  el.dispLabel.setAttribute('y', (cy + oy + 5).toFixed(2));
  const rr = (rTip + RD + gg.e * K) / 2;
  el.mark.setAttribute('cx', (cx + Math.cos(gapState.phi) * rr).toFixed(2));
  el.mark.setAttribute('cy', (cy + Math.sin(gapState.phi) * rr).toFixed(2));
  el.mark.setAttribute('opacity', gg.e > 0.005 ? 1 : 0);
  const X = el.strip.X;
  el.stripDisp.setAttribute('width', Math.max(0, X(gg.e) - el.strip.x0).toFixed(2));
  el.tick0.setAttribute('x1', X(gg.e)); el.tick0.setAttribute('x2', X(gg.e));
  el.gapLabel.textContent = `Gap ${fmt(gg.gMin, 2)}`;
  $('gMin').textContent = fmt(gg.gMin, 2) + ' mm' + (gg.gMin <= 0.001 ? ' (contact)' : '');
  $('gMax').textContent = fmt(gg.gMax, 2) + ' mm';
  $('gFlow').textContent = '×' + fmt(gg.flowFactor, 2);
  $('eccOut').textContent = fmt(gg.e, 2) + ' mm';
}
function setHighlight(hl) {
  gapState.hl = gapState.hl === hl ? null : hl;
  document.querySelectorAll('.areaCard').forEach(b => b.setAttribute('aria-pressed', b.dataset.hl === gapState.hl));
  $('gapSvg').setAttribute('class', gapState.hl ? 'hl-' + gapState.hl : '');
}
document.querySelectorAll('.areaCard').forEach(b => b.addEventListener('click', () => setHighlight(b.dataset.hl)));
function gapLoop(t) {
  if (!gapState.playing) return;
  if (gapState.last) gapState.phi += (t - gapState.last) / 1000 * 1.6;
  gapState.last = t;
  drawGap();
  requestAnimationFrame(gapLoop);
}
function setPlaying(on) {
  gapState.playing = on;
  gapState.last = 0;
  $('gapPlay').setAttribute('aria-pressed', on);
  $('gapPlay').textContent = on ? 'Pause orbit' : 'Play orbit';
  if (on) requestAnimationFrame(gapLoop);
}
$('ecc').addEventListener('input', drawGap);
$('gapPlay').addEventListener('click', () => setPlaying(!gapState.playing));


// ---------- EDM detail: slots, fins and wire path at true proportions ----------
const edm = { playing: false, t: 0.5, last: 0, el: null };   // t = 0.5: wire at the slot root
function buildEdm(g, f) {
  const svg = $('edmSvg');
  svg.innerHTML = '';
  edm.el = null;
  if (!f.valid) { $('edmNote').textContent = 'Fix the slot geometry to see the EDM detail.'; return; }
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(n).trim();
  const W = 680, top = 18, bot = 292, cx = W / 2;
  const rIn = g.Dd / 2 - 0.3, rOutV = g.Dh / 2 + 0.3;
  const S = (bot - top) / (rOutV - rIn);                     // px per mm, true proportions
  // Local slot frame: u = lateral (mm), v = radius along the slot centerline (mm); slot at angle th.
  const P = (u, v, th) => {
    const X = u * Math.cos(th) + v * Math.sin(th), Y = -u * Math.sin(th) + v * Math.cos(th);
    return [cx + X * S, bot - (Y - rIn) * S];
  };
  const pts = arr => arr.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2)).join('') + 'Z';
  const thMax = (W / 2 / S) / rIn * 1.15;
  const band = (r1, r2, fill, role) => {
    const a = [], n = 60;
    for (let i = 0; i <= n; i++) { const th = -thMax + 2 * thMax * i / n; a.push(P(0, r1, th)); }
    for (let i = n; i >= 0; i--) { const th = -thMax + 2 * thMax * i / n; a.push(P(0, r2, th)); }
    return sv(svg, 'path', { d: pts(a), fill, 'data-role': role });
  };
  sv(svg, 'rect', { x: 0, y: 0, width: W, height: 360, fill: C('--panel') });
  const clip = sv(sv(svg, 'defs', {}), 'clipPath', { id: 'edmClip' });
  sv(clip, 'rect', { x: 0, y: top, width: W, height: bot - top });
  const gEl = sv(svg, 'g', { 'clip-path': 'url(#edmClip)' });
  sv(gEl, 'rect', { x: 0, y: top, width: W, height: bot - top, fill: C('--gas') });
  const bandIn = (r1, r2, fill) => { const e = band(r1, r2, fill); gEl.appendChild(e); return e; };
  bandIn(rIn - 2, g.Dd / 2, C('--disp'));
  bandIn(g.Dt / 2, g.Do / 2, C('--steelFill'));
  bandIn(g.Dh / 2, rOutV + 2, C('--housing'));
  // Slot outline in the local frame (u, v), cut from the bore outward.
  const R = g.Dt / 2, b = f.b, r = f.rRoot, vWall = R + f.h - r, v0 = R - 0.2;
  const slotLocal = () => {
    const a = [[-b / 2, v0], [-b / 2, vWall]];
    const k = 10;
    if (f.mode === 'plunge') {
      for (let i = 1; i < k; i++) { const ph = Math.PI * i / k; a.push([-r * Math.cos(ph), vWall + r * Math.sin(ph)]); }
    } else {
      for (let i = 0; i <= k; i++) { const ph = Math.PI - Math.PI / 2 * i / k; a.push([-b / 2 + r + r * Math.cos(ph), vWall + r * Math.sin(ph)]); }
      for (let i = 0; i <= k; i++) { const ph = Math.PI / 2 - Math.PI / 2 * i / k; a.push([b / 2 - r + r * Math.cos(ph), vWall + r * Math.sin(ph)]); }
    }
    a.push([b / 2, vWall], [b / 2, v0]);
    return a;
  };
  const local = slotLocal();
  const dth = 2 * Math.PI / g.N;
  const K = Math.ceil(thMax / dth) + 1;
  for (let i = -K; i <= K; i++) {
    const th = i * dth;
    sv(gEl, 'path', { d: pts(local.map(([u, v]) => P(u, v, th))), fill: C('--gas'), stroke: i === 0 ? C('--wire') : 'none', 'stroke-width': i === 0 ? 1.2 : 0, 'stroke-dasharray': i === 0 ? '4 3' : '' });
  }
  // Wire centre path for the highlighted slot (i = 0).
  const kr = f.kerf / 2, start = R - 0.45;
  const path = f.mode === 'plunge'
    ? [[0, start], [0, vWall], [0, start]]
    : [[-b / 2 + kr, start], [-b / 2 + kr, vWall], [b / 2 - kr, vWall], [b / 2 - kr, start]];
  sv(gEl, 'path', { d: path.map(([u, v], i) => (i ? 'L' : 'M') + P(u, v, 0).map(n => n.toFixed(2)).join(',')).join(''), fill: 'none', stroke: C('--wire'), 'stroke-width': 1, 'stroke-dasharray': '2 3' });
  const env = sv(gEl, 'circle', { r: kr * S, fill: 'none', stroke: C('--hot'), 'stroke-width': 1, 'stroke-dasharray': '3 2' });
  const wireC = sv(gEl, 'circle', { r: Math.max(1.5, (g.wire / 2) * S), fill: C('--wire'), stroke: C('--ink'), 'stroke-width': 0.6 });
  // Labels: text with a halo so it reads on any band.
  const ks = Math.min(1.7, textScale(svg));
  const label = (x, y, txt, anchor = 'middle', size = 12) => {
    const t = sv(svg, 'text', { x, y, 'text-anchor': anchor, 'font-size': size * ks, fill: C('--ink'), stroke: C('--panel'), 'stroke-width': 3, 'paint-order': 'stroke' });
    t.textContent = txt; return t;
  };
  const leader = (x1, y1, x2, y2) => sv(svg, 'line', { x1, y1, x2, y2, stroke: C('--muted'), 'stroke-width': 0.8 });
  const yOf = rr => bot - (rr - rIn) * S;
  label(14, (yOf(g.Dd / 2) + bot) / 2 + 4, 'Displacer', 'start');
  label(14, (yOf(g.Dd / 2) + yOf(R)) / 2 + 4, `Tip gap ${fmt(f.tipClearance, 3)}`, 'start');
  label(W - 14, (yOf(g.Do / 2) + yOf(f.Dr / 2)) / 2 + 4, `Wall ${fmt(f.wall, 3)}`, 'end');
  label(W - 14, (yOf(g.Dh / 2) + top) / 2 + 4, 'Housing', 'end');
  // Annotation rows under the drawing, with leaders to the features.
  const [sx, sy] = P(0, R, 0);
  label(sx, 312, `Slot ${fmt(b, 3)} wide × ${fmt(f.h, 3)} deep`);
  leader(sx, 300, sx, sy + 2);
  // Fin label on the left, pointing at the fin just left of the highlighted slot.
  const [fx, fy] = P(0, R + 0.02, -dth / 2);
  const finX = Math.max(10, sx - 330);
  label(finX, 334, `Fin ${fmt(f.tTip, 3)} at bore → ${fmt(f.tRoot, 3)} at root`, 'start');
  leader(finX + 60, 323, fx, fy + 2);
  // Root-radius label on the right, pointing at the slot bottom.
  const [rx, ry] = P(f.mode === 'plunge' ? r * 0.7 : b / 2 - r * 0.3, vWall + r * 0.7, 0);
  const rX = Math.min(W - 10, sx + 330);
  label(rX, 334, `Root R${fmt(r, 3)}${f.mode === 'plunge' ? ', full round' : ', two corners'}`, 'end');
  leader(rX - 60, 323, rx, ry);
  // Scale bar: 0.5 mm, inside the displacer band at the lower right
  const sb = 0.5 * S, sy2 = bot - 9;
  sv(svg, 'line', { x1: W - 14 - sb, x2: W - 14, y1: sy2, y2: sy2, stroke: C('--ink'), 'stroke-width': 2 });
  label(W - 20 - sb, sy2 + 4, '0.5 mm', 'end', 11);
  edm.el = { env, wireC, path, P };
  $('edmNote').textContent = `${f.mode === 'plunge' ? 'Plunge cut: the wire is fed straight to depth and backed out, so the slot is one kerf wide.' : 'Contoured cut: the wire runs up one wall, across the root and down the other, leaving corner radii.'} Gold dot: ${fmt(g.wire, 3)} mm wire. Dashed red circle: the ${fmt(f.kerf, 3)} mm kerf it erodes (wire + 2 × ${fmt(g.overcut, 3)} spark gap). Dashed outline: the slot being cut.`;
  drawWire();
}
function drawWire() {
  if (!edm.el) return;
  const { env, wireC, path, P } = edm.el;
  const seg = [], tot = [0];
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    seg.push(l); tot.push(tot[i - 1] + l);
  }
  const L = tot[tot.length - 1] || 1;
  let d = Math.min(edm.t, 0.9999) * L, i = 0;
  while (i < seg.length - 1 && d > tot[i + 1]) i++;
  const k = seg[i] ? (d - tot[i]) / seg[i] : 0;
  const u = path[i][0] + (path[i + 1][0] - path[i][0]) * k, v = path[i][1] + (path[i + 1][1] - path[i][1]) * k;
  const [x, y] = P(u, v, 0);
  for (const c of [env, wireC]) { c.setAttribute('cx', x.toFixed(2)); c.setAttribute('cy', y.toFixed(2)); }
}
function edmLoop(t) {
  if (!edm.playing) return;
  if (edm.last) edm.t = (edm.t + (t - edm.last) / 3200) % 1;
  edm.last = t;
  drawWire();
  requestAnimationFrame(edmLoop);
}
function setEdmPlaying(on) {
  edm.playing = on; edm.last = 0;
  $('edmPlay').setAttribute('aria-pressed', on);
  $('edmPlay').textContent = on ? 'Pause wire' : 'Animate wire';
  if (on) requestAnimationFrame(edmLoop);
}
$('edmPlay').addEventListener('click', () => setEdmPlaying(!edm.playing));

ids.concat(['s']).forEach(i => $(i).addEventListener('input', update));
document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { $('ThC').value = b.dataset.th; update(); }));
function setMetric(m) {
  metric = m;
  [['mHeat', 'heat'], ['mFlow', 'flow'], ['mPow', 'power'], ['mEff', 'eff']].forEach(([id, k]) => $(id).setAttribute('aria-pressed', m === k));
  update();
}
function setGas(name, markDirty = true) {
  gas = name === 'air' ? 'air' : 'helium';
  $('gasHe').setAttribute('aria-pressed', gas === 'helium');
  $('gasAir').setAttribute('aria-pressed', gas === 'air');
  update();
  if (markDirty && typeof setDirty === 'function' && !applying) setDirty(true);
}
$('gasHe').addEventListener('click', () => setGas('helium'));
function setConfig(name) {
  config = name === 'plain' ? 'plain' : 'finned';
  $('cfgFin').setAttribute('aria-pressed', config === 'finned');
  $('cfgPlain').setAttribute('aria-pressed', config === 'plain');
  document.body.classList.toggle('cfg-plain', config === 'plain');
  setPlaying(false);
  update();
}
$('cfgFin').addEventListener('click', () => setConfig('finned'));
$('cfgPlain').addEventListener('click', () => setConfig('plain'));
$('gasAir').addEventListener('click', () => setGas('air'));
$('mPow').addEventListener('click', () => setMetric('power'));
$('mEff').addEventListener('click', () => setMetric('eff'));
$('mHeat').addEventListener('click', () => setMetric('heat'));
$('mFlow').addEventListener('click', () => setMetric('flow'));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
// Redraw when the dashboard columns change width, so drawings and chart text stay sized correctly.
let resizeQueued = false, lastWidth = 0;
new ResizeObserver(entries => {
  const w = Math.round(entries[0].contentRect.width);
  if (w === lastWidth || resizeQueued) return;
  lastWidth = w; resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; update(); });
}).observe(document.querySelector('main'));
// ---------- Designs: built-in presets and saved designs ----------
const MODE_DEFAULT = 'contour';
let store = null, saved = [], current = null, dirty = false, applying = false;
function currentValues() {
  const v = {};
  ids.concat(['s', 'ecc']).forEach(i => { const x = parseFloat($(i).value); if (Number.isFinite(x)) v[i] = x; });
  v.mode = $('cut').value;
  v.gas = gas;
  return v;
}
function describe(v) {
  const bar = v.p ? fmt(v.p / 1e5, 2) + ' bar' : '';
  return `${v.gas === 'air' ? 'Air. ' : ''}${fmt(v.N, 0)} ${v.mode === 'plunge' ? 'plunged' : 'contoured'} slots ${fmt(v.b, 3)} × ${fmt(v.h, 2)} mm, regenerator ID Ø${fmt(v.Dt, 2)}, displacer Ø${fmt(v.Dd, 2)}, ${bar}, ${fmt(v.f, 0)} Hz.`;
}
function setDirty(on) { dirty = on; $('dirtyNote').hidden = !on; }
function applyValues(values, label) {
  applying = true;
  $('cut').value = values.mode === 'plunge' ? 'plunge' : MODE_DEFAULT;
  gas = values.gas === 'air' ? 'air' : 'helium';
  $('gasHe').setAttribute('aria-pressed', gas === 'helium');
  $('gasAir').setAttribute('aria-pressed', gas === 'air');
  for (const [k, v] of Object.entries(values)) { if (k === 'mode' || k === 'gas') continue; const el = $(k); if (el) el.value = v; }
  lastContourB = values.mode === 'plunge' ? null : values.b;
  syncCutMode();
  setPlaying(false); setEdmPlaying(false);
  gapState.phi = 0; edm.t = 0.5;
  if (gapState.hl) setHighlight(gapState.hl);
  setMetric('heat');            // also calls update(), which rebuilds the views and slider range
  if (values.ecc !== undefined) $('ecc').value = values.ecc;
  drawGap();
  $('presetSummary').textContent = label;
  applying = false;
  setDirty(false);
}
function selectDesign(key) {
  const [kind, id] = key.split(':');
  if (kind === 'saved') {
    const r = saved.find(x => x.id === id);
    if (!r) return selectDesign('preset:' + defaultId);
    current = { kind, id, name: r.name, values: { mode: MODE_DEFAULT, ...r.values } };
    applyValues(current.values, `Saved design. ${describe(current.values)}${r.savedAt ? ' Saved ' + new Date(r.savedAt).toLocaleString() + '.' : ''}`);
  } else {
    const p = presets.find(x => x.id === id) || presets.find(x => x.id === defaultId) || presets[0];
    current = { kind: 'preset', id: p.id, name: p.name, values: p.values };
    applyValues(p.values, p.summary);
  }
  $('preset').value = current.kind + ':' + current.id;
  $('deleteBtn').hidden = current.kind !== 'saved';
}
function rebuildMenu() {
  const sel = $('preset');
  sel.textContent = '';
  const g1 = document.createElement('optgroup'); g1.label = 'Built-in designs';
  presets.forEach(p => { const o = document.createElement('option'); o.value = 'preset:' + p.id; o.textContent = p.name; g1.appendChild(o); });
  sel.appendChild(g1);
  if (saved.length) {
    const g2 = document.createElement('optgroup'); g2.label = 'Your saved designs';
    saved.slice().sort((x, y) => x.name.localeCompare(y.name)).forEach(r => {
      const o = document.createElement('option'); o.value = 'saved:' + r.id; o.textContent = r.name; g2.appendChild(o);
    });
    sel.appendChild(g2);
  }
  if (current) sel.value = current.kind + ':' + current.id;
}
function flash(msg) {
  $('saveMsg').textContent = msg;
  clearTimeout(flash.t); flash.t = setTimeout(() => { $('saveMsg').textContent = ''; }, 4000);
}
async function refreshSaved() {
  try { saved = store ? await store.list() : []; } catch (e) { saved = []; flash('Couldn’t read saved designs. Try again in a moment.'); }
  rebuildMenu();
}
async function saveCurrent() {
  const name = $('saveName').value.trim();
  if (!name) { $('saveErr').textContent = 'Enter a name for the design.'; $('saveName').focus(); return; }
  if (!finGeometry(read().g).valid) { $('saveErr').textContent = 'Fix the slot geometry before saving.'; return; }
  $('saveErr').textContent = '';
  const rec = Store.makeRecord(name, currentValues());
  const existed = saved.some(x => x.id === rec.id);
  try { await store.save(rec); } catch (e) { $('saveErr').textContent = 'Couldn’t save the design. Export a design file instead.'; return; }
  await refreshSaved();
  current = { kind: 'saved', id: rec.id, name: rec.name, values: rec.values };
  $('preset').value = 'saved:' + rec.id;
  $('deleteBtn').hidden = false;
  $('presetSummary').textContent = `Saved design. ${describe(rec.values)}`;
  setDirty(false);
  $('saveName').value = '';
  flash(existed ? `Updated “${rec.name}”.` : `Saved “${rec.name}”.`);
}
async function deleteCurrent() {
  if (!current || current.kind !== 'saved') return;
  const btn = $('deleteBtn');
  if (btn.dataset.confirm !== current.id) {           // two-step: first click arms, second deletes
    btn.dataset.confirm = current.id;
    btn.textContent = `Delete “${current.name}”?`;
    setTimeout(() => { if (btn.dataset.confirm) { delete btn.dataset.confirm; btn.textContent = 'Delete saved design'; } }, 4000);
    return;
  }
  delete btn.dataset.confirm; btn.textContent = 'Delete saved design';
  const name = current.name;
  try { await store.remove(current.id); } catch (e) { flash('Couldn’t delete the design. Try again.'); return; }
  await refreshSaved();
  selectDesign('preset:' + defaultId);
  flash(`Deleted “${name}”.`);
}
async function exportCurrent() {
  const name = (current && current.kind === 'saved' && !dirty) ? current.name : ($('saveName').value.trim() || (current ? current.name + (dirty ? ' (edited)' : '') : 'Regenerator design'));
  const rec = Store.makeRecord(name, currentValues());
  try {
    const status = await Store.saveFile(Store.slugify(name) + '.json', Store.toFile([rec]));
    flash(status === 'declined' ? 'Export cancelled.' : `Exported “${name}”.`);
  } catch (e) { flash('This view can’t save files. Open the calculator in a browser to export.'); }
}
async function importFile(file) {
  if (!file) return;
  try {
    const recs = Store.parseFile(await file.text());
    for (const r of recs) await store.save({ ...r, savedAt: r.savedAt || new Date().toISOString() });
    await refreshSaved();
    selectDesign('saved:' + recs[0].id);
    flash(recs.length === 1 ? `Imported “${recs[0].name}”.` : `Imported ${recs.length} designs.`);
  } catch (e) { flash(e.message || 'Couldn’t import that file.'); }
  $('importFile').value = '';
}
$('preset').addEventListener('change', e => selectDesign(e.target.value));
$('reset').addEventListener('click', () => {
  if (current) selectDesign(current.kind + ':' + current.id);
  $('resetMsg').textContent = 'Design values restored';
  setTimeout(() => { $('resetMsg').textContent = ''; }, 2000);
});
$('saveBtn').addEventListener('click', saveCurrent);
$('saveName').addEventListener('keydown', e => { if (e.key === 'Enter') saveCurrent(); });
$('saveName').addEventListener('input', () => { $('saveErr').textContent = ''; });
$('deleteBtn').addEventListener('click', deleteCurrent);
$('exportBtn').addEventListener('click', exportCurrent);
$('importFile').addEventListener('change', e => importFile(e.target.files[0]));
$('cut').addEventListener('change', () => {
  if ($('cut').value === 'plunge') lastContourB = parseFloat($('b').value);
  else if (lastContourB) $('b').value = lastContourB;
  syncCutMode(); update(); if (!applying) setDirty(true);
});
['wire', 'overcut'].forEach(i => $(i).addEventListener('input', () => { if ($('cut').value === 'plunge') { syncCutMode(); update(); } }));
ids.forEach(i => $(i).addEventListener('input', () => { if (!applying) setDirty(true); }));
// Start on the default built-in design, then add saved designs once the store is ready.
selectDesign('preset:' + defaultId);
Store.createStore().then(async s => {
  store = s;
  $('storeNote').textContent = s.note;
  await refreshSaved();
});
