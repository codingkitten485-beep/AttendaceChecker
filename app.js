/* ============================================================
   app.js — Attendance Analyser
   
   Sections:
     1.  Constants & state
     2.  Particle background
     3.  Entrance animations
     4.  Theme toggle
     5.  Chart colour helpers
     6.  Mini sparkline chart builder
     7.  Confetti burst
     8.  Animated number counter
     9.  Core update() — formulas, chart, insights
     10. setInsight() helper
     11. resetUI()
     12. Input event listeners
   
   ── KEY FORMULAS ──────────────────────────────────────────
   
   Variables:
     x  = lectures attended before the absence streak
     n  = consecutive lectures missed
     k  = lectures attended after coming back
   
   Derived:
     attended = x + k
     total    = x + n + k
     att%     = attended / total * 100
   
   Skip budget (if att >= 75%):
     canSkip  = floor(attended / 0.75 - total)
     Reasoning: you need attended >= 0.75 * total
                so total can grow by attended/0.75 - total
   
   Recovery target (if att < 75%):
     need     = ceil((0.75 * total - attended) / 0.25)
     Reasoning: each lecture you attend adds 1 attended
                and 1 total, net gain = 1 - 0.75 = 0.25 per lecture
   
   Rate of Rise (R):
     R = (n * k) / (total * (x + n)) * 100
     Measures how much your attendance has recovered
     per lecture attended (k), weighted by the severity
     of the absence (n) and normalised to the damage point (x+n).
   
   Rate of Fall (F):
     F = -(n) / (x + n) * 100
     Measures the total attendance drop caused by
     missing n lectures from a base of x attended.
   
   ============================================================ */


/* ── 1. CONSTANTS & STATE ─────────────────────────────────── */

const PROJ = 30;        // how many lectures ahead to project on the chart
let isDark  = true;     // tracks current theme
let prevAtt = -1;       // previous attendance % — used to detect crossing 75%
let mainChart = null;   // Chart.js instance for main trajectory
let miniR     = null;   // Chart.js instance for rise sparkline
let miniF     = null;   // Chart.js instance for fall sparkline


