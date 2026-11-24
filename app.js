// UI for the TMG regenerator stroke trade-off calculator.
// All physics lives in model.js; this file only reads inputs, calls the model and draws results.
// Default input values are the value="" attributes in index.html; the reset button restores them.
'use strict';
const { evaluate, breakEven } = window.RegenModel;

const $ = id => document.getElementById(id);
const ids = ['f','p','ThC','TcC','LMM','Dh','Dd0','Vm','Vh','Dd','N','t','Dt','Dr','Do','steelOverride','thin'];
let metric = 'heat';
function read() {
  const v = {}; ids.forEach(i => v[i] = parseFloat($(i).value));
  const op = { f: v.f, p: v.p, ThC: v.ThC, TcC: v.TcC, LMM: v.LMM };
  const g = { Dh: v.Dh, Dd0: v.Dd0, Dd: v.Dd, Dt: v.Dt, Dr: v.Dr, N: v.N, t: v.t, Do: v.Do,
              steelOverride: v.steelOverride || 0, thin: v.thin || 0, Vm: v.Vm, Vh: v.Vh };
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
  const svg = $('chart'), W = 760, H = 360, m = { l: 58, r: 18, t: 14, b: 44 };
  const xs = [], a = [], b = [], bl = [];
  for (let s = 0.5; s <= 3.0001; s += 0.05) {
    const e = evaluate(op, g, s); xs.push(s);
    if (metric === 'heat') { a.push(e.a.total); b.push(e.b.total); bl.push(e.b.Qregen); }
    else { a.push(e.a.Pflow); b.push(e.b.Pflow); }
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
  s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" font-size="13" fill="${C('--muted')}">Displacer stroke, mm (shaded: your 1.0 to 2.2 mm bracket)</text>`;
  s += `<text transform="translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="13" fill="${C('--muted')}">${metric === 'heat' ? 'Heat loss, W' : 'Pumping loss, W'}</text>`;
  s += `<path d="${path(a)}" fill="none" stroke="${C('--cold')}" stroke-width="2.5"/>`;
  s += `<path d="${path(b)}" fill="none" stroke="${C('--hot')}" stroke-width="2.5"/>`;
  if (metric === 'heat') s += `<path d="${path(bl)}" fill="none" stroke="${C('--hot')}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  if (metric === 'heat' && be && be <= 3) {
    const e = evaluate(op, g, be);
    s += `<circle cx="${X(be)}" cy="${Y(e.a.total)}" r="5" fill="${C('--panel')}" stroke="${C('--ink')}" stroke-width="2"/>`;
    s += `<text x="${X(be) - 10}" y="${Y(e.a.total) - 12}" text-anchor="end" font-size="13" fill="${C('--ink')}" paint-order="stroke" stroke="${C('--panel')}" stroke-width="4">Break-even ${be.toFixed(2)} mm</text>`;
  }
  s += `<line x1="${X(sNow)}" x2="${X(sNow)}" y1="${m.t}" y2="${H - m.b}" stroke="${C('--ink')}" stroke-width="1.5" stroke-dasharray="2 3"/>`;
  svg.innerHTML = s;
  $('legend').innerHTML = metric === 'heat'
    ? `<span><i style="background:${C('--cold')}"></i>Today’s 1 mm gap (regenerator leak)</span><span><i style="background:${C('--hot')}"></i>Finned liner, leak + steel conduction</span><span><i style="border-top:2px dashed ${C('--hot')};height:0"></i>Finned liner, leak only</span>`
    : `<span><i style="background:${C('--cold')}"></i>Today’s 1 mm gap</span><span><i style="background:${C('--hot')}"></i>Finned liner</span>`;
  $('chartTitle').textContent = metric === 'heat' ? 'Heat lost hot to cold vs. stroke' : 'Pumping loss (displacer damping) vs. stroke';
}
function niceStep(max) {
  const raw = max / 6, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
function update() {
  const { op, g, s } = read();
  $('sval').innerHTML = s.toFixed(2) + '<span>mm</span>';
  const e = evaluate(op, g, s), d = e.d;
  if (!d.sl || !e.a.Ve || !isFinite(e.b.total)) {
    $('verdict').textContent = 'Check the liner geometry: fin tips must be larger than the displacer, roots larger than tips, and the slot width positive.';
    return;
  }
  const be = breakEven(op, g);
  const diff = e.b.total - e.a.total;
  $('verdict').innerHTML = diff > 0
    ? `At ${s.toFixed(2)} mm, the finned liner loses <b>${fmt(diff, 0)} W more</b> heat than today’s gap: its steel conduction outweighs the leak it saves.`
    : `At ${s.toFixed(2)} mm, the finned liner loses <b>${fmt(-diff, 0)} W less</b> heat than today’s gap: the leak it saves outweighs its steel conduction.`;
  $('beNote').textContent = be
    ? `Break-even stroke: ${be.toFixed(2)} mm at ${fmt(op.ThC, 0)} °C. Below it, keep the plain gap; above it, the liner wins on heat.`
    : 'No break-even between 0.2 and 5 mm with these inputs.';
  $('geomNote').textContent = `Slot width ${fmt(d.sl.bMM, 3)} mm, slot depth ${fmt(d.sl.hMM, 2)} mm. Computed liner steel ${fmt(d.linerSteelCalc, 0)} mm²; net added steel ${fmt(d.netSteel, 0)} mm². Gas penetration depth ${fmt(e.b.deltaG * 1000, 2)} mm.`;
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
    `<tr><td>Pressure swing vs. today (Eq. 6.1)</td><td>100%</td><td>${fmt(e.swing * 100, 1)}%</td><td class="${cls(e.swing >= 1)}">${e.swing >= 1 ? '+' : ''}${fmt((e.swing - 1) * 100, 1)}%</td></tr>` +
    `<tr><td>Liner flow split</td><td colspan="3" style="text-align:left">${sh}</td></tr>`;
  chart(op, g, s, be);
}
ids.concat(['s']).forEach(i => $(i).addEventListener('input', update));
document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { $('ThC').value = b.dataset.th; update(); }));
function setMetric(m) { metric = m; $('mHeat').setAttribute('aria-pressed', m === 'heat'); $('mFlow').setAttribute('aria-pressed', m === 'flow'); update(); }
$('mHeat').addEventListener('click', () => setMetric('heat'));
$('mFlow').addEventListener('click', () => setMetric('flow'));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
$('reset').addEventListener('click', () => {
  ids.concat(['s']).forEach(i => { $(i).value = $(i).defaultValue; });
  setMetric('heat');
  $('resetMsg').textContent = 'Defaults restored';
  setTimeout(() => { $('resetMsg').textContent = ''; }, 2000);
});
update();
