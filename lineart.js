// One-line print for the cabin wall (Personal Website, room.js). A classic script: it sets window.LINEART.
// draw(t, put) paints the 32 x 92 picture at t seconds through put(x, y, '#rrggbb'); the picture depends only on t and loops
// every T seconds. A single ink line on cream paper draws a subject, keeps it gently alive, then flows without lifting into
// the next, in homage to famous works: Hokusai's Great Wave, Van Gogh's Starry Night, Banksy's Girl with Balloon, Picasso's
// Dove of Peace, and a graffiti piece by the Berlin crew 1UP. Red marks the accents; some areas are sprayed in red.
(function () {
  const W = 32, H = 92, N = 480, MORPH = 1.9, HOLD = 7.6, SEG = MORPH + HOLD, TAU = Math.PI * 2;
  const PAPER = '#f3eee5', GRAIN = '#e6e0d4', INK = '#1d1d22', SOFT = '#7a756c', RED = '#d6402f';
  const hx = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const arc = (cx, cy, rx, ry, a0, a1, n, f) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n, rr = f ? f(a) : 1; return [cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]; });
  const S = (pts, tag = 'ink', o = {}) => ({ pts, tag, ...o });         // one stroke of the line; between strokes the pen moves unseen; o.fill sprays its inside

  // ---- five homages, each in one line; they return their strokes at time t (u = seconds since the subject was reached)
  const heartPts = (cx, cy, k, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI + TAU * i / n, s = Math.sin(a); return [cx + 16 * s * s * s * k, cy - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * k]; });
  const SUBJECTS = [
    (t) => {                                                             // after Hokusai, The Great Wave off Kanagawa: the curling wave, Fuji in the trough, a red seal
      const sw = Math.sin(t * 1.4) * .7, ph = t * 2.2;
      const wave = [[3, 82], [4, 70], [6, 58], [9, 46], [13, 36], [17, 29], [21, 25 + sw * .4], [25 + sw * .6, 24.2], [28 + sw, 26.4], [29.4 + sw, 30.4],
        [28.2 + sw, 33.6], [26.8 + sw * .8, 31.2], [26.2 + sw * .8, 35], [24.6 + sw * .6, 32.4], [24, 36.4], [22.4, 33.8], [21.8, 37.8], [20.2, 35.4],
        [19, 39.5], [17.6, 44.5], [17, 51], [18, 58], [20.5, 65], [24, 71], [29, 75]];
      const sea = Array.from({ length: 14 }, (_, i) => [3 + i * 2, 85 + Math.sin(ph + i * 1.6) * 1.1]);
      return [
        S(wave), S([[6, 74], [9, 60], [13, 49], [17.5, 40]]), S([[10, 79], [12, 68], [15, 58]]), S([[14, 33], [18.5, 29.5], [23, 28]]),
        S([[20, 84], [24, 77], [25.5, 76], [27, 77], [29, 82]]), S([[23, 79], [24.2, 78.2], [25.4, 79.6], [26.6, 78.2], [27.6, 79.2]]),
        S([[6, 83], [15, 81]]), S(sea),
        S([[25, 4], [29, 4], [29, 12], [25, 12], [25, 4]], 'red', { fill: RED }),
      ];
    },
    (t) => {                                                             // after Van Gogh, The Starry Night: the cypress, a turning swirl, stars and a red crescent
      const rot = t * .55, sp = (cx, cy, r0, r1, turns, n) => Array.from({ length: n + 1 }, (_, i) => { const q = i / n, a = rot + q * turns * TAU, r = r0 + (r1 - r0) * q; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .85]; });
      const star = (x, y, i) => S(arc(x, y, .8 + .5 * Math.max(0, Math.sin(t * 2.4 + i * 1.7)), .8 + .5 * Math.max(0, Math.sin(t * 2.4 + i * 1.7)), 0, TAU, 8));
      const flow = Array.from({ length: 10 }, (_, i) => [12 + i * 1.9, 51 + Math.sin(t * 1.3 + i * .9) * 1.2]);
      return [
        S([[6, 86], [4.5, 78], [5.5, 72], [3.5, 64], [5, 56], [3.8, 48], [5.6, 40], [5, 32], [6.8, 24], [7.6, 14], [8.8, 24], [10.6, 32], [9.6, 40], [11.4, 48], [10, 56], [11.6, 64], [9.8, 72], [10.8, 78], [9.5, 86]].map(([x, y]) => [7.6 + (x - 7.6) * 1.55 + Math.sin(t * 2 + y * .3) * .35, y])),
        S([[6.4, 80], [6, 66], [7, 52], [6.6, 38], [7.6, 24]].map(([x, y]) => [7.6 + (x - 7.6) * 1.55, y])), S([[8.6, 76], [9, 60], [8.4, 46], [8.6, 32]].map(([x, y]) => [7.6 + (x - 7.6) * 1.55, y])),
        S(sp(19, 30, .8, 7.5, 2, 44)), S(sp(25, 43, .6, 3.4, 1.4, 20)), S(flow),
        S([...arc(25.5, 13, 3, 3, -.9, Math.PI + .9, 16), ...arc(26.6, 12.2, 2.4, 2.4, Math.PI + .7, -.7, 14)], 'red', { fill: RED }),
        star(14, 15, 0), star(20.5, 11, 1), star(12.5, 38, 2), star(27.5, 30, 3),
        S([[11, 64], [16, 61], [22, 63], [29, 60]]),
        S([[11, 74], [13, 74], [13, 70], [15, 68], [17, 70], [17, 74], [19, 74], [19, 71], [21, 69.5], [23, 71], [23, 74], [24.5, 74], [24.5, 66], [25.5, 61], [26.5, 66], [26.5, 74], [29, 74]]),
      ];
    },
    (t) => {                                                             // after Banksy, Girl with Balloon: the red heart drifts away, the girl reaches after it
      const bx = 21 + Math.sin(t * .5) * 1.6, by = 24 + Math.sin(t * .7) * 2, heart = heartPts(bx, by, .28), tip = heart[0];
      const hair = Math.sin(t * 1.6) * .8, swing = Math.sin(t * .9) * 1.4;
      return [
        S(heart, 'red', { fill: RED }),
        S([tip, [tip[0] - 1 + swing, tip[1] + 11], [16.5 + swing * .5, 50], [15.4, 61]]),
        S(arc(9, 65.5, 2.5, 2.6, 0, TAU, 14)), S([[7, 64], [4.2, 63 + hair], [3.2, 65 + hair]]), S([[7.2, 66.5], [4.6, 67.5 + hair]]),
        S([[9.6, 69.5], [12.6, 66], [15.2, 62.5]]), S([[8.4, 69.5], [5.4, 74]]),
        S([[8.6, 68.5], [5.6, 80], [12.8, 80], [10, 68.5]]),
        S([[7.6, 80], [7.2, 86], [5.6, 86]]), S([[10.6, 80], [11, 86], [12.6, 86]]),
      ];
    },
    (t) => {                                                             // after Picasso, Dove of Peace: one line, the wings beating, a red olive branch
      const f = Math.sin(t * 1.7) * 2.6;
      const big = st => ({ ...st, pts: st.pts.map(([x, y]) => [16 + (x - 16) * 1.14, 42 + (y - 42) * 1.14]) });
      return [
        S([[5, 54], [9, 50.5], [13, 47], [11, 37], [14, 30 - f * .3], [17, 26 - f * .6], [22.5, 21.5 - f], [19.5, 31], [18.4, 39], [21, 39.5], [24, 39], [27, 40.6], [24.2, 42.6], [19.5, 47], [13, 51.5], [5, 57], [8.4, 53.2]]),
        S([[15.4, 44], [15.8, 35], [18.6, 28.5 - f * .6], [20.2, 26 - f * .8]]),
        S(arc(24.3, 40.1, .45, .45, 0, TAU, 6)),
        S([[26.6, 41.2], [28, 45], [28.6, 49]], 'red'),
        S(arc(26.2, 44.2, 1.3, .7, 0, TAU, 8), 'red', { fill: RED }), S(arc(29.2, 46.3, 1.3, .7, 0, TAU, 8), 'red', { fill: RED }), S(arc(27, 48.4, 1.3, .7, 0, TAU, 8), 'red', { fill: RED }),
        S([[8, 72], [11, 70.5], [14, 72], [17, 70.5]], 'soft'), S([[15, 78], [18, 76.5], [21, 78], [24, 76.5]], 'soft'),
      ].map(big);
    },
    (t, u) => {                                                          // a graffiti piece by 1UP: block letters with a 3D shadow, sprayed red, with drips
      const ONE = [[9, 11], [16, 7], [19.5, 7], [19.5, 26], [23, 26], [23, 31], [9, 31], [9, 26], [13, 26], [13, 15], [9, 16], [9, 11]];
      const U = [[6, 35], [12, 35], [12, 50], [20, 50], [20, 35], [26, 35], [26, 52.5], [22, 57], [10, 57], [6, 52.5], [6, 35]];
      const P = [[7, 61], [21, 61], [26, 65], [26, 72], [21, 76], [13, 76], [13, 84], [7, 84], [7, 61]];
      const HOLE = [[13, 66], [19, 66], [20, 68], [20, 69.5], [19, 71], [13, 71], [13, 66]];
      const sh = pts => pts.map(([x, y]) => [x + 1.6, y + 1.6]), drip = clamp((u - 3) / 4);
      return [
        S(sh(ONE), 'soft'), S(sh(U), 'soft'), S(sh(P), 'soft'),
        S(ONE, 'ink', { fill: RED }), S(U, 'ink', { fill: RED }), S(P, 'ink', { fill: RED, holes: [HOLE] }), S(HOLE),
        S([[15, 31], [15, 31.5 + 3 * drip]], 'red'), S([[11, 57], [11, 57.5 + 2.4 * drip]], 'red'), S([[21, 56], [21, 56.5 + 3.4 * drip]], 'red'), S([[9, 84], [9, 84.5 + 2.6 * drip]], 'red'),
      ];
    },
  ];
  const T = SUBJECTS.length * SEG;

  // the strokes as one line of N points, spaced by length (the unseen pen moves count for less)
  function resample(strokes) {
    const V = [];
    strokes.forEach((s, si) => s.pts.forEach((p, k) => V.push({ x: p[0], y: p[1], tag: s.tag, vis: k > 0, si })));
    const cum = [0];
    for (let i = 1; i < V.length; i++) cum.push(cum[i - 1] + Math.hypot(V[i].x - V[i - 1].x, V[i].y - V[i - 1].y) * (V[i].vis ? 1 : .25));
    const L = cum[cum.length - 1], out = []; let j = 1;
    for (let i = 0; i < N; i++) {
      const d = L * i / (N - 1);
      while (j < V.length - 1 && cum[j] < d) j++;
      const a = V[j - 1], b = V[j], seg = cum[j] - cum[j - 1], q = seg ? (d - cum[j - 1]) / seg : 0;
      out.push({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, tag: b.tag, vis: b.vis });
    }
    return out;
  }
  const colour = tag => tag === 'red' ? RED : tag === 'soft' ? SOFT : INK;
  // red areas sprayed in once the line has arrived (even-odd inside test, holes left open), with a little speckle
  const inside = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  function fills(strokes, put, amt) {
    if (amt <= 0) return;
    for (const s of strokes) {
      if (!s.fill) continue;
      const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
          if (!inside(x + .5, y + .5, s.pts) || (s.holes || []).some(h => inside(x + .5, y + .5, h))) continue;
          if (rnd(x * 3 + 1, y * 5 + 2) < amt) put(x, y, rnd(x, y * 2) < .14 ? mix(s.fill, '#ffffff', .28) : s.fill);
        }
    }
  }
  function line(put, x0, y0, x1, y1, col) {                            // Bresenham, so the ink stays crisp
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (let n = 0; n < 200; n++) {
      if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) put(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  function draw(t, put) {
    const tt = ((t % T) + T) % T, s = Math.floor(tt / SEG), local = tt - s * SEG;
    const prev = (s + SUBJECTS.length - 1) % SUBJECTS.length;
    // paper with a faint grain and a soft darkening at the edges
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(x, W - 1 - x, y, H - 1 - y), g = rnd(x, y) < .05 ? .55 : 0;
      put(x, y, mix(PAPER, GRAIN, Math.max(g, edge < 2 ? .45 - edge * .2 : 0)));
    }
    const SB = SUBJECTS[s](t, local), B = resample(SB), SA = local < MORPH ? SUBJECTS[prev](t - local + .001, HOLD + MORPH) : null;
    fills(SB, put, clamp((local - MORPH * .8) / 1.6));                 // this subject's red areas are sprayed in as the line arrives
    if (SA) fills(SA, put, 1 - clamp(local / (MORPH * .55)));          // and the last subject's fade as it leaves
    let P = B;
    if (local < MORPH) {                                               // the line flows from the last subject into this one, a wave along its length
      const A = resample(SA);
      P = B.map((b, i) => {
        const a = A[i], q = ease(clamp((local / MORPH - (i / N) * .4) / .6)), wob = Math.sin(q * Math.PI) * 1.4;
        return { x: a.x + (b.x - a.x) * q + Math.sin(i * .21 + local * 5) * wob * .4, y: a.y + (b.y - a.y) * q - wob, tag: q < .5 ? a.tag : b.tag, vis: q < .5 ? a.vis : b.vis, q };
      });
    }
    for (let i = 1; i < N; i++) if (P[i].vis) line(put, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, colour(P[i].tag));
    if (local < MORPH) for (const p of P) if (p.q > .15 && p.q < .85 && rnd(p.x * 7 | 0, p.y * 3 | 0) < .04) { const x = Math.round(p.x), y = Math.round(p.y); if (x >= 0 && x < W && y >= 0 && y < H) put(x, y, SOFT); }   // a little ink in the air
  }
  window.LINEART = { W, H, T, draw };
})();