/* ── 2. PARTICLE BACKGROUND ───────────────────────────────── */
/*
   Draws floating geometric shapes (triangles, hexagons, squares, circles)
   and faint connecting lines between nearby shapes.
   Colours shift with the theme toggle.
   To change shape count, edit the loop limit (currently 38).
   To change shape types, edit the `types` array.
*/
(function initParticles() {
  const cv = document.getElementById('pc');
  const cx = cv.getContext('2d');
  let W, H, shapes = [];

  function resize() {
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
  }

  window.addEventListener('resize', () => {
    resize();
    if (mainChart) mainChart.resize();
  });

  resize();

  function rnd(a, b) { return a + Math.random() * (b - a); }

  const types = ['tri', 'hex', 'sq', 'circ'];

  // Spawn 38 shapes with random positions, sizes, rotation speeds, velocities
  for (let i = 0; i < 38; i++) {
    shapes.push({
      t:   types[i % 4],
      x:   rnd(0, W),
      y:   rnd(0, H),
      s:   rnd(8, 22),          // size
      rot: rnd(0, Math.PI * 2), // initial rotation
      rs:  rnd(-.005, .005),    // rotation speed
      vx:  rnd(-.15, .15),      // x velocity
      vy:  rnd(-.12, .12),      // y velocity
      a:   rnd(.04, .14),       // opacity
    });
  }

  function draw() {
    cx.clearRect(0, 0, W, H);

    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    shapes.forEach(sh => {
      // Move and rotate each shape
      sh.x += sh.vx; sh.y += sh.vy; sh.rot += sh.rs;

      // Wrap around screen edges
      if (sh.x < -40)  sh.x = W + 40;
      if (sh.x > W+40) sh.x = -40;
      if (sh.y < -40)  sh.y = H + 40;
      if (sh.y > H+40) sh.y = -40;

      cx.save();
      cx.translate(sh.x, sh.y);
      cx.rotate(sh.rot);
      cx.globalAlpha  = sh.a * (dark ? 1 : .7);
      cx.strokeStyle  = dark ? 'rgba(232,184,75,0.6)' : 'rgba(61,61,191,0.45)';
      cx.lineWidth    = 1;
      cx.beginPath();

      const s = sh.s;
      if      (sh.t === 'tri') { cx.moveTo(0,-s); cx.lineTo(s*.87,s*.5); cx.lineTo(-s*.87,s*.5); cx.closePath(); }
      else if (sh.t === 'hex') { for (let i=0;i<6;i++){ const a=i/6*Math.PI*2; i ? cx.lineTo(Math.cos(a)*s,Math.sin(a)*s) : cx.moveTo(Math.cos(a)*s,Math.sin(a)*s); } cx.closePath(); }
      else if (sh.t === 'sq')  { cx.rect(-s*.7, -s*.7, s*1.4, s*1.4); }
      else                     { cx.arc(0, 0, s, 0, Math.PI*2); }

      cx.stroke();
      cx.restore();
    });

    // Draw faint connecting lines between shapes that are close together
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const dx = shapes[i].x - shapes[j].x;
        const dy = shapes[i].y - shapes[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 100) {
          cx.save();
          cx.globalAlpha = (1 - d/100) * .04 * (dark ? 1 : .5);
          cx.strokeStyle = dark ? '#E8B84B' : '#3D3DBF';
          cx.lineWidth   = .6;
          cx.beginPath();
          cx.moveTo(shapes[i].x, shapes[i].y);
          cx.lineTo(shapes[j].x, shapes[j].y);
          cx.stroke();
          cx.restore();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();


/* ── 3. ENTRANCE ANIMATIONS ───────────────────────────────── */
/*
   Staggered slide-in on page load using anime.js.
   To adjust timing, edit the `delay` and `duration` values.
*/
window.addEventListener('DOMContentLoaded', () => {
  anime({ targets: '#topbar', opacity: [0,1], translateY: [-8,0],  duration: 600, delay: 100, easing: 'easeOutExpo' });
  anime({ targets: '#left',   opacity: [0,1], translateX: [-24,0], duration: 700, delay: 200, easing: 'easeOutExpo' });
  anime({ targets: '#center', opacity: [0,1], scale: [.97,1],      duration: 700, delay: 300, easing: 'easeOutExpo' });
  anime({ targets: '#right',  opacity: [0,1], translateX: [24,0],  duration: 700, delay: 400, easing: 'easeOutExpo' });
  anime({ targets: '#bottom', opacity: [0,1], translateY: [8,0],   duration: 500, delay: 500, easing: 'easeOutExpo' });

  // Stagger the three input groups sliding in
  anime({
    targets:  ['#ig-x', '#ig-n', '#ig-k'],
    opacity:  [0, 1],
    translateX: [-14, 0],
    delay:    anime.stagger(80, { start: 400 }),
    duration: 400,
    easing:   'easeOutQuad',
  });
});


/* ── 4. THEME TOGGLE ──────────────────────────────────────── */
/*
   Toggles data-theme on <html> between "dark" and "light".
   Also updates chart colours immediately without a full re-render.
*/
document.getElementById('theme-btn').addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('mode-lbl').textContent = isDark ? 'Dark' : 'Light';

  // Spin the toggle pill for delight
  anime({ targets: '#theme-btn', rotateY: [0, 360], duration: 600, easing: 'easeInOutBack' });

  // Update chart colours without destroying/rebuilding
  if (mainChart) { refreshChartTheme(); mainChart.update('none'); }
  [miniR, miniF].forEach(c => { if (c) c.update('none'); });
});


/* ── 5. CHART COLOUR HELPERS ──────────────────────────────── */

/**
 * Returns theme-appropriate colours for Chart.js options.
 * Called when building or refreshing a chart.
 */
function chartColors() {
  return {
    grid:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    tick:  isDark ? '#45455A' : '#AEAEC8',
    bord:  isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    tt:    isDark ? '#1E1E26' : '#FFFFFF',        // tooltip background
    ttTxt: isDark ? '#EEEEF5' : '#16161C',        // tooltip text
    ttBrd: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
  };
}

/**
 * Patches the existing mainChart's scale/tooltip colours
 * without rebuilding the whole chart. Called on theme toggle.
 */
function refreshChartTheme() {
  if (!mainChart) return;
  const c = chartColors();
  const o = mainChart.options;
  o.scales.x.grid.color  = c.grid;
  o.scales.y.grid.color  = c.grid;
  o.scales.x.ticks.color = c.tick;
  o.scales.y.ticks.color = c.tick;
  o.scales.x.border.color = c.bord;
  o.scales.y.border.color = c.bord;
  o.plugins.tooltip.backgroundColor = c.tt;
  o.plugins.tooltip.bodyColor        = c.ttTxt;
  o.plugins.tooltip.borderColor      = c.ttBrd;
}


/* ── 6. MINI SPARKLINE CHART BUILDER ──────────────────────── */

/**
 * Creates (or recreates) a small sparkline Chart.js chart.
 * @param {string} id      - canvas element id
 * @param {string} color   - rgb(...) or rgba(...) border colour
 * @param {number[]} data  - array of y values
 * @returns Chart instance
 */
function buildMiniChart(id, color, data) {
  const cv = document.getElementById(id);
  const existing = Chart.getChart(cv);
  if (existing) existing.destroy();

  return new Chart(cv, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor:     color,
        backgroundColor: color.replace(')', ',0.12)').replace('rgb', 'rgba'),
        fill:            true,
        tension:         .4,
        pointRadius:     0,
        borderWidth:     1.5,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 800, easing: 'easeInOutQuart' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales:  { x: { display: false }, y: { display: false } },
    },
  });
}


