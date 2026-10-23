// Dot-morph print for the cabin wall (Personal Website, room.js) and its OpenFilm page. A classic script: it sets
// window.DOTS. draw(t, put) paints the 32 x 92 picture at t seconds through put(x, y, '#rrggbb'); the picture depends
// only on t and loops every T seconds. 120 dots move through six shapes: scatter, grid, bar chart, line chart, globe,
// mountain. Bars and line use international tourist arrivals, world, 1995-2019 (World Bank, World Development
// Indicators, ST.INT.ARVL, CC BY 4.0, retrieved 23 October 2026), in billions.
(function () {
  const W = 32, H = 92, N = 120, HOLD = 2.3, MOVE = 1.3, SEG = HOLD + MOVE;
  const ARRIVALS = [1.083, 1.143, 1.194, 1.210, 1.254, 1.332, 1.299, 1.320, 1.300, 1.436, 1.502, 1.683, 1.739, 1.751,
    1.687, 1.756, 1.793, 1.881, 1.952, 2.012, 2.072, 2.140, 2.249, 2.339, 2.403];
  const BG = '#15171d', DOT = '#e9e3d6', DIM = '#5f5b55', ACC = '#7ff5d2';
  const hx = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  // points along a polyline, evenly by length
  const along = (pts, n, tone) => {
    const seg = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push([pts[i - 1], pts[i], L, d]); L += d; }
    return Array.from({ length: n }, (_, k) => { const s = L * k / Math.max(1, n - 1), [a, b, l0, d] = seg.find(q => s <= q[2] + q[3] + 1e-9) || seg[seg.length - 1], u = d ? (s - l0) / d : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, tone]; });
  };
  const ring = (cx, cy, rx, ry, n, tone) => Array.from({ length: n }, (_, k) => [cx + rx * Math.cos(k / n * Math.PI * 2), cy + ry * Math.sin(k / n * Math.PI * 2), tone]);

  // each shape: N points [x, y, tone], tone 0 dim, 1 dot, 2 accent; sorted left to right so the dots flow across
  const yOf = v => 80 - (v - 1) / 1.5 * 58;
  const SHAPES = [
    () => Array.from({ length: N }, (_, i) => [2 + rnd(i, 1) * 28, 3 + rnd(i, 2) * 86, 1]),                       // scatter
    () => Array.from({ length: N }, (_, i) => [4 + (i % 8) * 3.4, 7 + Math.floor(i / 8) * 5.5, 1]),              // grid
    () => {                                                                                                         // bars, every fifth year
      const vals = [0, 5, 10, 15, 20, 24].map(k => ARRIVALS[k]), sum = vals.reduce((a, b) => a + b, 0);
      let left = N; const counts = vals.map((v, b) => { const c = b < 5 ? Math.round(N * v / sum) : left; left -= c; return c; });
      const out = [];
      counts.forEach((c, b) => { for (let k = 0; k < c; k++) out.push([4 + b * 4.7 + (k % 2) * 1.2, 84 - Math.floor(k / 2) * 4, b === 5 ? 2 : 1]); });
      return out;
    },
    () => {                                                                                                         // the line, with a quiet area under it
      const pts = ARRIVALS.map((v, k) => [3 + k * (26 / 24), yOf(v)]);
      const line = along(pts, 64, 2), area = [];
      for (let i = 0; area.length < N - 64; i++) { const x = 3 + rnd(i, 7) * 26, k = Math.min(23, Math.floor((x - 3) / (26 / 24))), top = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * ((x - pts[k][0]) / (26 / 24)); const y = top + 3 + rnd(i, 8) * (84 - top - 3); if (y < 84) area.push([x, y, 0]); }
      return line.concat(area);
    },
    () => ring(16, 46, 13, 13, 56, 1).concat(ring(16, 46, 5.5, 13, 24, 0), ring(16, 40, 12, 3.2, 20, 0), ring(16, 52, 12, 3.2, 20, 0)),   // globe
    () => along([[2, 80], [10, 46], [14, 55], [21, 26], [26, 44], [30, 80]], 76, 1).concat(along([[2, 84], [30, 84]], 32, 0), ring(8, 22, 3, 3, 12, 2)),   // mountain, a lake line and the sun
  ].map(f => f().sort((a, b) => (a[0] + a[1] * .02) - (b[0] + b[1] * .02)));
  const T = SHAPES.length * SEG;
  const toneCol = k => k < 1 ? mix(DIM, DOT, k) : mix(DOT, ACC, k - 1);

  function draw(t, put) {
    const tt = ((t % T) + T) % T, s = Math.floor(tt / SEG), local = tt - s * SEG;
    const A = SHAPES[s], B = SHAPES[(s + 1) % SHAPES.length];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, BG);
    const at = (i, p) => { const a = A[i], b = B[i], k = ease(p); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
    const pts = [];
    for (let i = 0; i < N; i++) {
      const delay = rnd(i, 3) * .45, p = Math.max(0, Math.min(1, (local - HOLD - delay * MOVE) / (MOVE * (1 - .45))));
      const [x, y, tone] = at(i, p), moving = p > 0 && p < 1;
      if (moving) { const [gx, gy] = at(i, Math.max(0, p - .14)); pts.push([gx, gy, mix(BG, toneCol(tone), .35)]); }   // a short trail
      pts.push([x, y, moving ? mix(toneCol(tone), '#ffffff', .35) : toneCol(tone)]);
    }
    for (const [x, y, col] of pts) { const px = Math.round(x), py = Math.round(y); if (px >= 0 && px < W && py >= 0 && py < H) put(px, py, col); }
  }
  window.DOTS = { W, H, T, draw };
})();
