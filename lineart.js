// One-line print for the cabin wall (Personal Website, room.js). A classic script: it sets window.LINEART.
// draw(t, put) paints the 32 x 92 picture at t seconds through put(x, y, '#rrggbb'); the picture depends only on t and loops
// every T seconds. A single ink line on cream paper draws a subject, keeps it gently alive, then flows without lifting into
// the next: a light bulb whose filament is a beating heart, a mountain village by a river under a rising sun, a tree whose
// roots form a network, a seedling growing from a stack of coins, and a turning globe with a pin. Red marks the accents.
(function () {
  const W = 32, H = 92, N = 480, MORPH = 1.9, HOLD = 7.6, SEG = MORPH + HOLD, TAU = Math.PI * 2;
  const PAPER = '#f3eee5', GRAIN = '#e6e0d4', INK = '#1d1d22', SOFT = '#7a756c', RED = '#d6402f';
  const hx = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const arc = (cx, cy, rx, ry, a0, a1, n, f) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n, rr = f ? f(a) : 1; return [cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]; });
  const S = (pts, tag = 'ink') => ({ pts, tag });                       // one stroke of the line; between strokes the pen moves unseen
  // the heartbeat: two beats close together, then a rest
  const beat = t => { const q = (t * 1.05) % 1; return Math.exp(-Math.pow((q - .08) / .045, 2)) + .7 * Math.exp(-Math.pow((q - .27) / .05, 2)); };

  // ---- the five subjects; each returns its strokes at time t (u = seconds since the subject was reached)
  const SUBJECTS = [
    (t) => {                                                             // a light bulb whose filament is a heart
      const p = beat(t), k = .3 * (1 + .16 * p), hy = 32.5;
      const heart = Array.from({ length: 41 }, (_, i) => { const a = Math.PI + TAU * i / 40, s = Math.sin(a); return [16 + 16 * s * s * s * k, hy - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * k]; });
      const tip = heart[0];
      const out = [
        S([[13, 48], [11.4, 42], ...arc(16, 31.5, 11, 11, 115 * Math.PI / 180, 425 * Math.PI / 180, 46), [20.6, 42], [19, 48], [13, 50], [19, 52], [13, 54], [19, 56], [13, 56], [14.5, 58], [16, 59.5], [17.5, 58], [19, 56]]),
        S([[14.6, 47.5], tip]), S(heart, 'red'), S([tip, [17.4, 47.5]]),
      ];
      if (p > .25) for (const d of [200, 235, 270, 305, 340]) { const a = d * Math.PI / 180; out.push(S([[16 + Math.cos(a) * 13.2, 31.5 + Math.sin(a) * 13.2], [16 + Math.cos(a) * 15.6, 31.5 + Math.sin(a) * 15.6]], 'soft')); }
      return out;
    },
    (t, u) => {                                                          // a mountain village by a winding river, under a rising sun
      const sunY = 13 - clamp(u / 7) * 2.5, wv = y => Math.sin(t * 2.2 + y * .7) * .3;
      return [
        S([[3, 50], [8, 39], [11, 43], [16, 19], [21, 33], [24, 29.5], [29, 47]]),
        S([[13.8, 28], [14.8, 30.5], [16, 27.5], [17.3, 30.5], [18.4, 28.5]]),
        S(arc(25, sunY, 3, 3, 0, TAU, 18), 'red'),
        S([[3, 64], [6, 64], [6, 58.5], [9, 55], [12, 58.5], [12, 64], [14, 64], [14, 60], [16.5, 57], [19, 60], [19, 64], [22, 64], [22, 56.5], [23.5, 54], [25, 56.5], [25, 64], [29, 64]]),
        S([[23.5, 54], [23.5, 51.5]]), S([[22.6, 52.4], [24.4, 52.4]]), S([[9, 64], [9, 61.5]]),
        S([[15, 66], [11.5, 72], [14, 79], [9.5, 86]].map(([x, y]) => [x + wv(y), y]), 'water'),
        S([[18, 66], [15.5, 72], [18.5, 79], [15.5, 86]].map(([x, y]) => [x + wv(y), y]), 'water'),
      ];
    },
    (t) => {                                                             // a tree whose roots spread as a network
      const sway = y => Math.sin(t * 1.15) * clamp((52 - y) / 30) * .9;
      const crown = arc(16, 27, 11, 10.5, Math.PI * .62, Math.PI * 2.38, 60, a => 1 + .06 * Math.sin(a * 9)).map(([x, y]) => [x + sway(y), y]);
      return [
        S([[4, 54], [14.4, 54], [15, 41], ...crown, [17.2, 41], [17.6, 54], [28, 54]]),
        S([[15.6, 42], [12.6, 35.5]].map(([x, y]) => [x + sway(y), y])), S([[16.8, 42], [19.6, 35.5]].map(([x, y]) => [x + sway(y), y])),
        S(arc(21.5 + sway(23), 23, 1.7, 1.7, 0, TAU, 10), 'red'),
        S([[15, 54], [10, 62], [6, 70], [4, 80]]), S([[10, 62], [12, 72], [9, 84]]),
        S([[17, 54], [22, 63], [26, 72], [28, 82]]), S([[22, 63], [19, 74], [21, 85]]), S([[16, 54], [16.2, 66], [15, 78]]),
        S(arc(10, 62, .9, .9, 0, TAU, 6)), S(arc(22, 63, .9, .9, 0, TAU, 6)), S(arc(16.2, 66, .9, .9, 0, TAU, 6)),
      ];
    },
    (t, u) => {                                                          // a seedling growing from a stack of coins
      const grow = .82 + .18 * clamp(u / 5), lean = Math.sin(t * 1.3) * .1;
      const top = [16 + Math.sin(t * 1.3) * .8, 72 - 31 * grow];
      const stem = Array.from({ length: 13 }, (_, i) => { const q = i / 12; return [16 + Math.sin(q * Math.PI) * 1.6 + (top[0] - 16) * q, 72 - (72 - top[1]) * q]; });
      const leaf = (bx, by, len, ang) => { const pts = []; for (let i = 0; i <= 12; i++) { const q = i / 12, w = Math.sin(q * Math.PI) * len * .38; pts.push([bx + Math.cos(ang) * len * q - Math.sin(ang) * w, by + Math.sin(ang) * len * q + Math.cos(ang) * w]); } for (let i = 12; i >= 0; i--) { const q = i / 12, w = Math.sin(q * Math.PI) * len * .38; pts.push([bx + Math.cos(ang) * len * q + Math.sin(ang) * w, by + Math.sin(ang) * len * q - Math.cos(ang) * w]); } return pts; };
      const mid = stem[7];
      return [
        S([[9, 72], [9, 84], ...arc(16, 84, 7, 1.9, Math.PI, 0, 14), [23, 72], ...arc(16, 72, 7, 1.9, 0, -Math.PI, 14), ...arc(16, 72, 7, 1.9, Math.PI, 0, 14)]),
        S(arc(16, 76, 7, 1.9, Math.PI, 0, 14)), S(arc(16, 80, 7, 1.9, Math.PI, 0, 14)),
        S(stem), S(leaf(mid[0], mid[1], 11 * grow, Math.PI + .5 + lean)), S(leaf(top[0], top[1] + 4, 10 * grow, -.5 + lean)),
        S(arc(top[0], top[1] - 1.2, 1.2, 1.2, 0, TAU, 8), 'red'),
      ];
    },
    (t) => {                                                             // a globe turning on its stand, with a pin
      const rot = t * .45, bob = Math.abs(Math.sin(t * 2.1)) * .9, out = [S(arc(16, 36, 12, 12, -Math.PI / 2, Math.PI * 1.5, 48))];
      for (let k = 0; k < 3; k++) { const rx = 12 * Math.cos(rot + k * Math.PI / 3); out.push(S(arc(16, 36, Math.abs(rx), 12, -Math.PI / 2, Math.PI / 2, 18))); }
      out.push(S([[4, 36], [28, 36]]), S([[5.6, 30], [26.4, 30]]), S([[5.6, 42], [26.4, 42]]));
      out.push(S([...arc(16, 36, 14.5, 14.5, -Math.PI * .62, -Math.PI * 1.42, 22).reverse(), [16, 50.5], [16, 56], [10, 58], [22, 58], [16, 56]]));
      out.push(S([[20.5, 29.5], [20.5, 24.5 - bob]]), S(arc(20.5, 22.8 - bob, 1.8, 1.8, 0, TAU, 10), 'red'));
      return out;
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
  const GLYPH = { J: '001001001101010', N: '110101101101101' };
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
    const B = resample(SUBJECTS[s](t, local));
    let P = B;
    if (local < MORPH) {                                               // the line flows from the last subject into this one, a wave along its length
      const A = resample(SUBJECTS[prev](t - local + .001, HOLD + MORPH));
      P = B.map((b, i) => {
        const a = A[i], q = ease(clamp((local / MORPH - (i / N) * .4) / .6)), wob = Math.sin(q * Math.PI) * 1.4;
        return { x: a.x + (b.x - a.x) * q + Math.sin(i * .21 + local * 5) * wob * .4, y: a.y + (b.y - a.y) * q - wob, tag: q < .5 ? a.tag : b.tag, vis: q < .5 ? a.vis : b.vis, q };
      });
    }
    for (let i = 1; i < N; i++) if (P[i].vis) line(put, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, colour(P[i].tag));
    if (local < MORPH) for (const p of P) if (p.q > .15 && p.q < .85 && rnd(p.x * 7 | 0, p.y * 3 | 0) < .04) { const x = Math.round(p.x), y = Math.round(p.y); if (x >= 0 && x < W && y >= 0 && y < H) put(x, y, SOFT); }   // a little ink in the air
    if (s === 2 && local >= MORPH) {                                   // a red signal travelling along the roots
      const ROOT = [[16, 54], [16.2, 66], [12, 72], [9, 84]], q = ((t * .35) % 1), seg = Math.min(2, Math.floor(q * 3)), f = q * 3 - seg;
      const x = ROOT[seg][0] + (ROOT[seg + 1][0] - ROOT[seg][0]) * f, y = ROOT[seg][1] + (ROOT[seg + 1][1] - ROOT[seg][1]) * f;
      put(Math.round(x), Math.round(y), RED);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = Math.round(x) + dx, py = Math.round(y) + dy; if (px >= 0 && px < W && py >= 0 && py < H) put(px, py, mix(PAPER, RED, .35)); }
    }
    // the artist's initials, small and in red pencil
    let cx = 24;
    for (const ch of 'JN') { const g = GLYPH[ch]; for (let i = 0; i < 15; i++) if (g[i] === '1') put(cx + i % 3, 85 + (i / 3 | 0), mix(PAPER, RED, .7)); cx += 4; }
  }
  window.LINEART = { W, H, T, draw };
})();
