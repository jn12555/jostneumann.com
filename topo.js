// Animated topographic map for the framed print in the cabin (Personal Website, room.js) and its OpenFilm page.
// A classic script: it sets window.TOPO. draw(t, put) paints the 32 x 92 map at t seconds through put(x, y, '#rrggbb');
// the picture depends only on t and loops every T seconds (the sun circles the relief, the trail is walked to the summit).
(function () {
  const W = 32, H = 92, T = 12, TAU = Math.PI * 2;
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (B[i] - v) * k))).toString(16).padStart(2, '0')).join(''); };
  const scale = (c, k) => '#' + hex(c).map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('');

  // the relief: four summits along a ridge, low hills and a valley that holds a lake and a river
  const PEAKS = [[11, 19, 1, 8.5], [22, 37, .78, 8], [10, 60, .62, 9.5], [23, 79, .42, 7]];
  const nz = (x, y) => Math.sin(x * .73 + y * .21) * Math.sin(y * .37 - x * .19) * .5 + Math.sin(x * .31 - y * .53 + 1.7) * .5;
  const E = new Float32Array((W + 2) * (H + 2));
  const e = (x, y) => E[(y + 1) * (W + 2) + x + 1];
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    let v = .03 * nz(x, y);
    for (const [px, py, h, s] of PEAKS) v += h * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * s * s));
    v -= .22 * Math.exp(-((x - 4 - y * .12) ** 2) / 18);                   // the valley along the left edge
    E[(y + 1) * (W + 2) + x + 1] = v;
  }
  const LEVELS = 6, WATER = .03, lv = v => Math.floor(v * LEVELS);
  // the trail: from the lake shore up to the main summit, as a list of pixels with their distance along the way
  const WAY = [[5, 88], [8, 82], [13, 76], [16, 69], [15, 62], [18, 54], [17, 47], [14, 40], [15, 32], [13, 25], [11, 19]];
  const TRAIL = []; let s = 0;
  for (let i = 1; i < WAY.length; i++) {
    const [x0, y0] = WAY[i - 1], [x1, y1] = WAY[i], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k < n; k++) { TRAIL.push([Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), s]); s++; }
  }
  const LEN = s;

  function draw(t, put) {
    const u = ((t % T) + T) % T / T, sun = u * TAU;                          // 0..1 through the loop
    const sx = Math.cos(sun), sy = Math.sin(sun);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = e(x, y);
      let col;
      if (v < WATER) col = v < WATER - .05 ? '#7fa8b8' : '#9fc0cc';           // lake and river, deeper in the middle
      else {
        const k = Math.min(1, v / .95);
        col = k < .45 ? mix('#cfd8b4', '#e6dcbc', k / .45) : mix('#e6dcbc', '#d2b48e', (k - .45) / .55);   // hypsometric tint
        const dx = e(x + 1, y) - e(x - 1, y), dy = e(x, y + 1) - e(x, y - 1);
        col = scale(col, .9 + Math.max(-.16, Math.min(.16, -(dx * sx + dy * sy) * 2.2)));   // hillshade from the circling sun
        const L = lv(v);
        if (L !== lv(e(x + 1, y)) || L !== lv(e(x, y + 1))) col = L % 3 === 2 ? '#7a5838' : mix(col, '#9a7048', .55);   // contours, every third one stronger
      }
      if ((x === 16 || y % 23 === 0) && (x + y) % 2 === 0) col = mix(col, '#8c7a60', .35);   // a faint graticule
      put(x, y, col);
    }
    // the trail is walked once per loop: dashes behind the walker, a red dot at the walker, a flag at the summit
    const walked = Math.min(1, u * 1.25) * LEN;
    for (const [x, y, d] of TRAIL) if (d <= walked && (d % 3) !== 2) put(x, y, '#b8402e');
    const w = TRAIL[Math.min(TRAIL.length - 1, Math.floor(walked))];
    if (u < .8) { put(w[0], w[1], '#e0503a'); put(w[0], w[1] - 1, '#e0503a'); }
    const [fx, fy] = WAY[WAY.length - 1];
    put(fx, fy, '#2a2622'); put(fx, fy - 1, '#2a2622'); put(fx, fy - 2, '#2a2622');
    if (u >= .8) { put(fx + 1, fy - 2, '#e0503a'); put(fx + 2, fy - 2, '#e0503a'); put(fx + 1, fy - 1, '#e0503a'); }   // the flag goes up on arrival
  }
  window.TOPO = { W, H, T, draw };
})();