/* ── 7. CONFETTI BURST ────────────────────────────────────── */
/*
   Triggered once when attendance crosses 75% upward.
   Creates 24 coloured dots that scatter outward with anime.js.
   To change origin point, edit the left/top in d.style.cssText.
*/
function confetti() {
  const cols = isDark
    ? ['#E8B84B', '#4BDDE8', '#4BE89A', '#E84B6A', '#FFFFFF']
    : ['#3D3DBF', '#008A99', '#00915A', '#CC2244', '#16161C'];

  for (let i = 0; i < 24; i++) {
    const d = document.createElement('div');
    d.className  = 'cdot';
    d.style.cssText = `
      width:  ${6 + Math.random() * 5}px;
      height: ${6 + Math.random() * 5}px;
      background: ${cols[i % cols.length]};
      left: ${window.innerWidth * .28}px;
      top:  ${window.innerHeight * .6}px;
    `;
    document.body.appendChild(d);

    const angle = i / 24 * Math.PI * 2;
    const dist  = 60 + Math.random() * 100;

    anime({
      targets:    d,
      translateX: Math.cos(angle) * dist,
      translateY: Math.sin(angle) * dist - 60,
      opacity:    [1, 0],
      scale:      [1, .1],
      rotate:     [0, 720 * (Math.random() > .5 ? 1 : -1)],
      duration:   700 + Math.random() * 350,
      easing:     'easeOutExpo',
      complete:   () => d.remove(),
    });
  }
}


/* ── 8. ANIMATED NUMBER COUNTER ───────────────────────────── */

/**
 * Smoothly animates a DOM element's text content from 0 to `val`.
 * @param {HTMLElement} el  - element to update
 * @param {number}      val - target value (can be negative)
 * @param {Function}    fmt - formatter: (number) => string
 */
function animNum(el, val, fmt) {
  const p = { v: 0 };
  anime({
    targets:  p,
    v:        Math.abs(val),
    duration: 800,
    easing:   'easeOutExpo',
    update()  { el.textContent = fmt(val < 0 ? -p.v : p.v); },
    complete() { el.textContent = fmt(val); },
  });
}


/* ── 9. CORE UPDATE ───────────────────────────────────────── */
/*
   Called on every input change.
   Reads x, n, k → computes all derived values → updates all UI.
   See top-of-file comment block for full formula documentation.
*/
function update() {
  const x = parseFloat(document.getElementById('inp-x').value);
  const n = parseFloat(document.getElementById('inp-n').value);
  const k = parseFloat(document.getElementById('inp-k').value);

  // Bail out if inputs are incomplete or invalid
  if ([x, n, k].some(v => isNaN(v) || v < 0) || x + n + k === 0) {
    resetUI();
    return;
  }

  // ── Derived values ──────────────────────────────────────
  const attended = x + k;
  const total    = x + n + k;
  const att      = attended / total * 100;

  // Rate of Rise: how much your attendance has recovered per lecture attended
  // (proportional to absence severity n, current recovery k, and normalised to damage point)
  const R = (x + n) === 0 ? 0 : (n * k) / (total * (x + n)) * 100;

  // Rate of Fall: how far your attendance dropped due to the absence streak
  // (flat measure — doesn't change as you recover)
  const F = (x + n) === 0 ? 0 : -(n) / (x + n) * 100;

  // ── Status bar (bottom) ─────────────────────────────────
  document.getElementById('st-att').textContent = attended;
  document.getElementById('st-mis').textContent = n;
  document.getElementById('st-tot').textContent = total;

  // ── Attendance chip (left panel) ───────────────────────
  const attEl    = document.getElementById('att-val');
  const attSubEl = document.getElementById('att-sub');

  animNum(attEl, att, v => v.toFixed(1) + '%');

  // Colour: green ≥75%, amber 60-74%, red <60%
  attEl.style.color = att >= 75 ? 'var(--green)' : att >= 60 ? 'var(--acc)' : 'var(--red)';

  if (att >= 75) {
    const canSkip = Math.max(0, Math.floor(attended / 0.75 - total));
    attSubEl.textContent = `You can skip ${canSkip} more lecture${canSkip === 1 ? '' : 's'}`;
  } else {
    const need = Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));
    attSubEl.textContent = `Attend ${need} consecutive to reach 75%`;
  }

  // ── Confetti — fires once when crossing 75% upward ──────
  if (att >= 75 && prevAtt < 75 && prevAtt >= 0) confetti();
  prevAtt = att;

  // ── Right panel insights ────────────────────────────────
  if (att >= 75) {
    const canSkip = Math.max(0, Math.floor(attended / 0.75 - total));
    setInsight('ib-main', 'good', canSkip,
      'Lectures you can skip',
      `Skip up to ${canSkip} and still stay above 75%`
    );
    setInsight('ib-sec', 'neu', total,
      'Total lectures',
      `${attended} attended · ${n} missed`,
      'neu'
    );
  } else {
    const need = Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));
    setInsight('ib-main', 'bad', need,
      'Lectures to attend',
      `Attend ${need} in a row to cross 75%`
    );
    setInsight('ib-sec', 'neu', total,
      'Total lectures',
      `${attended} attended · ${n} missed`,
      'neu'
    );
  }

  // ── Mini sparkline charts ───────────────────────────────
  // Simulate R (rise) over increasing k values
  const rHist = [], fHist = [];
  const kRange = Math.max(k * 2, 20);

  for (let ki = 0; ki <= kRange; ki++) {
    const ri = (x + n) === 0 ? 0 : (n * ki) / ((x + n + ki) * (x + n)) * 100;
    const fi = (x + n) === 0 ? 0 : -(n) / (x + n) * 100;
    rHist.push(+ri.toFixed(3));
    fHist.push(+fi.toFixed(3));
  }

  const rColor = isDark ? 'rgba(75,232,154,1)'  : 'rgba(0,145,90,1)';
  const fColor = isDark ? 'rgba(232,75,106,1)'  : 'rgba(204,34,68,1)';

  document.getElementById('mv-r').textContent = '+' + R.toFixed(3) + '%';
  document.getElementById('mv-f').textContent = F.toFixed(2) + '%';

  miniR = buildMiniChart('mini-r', rColor, rHist);
  miniF = buildMiniChart('mini-f', fColor, fHist);

  // ── Main trajectory chart ───────────────────────────────
  // Build the history arc point-by-point:
  //   Amber  = lectures 1..x     (attending phase, att stays ~100%)
  //   Red    = lectures x+1..x+n (absence phase, att drops)
  //   Teal   = lectures x+n+1..total (recovery phase, att rises)

  const hPts  = [];   // y values
  const hLbls = [];   // x-axis labels
  const hCols = [];   // per-segment colour

  const accColor = isDark ? '#E8B84B' : '#3D3DBF';

  for (let i = 1; i <= x; i++) {
    hPts.push(100);
    hLbls.push('L' + i);
    hCols.push(accColor);
  }
  for (let j = 1; j <= n; j++) {
    hPts.push(+(x / (x + j) * 100).toFixed(2));
    hLbls.push('A' + j);
    hCols.push(isDark ? '#E84B6A' : '#CC2244');
  }
  for (let m = 1; m <= k; m++) {
    hPts.push(+((x + m) / (x + n + m) * 100).toFixed(2));
    hLbls.push('R' + m);
    hCols.push(isDark ? '#4BDDE8' : '#008A99');
  }

  // "now" is the pivot point — future projections branch from here
  const pivIdx = hLbls.length;
  const curAtt = hPts.length ? hPts[hPts.length - 1] : 100;

  // Green future: attend every upcoming lecture
  const gFut = [curAtt];
  // Red future: skip every upcoming lecture
  const bFut = [curAtt];

  for (let i = 1; i <= PROJ; i++) {
    gFut.push(+((attended + i) / (total + i) * 100).toFixed(2));
    bFut.push(+(attended / (total + i) * 100).toFixed(2));
  }

  // Combine history + future labels
  const allLbls = [...hLbls];
  for (let i = 0; i <= PROJ; i++) allLbls.push('F' + (i === 0 ? '0' : i));

  // Pad datasets with null where they don't apply (spanGaps:false keeps gaps)
  const hFull = [...hPts, ...Array(PROJ).fill(null)];
  const gFull = [...Array(pivIdx).fill(null), ...gFut];
  const bFull = [...Array(pivIdx).fill(null), ...bFut];
  const thrsh = Array(allLbls.length).fill(75);   // flat 75% threshold line

  // Show chart, hide empty state
  document.getElementById('es').classList.remove('visible');
  const canvas = document.getElementById('main-chart');
  canvas.style.display = 'block';

  if (mainChart) mainChart.destroy();

  const ctx = canvas.getContext('2d');
  const c   = chartColors();

  // Gradient fills under future projection lines
  const gGrad = ctx.createLinearGradient(0, 0, 0, 300);
  gGrad.addColorStop(0, isDark ? 'rgba(75,232,154,0.18)' : 'rgba(0,145,90,0.15)');
  gGrad.addColorStop(1, 'rgba(0,0,0,0)');

  const bGrad = ctx.createLinearGradient(0, 0, 0, 300);
  bGrad.addColorStop(0, isDark ? 'rgba(232,75,106,0.15)' : 'rgba(204,34,68,0.12)');
  bGrad.addColorStop(1, 'rgba(0,0,0,0)');

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLbls,
      datasets: [
        // Dataset 0: History arc (colour-coded by phase via segment callback)
        {
          label: 'History',
          data:  hFull,
          segment: { borderColor: ctx => hCols[ctx.p0DataIndex] || accColor },
          backgroundColor: 'rgba(0,0,0,0)',
          fill:            false,
          tension:         .3,
          // Show dots only at phase transition points
          pointRadius:          ci => { const i = ci.dataIndex; return (i===0 || i===x-1 || i===x+n-1 || i===pivIdx-1) ? 4 : 0; },
          pointBackgroundColor: ci => hCols[ci.dataIndex] || accColor,
          pointBorderColor:     'transparent',
          borderWidth:          2,
          spanGaps:             false,
        },
        // Dataset 1: "If you attend" future projection
        {
          label:           'If you attend',
          data:            gFull,
          borderColor:     isDark ? '#4BE89A' : '#00915A',
          backgroundColor: gGrad,
          fill:            true,
          tension:         .3,
          borderWidth:     1.5,
          pointRadius:          ci => (ci.dataIndex === pivIdx || ci.dataIndex === allLbls.length-1) ? 4 : 0,
          pointBackgroundColor: isDark ? '#4BE89A' : '#00915A',
          pointBorderColor:     'transparent',
          spanGaps:             false,
        },
        // Dataset 2: "If you skip" future projection
        {
          label:           'If you skip',
          data:            bFull,
          borderColor:     isDark ? '#E84B6A' : '#CC2244',
          backgroundColor: bGrad,
          fill:            true,
          tension:         .3,
          borderWidth:     1.5,
          borderDash:      [4, 3],
          pointRadius:          ci => (ci.dataIndex === pivIdx || ci.dataIndex === allLbls.length-1) ? 4 : 0,
          pointBackgroundColor: isDark ? '#E84B6A' : '#CC2244',
          pointBorderColor:     'transparent',
          spanGaps:             false,
        },
        // Dataset 3: 75% threshold reference line
        {
          label:       '75%',
          data:        thrsh,
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
          borderDash:  [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill:        false,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 900, easing: 'easeInOutQuart' },
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tt,
          borderColor:     c.ttBrd,
          borderWidth:     1,
          titleColor:      isDark ? '#E8B84B' : '#3D3DBF',
          bodyColor:       c.ttTxt,
          padding:         12,
          titleFont: { family: "'DM Serif Display',serif", size: 13 },
          bodyFont:  { family: "'Plus Jakarta Sans',sans-serif", size: 12 },
          callbacks: {
            title: items => {
              const i = items[0].dataIndex;
              if      (i < x)       return `Lecture ${i+1} · Attending`;
              else if (i < x + n)   return `Lecture ${x+(i-x+1)} · Absent`;
              else if (i < pivIdx)  return `Lecture ${x+n+(i-x-n+1)} · Recovery`;
              else if (i === pivIdx) return 'Now · Current state';
              else                  return `Future +${i - pivIdx} lectures`;
            },
            label: item => {
              if (item.parsed.y === null)   return null;
              if (item.datasetIndex === 3)  return ` Threshold · 75%`;
              return ` ${item.dataset.label} · ${item.parsed.y.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks:  { color: c.tick, font: { family: "'Plus Jakarta Sans',sans-serif", size: 10 }, maxTicksLimit: 14 },
          grid:   { color: c.grid },
          border: { color: c.bord },
        },
        y: {
          min:    0,
          max:    100,
          ticks:  { color: c.tick, font: { family: "'Plus Jakarta Sans',sans-serif", size: 10 }, callback: v => v + '%', stepSize: 25 },
          grid:   { color: c.grid },
          border: { color: c.bord },
        },
      },
    },
    // Custom plugin: draws a "now" vertical dashed line at the pivot point
    plugins: [{
      id: 'now',
      afterDraw(chart) {
        const { ctx: cx, chartArea: { top, bottom }, scales: { x: xs } } = chart;
        const px = xs.getPixelForValue(pivIdx);
        cx.save();
        cx.beginPath();
        cx.moveTo(px, top);
        cx.lineTo(px, bottom);
        cx.strokeStyle = isDark ? 'rgba(232,184,75,0.3)' : 'rgba(61,61,191,0.3)';
        cx.lineWidth   = 1;
        cx.setLineDash([3, 3]);
        cx.stroke();
        cx.globalAlpha  = .55;
        cx.fillStyle    = isDark ? '#E8B84B' : '#3D3DBF';
        cx.font         = "12px 'Plus Jakarta Sans',sans-serif";
        cx.fillText('now', px + 4, top + 13);
        cx.restore();
      },
    }],
  });

  // Fade in the legend now that the chart is ready
  anime({ targets: '#cleg', opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
}


/* ── 10. INSIGHT BLOCK HELPER ─────────────────────────────── */

/**
 * Updates a right-panel insight card with new content and animates it.
 * @param {string} id      - base element id (e.g. 'ib-main')
 * @param {string} type    - 'good' | 'bad' | 'neu' — controls border/dot colour
 * @param {number} val     - number to animate to
 * @param {string} label   - uppercase label text
 * @param {string} desc    - description text below the number
 * @param {string} [numType] - override number colour type (defaults to `type`)
 */
function setInsight(id, type, val, label, desc, numType) {
  const el    = document.getElementById(id);
  const nType = numType || type;

  el.className = 'insight-block ' + type;
  document.getElementById(id + '-lbl').textContent = label;

  const numEl = document.getElementById(id + '-num');
  numEl.className = 'ib-num ' + nType;
  animNum(numEl, val, v => Math.round(Math.abs(v)).toString());

  document.getElementById(id + '-desc').textContent = desc;

  const dotColor = type === 'good' ? 'var(--green)' : type === 'bad' ? 'var(--red)' : 'var(--acc2)';
  el.querySelector('.ib-dot').style.background = dotColor;

  // Bounce card in
  anime({ targets: el, scale: [.96, 1], opacity: [.5, 1], duration: 400, easing: 'easeOutBack' });
}


/* ── 11. RESET UI ─────────────────────────────────────────── */
/*
   Called when inputs are cleared or invalid.
   Resets all display elements back to their placeholder state.
*/
function resetUI() {
  document.getElementById('att-val').textContent  = '—';
  document.getElementById('att-sub').textContent  = 'Enter your numbers above';
  document.getElementById('att-val').style.color  = 'var(--acc)';

  document.getElementById('es').classList.add('visible');
  document.getElementById('main-chart').style.display = 'none';
  document.getElementById('cleg').style.opacity = '0';

  ['ib-main', 'ib-sec'].forEach(id => {
    document.getElementById(id + '-num').textContent  = '—';
    document.getElementById(id + '-desc').textContent = '—';
  });

  document.getElementById('mv-r').textContent = '—';
  document.getElementById('mv-f').textContent = '—';

  ['st-att', 'st-mis', 'st-tot'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );

  prevAtt = -1;
}


/* ── 12. INPUT EVENT LISTENERS ────────────────────────────── */
/*
   Each number input gets:
     - focus  → slide padding + highlight label
     - blur   → restore padding + dim label
     - input  → micro-scale animation + trigger update()
*/
document.querySelectorAll('input[type="number"]').forEach(inp => {

  inp.addEventListener('focus', () => {
    anime({ targets: inp, paddingLeft: ['0.85rem', '1.1rem'], duration: 180, easing: 'easeOutQuad' });
    anime({
      targets:  inp.closest('.inp-group').querySelector('.inp-question'),
      color:    [isDark ? '#7070A0' : '#6060A0', isDark ? '#E8B84B' : '#3D3DBF'],
      duration: 200,
      easing:   'easeOutQuad',
    });
  });

  inp.addEventListener('blur', () => {
    anime({ targets: inp, paddingLeft: ['1.1rem', '0.85rem'], duration: 180, easing: 'easeOutQuad' });
    anime({
      targets:  inp.closest('.inp-group').querySelector('.inp-question'),
      color:    [isDark ? '#E8B84B' : '#3D3DBF', isDark ? '#7070A0' : '#6060A0'],
      duration: 200,
      easing:   'easeOutQuad',
    });
  });

  inp.addEventListener('input', () => {
    anime({ targets: inp, scale: [1, 1.02, 1], duration: 200, easing: 'easeInOutQuad' });
    update();
  });

});
