// Pixel-art desk scene for the personal page, in the iahpixel style: a timber cabin office in the forest, drawn at
// 384x216 native pixels and lit through a light map (albedo x light, then an emissive pass). Sky, landscape and room
// light follow the visitor's local time (night, dawn, day, dusk, blue hour) and the season of the date, with sunbeams,
// a lamp cone and soft shadows, parallax between landscape, wall and desk, and a real-time wall clock. The window
// looks out on a slow river under a mountain panorama with a mixed forest, a willow, wildflowers, mist, a heron and fireflies. On a
// minimal desk, four objects open the sections of the plain (LO-FI) page in a panel: the curved screen (About),
// the shelf (Experience), the tablet (CV) and the phone (Contact).
(() => {
'use strict';
const W = 384, H = 216, TAU = Math.PI * 2;
const VW = 480, VH = 270, OX = 48, OY = 20;   // displayed room (perspective shell) and where the back wall sits in it
const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- page basics that also matter in LO-FI mode ----------
const mail = document.getElementById('email-link');
if (mail && mail.dataset.user && mail.dataset.user !== 'PLACEHOLDER') mail.href = 'mailto:' + mail.dataset.user + '@' + mail.dataset.domain;
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- canvases ----------
const cv = document.getElementById('room'), oc = cv.getContext('2d');
cv.width = VW; cv.height = VH;
const IN = document.createElement('canvas'); IN.width = W; IN.height = H;
const o = IN.getContext('2d');                    // the back wall scene
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const ROOM = mk(), rm = ROOM.getContext('2d');   // static albedo of the room (glass left transparent)
const A = mk(), ax = A.getContext('2d');          // albedo of this frame, then lit
const MASK = mk(), mx = MASK.getContext('2d');    // alpha copy of A, to restore transparency after multiply
const L = mk(), lx = L.getContext('2d');          // light map
const VIG = document.createElement('canvas'); VIG.width = VW; VIG.height = VH;
const vx = VIG.getContext('2d');                  // vignette over the whole room
const LAND = mk(), lc = LAND.getContext('2d');    // landscape outside, kept apart so the night shade spares the sky
const DESKL = mk(), dk = DESKL.getContext('2d');  // desk and everything on it (albedo), shifted slightly for parallax

// ---------- helpers ----------
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(n) { n = (n | 0) ^ 0x9e3779b9; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
function mix(a, b, t) { const A1 = hex(a), B1 = hex(b); return '#' + A1.map((v, i) => Math.round(v + (B1[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function r(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
function ell(c, x, y, rx, ry, col, rot = 0) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); }
function glow(c, x, y, rad, col, a) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(col, Math.min(1, a))); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function strokePath(c, pts, col, w = 1) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }

// ---------- time of day: the scene follows the visitor's local clock (?hour=13.5 fixes it for testing) ----------
const HOUR_PARAM = new URLSearchParams(location.search).get('hour');
const FIXED = HOUR_PARAM !== null && HOUR_PARAM !== '' && !isNaN(+HOUR_PARAM);
function hourNow() { if (FIXED) return ((+HOUR_PARAM % 24) + 24) % 24; const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
const DUSK_LAND = { mount: '#6e6688', hill: '#4c4f68', pineFar: '#2f413b', pineNear: '#1e2c27', bank: '#22301f' };
const DAY = {
  skyTop: '#3f7cc2', skyMid: '#73a9dc', skyLow: '#b4d4ee', skyHor: '#e2eef4', glowCol: '#fff6e0', glowA: .2,
  mount: '#8296b4', hill: '#5f7c94', pineFar: '#43704e', pineNear: '#2e5639', bank: '#3c5c32',
  riverTop: '#b4d8ec', riverMid: '#6e9ebc', riverBot: '#3c6c7c', ripple: '#ffffff', rippleA: .3,
  shadeCol: '#1a1a30', shadeA: 0, ambient: '#b4aea8', winCol: '#d0e4ff', winA: .55,
  lamp: 0, stars: 0, flies: 0, lodge: 0, mist: .35, vig: .35
};
const AFTERNOON = { ...DAY, skyTop: '#4479bc', skyLow: '#cfd8e2', skyHor: '#f2e2c4', glowCol: '#ffe8c0', glowA: .3, ambient: '#ac9f98', winCol: '#f2dcb4' };
const DUSK = {
  skyTop: '#26304f', skyMid: '#6b5d82', skyLow: '#f0a77a', skyHor: '#f6c48e', glowCol: '#ffd09a', glowA: .55, ...DUSK_LAND,
  riverTop: '#e7ae86', riverMid: '#9a7f92', riverBot: '#3e4a62', ripple: '#ffe2c4', rippleA: .22,
  shadeCol: '#1a1a30', shadeA: 0, ambient: '#4c4768', winCol: '#c08070', winA: .5,
  lamp: 1, stars: .5, flies: .6, lodge: 1, mist: 1, vig: .62
};
const BLUE = {
  skyTop: '#141a38', skyMid: '#2e3460', skyLow: '#56507e', skyHor: '#86688a', glowCol: '#9a7aa0', glowA: .3, ...DUSK_LAND,
  riverTop: '#7a6890', riverMid: '#4a4a70', riverBot: '#262c44', ripple: '#e0d8f0', rippleA: .15,
  shadeCol: '#141a40', shadeA: .38, ambient: '#3a3858', winCol: '#5a5aa0', winA: .4,
  lamp: 1, stars: .9, flies: 1, lodge: 1, mist: .9, vig: .66
};
const NIGHT = {
  skyTop: '#0b0f22', skyMid: '#161c3a', skyLow: '#24284a', skyHor: '#33335a', glowCol: '#6a6a9a', glowA: .12, ...DUSK_LAND,
  riverTop: '#3a3c5c', riverMid: '#262a46', riverBot: '#141a2c', ripple: '#c8d0f0', rippleA: .12,
  shadeCol: '#0a0e26', shadeA: .6, ambient: '#2c2a46', winCol: '#3a4890', winA: .35,
  lamp: 1, stars: 1, flies: 1, lodge: 1, mist: .7, vig: .7
};
const DAWN = {
  skyTop: '#3a4a7a', skyMid: '#ae88a0', skyLow: '#f0ae88', skyHor: '#ffd6a2', glowCol: '#ffc890', glowA: .6,
  mount: '#8a7a98', hill: '#5a5a72', pineFar: '#34463e', pineNear: '#24322c', bank: '#283624',
  riverTop: '#f0c0a0', riverMid: '#a890a8', riverBot: '#4a5872', ripple: '#fff0d8', rippleA: .22,
  shadeCol: '#3a2a4a', shadeA: .12, ambient: '#6a6078', winCol: '#e0a090', winA: .5,
  lamp: .5, stars: .2, flies: 0, lodge: .5, mist: 1.5, vig: .55
};
const KEYS = [[0, NIGHT], [5, NIGHT], [6.5, DAWN], [8.5, DAY], [16.5, AFTERNOON], [18.5, DUSK], [20, BLUE], [21.5, NIGHT], [24, NIGHT]];
function envAt(h) {
  let i = 0; while (h >= KEYS[i + 1][0]) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1], f = (h - h0) / (h1 - h0), e = { hour: h };
  for (const k in a) e[k] = typeof a[k] === 'string' ? mix(a[k], b[k], f) : a[k] + (b[k] - a[k]) * f;
  return e;
}
let ENV = envAt(hourNow());

// ---------- season of the date (northern hemisphere; ?season=winter fixes it for testing) ----------
const SEASONS = {
  spring: { canopy: ['#7ab85a', '#8cc46a', '#e8a8c0', '#f0c0d0'], larch: '#8ab860', bank: '#4a7a3a', bankMix: .35, reed: '#6a8a40', reedTop: '#8aa050', caps: .6, snow: 0, particles: 'petals', flies: .3, frost: 0, smoke: .6 },
  summer: { canopy: ['#3e7a3a', '#4a8a40', '#356c34', '#5a9a48'], larch: '#4a7a40', bank: '#3a6a2e', bankMix: .25, reed: '#4a6a2a', reedTop: '#6a7a30', caps: .15, snow: 0, particles: null, flies: 1, frost: 0, smoke: .4 },
  autumn: { canopy: ['#d8742e', '#e8a03a', '#b84a2a', '#c8902a'], larch: '#e0a040', bank: '#6a6a32', bankMix: .4, reed: '#a08a40', reedTop: '#c8a858', caps: .35, snow: 0, particles: 'leaves', flies: .2, frost: 0, smoke: .8 },
  winter: { canopy: null, larch: '#8a7a6a', bank: '#e8eef6', bankMix: .75, reed: '#b8a888', reedTop: '#e8e4dc', caps: 1, snow: 1, particles: 'snow', flies: 0, frost: 1, smoke: 1 }
};
Object.assign(SEASONS.spring, { leaves: ['#7ab85a', '#9ccc6a', '#6aa84e'], bloom: ['#f4e46a', '#ffffff', '#d88ad8', '#f0a0c0', '#8ab0f0'], blossom: '#f6d4e0' });
Object.assign(SEASONS.summer, { leaves: ['#3e7a3a', '#4f8e42', '#2f6a34', '#5a9a48'], bloom: ['#f4e46a', '#ffffff', '#9a7ad8', '#e04a3a', '#f0a0c0'], blossom: '#f4f0dc' });
Object.assign(SEASONS.autumn, { leaves: ['#d8742e', '#e8a03a', '#b84a2a', '#c8902a', '#8a9a3a'], bloom: ['#b8a0d8', '#e8d8a0', '#c8603a'], blossom: null });
Object.assign(SEASONS.winter, { leaves: null, bloom: null, blossom: null });
const SEASON_PARAM = new URLSearchParams(location.search).get('season');
const SEASON = SEASONS[SEASON_PARAM] || SEASONS[(m => m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn')(new Date().getMonth())];

// ---------- parallax: the landscape, the wall and the desk move a little with the pointer ----------
// switched off on 23 October 2026: with the glass wall the shift moved almost the whole picture
const PARALLAX = new URLSearchParams(location.search).get('parallax') === '1';
let PX = 0, PY = 0, TX = 0, TY = 0, hasPointer = false, DDX = 0, DDY = 0;
const off = k => [Math.round(PX * k), Math.round(PY * k * .6)];

// 3x5 pixel font
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '>': '100010001010100', _: '000000000000111', '.': '000000000000010', ':': '000010000010000',
  '-': '000000111000000', '/': '001001010100100', ' ': '000000000000000'
};
function text(c, s, x, y, col) {
  c.fillStyle = col; let cx = x;
  for (const ch of s.toUpperCase()) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(cx + i % 3, y + (i / 3 | 0), 1, 1); cx += 4; }
}

// ---------- hotspots ----------
const SPOTS = [
  { id: 'about', label: 'About', n: '01', x: 196, y: 90, w: 116, h: 60, line: '>ABOUT' },
  { id: 'experience', label: 'Experience', n: '02', x: 390, y: 25, w: 40, h: 166, line: '>EXPERIENCE' },
  { id: 'cv', label: 'CV', n: '05', x: 158, y: 114, w: 34, h: 36, line: '>CV.PDF' },
  { id: 'contact', label: 'Contact', n: '06', x: 312, y: 121, w: 20, h: 29, line: '>CONTACT' },
  { id: 'writing', label: 'Writing', n: '03', x: 92, y: 144, w: 46, h: 13, line: '>WRITING' }
];
const NAV_ONLY = [{ id: 'resources', label: 'Resources', n: '04', at: 'writing' }];   // panels without an object of their own; the camera turns to `at`
const SOURCES = { about: ['about', 'expertise'], experience: ['experience', 'education'], cv: ['cv'], contact: ['contact'], writing: ['writing'], resources: ['resources'] };

// ---------- the 40-inch curved ultrawide (21:9) ----------
const MON = { x: 198, w: 112, cy: 114, h0: 38, k: .14 };   // the screen is taller at the edges than in the middle
// positions the code layers use; the painted still (STILL_GEO further down) replaces them with its own
const GEO = {
  clip: [0, 0, 384, 192], outDY: 0,                         // glass opening and vertical shift of the view
  panesX: [[3, 95], [98, 191], [194, 287], [290, 381]], glassBottom: 146, sill: 146, desk: [147, 155],
  lamp: { bulb: [323, 103, 10], glow: [328, 105], light: [328, 108], cone: [[322, 103], [334, 103], [356, 150], [298, 150]], pool: [330, 150] },
  kbd: [254, 152], tablet: [162, 118, 26, 20], phone: [317, 126, 9, 15], mug: [144, 136],
  clock: { x: 330, y: 22, h: 4.5, m: 7, s: 7.5, cover: 0, face: '#ece6da' }, shadows: true
};
const monCol = i => { const u = (i + .5) / MON.w * 2 - 1, h = MON.h0 * (1 + MON.k * u * u); return { top: MON.cy - h / 2, h }; };

// ---------- glass wall and the view: a full-width forest river panorama (colours from ENV and SEASON) ----------
// The back wall is glass from the ceiling to the floor (y 0 to 192); the view behind it is drawn here in layers.
const WIN = { x: 0, y: 0, w: W, h: 192 };
const PANES = [[3, 3, 92, 186], [98, 3, 93, 186], [194, 3, 93, 186], [290, 3, 91, 186]];   // glass panels between the mullions
const SKY = 100, FAR = 102, NEAR = 106, RIV0 = 106, RIV1 = 142;                      // horizon, far bank, river
const rnd = mulberry32(11);
const ridge = (y0, amp, step, seed) => { const q = mulberry32(seed), pts = [[-10, 200]]; for (let x = -10; x <= W + 10; x += step) pts.push([x, y0 - q() * amp]); pts.push([W + 10, 200]); return pts; };
const HILL = ridge(96, 10, 6, 5);
// mountain ranges: jagged peaks, each with a shaded right face; the far range is high and hazy, the middle one closer
function range(base, minH, maxH, n, seed) {
  const q = mulberry32(seed), step = (W + 24) / n, pts = [[-12, 200]], faces = [];
  for (let i = 0; i <= n; i++) {
    const px = -12 + i * step + (q() - .5) * step * .4, peak = base - (minH + q() * (maxH - minH));
    const sx = px + step * (.12 + q() * .1), sy = peak + 2 + q() * 5, vx = px + step * (.45 + q() * .1), vy = base - q() * minH * .7;
    pts.push([px - step * .3, (peak + vy) / 2 + (q() - .5) * 5], [px, peak], [sx, sy], [vx, vy]);
    faces.push([[px, peak], [sx, sy], [vx, vy], [px + step * .08, base + 8]]);
  }
  pts.push([W + 12, 200]);
  return { pts, faces };
}
const FAR_RANGE = range(66, 22, 50, 7, 31), MID_RANGE = range(86, 12, 30, 10, 37);
const PINES_FAR = [], PINES_NEAR = [], REEDS = [], STARS = [], FLIES = [], BUSH = [], GRASS = [], FLOWERS = [], FERNS = [];
for (let x = -6; x < W + 6; x += 2 + rnd() * 2.5) PINES_FAR.push({ x, h: 8 + rnd() * 8, w: 2 + rnd() * 1.5 });
for (let x = -6; x < W + 6; x += 3.5 + rnd() * 4.5) PINES_NEAR.push({ x, h: 13 + rnd() * 14, w: 3.5 + rnd() * 2.5 });
for (let x = 0; x < W; x += 1 + rnd() * 2) REEDS.push({ x: x | 0, h: 4 + rnd() * 9, p: rnd() * TAU });
for (let i = 0; i < 40; i++) STARS.push({ x: rnd() * W | 0, y: rnd() * 46 | 0, p: rnd() * TAU });
for (let i = 0; i < 26; i++) FLIES.push({ x: 10 + rnd() * (W - 20), y: 146 + rnd() * 34, p: rnd() * TAU, r: 2 + rnd() * 5 });
for (let i = 0; i < 26; i++) BUSH.push({ x: rnd() * W, y: 138 + rnd() * 30, r: (7 + rnd() * 10) * .6, c: i });
const TALL_UNUSED = [[34, 40], [52, 30], [104, 36], [118, 26], [196, 42], [212, 30], [292, 38], [312, 46], [334, 30], [362, 40]].map(([x, h], i) => ({ x, h, w: 4 + (i % 3), c: i }));
const CATTAILS = Array.from({ length: 18 }, (_, i) => ({ x: 84 + (i % 9) * 6 + (i > 8 ? 180 : 0) + rnd() * 3, h: 16 + rnd() * 12, p: rnd() * TAU }));
for (let x = 0; x < W; x += 2) GRASS.push({ x, h: 4 + rnd() * 10, p: rnd() * TAU, y: 172 + rnd() * 12 });
for (let i = 0; i < 46; i++) FLOWERS.push({ x: rnd() * W, y: 160 + rnd() * 24, c: i % 3 });
for (let i = 0; i < 9; i++) FERNS.push({ x: 20 + rnd() * (W - 40), y: 186, s: .8 + rnd() * .6, p: rnd() * TAU });
const MIST = [[20, 112, 90, .16], [160, 118, 110, .12], [300, 110, 80, .1]];
const DECID = Array.from({ length: 22 }, (_, i) => ({ x: rnd() * W, r: 3 + rnd() * 3.5, c: i }));
const PARTS = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd(), v: rnd(), p: rnd() * TAU }));
const MOTES = Array.from({ length: 34 }, () => ({ x: rnd(), y: rnd(), v: 2 + rnd() * 4, p: rnd() * TAU }));
const FROST = [];
for (const [x, y, w, h] of PANES) for (let i = 0; i < 60; i++) {
  const left = rnd() < .5, top = rnd() < .5, d = rnd() ** 2 * 11, a = rnd() * TAU / 4;
  FROST.push([Math.round((left ? x : x + w - 1) + Math.cos(a) * d * (left ? 1 : -1)), Math.round((top ? y : y + h - 1) + Math.sin(a) * d * (top ? 1 : -1)), 1 - d / 11]);
}

// ---------- vegetation: what grows where, fixed by seed (drawn once per light change in vegLayers) ----------
const vr = mulberry32(23);
const yOn = (pts, x) => { for (let i = 1; i < pts.length - 2; i++) if (pts[i + 1][0] >= x) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; return y0 + (y1 - y0) * clamp((x - x0) / Math.max(.01, x1 - x0)); } return 200; };
const SLOPE = [];                                                               // forest climbing the mountain flanks up to a treeline
for (let i = 0; i < 700; i++) { const x = vr() * W, top = Math.max(yOn(MID_RANGE.pts, x) + 2, 70 + vr() * 8), y = top + Math.sqrt(vr()) * (98 - top); if (y > top + 1) SLOPE.push({ x, y, h: 2 + vr() * 2 + (y - 70) * .1, k: vr() }); }
SLOPE.sort((a, b) => a.y - b.y);
const NEARMIX = PINES_NEAR.map((p, i) => ({ ...p, k: hash(i * 13 + 5) })).sort((a, b) => b.h - a.h);   // tall trees behind, small in front
const SHORE = []; for (let x = -4; x < W + 4; x += 2 + vr() * 4) SHORE.push({ x, r: 1.5 + vr() * 2.5, c: (vr() * 4) | 0 });
const BANK_TREES = [
  { t: 'spruce', x: 28, h: 60, w: 10 }, { t: 'oak', x: 48, h: 46, r: 13, bloom: 1 }, { t: 'rowan', x: 94, h: 30, r: 7 },
  { t: 'willow', x: 124, h: 44, r: 15 }, { t: 'alder', x: 190, h: 40, r: 9 }, { t: 'poplar', x: 214, h: 56, r: 5 },
  { t: 'spruce', x: 240, h: 34, w: 6 }, { t: 'spruce', x: 274, h: 30, w: 5 }, { t: 'oak', x: 312, h: 50, r: 14 },
  { t: 'spruce', x: 342, h: 64, w: 10 }, { t: 'rowan', x: 368, h: 26, r: 6 }
].map(t => ({ ...t, h: Math.round(t.h * .6), w: t.w && t.w * .7, r: t.r && Math.max(4, t.r * .7) }));   // kept low so the view stays open
const EDGE = []; for (let x = 2; x < W; x += 3 + vr() * 7) EDGE.push({ x, h: 5 + vr() * 7, c: vr() });   // flowers at the water's edge
const LILIES = []; for (const [cx, n] of [[100, 7], [262, 9], [330, 5]]) for (let i = 0; i < n; i++) LILIES.push({ x: cx + (vr() - .5) * 30, y: 132 + vr() * 7, f: vr() < .35 });
const ROCKS = [[8, 143, 5], [62, 142, 4], [134, 144, 6], [200, 141, 3], [288, 143, 5], [378, 142, 4], [40, 178, 6], [170, 180, 5], [330, 177, 7]];
const TUFTS = []; for (let i = 0; i < 110; i++) TUFTS.push({ x: vr() * W, y: 150 + vr() * 34, h: 3 + vr() * 6 }); TUFTS.sort((a, b) => a.y - b.y);
const MEADOW = []; for (let i = 0; i < 150; i++) MEADOW.push({ x: vr() * W, y: 158 + vr() * 26, t: vr(), h: 4 + vr() * 7, c: (vr() * 5) | 0 }); MEADOW.sort((a, b) => a.y - b.y);

function pine(c, x, base, h, w, col) {
  poly(c, [[x, base - h], [x - w, base - h * .35], [x + w, base - h * .35]], col);
  poly(c, [[x, base - h * .7], [x - w * 1.35, base], [x + w * 1.35, base]], col);
}
function skyBody(h) {
  // sun from about 6:00 to 19:00, moon from 19:30 to 6:00; both rise on the right and set on the left
  const sun = h >= 5.8 && h <= 19.2, u = sun ? (h - 6) / 13 : ((h + 24 - 19.5) % 24) / 10.5;
  if (u < -.05 || u > 1.05) return null;
  return { sun, x: W - 30 - u * (W - 60), y: 86 - Math.sin(clamp(u) * Math.PI) * 70, lift: Math.sin(clamp(u) * Math.PI) };
}
function sunInfo(E) {
  const b = skyBody(E.hour);
  if (!b || !b.sun) return null;
  const rel = (b.x - W / 2) / (W / 2);
  return { s: clamp(b.lift * 2.5), col: mix('#ff9a50', '#fff0d0', clamp(b.lift * 1.4)), dx: -rel * 36 };
}
function drawDecid(g, d, E, S, snowC, base) {
  const top = base - d.r * 2.2;
  if (!S.canopy) {
    const tr = mix('#5a4a44', E.pineFar, .3);
    r(g, d.x, top + 1, 1, base - top, tr);
    strokePath(g, [[d.x + .5, top + d.r], [d.x - d.r + .5, top + 1]], tr); strokePath(g, [[d.x + .5, top + d.r * 1.3], [d.x + d.r + .5, top + 2]], tr);
    r(g, d.x - d.r + 1, top + 1, 2, 1, snowC); r(g, d.x + d.r - 1, top + 2, 2, 1, snowC);
    return;
  }
  r(g, d.x, base - d.r, 1, d.r, mix('#4a3a2a', E.pineFar, .4));
  const col = mix(S.canopy[d.c % S.canopy.length], E.pineFar, .35);
  ell(g, d.x + .5, top + d.r, d.r * 1.15, d.r, col);
  ell(g, d.x - d.r * .3, top + d.r * .7, d.r * .5, d.r * .4, mix(col, '#ffffff', .12));
}
// a birch in the foreground corner: white trunk with dark marks, branches and a canopy that follows the season
function birch(g, x, side, E, S, snowC, t) {
  const bark = mix('#e8e4da', E.riverMid, .25), mark = '#2a2622';
  r(g, x, -2, 7, 194, bark); r(g, x + 5, -2, 2, 194, mix(bark, '#000000', .18));
  for (let y = 4; y < 190; y += 9) r(g, x + ((y * 7) % 4), y, 3 + (y % 3), 1, mark);
  strokePath(g, [[x + 3, 60], [x + 3 + side * 26, 30]], bark, 2); strokePath(g, [[x + 3, 36], [x + 3 + side * 18, 12]], bark, 2);
  if (!S.canopy) { for (let k = 0; k < 6; k++) r(g, x + side * (6 + k * 5), 14 + (k * 11) % 30, 3, 1, snowC); return; }
  for (let k = 0; k < 34; k++) {
    const kx = x + 3 + side * (hash(k * 3 + x) * 46 - 6), ky = hash(k * 7 + x) * 58 - 4, sw = reduce ? 0 : Math.sin(t * .8 + k) * .8;
    ell(g, kx + sw, ky, 3 + hash(k + x) * 3, 2.2 + hash(k * 5 + x) * 2, mix(S.canopy[k % S.canopy.length], E.pineNear, .25 + hash(k) * .2));
  }
}
// tree shapes; T is a tone {c, hi, lo, side}: base colour, sunlit and shaded variants, and the side the light comes from
function spruce(g, x, base, h, w, T, snowC) {
  const top = base - h, tiers = Math.max(2, Math.round(h / 6));
  for (let y = 0; y < h; y++) {
    const rel = (y + 1) / h, loc = (rel * tiers) % 1, j = hash(Math.round(x * 7) * 131 + y) - .5;
    const hw = Math.max(.6, w * (.1 + .9 * rel) * (.5 + .5 * loc) + j * 1.1);
    const x0 = Math.round(x - hw), x1 = Math.round(x + hw), n = x1 - x0 + 1, lw = Math.max(1, Math.round(n * .3)), yy = top + y;
    r(g, x0, yy, n, 1, loc > .82 && n > 2 ? T.lo : T.c);
    if (n > 2) { r(g, T.side < 0 ? x0 : x1 - lw + 1, yy, lw, 1, T.hi); r(g, T.side < 0 ? x1 - lw + 1 : x0, yy, lw, 1, T.lo); }
    if (snowC && Math.floor(rel * tiers) !== Math.floor((rel - 1 / h) * tiers)) r(g, x0, yy, Math.max(1, n - 1), 1, snowC);
  }
}
function crown(g, x, base, h, rad, T, seed, bare, snowC, tr) {
  const cy = base - h + rad;
  r(g, x - 1, cy, 2, base - cy, tr);
  if (bare) {                                                                   // winter: branches with a line of snow
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * .38 + (hash(seed + k) - .5) * .2, L = rad * (.8 + hash(seed * 3 + k) * .5), sy = cy + rad * .4;
      const ex = x + Math.cos(a) * L, ey = sy + Math.sin(a) * L, mx2 = (x + ex) / 2, my = (sy + ey) / 2;
      strokePath(g, [[x, sy], [ex, ey]], tr); strokePath(g, [[mx2, my], [mx2 + Math.cos(a - .6) * L * .4, my + Math.sin(a - .6) * L * .4]], tr);
      if (snowC) r(g, ex - 1, ey, 2, 1, snowC);
    }
    return;
  }
  ell(g, x, cy + rad * .1, rad, rad * .82, T.lo);
  const n = 6 + Math.round(rad * .6);
  for (let k = 0; k < n; k++) { const a = hash(seed + k * 7) * TAU, d = hash(seed + k * 11) * rad * .55; ell(g, x + Math.cos(a) * d, cy + Math.sin(a) * d * .8 - rad * .05, rad * (.32 + hash(seed + k * 5) * .22), rad * (.28 + hash(seed + k * 3) * .18), T.c); }
  for (let k = 0; k < n * .6; k++) { const a = -Math.PI / 2 + T.side * (.3 + hash(seed + k * 13) * .9), d = rad * (.25 + hash(seed + k * 17) * .45); ell(g, x + Math.cos(a) * d, cy + Math.sin(a) * d * .8, rad * (.16 + hash(seed + k * 19) * .12), rad * (.12 + hash(seed + k) * .1), T.hi); }
  for (let k = 0; k < rad * 4; k++) { const a = hash(seed + k * 23) * TAU, d = Math.sqrt(hash(seed + k * 29)) * rad * .85; r(g, x + Math.cos(a) * d, cy + Math.sin(a) * d * .78, 1, 1, hash(seed + k) < .5 ? T.lo : T.hi); }
}
function willow(g, x, base, h, rad, T, seed, bare, snowC, tr) {
  const cy = base - h + rad * .6;
  strokePath(g, [[x, base], [x - 2, base - h * .45], [x + 1, cy]], tr, 2);
  if (!bare) { ell(g, x, cy, rad * .9, rad * .55, T.lo); ell(g, x + T.side * rad * .2, cy - rad * .15, rad * .6, rad * .35, T.c); }
  const strands = Math.round(rad * 2.2);
  for (let k = 0; k < strands; k++) {
    const u = k / (strands - 1) * 2 - 1, sx = x + u * rad, sy = cy - Math.sqrt(1 - u * u) * rad * .45 + 1;
    const len = (base - sy) * (.55 + hash(seed + k) * .4) * (1 - Math.abs(u) * .25);
    const col = bare ? mix(tr, '#c8a860', .5) : [T.hi, T.c, T.lo][k % 3];
    strokePath(g, [[sx, sy], [sx + u * 2, sy + len * .5], [sx + u * 2.5, sy + len]], col, 1);
    if (!bare && k % 2) r(g, sx + u * 2.5 - .5, sy + len * (.4 + hash(seed + k * 3) * .5), 1, 2, T.hi);
  }
  if (bare && snowC) ell(g, x, cy - rad * .4, rad * .5, 1, snowC);
}
function poplar(g, x, base, h, rad, T, seed, bare, tr) {
  r(g, x - .5, base - h * .25, 1, h * .25, tr);
  if (bare) { strokePath(g, [[x, base], [x, base - h]], tr); for (let k = 0; k < 6; k++) strokePath(g, [[x, base - h * .2 - k * h * .12], [x + (k % 2 ? 1 : -1) * rad * .8, base - h * .4 - k * h * .12]], tr); return; }
  ell(g, x, base - h * .58, rad, h * .42, T.lo);
  ell(g, x + T.side * rad * .25, base - h * .62, rad * .6, h * .36, T.c);
  ell(g, x + T.side * rad * .45, base - h * .66, rad * .3, h * .26, T.hi);
  for (let k = 0; k < h * .8; k++) r(g, x + (hash(seed + k) - .5) * rad * 1.6, base - h * .2 - hash(seed * 7 + k) * h * .76, 1, 1, hash(seed + k * 3) < .5 ? T.lo : T.hi);
}
// the static landscape in two cached layers (mountains to river, and the near bank), rebuilt when the light changes
let VEG = null;
const REF = mk(), rf = REF.getContext('2d');
function vegLayers(E, S, snowC) {
  if (VEG && VEG.env === E) return VEG;
  const back = VEG ? VEG.back : mk(), front = VEG ? VEG.front : mk(), b = back.getContext('2d'), f = front.getContext('2d');
  b.clearRect(0, 0, W, H); f.clearRect(0, 0, W, H);
  const body = skyBody(E.hour), lit = clamp(1 - E.lamp * 1.2), side = body && body.sun && body.x > W / 2 ? 1 : -1;
  const light = body && body.sun ? mix('#ffd8a0', '#fff6dc', body.lift) : E.skyLow;
  const tone = (col, k = .22) => ({ c: col, hi: mix(col, light, k * (.35 + .65 * lit)), lo: mix(col, '#050c0a', .32), side });
  const snow = S.snow ? snowC : null, bare = !S.leaves;
  // the mountain panorama: far high range (always snow on the summits), middle range (snow by season), foothills
  const mtn = (R0, col, shade, snowTop, snowA) => {
    poly(b, R0.pts, col);
    for (const q of R0.faces) poly(b, q, shade);
    if (snowA > 0) {
      b.save(); b.beginPath(); b.moveTo(R0.pts[0][0], R0.pts[0][1]); for (const q of R0.pts) b.lineTo(q[0], q[1]); b.closePath(); b.clip();
      b.fillStyle = rgba(snowC, .9 * snowA); b.fillRect(-12, 0, W + 24, snowTop);
      b.fillStyle = rgba(snowC, .45 * snowA); b.fillRect(-12, snowTop, W + 24, 3);
      for (const q of R0.faces) poly(b, q.map(([x, y]) => [x, Math.min(y, snowTop + 2)]), rgba(mix(snowC, E.skyTop, .3), .5 * snowA));
      b.restore();
    }
  };
  { const far = mix(E.mount, E.skyLow, .45); mtn(FAR_RANGE, far, mix(far, E.skyTop, .3), 40, Math.max(.6, S.caps)); }
  mtn(MID_RANGE, E.mount, mix(E.mount, '#000000', .18), 64, S.caps * .9);
  poly(b, HILL, E.hill);
  // forest climbing the slopes: conifers and broadleaf crowns, hazier the higher they grow
  const slopeC = [E.pineFar, mix(E.pineFar, '#5a7a5a', .3), S.leaves ? mix(S.leaves[0], E.pineFar, .5) : mix('#6a5a50', E.pineFar, .5)];
  for (const q of SLOPE) {
    const col = mix(slopeC[q.k < .35 ? 0 : q.k < .7 ? 1 : 2], E.mount, clamp((96 - q.y) / 26) * .65);
    if (q.k < .7) { r(b, q.x, q.y - q.h, 1, q.h, col); r(b, q.x - 1, q.y - q.h * .55, 3, q.h * .55, col); if (snow) r(b, q.x, q.y - q.h, 1, 1, snow); }
    else ell(b, q.x, q.y - q.h * .45, 1.6, q.h * .45, col);
  }
  // far forest: three tones of spruce with round broadleaf crowns between them
  const farT = [tone(E.pineFar, .18), tone(mix(E.pineFar, '#4a6a5e', .3), .18), tone(mix(E.pineFar, '#000000', .12), .14)];
  PINES_FAR.forEach((pf, i) => spruce(b, pf.x, FAR, pf.h, pf.w, farT[i % 3], snow));
  for (const d of DECID) drawDecid(b, d, E, S, snowC, FAR + 1);
  // treeline across the river: tiered spruces, larches, broadleaf crowns and poplars
  const nearCon = [tone(E.pineNear), tone(mix(E.pineNear, '#3e5e52', .35)), tone(mix(E.pineNear, '#000000', .15), .15)];
  const nearLeaf = S.leaves ? S.leaves.map(c => tone(mix(c, E.pineNear, .45), .25)) : null, trFar = mix('#3a2e26', E.pineNear, .4);
  NEARMIX.forEach((pn, i) => {
    if (pn.k < .6 || (bare && pn.k < .8)) spruce(b, pn.x, NEAR, pn.h, pn.w, S.larch && i % 5 === 2 ? tone(mix(S.larch, E.pineNear, .45)) : nearCon[i % 3], snow);
    else if (pn.k < .86) crown(b, pn.x, NEAR, pn.h * .8, pn.w * 1.6, nearLeaf && nearLeaf[i % nearLeaf.length], i * 17, bare, snow, trFar);
    else poplar(b, pn.x, NEAR, pn.h * 1.1, pn.w * .7, nearLeaf && nearLeaf[1], i * 19, bare, trFar);
  });
  r(b, -10, NEAR - 2, W + 20, 2, snow || mix(E.pineNear, '#000000', .15));
  // the river, shrubs along the far bank, and the forest mirrored in the water
  const river = b.createLinearGradient(0, RIV0, 0, RIV1);
  river.addColorStop(0, E.riverTop); river.addColorStop(.35, E.riverMid); river.addColorStop(1, E.riverBot);
  b.fillStyle = river; b.fillRect(-10, RIV0, W + 20, RIV1 - RIV0);
  const shoreBare = tone(mix('#5a4a40', E.pineNear, .5));
  for (const s of SHORE) {
    const T = nearLeaf ? nearLeaf[s.c % nearLeaf.length] : shoreBare;
    ell(b, s.x, RIV0 - .5, s.r * 1.3, s.r * .8, T.lo); ell(b, s.x + T.side * .5, RIV0 - 1, s.r * .9, s.r * .55, T.c); r(b, s.x + T.side * s.r * .5, RIV0 - s.r * .6, 1, 1, T.hi);
    if (snow) r(b, s.x - 1, RIV0 - s.r * .8, 2, 1, snow);
  }
  rf.clearRect(0, 0, W, H); rf.drawImage(back, 0, RIV0 - 34, W, 34, 0, 0, W, 34);
  b.save(); b.beginPath(); b.rect(-10, RIV0, W + 20, RIV1 - RIV0); b.clip(); b.setTransform(1, 0, 0, -1, 0, 2 * RIV0);
  b.globalAlpha = .26; b.drawImage(REF, 0, 0, W, 34, 0, RIV0 - 34, W, 34);
  b.globalAlpha = .1; b.drawImage(REF, 0, 0, W, 34, -1, RIV0 - 35, W, 34); b.drawImage(REF, 0, 0, W, 34, 1, RIV0 - 33, W, 34);
  b.restore();

  // ---- near bank (front layer) ----
  const pad = mix(S.particles === 'leaves' ? '#8a8a3a' : '#4a8a3e', E.riverMid, .3), padHi = mix(pad, '#ffffff', .15);
  if (!S.snow) for (const l of LILIES) {
    ell(f, l.x, l.y, 2.4, .9, pad); r(f, l.x - 1, l.y - 1, 2, 1, padHi);
    if (l.f && S === SEASONS.summer) { r(f, l.x, l.y - 1, 2, 1, '#f4d0dc'); r(f, l.x + .5, l.y - 2, 1, 1, '#ffffff'); }
  }
  const bankC = mix(E.bank, S.snow ? snowC : S.bank, S.bankMix);
  poly(f, [[-10, 142], [60, 139], [130, 142], [210, 138], [300, 141], [W + 10, 138], [W + 10, 200], [-10, 200]], bankC);
  for (const px of [144, 152, 160, 168, 176]) { r(f, px, 131, 1, 9, '#3a2618'); r(f, px, 140, 1, 2, rgba(E.ripple, .25)); }   // jetty
  r(f, 140, 129, 40, 2, '#7a5434'); r(f, 140, 129, 40, 1, snow || '#a27448');
  for (let px = 143; px < 180; px += 4) r(f, px, 129, 1, 2, '#5a3a24');
  const rockC = mix('#7a7a74', E.hill, .35), rockLo = mix(rockC, '#000000', .2), moss = mix('#5a8a3a', rockC, .4);
  const rocks = s => { const [x, y, z] = s; ell(f, x, y, z, z * .55, rockLo); ell(f, x - z * .2, y - z * .15, z * .75, z * .38, rockC); if (snow) ell(f, x - z * .1, y - z * .4, z * .7, z * .18, snow); else r(f, x - z * .5, y - z * .5, z * .8, 1, moss); };
  ROCKS.slice(0, 6).forEach(rocks);
  const reed = mix(S.reed, E.bank, .4), reedTop = mix(S.reedTop, E.bank, .35);
  for (const q of REEDS) { r(f, q.x, 146 - q.h, 1, q.h, reed); r(f, q.x, 146 - q.h - 1, 1, 2, reedTop); }
  // trees on the near bank: spruce, oak (a cherry in blossom in spring), willow over the water, rowan, alder and a poplar
  const trunkC = mix('#4a3a2c', E.pineNear, .25);
  const conT = [tone(mix(E.pineNear, '#2e5639', .25)), tone(mix(E.pineNear, '#3a6a5a', .3)), tone(mix(E.pineNear, '#26422c', .2))];
  const leafT = S.leaves && S.leaves.map(c => tone(mix(c, E.pineNear, .22), .28));
  const willowT = S.leaves && tone(mix(mix(S.leaves[1], '#b0c060', .3), E.pineNear, .2), .3);
  const alderT = S.leaves && tone(mix(mix(S.leaves[2 % S.leaves.length], '#1e3a24', .3), E.pineNear, .2));
  const cherryT = S === SEASONS.spring && tone(mix('#f0c4d4', E.pineNear, .15), .2);
  BANK_TREES.forEach((bt, i) => {
    const base = 144, seed = bt.x * 7;
    if (bt.t === 'spruce') { r(f, bt.x - 1, base - 6, 2, 6, trunkC); spruce(f, bt.x, base - 2, bt.h, bt.w, conT[i % 3], snow); }
    else if (bt.t === 'willow') willow(f, bt.x, base, bt.h, bt.r, willowT, seed, bare, snow, trunkC);
    else if (bt.t === 'poplar') poplar(f, bt.x, base, bt.h, bt.r, leafT && leafT[1], seed, bare, trunkC);
    else {
      crown(f, bt.x, base, bt.h, bt.r, bt.bloom && cherryT ? cherryT : bt.t === 'alder' ? alderT : leafT && leafT[i % leafT.length], seed, bare, snow, trunkC);
      if (bt.t === 'rowan' && !bare) for (let k = 0; k < 12; k++)
        r(f, bt.x + (hash(seed + k) - .5) * bt.r * 1.4, base - bt.h + bt.r + (hash(seed * 3 + k) - .5) * bt.r * 1.1, 1, 1, S === SEASONS.spring ? '#f4f0e8' : '#d8402a');
    }
  });
  // flowers at the water's edge: marsh marigold in spring; purple loosestrife, yellow iris and meadowsweet in summer
  const edgeCol = S === SEASONS.spring ? ['#f0d040', '#ffffff', '#e8a8c8'] : ['#b04aa0', '#e8c840', '#f4ecd8'];
  for (const e of EDGE) {
    const top = 145 - e.h;
    strokePath(f, [[e.x, 145], [e.x, top]], reed);
    if (snow) { r(f, e.x - .5, top, 2, 1, snow); continue; }
    if (S === SEASONS.autumn) { r(f, e.x - .5, top, 1, 3, '#8a5a3a'); continue; }
    const kind = e.c < .55 ? 0 : e.c < .8 ? 1 : 2, col = mix(edgeCol[kind], E.bank, .2);
    if (kind === 0) for (let y = 0; y < e.h * .55; y++) r(f, e.x - (y % 2), top + y, 1, 1, y < 1 ? mix(col, '#ffffff', .3) : col);
    else if (kind === 1) { strokePath(f, [[e.x + 1, 145], [e.x + 2, top + 3]], reed); r(f, e.x - 1, top, 3, 1, col); r(f, e.x, top - 1, 1, 1, col); }
    else ell(f, e.x, top, 1.5, 1, col);
  }
  // shrubs along the bank: layered leaves with a lit side, blossom in spring and summer, berries in autumn
  const twig = mix('#6a5a4a', snowC, .3);
  for (const bu of BUSH) {
    if (bare) { for (let k = 0; k < 7; k++) strokePath(f, [[bu.x, bu.y], [bu.x + (k - 3) * bu.r * .25, bu.y - bu.r * (.4 + hash(k + bu.c) * .3)]], twig); ell(f, bu.x, bu.y - bu.r * .45, bu.r * .6, bu.r * .15, snowC); continue; }
    const T = tone(mix(S.leaves[bu.c % S.leaves.length], bankC, .35), .3);
    ell(f, bu.x, bu.y, bu.r, bu.r * .62, T.lo);
    for (let k = 0; k < 6; k++) ell(f, bu.x + (hash(bu.c * 9 + k) - .5) * bu.r * 1.2, bu.y - bu.r * .15 - hash(bu.c * 5 + k) * bu.r * .3, bu.r * .38, bu.r * .28, T.c);
    for (let k = 0; k < 4; k++) ell(f, bu.x + T.side * bu.r * (.1 + hash(bu.c * 3 + k) * .5), bu.y - bu.r * (.3 + hash(bu.c + k * 7) * .2), bu.r * .2, bu.r * .12, T.hi);
    const dots = S.blossom && bu.c % 3 === 0 ? S.blossom : S === SEASONS.autumn && bu.c % 4 === 1 ? '#c8302a' : null;
    if (dots) for (let k = 0; k < bu.r * 1.5; k++) r(f, bu.x + (hash(bu.c * 31 + k) - .5) * bu.r * 1.6, bu.y - bu.r * .1 - hash(bu.c * 37 + k) * bu.r * .45, 1, 1, dots);
  }
  // the meadow: grass tufts in three tones, stones, then wildflowers by season
  const gA = mix(reed, bankC, .3), gB = mix(gA, '#000000', .2), gC = mix(gA, light, .25 * lit);
  for (const q of TUFTS) for (let k = -2; k <= 2; k++) strokePath(f, [[q.x + k * .6, q.y], [q.x + k * 1.6, q.y - q.h * (1 - Math.abs(k) * .18)]], k === 0 ? gC : k % 2 ? gB : gA);
  ROCKS.slice(6).forEach(rocks);
  for (const m of MEADOW) {
    if (!S.bloom) { if (m.t < .38) { strokePath(f, [[m.x, m.y], [m.x, m.y - m.h]], gB); r(f, m.x - .5, m.y - m.h, 2, 1, snow || '#6a5040'); } continue; }
    const col = S.bloom[m.c % S.bloom.length];
    if (m.t < .22) { strokePath(f, [[m.x, m.y], [m.x, m.y - m.h]], gB); for (let y = 0; y < m.h * .6; y++) r(f, m.x - (y % 2), m.y - m.h + y, y > 1 ? 2 : 1, 1, y < 2 ? mix(col, '#ffffff', .3) : col); }   // lupine and foxglove spikes
    else if (m.t < .38) { strokePath(f, [[m.x, m.y], [m.x, m.y - m.h]], gB); ell(f, m.x, m.y - m.h, 2.2, .9, S === SEASONS.autumn ? '#c8b890' : '#f4f0e0'); }   // cow parsley
    else if (m.t < .62) { const p = m.c % 2 ? '#f8f6f0' : col; r(f, m.x - 1, m.y - 2, 3, 1, p); r(f, m.x, m.y - 3, 1, 3, p); r(f, m.x, m.y - 2, 1, 1, '#f0c030'); }   // daisies and asters
    else r(f, m.x, m.y - 1, 1 + (m.c % 2), 1, col);
  }
  if (S === SEASONS.autumn) for (let i = 0; i < 9; i++) { const m = MEADOW[i * 13 + 4]; r(f, m.x, m.y - 2, 1, 2, '#e8dcc8'); r(f, m.x - 1, m.y - 3, 3, 1, i % 2 ? '#c84a2a' : '#a8784a'); }
  // foreground ferns and the deck outside the glass
  for (const fe of FERNS) {
    const col = snow ? mix('#8a7a6a', snowC, .4) : mix(S.leaves ? S.leaves[1] : '#4a6a3a', bankC, .25), hi = mix(col, light, .2 * lit);
    for (let k = -3; k <= 3; k++) {
      const a = -Math.PI / 2 + k * .32, L = 14 * fe.s * (1 - Math.abs(k) * .12);
      strokePath(f, [[fe.x, fe.y], [fe.x + Math.cos(a) * L, fe.y + Math.sin(a) * L]], col, 1);
      for (let j = 3; j < L; j += 3) { const px = fe.x + Math.cos(a) * j, py = fe.y + Math.sin(a) * j; r(f, px - 1, py, 3, 1, (j / 3 + k) % 2 ? col : hi); }
    }
  }
  r(f, -10, 184, W + 20, 9, mix('#8a6a48', snowC, S.snow ? .5 : 0)); r(f, -10, 184, W + 20, 1, mix('#a8845a', snowC, S.snow ? .6 : 0));
  for (let x = 0; x < W; x += 22) r(f, x, 185, 1, 8, '#6a4a30');
  r(f, -10, 188, W + 20, 1, '#6a4a30');
  VEG = { env: E, back, front };
  return VEG;
}
function drawOutside(c, t) {
  const E = ENV, S = SEASON, snowC = mix('#f2f6fb', E.riverMid, .3);
  c.save(); c.beginPath(); c.rect(...GEO.clip); c.clip(); c.translate(0, GEO.outDY);
  // sky, stars, sun or moon (farthest layer)
  c.save(); c.translate(...off(3));
  const sky = c.createLinearGradient(0, 0, 0, SKY);
  sky.addColorStop(0, E.skyTop); sky.addColorStop(.42, E.skyMid); sky.addColorStop(.8, E.skyLow); sky.addColorStop(1, E.skyHor);
  c.fillStyle = sky; c.fillRect(-10, -10, W + 20, SKY + 14);
  if (E.stars > .02) for (const st of STARS) r(c, st.x, st.y, 1, 1, `rgba(236,228,246,${E.stars * (.25 + .35 * (reduce ? 1 : (Math.sin(t * 1.3 + st.p) * .5 + .5)))})`);
  const body = skyBody(E.hour);
  if (body && body.sun) { glow(c, body.x, body.y, 40, mix('#ffb070', '#fff4d8', body.lift), .5); ell(c, body.x, body.y, 4.5, 4.5, mix('#ffb070', '#fff8e8', body.lift)); }
  else if (body) { glow(c, body.x, body.y, 26, '#c8d0f0', .25); ell(c, body.x, body.y, 3.5, 3.5, '#e8eaf4'); ell(c, body.x + 1.6, body.y - .7, 2.8, 2.8, E.skyMid); }
  glow(c, W * .55, 88, 120, E.glowCol, E.glowA);
  for (let fl = 0; fl < 2; fl++) {                                                   // two flocks of birds
    const bp = ((t + fl * 6) % 13) / 7, bird = mix('#2a2438', '#3a3a48', 1 - E.lamp);
    if (bp < 1) for (let k = 0; k < 4; k++) {
      const bx = -8 + bp * (W + 16) - k * 6, by = 26 + fl * 14 + k * 2 + Math.sin(t * 2 + k) * .8, up = Math.floor(t * 4 + k) % 2;
      r(c, bx - 1, by - up, 1, 1, bird); r(c, bx, by, 1, 1, bird); r(c, bx + 1, by - up, 1, 1, bird);
    }
  }
  c.restore();

  // landscape on its own layer, so the night shade spares the sky: cached vegetation plus the moving parts
  const g = lc, G = k => { const [dx, dy] = off(k); g.setTransform(1, 0, 0, 1, dx, dy); };
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const V = vegLayers(E, S, snowC);
  G(2.2); g.drawImage(V.back, 0, 0);
  G(1.5);
  for (let y = RIV0 + 2; y < RIV1 - 1; y += 2) {
    const sp = 2 + (y - RIV0) * .2;
    for (let i = 0; i < 12; i++) {
      const x = ((hash(y * 7 + i) * W + t * sp * (i % 2 ? 1 : -.6)) % W + W) % W;
      r(g, x, y, 3 + (y - RIV0) / 5, 1, rgba(E.ripple, E.rippleA * (.7 + .5 * hash(y + i))));
    }
  }
  if (S.snow) { const ice = mix('#dfe8f2', E.riverMid, .3); r(g, -10, RIV0, W + 20, 1, ice); r(g, -10, RIV1 - 4, W + 20, 3, ice); }
  G(1.0); g.drawImage(V.front, 0, 0);
  // a heron fishing by the far post, cattails and meadow grass moving in the wind
  const dip = reduce ? 0 : Math.max(0, Math.sin(((t % 12) - 8) / 4 * Math.PI)) * ((t % 12) > 8 ? 1 : 0);
  r(g, 70, 132, 1, 8, '#2a2a30'); r(g, 72, 132, 1, 8, '#2a2a30'); ell(g, 71, 130, 4, 2.2, '#8a8e9a'); r(g, 67, 129, 2, 1, '#5a5e6a');
  strokePath(g, [[73, 129], [74, 124 + dip * 3], [73, 121 + dip * 5]], '#9a9eaa', 1);
  r(g, 73, 120 + dip * 5, 2, 1, '#9a9eaa'); r(g, 75, 121 + dip * 5, 2, 1, '#d8a040');
  const reed = mix(S.reed, E.bank, .4), bankC = mix(E.bank, S.snow ? snowC : S.bank, S.bankMix);
  for (const q of CATTAILS) {
    const sw = reduce ? 0 : Math.sin(t * .9 + q.p) * 1.4;
    strokePath(g, [[q.x, 146], [q.x + sw, 146 - q.h]], reed, 1);
    if (!S.snow) r(g, q.x + sw - .5, 146 - q.h + 1, 2, 4, '#6a4428');
  }
  const blade = mix(reed, bankC, .3);
  GRASS.forEach((q, i) => { if (i % 3) return; const sw = reduce ? 0 : Math.sin(t * 1.1 + q.p) * 1.2; strokePath(g, [[q.x, q.y], [q.x + sw, q.y - q.h]], blade, 1); });
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (E.shadeA > .01) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba(E.shadeCol, E.shadeA); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  c.drawImage(LAND, 0, 0);

  // light and air over the landscape
  if (body) {
    c.save(); c.translate(...off(1.5));
    const ga = body.sun ? .35 + .2 * (1 - body.lift) : .3;
    for (let y = RIV0 + 1; y < RIV1 - 6; y += 2) if (hash(y * 3 + Math.floor(t * 3)) < .7) r(c, body.x + (hash(y + Math.floor(t * 2)) - .5) * (y - RIV0 + 4) * .7, y, 2 + (y - RIV0) / 6, 1, rgba(body.sun ? mix('#ffd6a0', '#ffffff', body.lift) : '#dfe4f8', ga));
    c.restore();
  }
  c.save(); c.translate(...off(1.4));
  for (const [x0, y, w, a] of MIST) { const x = ((x0 + t * 1.4) % (W + w)) - w / 2; ell(c, x, y, w / 2, 3, `rgba(236,224,232,${Math.min(.5, a * E.mist)})`); }
  c.restore();
  if (S.particles) {
    const [px, py] = off(1.2), n = S.particles === 'snow' ? 60 : 22, dim = 1 - E.shadeA * .6;
    for (let i = 0; i < n; i++) {
      const q = PARTS[i];
      if (S.particles === 'snow') {
        const y = ((q.y * 192 + t * (6 + q.v * 7)) % 192), x = (((q.x * W + Math.sin(t * .6 + q.p) * 3 + t * 1.5) % W) + W) % W;
        r(c, x + px, y + py, 1, 1, `rgba(240,244,250,${.8 * dim})`);
      } else {
        const y = ((q.y * 192 + t * (3 + q.v * 3)) % 192), x = (((q.x * W - t * (2 + q.v * 3) + Math.sin(t * 1.3 + q.p) * 3) % W) + W) % W;
        r(c, x + px, y + py, 1, 1, rgba(S.particles === 'leaves' ? S.canopy[i % S.canopy.length] : (i % 2 ? '#f4c0d0' : '#ffffff'), .9 * dim));
      }
    }
  }
  if (E.flies * S.flies > .02) {
    const [px, py] = off(1);
    for (const f of FLIES) {
      const a = E.flies * S.flies * (reduce ? .6 : clamp(Math.sin(t * 1.7 + f.p) * 1.4 - .3));
      if (a <= 0) continue;
      const x = f.x + px + Math.sin(t * .5 + f.p) * f.r, y = f.y + py + Math.cos(t * .4 + f.p * 2) * 2;
      r(c, x, y, 1, 1, `rgba(220,255,140,${a})`); glow(c, x, y, 4, '#d8ff80', .35 * a);
    }
  }
  c.fillStyle = 'rgba(12,14,22,.2)'; c.fillRect(0, 0, W, 192);              // tinted glass: dims the view a little for more contrast
  if (S.frost) for (const [x, y, a] of FROST) r(c, x, y, 1, 1, `rgba(232,240,255,${a * .5 * S.frost})`);
  c.restore();
}

// ---------- static room (albedo) ----------
function drawRoom(c) {
  // floor-to-ceiling glass: everything above the floor stays transparent except the frame
  const frame = '#1c1c20', edge = '#3a3a42';
  r(c, 0, 0, W, 2, frame); r(c, 0, 2, W, 1, edge);
  for (const x of [0, 95, 191, 287, 382]) { r(c, x, 0, 2, 192, frame); r(c, x + 1, 0, 1, 192, edge); }
  r(c, 0, 190, W, 2, frame);
  // station clock on a rod from the ceiling beam (hands are drawn every frame)
  const K = GEO.clock;
  r(c, K.x - .5, 0, 1, K.y - 10, '#2a2a2e');
  ell(c, K.x, K.y, 10.5, 10.5, '#2a2a2e'); ell(c, K.x, K.y, 9, 9, '#ece6da');
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, rr = k % 3 ? 7.4 : 6.8; r(c, K.x + Math.sin(a) * rr - .5, K.y - Math.cos(a) * rr - .5, 1, k % 3 ? 1 : 1.6, '#6a6458'); }
}

// ---------- desk layer (albedo; shifts slightly against the wall for parallax) ----------
function drawDesk(c) {
  // ---------- under the desk: dark walnut floor and a plain wool rug ----------
  r(c, 0, 192, W, 4, '#2a2a2e'); r(c, 0, 192, W, 1, '#5a5a62');                 // threshold under the glass
  r(c, 0, 196, W, 20, '#57402f');
  for (let y = 201, i = 0; y < 216; y += 6, i++) { r(c, 0, y, W, 1, '#46332a'); for (let x = (i * 71) % 120; x < W; x += 140) r(c, x, y - 5, 1, 5, '#46332a'); }
  poly(c, [[70, 204], [250, 204], [264, 216], [56, 216]], '#45413e'); r(c, 68, 204, 184, 1, '#524d49');
  const under = c.createLinearGradient(0, 161, 0, 204);
  under.addColorStop(0, 'rgba(20,10,6,.5)'); under.addColorStop(1, 'rgba(20,10,6,0)');
  c.fillStyle = under; c.fillRect(0, 161, W, 43);
  // slim black steel frame (no drawers)
  r(c, 16, 159, 352, 2, '#2a2a2e');
  for (const lx2 of [16, 364]) { r(c, lx2, 159, 3, 54, '#2a2a2e'); r(c, lx2, 159, 1, 54, '#4a4a52'); r(c, lx2 - 3, 213, 9, 1, '#18181c'); }
  // ---------- desk top: light oak, thin front edge ----------
  poly(c, [[6, 146], [384, 146], [384, 156], [0, 156]], '#bf9468');
  const gr = mulberry32(21);
  for (let i = 0; i < 60; i++) { const y = 147 + (gr() * 9 | 0), x = gr() * W, w = 10 + gr() * 50; r(c, x, y, w, 1, gr() < .5 ? '#c9a078' : '#b0855a'); }
  r(c, 0, 146, W, 1, '#d8ae80');
  r(c, 0, 156, W, 3, '#a47a52'); r(c, 0, 156, W, 1, '#e0b88a'); r(c, 0, 158, W, 1, '#6a4a30');
  // shadows on the desk
  for (const [x, w] of [[94, 42], [138, 14], [164, 26], [196, 116], [314, 18], [338, 14], [356, 24]]) r(c, x, 150, w, 2, 'rgba(40,20,10,.3)');
  // minimal desk lamp on the right: black stem, arm and a small head over the phone
  ell(c, 344, 149, 6, 1.6, '#2a2a2e'); r(c, 338, 149, 13, 1, '#18181c');
  r(c, 343, 100, 1, 49, '#2a2a2e'); r(c, 330, 100, 14, 1, '#2a2a2e');
  r(c, 322, 99, 12, 4, '#2a2a2e'); r(c, 322, 99, 12, 1, '#4a4a52');
  // notebook and pen
  poly(c, [[96, 148], [115, 148], [115, 154], [94, 154]], '#e6dac0');
  poly(c, [[115, 148], [133, 148], [135, 154], [115, 154]], '#ded1b4');
  r(c, 114, 148, 1, 6, '#b8a888');
  for (let i = 0; i < 3; i++) { r(c, 98, 149 + i * 2, 14, 1, '#c8bca0'); r(c, 117, 149 + i * 2, 14, 1, '#c8bca0'); }
  r(c, 120, 152, 12, 1, '#2a2a3a');
  // mug
  r(c, 140, 138, 9, 10, '#e9e4da'); r(c, 147, 138, 2, 10, '#cfc8bc');
  r(c, 149, 140, 3, 1, '#e9e4da'); r(c, 151, 140, 1, 6, '#e9e4da'); r(c, 149, 145, 3, 1, '#e9e4da');
  r(c, 141, 138, 7, 1, '#3a2418');
  // monitor: 40-inch curved ultrawide on a slim aluminium stand
  poly(c, [[246, 130], [258, 130], [257, 146], [247, 146]], '#8c9098'); r(c, 256, 130, 2, 16, '#6c7078'); r(c, 247, 130, 1, 16, '#a8acb4');
  poly(c, [[234, 145], [270, 145], [274, 149], [230, 149]], '#a4a8b0'); r(c, 234, 145, 36, 1, '#c4c8d0'); r(c, 230, 148, 44, 1, '#70747c');
  for (let i = -2; i < MON.w + 2; i++) { const { top, h } = monCol(clamp(i, 0, MON.w - 1)); r(c, MON.x + i, top - 1.5, 1, h + 3, '#16181c'); }
  for (let i = 0; i < MON.w; i++) { const { top, h } = monCol(i); r(c, MON.x + i, top + h + 1, 1, 1, '#2c2f36'); }
  r(c, MON.x + MON.w / 2 - 1, MON.cy - MON.h0 / 2 - 1.5, 2, 1, '#30343a');
  // desk mat
  poly(c, [[210, 149], [308, 149], [312, 156], [206, 156]], '#3e4c46'); r(c, 206, 155, 106, 1, '#2e3a35');
  // retro mechanical keyboard: beige case, sculpted two-tone keycaps, accent keys and a coiled cable
  for (const [x, y] of [[253, 146], [254, 147], [253, 148]]) r(c, x, y, 1, 1, '#4fa898');
  poly(c, [[221, 148], [287, 148], [290, 158], [218, 158]], '#d6cfbd');
  r(c, 221, 148, 66, 1, '#ebe5d6'); r(c, 218, 157, 72, 1, '#a39a86'); r(c, 286, 149, 2, 8, '#c4bca8');
  const key = (x, y, w, top, side) => { r(c, x, y, w, 1, top); r(c, x, y + 1, w, 1, side); };
  const BEIGE = ['#efe9dc', '#bbb29f'], GREY = ['#938d80', '#6c675c'], ORANGE = ['#e8763e', '#a8502c'], TEAL = ['#52aa9a', '#357a6e'];
  for (let j = 0; j < 4; j++) {
    const y = 149 + j * 2, x0 = 222 - j * .75, x1 = 286 + j * .75;
    if (j < 3) {
      for (let x = x0, k = 0; x + 2 <= x1; x += 3, k++) {
        const last = x + 5 > x1;
        const col = j === 0 && k === 0 ? ORANGE : j === 1 && last ? TEAL : j === 0 && x > 276 ? GREY : BEIGE;
        key(x, y, j === 1 && last ? 3 : 2, col[0], col[1]);
      }
    } else {
      for (const x of [x0, x0 + 3, x0 + 6, x1 - 8, x1 - 5, x1 - 2]) key(x, y, 2, GREY[0], GREY[1]);
      key(x0 + 9, y, 44, BEIGE[0], BEIGE[1]);
    }
  }
  // minimal mouse
  ell(c, 299, 152, 2.6, 1.6, '#ecebe6'); r(c, 298, 151, 2, 1, '#ffffff');
  // tablet on a slim stand, left of the screen (the CV)
  ell(c, 176, 148, 9, 1.5, '#a4a8b0'); r(c, 167, 148, 18, 1, '#70747c');
  r(c, 174, 139, 3, 9, '#9a9ea6'); r(c, 176, 139, 1, 9, '#7a7e86');
  r(c, 160, 116, 30, 24, '#1a1c20'); r(c, 160, 116, 30, 1, '#34363c'); r(c, 162, 118, 26, 20, '#0e1014');
  // phone on an oak charging dock, right of the screen (contact)
  poly(c, [[314, 148], [330, 148], [328, 140], [316, 140]], '#b48a5e'); r(c, 314, 147, 16, 1, '#8a6440');
  r(c, 316, 124, 11, 19, '#141518'); r(c, 316, 124, 11, 1, '#34363c'); r(c, 317, 126, 9, 15, '#0e1014');
  r(c, 321, 125, 1, 1, '#2a2c30');
  // plant in a white ceramic pot
  const LEAF = [[364, 118, 4, 11, -.5, '#4a7a46'], [370, 116, 4, 12, .4, '#3a6438'], [360, 124, 3, 9, -1.1, '#3a6438'], [374, 123, 3, 9, 1.0, '#4a7a46'], [367, 110, 3, 10, .05, '#5a8a50']];
  for (const [x, y, a, b, rot, col] of LEAF) ell(c, x, y, a, b, col, rot);
  poly(c, [[359, 133], [377, 133], [375, 148], [361, 148]], '#e2ddd3'); r(c, 358, 132, 20, 2, '#f0ece4'); r(c, 374, 134, 2, 14, '#c8c2b6');
}

// ---------- light map ----------
function drawLight(c) {
  const E = ENV;
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = E.ambient; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  glow(c, 192, 70, 260, E.winCol, E.winA * 1.1);               // sky light through the glass wall
  glow(c, 90, 104, 90, '#4a8070', .18);
  glow(c, ...GEO.lamp.light, 140, '#ffa860', .8 * E.lamp);       // desk lamp
  glow(c, ...GEO.lamp.pool, 60, '#ffcf90', .45 * E.lamp);
  glow(c, MON.x + MON.w / 2, 112, 96, '#6a88c0', .38);           // the screen
  glow(c, GEO.tablet[0] + GEO.tablet[2] / 2, GEO.tablet[1] + GEO.tablet[3] / 2, 30, '#fff2dc', .12);   // the tablet
  glow(c, ...GEO.kbd, 26, '#7a9ad0', .3);                        // screen light on the keyboard
  const sun = sunInfo(E);
  if (sun) {                                                     // the window, projected onto the sill and the desk by the sun
    const S0 = GEO.sill, [D0, D1] = GEO.desk, DM = (D0 + D1) / 2;
    for (const [x0, x1] of GEO.panesX) {
      poly(c, [[x0 + sun.dx * .2, S0], [x1 + sun.dx * .2, S0], [x1 + sun.dx * .25, S0 + 2], [x0 + sun.dx * .25, S0 + 2]], rgba(sun.col, .45 * sun.s));
      poly(c, [[x0 + sun.dx * .9, D0], [x1 + sun.dx * .9, D0], [x1 + sun.dx * 1.0 + 3, DM - 1], [x0 + sun.dx * 1.0 - 3, DM - 1]], rgba(sun.col, .55 * sun.s));
      poly(c, [[x0 + sun.dx * 1.05 - 4, DM + 1], [x1 + sun.dx * 1.05 + 4, DM + 1], [x1 + sun.dx * 1.15 + 6, D1], [x0 + sun.dx * 1.15 - 6, D1]], rgba(sun.col, .55 * sun.s));
    }
  }
  if (E.lamp > .05) {                                            // the lamp's cone onto the desk
    const lg = c.createLinearGradient(0, GEO.lamp.cone[0][1], 0, GEO.lamp.cone[2][1]);
    lg.addColorStop(0, rgba('#ffc080', .35 * E.lamp)); lg.addColorStop(1, rgba('#ffc080', .15 * E.lamp));
    const cn = GEO.lamp.cone; c.fillStyle = lg; c.beginPath(); c.moveTo(...cn[0]); for (const q of cn.slice(1)) c.lineTo(...q); c.fill();
  }
  glow(c, 200, 112, 170, '#b07050', .22 + .2 * E.lamp);          // warm fill
  c.globalCompositeOperation = 'source-over';
}
function drawVignette() {
  vx.clearRect(0, 0, VW, VH);
  const g = vx.createRadialGradient(VW / 2, VH / 2 + 4, 130, VW / 2, VH / 2, 300);
  g.addColorStop(0, 'rgba(8,6,12,0)'); g.addColorStop(1, `rgba(8,6,12,${ENV.vig})`);
  vx.fillStyle = g; vx.fillRect(0, 0, VW, VH);
}
function updateEnv() { ENV = envAt(hourNow()); drawLight(lx); drawVignette(); if (typeof updateShell === 'function') updateShell(); }

// clock hands, drawn as single pixels so they stay crisp
function drawClockHands(c) {
  const h = hourNow(), sec = FIXED ? 0 : new Date().getSeconds(), K = GEO.clock;
  if (K.cover) ell(c, K.x, K.y, K.cover, K.cover, K.face);       // hide the hands painted in the still
  const hand = (turn, len, col) => { const a = turn * TAU; for (let i = 0; i <= len; i += .5) r(c, K.x + Math.sin(a) * i - .5, K.y - Math.cos(a) * i - .5, 1, 1, col); };
  hand((h % 12) / 12, K.h, '#2a2a2e');
  hand(((h * 60) % 60) / 60, K.m, '#2a2a2e');
  if (!reduce) hand(sec / 60, K.s, '#c84a3a');
  r(c, K.x - .5, K.y - .5, 1, 1, '#c84a3a');
}

// ---------- emissive pass ----------
let bootT = /[?&]og=1/.test(location.search) ? -30 : 0;   // the preview capture shows the screen fully on, with a keyword typed
function drawEmissive(c, t, hover) {
  // sunbeams through the lower window and dust drifting in them
  const sun = sunInfo(ENV);
  if (sun) {
    c.globalCompositeOperation = 'lighter';
    const G0 = GEO.glassBottom, D1 = GEO.desk[1], span = D1 - G0;
    for (const [x0, x1] of GEO.panesX) {
      const bg = c.createLinearGradient(0, G0, 0, D1);
      bg.addColorStop(0, rgba(sun.col, 0)); bg.addColorStop(.3, rgba(sun.col, .09 * sun.s)); bg.addColorStop(1, rgba(sun.col, .03 * sun.s));
      c.fillStyle = bg; c.beginPath(); c.moveTo(x0 + 2, G0); c.lineTo(x1 - 2, G0); c.lineTo(x1 + sun.dx * 1.15 + 6, D1); c.lineTo(x0 + sun.dx * 1.15 - 6, D1); c.fill();
    }
    for (const m of MOTES) {
      const px0 = GEO.panesX[0][0], pw = GEO.panesX[1][1] - px0, y = G0 + 2 + ((m.y * (span - 3) + t * m.v) % (span - 3)), k = (y - G0) / span, x = px0 + 2 + m.x * (pw - 4) + sun.dx * 1.15 * k + Math.sin(t * .4 + m.p) * 2;
      const a = sun.s * (.2 + .35 * Math.sin(t * 1.1 + m.p * 3));
      if (a > 0) r(c, x, y, 1, 1, rgba('#fff4dc', a));
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.save(); c.translate(DDX, DDY);
  // soft shadows cast by the lamp (down and to the left)
  if (GEO.shadows && ENV.lamp > .05) {
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = .5 * ENV.lamp;
    ell(c, 311, 150, 6, 1.4, '#6a5a60'); ell(c, 294, 153.5, 3, 1, '#6a5a60'); ell(c, 236, 149.6, 6, 1, '#6a5a60');
    poly(c, [[218, 149], [221, 149], [214, 158], [211, 158]], '#6a5a60');
    poly(c, [[170, 148], [176, 148], [168, 152], [162, 152]], '#6a5a60');
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  // lamp bulb
  if (ENV.lamp > .05) { const [bx, by, bw] = GEO.lamp.bulb; r(c, bx, by, bw, 1, rgba('#ffe7b0', Math.min(1, ENV.lamp * 1.2))); glow(c, ...GEO.lamp.glow, 24, '#ffb060', .42 * ENV.lamp); }
  // curved ultrawide: the desktop is drawn flat, then warped column by column (taller at the edges)
  const flick = reduce ? 1 : .97 + .03 * hash(Math.floor(t * 8));
  drawDesktop(sc, t, hover);
  c.imageSmoothingEnabled = false;
  for (let i = 0; i < MON.w; i++) { const { top, h } = monCol(i); c.drawImage(SCR, i, 0, 1, SCR.height, MON.x + i, top, 1, h); }
  c.globalCompositeOperation = 'lighter';
  glow(c, MON.x + MON.w / 2, MON.cy, 64, '#7a90c8', .13 * flick);
  glow(c, MON.x + MON.w / 2, MON.cy - 22, 44, '#8a9ad8', .07);
  c.globalCompositeOperation = 'source-over';
  // LEDs
  r(c, MON.x + MON.w - 5, MON.cy + MON.h0 / 2 + 2, 1, 1, '#e8f0ff');
  // tablet: the CV as a document
  { const [tx, ty, tw, th] = GEO.tablet;
    r(c, tx, ty, tw, th, '#f4f1ea');
    text(c, 'CV', tx + 2, ty + 2, '#2a2e38'); r(c, tx + 11, ty + 3, tw - 14, 1, '#8a8e98'); r(c, tx + 11, ty + 5, tw - 18, 1, '#b4b8c0');
    r(c, tx + 2, ty + 9, 6, 1, '#4fa898');
    for (let i = 0; ty + 12 + i * 2 < ty + th - 1; i++) r(c, tx + 2, ty + 12 + i * 2, i % 3 === 2 ? tw - 12 : tw - 4, 1, '#c4c0b6');
    c.globalCompositeOperation = 'lighter'; glow(c, tx + tw / 2, ty + th / 2, 22, '#fff2dc', .1); c.globalCompositeOperation = 'source-over'; }
  // phone: a short conversation and a pulsing notification
  { const [qx, qy, qw, qh] = GEO.phone;
    r(c, qx, qy, qw, qh, '#121a24');
    for (let i = 0; qy + 2 + i * 3 + 2 <= qy + qh; i++) r(c, i % 2 ? qx + qw - 6 : qx + 1, qy + 2 + i * 3, i % 2 ? 5 : 6, 2, i % 2 ? '#4fa898' : '#3a4656');
    if (reduce || Math.floor(t * 1.5) % 2 === 0) { r(c, qx + qw - 1, qy, 1, 1, '#7ff5d2'); glow(c, qx + qw - 1, qy, 4, '#7ff5d2', .5); }
    c.globalCompositeOperation = 'lighter'; glow(c, qx + qw / 2, qy + qh / 2, 12, '#6ab8d0', .1); c.globalCompositeOperation = 'source-over'; }
  // steam over the mug
  if (!reduce) for (let i = 0; i < 4; i++) {
    const ph = (t * .45 + i / 4) % 1;
    r(c, GEO.mug[0] + Math.sin(ph * 7 + i * 2) * 1.6, GEO.mug[1] - ph * 10, 1, 1, `rgba(240,235,225,${(1 - ph) * .32})`);
  }
  c.restore();
}

const KEYWORDS = ['TOURISM', 'INVESTMENT', 'DEVELOPMENT', 'OPEN DATA'];
// the flat desktop shown on the curved screen, one row per screen pixel in the middle (92 x 30 for the code-drawn
// monitor; rebuilt to the painted monitor's size): dusk wallpaper, a profile window, a clock widget and a dock
const SCR = document.createElement('canvas'), sc = SCR.getContext('2d');
let WALL, SW = 0, SH = 0;
function buildScreen() {
  SW = MON.w; SH = Math.round(MON.h0); SCR.width = SW; SCR.height = SH;
  WALL = document.createElement('canvas'); WALL.width = SW; WALL.height = SH; const g = WALL.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, SH); sky.addColorStop(0, '#2c3d5c'); sky.addColorStop(.5, '#a07090'); sky.addColorStop(.8, '#eaa878'); sky.addColorStop(1, '#f2c08c');
  g.fillStyle = sky; g.fillRect(0, 0, SW, SH);
  const hz = Math.round(SH * .6), lake = Math.round(SH * .8), q = mulberry32(5), pts = [[0, SH]];
  for (let x = 0; x <= SW; x += 6) pts.push([x, hz - q() * 6]); pts.push([SW, SH]);
  poly(g, pts, '#5a5478');
  for (let x = 0; x < SW; x += 2 + q() * 2) poly(g, [[x, hz - q() * 4], [x - 2, lake], [x + 2, lake]], '#1f3330');
  g.fillStyle = '#c08a80'; g.fillRect(0, lake, SW, SH - lake);
  g.fillStyle = 'rgba(255,230,200,.35)'; for (let y = lake + 1; y < SH; y += 2) g.fillRect((y * 13) % Math.max(1, SW - 22), y, 10, 1);
}
buildScreen();
function drawDesktop(g, t, hover) {
  const bt = t - bootT, wx = Math.round(SW * .15), wy = Math.max(3, Math.round(SH / 2 - 12)), cx = SW - 25, dx = Math.round(SW / 2 - 16);
  g.drawImage(WALL, 0, 0);
  // menu bar with a clock
  g.fillStyle = 'rgba(12,14,20,.6)'; g.fillRect(0, 0, SW, 2);
  r(g, 2, 0, 1, 1, '#e8ecf4'); r(g, SW - 15, 0, 12, 1, '#e8ecf4');
  // profile window
  r(g, wx + 1, wy + 1, 50, 21, 'rgba(0,0,0,.35)');
  r(g, wx, wy, 50, 21, '#141a22'); r(g, wx, wy, 50, 2, '#232c38');
  r(g, wx + 2, wy, 1, 1, '#ff5f57'); r(g, wx + 4, wy, 1, 1, '#febc2e'); r(g, wx + 6, wy, 1, 1, '#28c840');
  // name typed once, then the main keywords typed in turn (or the section under the pointer)
  const k = Math.floor((bt - .6) * 18);
  let used = 0;
  ['JOST', 'NEUMANN'].forEach((s, i) => { text(g, s.slice(0, clamp(k - used, 0, s.length)), wx + 3, wy + 3 + i * 6, '#f0f4f8'); used += s.length; });
  if (k > used) {
    const p = Math.max(0, bt - 1.4), kw = KEYWORDS[Math.floor(p / 3) % KEYWORDS.length];
    const l3 = hover ? hover.line : kw.slice(0, Math.floor((p % 3) * 14));
    text(g, l3, wx + 3, wy + 15, '#7ff5d2');
    if (Math.floor(t * 2) % 2 === 0) r(g, wx + 3 + l3.length * 4, wy + 15, 1, 5, '#7ff5d2');
  }
  // clock widget with the local time
  r(g, cx, wy, 22, 11, '#141a22'); r(g, cx, wy, 22, 2, '#232c38');
  const hr = hourNow(), hh = String(Math.floor(hr)).padStart(2, '0'), mm = String(Math.floor((hr * 60) % 60)).padStart(2, '0');
  text(g, hh + (reduce || Math.floor(t * 2) % 2 === 0 ? ':' : ' ') + mm, cx + 2, wy + 4, '#e8ecf4');
  // dock
  r(g, dx, SH - 4, 32, 4, 'rgba(14,16,24,.65)');
  ['#5ac8fa', '#ffcc4a', '#7ff5d2', '#ff7a5a', '#b28af0', '#e8ecf4'].forEach((col, i) => r(g, dx + 2 + i * 5, SH - 3, 3, 2, col));
  // edge shading and a soft glare across the panel
  const eg = g.createLinearGradient(0, 0, SW, 0);
  eg.addColorStop(0, 'rgba(0,0,0,.28)'); eg.addColorStop(.15, 'rgba(0,0,0,0)'); eg.addColorStop(.85, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = eg; g.fillRect(0, 0, SW, SH);
  g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(SW * .56, 0); g.lineTo(SW * .7, 0); g.lineTo(SW * .46, SH); g.lineTo(SW * .32, SH); g.fill();
  // wake-up fade
  if (bt < .6) { g.fillStyle = `rgba(0,0,0,${1 - bt / .6})`; g.fillRect(0, 0, SW, SH); }
}

function drawHover(c, t, s) {
  if (!s) return;
  const a = .65 + .35 * Math.sin(t * 6), col = `rgba(255,231,168,${a})`, x0 = s.x - 2, y0 = s.y - 2, x1 = s.x + s.w + 1, y1 = s.y + s.h + 1, k = 4;
  c.fillStyle = col;
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    c.fillRect(Math.min(x, x + dx * k), y, k, 1); c.fillRect(x, Math.min(y, y + dy * k), 1, k);
  }
}

drawRoom(rm);
drawDesk(dk);

// ---------- painted still (engine option B) ----------
// With ?still=1, assets/room-still.png replaces the code-drawn room and desk. Flat magenta (#ff00ff) marks the
// window glass, which becomes transparent so the live sky and landscape show through; screens, clock hands, steam
// and all lighting stay in code. The code-drawn room is the default. ?export=reference saves the code-drawn
// room as a 1536x864 composition reference into the iahpixel stills folder (server on port 8795).
const QS = new URLSearchParams(location.search);
let stillMode = false;
// geometry of assets/room-still.png (Nano Banana Pro, 23 October 2026), measured from its magenta glass and black
// screens and mapped to the 384x216 native pixels
const STILL_GEO = {
  geo: {
    clip: [44, 22, 85, 86], outDY: -6,
    panesX: [[44, 80], [92, 129]], glassBottom: 107, sill: 112, desk: [130, 152],
    lamp: { bulb: [307, 97, 10], glow: [312, 99], light: [312, 102], cone: [[306, 97], [318, 97], [334, 140], [290, 140]], pool: [313, 140] },
    kbd: [248, 141], tablet: [165, 113, 28, 22], phone: [301, 116, 9, 15], mug: [110, 127],
    clock: { x: 356.5, y: 33, h: 4.5, m: 7, s: 7.5, cover: 7.5, face: '#ebe2d0' }, shadows: false
  },
  mon: { x: 205, w: 87, cy: 95.7, h0: 41, k: .05 },
  spots: { about: [202, 72, 93, 77], experience: [240, 18, 96, 47], cv: [159, 106, 39, 36], contact: [295, 110, 22, 30], writing: [56, 132, 47, 20] }
};
if (QS.get('still') === '1') {
  const img = new Image();
  img.onload = () => {
    const big = document.createElement('canvas'); big.width = img.width; big.height = img.height;
    const bx = big.getContext('2d'); bx.drawImage(img, 0, 0);
    const d = bx.getImageData(0, 0, big.width, big.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 170 && px[i + 2] > 170 && px[i + 1] < 110 && Math.abs(px[i] - px[i + 2]) < 70) px[i + 3] = 0;
    bx.putImageData(d, 0, 0);
    rm.clearRect(0, 0, W, H); rm.imageSmoothingEnabled = true; rm.imageSmoothingQuality = 'high'; rm.drawImage(big, 0, 0, W, H);
    const sm = rm.getImageData(0, 0, W, H), q = sm.data;
    for (let i = 0; i < q.length; i += 4) q[i + 3] = q[i + 3] < 150 ? 0 : 255;
    rm.putImageData(sm, 0, 0);
    dk.clearRect(0, 0, W, H); stillMode = true;
    Object.assign(GEO, STILL_GEO.geo); Object.assign(MON, STILL_GEO.mon); buildScreen();
    for (const sp of SPOTS) [sp.x, sp.y, sp.w, sp.h] = STILL_GEO.spots[sp.id];
    updateEnv();
  };
  img.src = 'assets/room-still.png';
}
if (QS.get('export') === 'reference') {
  const K = 4, ref = document.createElement('canvas'); ref.width = W * K; ref.height = H * K;
  const g = ref.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#6e4b33'; g.fillRect(0, 0, ref.width, ref.height);
  g.drawImage(ROOM, 0, 0, ref.width, ref.height); g.drawImage(DESKL, 0, 0, ref.width, ref.height);
  g.fillStyle = '#ff00ff'; for (const [x, y, w, h] of PANES) g.fillRect(x * K, y * K, w * K, h * K);
  g.fillStyle = '#000000';
  for (let i = 0; i < MON.w; i++) { const { top, h } = monCol(i); g.fillRect((MON.x + i) * K, Math.round(top * K), K, Math.round(h * K)); }
  for (const [x, y, w, h] of [GEO.tablet, GEO.phone]) g.fillRect(x * K, y * K, w * K, h * K);
  ref.toBlob(b => fetch('http://localhost:8795/save?name=stills/cabin-office/reference.png', { method: 'POST', mode: 'no-cors', body: new Blob([b], { type: 'text/plain' }) })
    .then(() => console.log('reference saved')), 'image/png');
}
// ---------- room shell: one-point perspective around the back wall (the 384x216 scene above) ----------
// The displayed canvas is 480x270; the back wall sits at (OX, OY). Ceiling beams, side walls and floor planks run
// towards the vanishing point; a desk chair and a monstera in the foreground frame the view and move with the parallax.
const VPX = 240, VPY = 120;
const toY = (x, y, yT) => VPX + (x - VPX) * (yT - VPY) / (y - VPY);          // x on the ray from VP through (x, y), at height yT
const toX = (x, y, xT) => VPY + (y - VPY) * (xT - VPX) / (x - VPX);          // y on the same ray, at x = xT
const SHB = document.createElement('canvas'), SHF = document.createElement('canvas'), SHL = document.createElement('canvas'), SHM = document.createElement('canvas');
const LITB = document.createElement('canvas'), LITF = document.createElement('canvas');
for (const c of [SHB, SHF, SHL, SHM, LITB, LITF]) { c.width = VW; c.height = VH; }
const sb = SHB.getContext('2d'), sf = SHF.getContext('2d'), sl = SHL.getContext('2d'), sm = SHM.getContext('2d');
let ART = [24, 90];                                // centre of the print on the left wall
const ART_Q = QS.get('art');
const ART_KIND = ['bulb', 'hiroshige'].includes(ART_Q) ? ART_Q : ART_Q === 'topo' && window.TOPO ? 'topo' : window.DOTS ? 'dots' : window.TOPO ? 'topo' : 'hiroshige';
const LIVE = { dots: window.DOTS, topo: window.TOPO }[ART_KIND], LIVE_FPS = ART_KIND === 'dots' ? 20 : 8;   // the live print and its steps per second
let ARTGEO = null;                                 // the print's wall mapping, set when the shell is drawn
// the live print (dots.js by default, topo.js with ?art=topo): drawn into its own small canvas, stretched column by column onto the wall in perspective,
// lit like the shell and cached until its next step
const TOPO_C = document.createElement('canvas'), ARTW = document.createElement('canvas');
let topoStep = -1;
function drawArtLive(c, t) {
  if (!LIVE || !ARTGEO) return;
  const step = Math.floor(t * LIVE_FPS);
  if (step !== topoStep) {
    topoStep = step;
    const { W: TW, H: TH } = LIVE; TOPO_C.width = TW; TOPO_C.height = TH; ARTW.width = VW; ARTW.height = VH;
    const tg = TOPO_C.getContext('2d'), img = tg.createImageData(TW, TH);
    LIVE.draw(step / LIVE_FPS, (x, y, col) => { const i = (y * TW + x) * 4, n = parseInt(col.slice(1), 16); img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255; });
    tg.putImageData(img, 0, 0);
    const w = ARTW.getContext('2d');
    w.imageSmoothingEnabled = false;
    for (let x = 0; x < TW; x++) {                                       // local x 2..34, y 3..95 inside the paper
      const [sx, y0] = ARTGEO.at(2 + x, 3), [, y1] = ARTGEO.at(2 + x, 3 + TH);
      w.drawImage(TOPO_C, x, 0, 1, TH, Math.round(sx), Math.round(y0), 1, Math.round(y1) - Math.round(y0));
    }
    w.globalCompositeOperation = 'multiply'; w.drawImage(SHL, 0, 0);
    w.globalCompositeOperation = 'destination-in'; w.drawImage(TOPO_MASK(), 0, 0);
    w.globalCompositeOperation = 'source-over';
  }
  c.drawImage(ARTW, 0, 0);
}
// the drawn columns themselves, as the mask that keeps the light inside the print
let topoMask = null;
function TOPO_MASK() {
  if (topoMask) return topoMask;
  topoMask = document.createElement('canvas'); topoMask.width = VW; topoMask.height = VH;
  const m = topoMask.getContext('2d'); m.fillStyle = '#000';
  for (let x = 0; x < LIVE.W; x++) { const [sx, y0] = ARTGEO.at(2 + x, 3), [, y1] = ARTGEO.at(2 + x, 3 + LIVE.H); m.fillRect(Math.round(sx), Math.round(y0), 1, Math.round(y1) - Math.round(y0)); }
  return topoMask;
}

function drawShellBack(c) {
  // pale ceiling with fine slats running towards the vanishing point and a recessed light line along the glass
  poly(c, [[0, -6], [VW, -6], [OX + W, OY], [OX, OY]], '#2e2c2a');
  for (let x = OX; x <= OX + W; x += 12) strokePath(c, [[x, OY], [toY(x, OY, -6), -6]], '#373431');
  r(c, OX, OY - 2, W, 2, '#b8ae9c');
  // smooth plaster side walls with a soft shadow into the corners and a thin skirting
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? OX : OX + W, xe = side < 0 ? 0 : VW;
    poly(c, [[xe, toX(x0, OY, xe)], [x0, OY], [x0, OY + 196], [xe, toX(x0, OY + 196, xe)]], '#3a3735');
    for (let k = 0; k < 6; k++) { const xx = x0 - side * k; strokePath(c, [[xx, toX(x0, OY, xx)], [xx, toX(x0, OY + 196, xx)]], `rgba(0,0,0,${.22 - k * .033})`); }
    strokePath(c, [[x0, OY + 194], [xe, toX(x0, OY + 194, xe)]], '#262422', 2);
    r(c, x0 - (side < 0 ? 0 : 1), OY, 1, 196, '#262422');
  }
  // light oak floor with wide boards, and the wool rug running on from the back wall
  poly(c, [[OX, OY + 196], [OX + W, OY + 196], [VW, toX(OX + W, OY + 196, VW)], [VW, VH], [0, VH], [0, toX(OX, OY + 196, 0)]], '#57402f');
  for (let x = -260; x <= VW + 260; x += 30) strokePath(c, [[x, OY + 196], [toY(x, OY + 196, VH), VH]], '#46332a');
  for (const y of [OY + 226, OY + 244]) r(c, 0, y, VW, 1, '#46332a');
  const ry = OY + 216, rb = 262;
  poly(c, [[OX + 56, ry], [OX + 264, ry], [toY(OX + 264, ry, rb), rb], [toY(OX + 56, ry, rb), rb]], '#45413e');
  r(c, toY(OX + 56, ry, rb), rb, toY(OX + 264, ry, rb) - toY(OX + 56, ry, rb), 1, '#33302e');
  // left wall: a framed print, drawn live over the paper by drawArtLive(): by default dots that move between data shapes
  // (dots.js), with ?art=topo an animated topographic map (topo.js), both made as OpenFilm pages; ?art=hiroshige and
  // ?art=bulb show the earlier static prints.
  const yL = (x, f) => { const t = toX(OX, OY, x), b = toX(OX, OY + 194, x); return t + (b - t) * f; };
  const AX0 = 7, AX1 = 43, F0 = .14, F1 = .66, AH = 100;                      // the art's frame on the wall, local height in pixels
  const at = (px, py) => [AX0 + px, yL(AX0 + px, F0 + py / AH * (F1 - F0))];   // local drawing coordinates -> wall
  const dot = (px, py, col) => { const [x, y] = at(px, py); r(c, x, y, 1, 1, col); };
  const frameQ = (x0, x1, f0, f1, col) => poly(c, [[x0, yL(x0, f0)], [x1, yL(x1, f0)], [x1, yL(x1, f1)], [x0, yL(x0, f1)]], col);
  frameQ(AX0 - 3, AX1 + 1, F0 - .035, F1 + .02, '#141416'); frameQ(AX0 - 1.5, AX1 - .5, F0 - .02, F1 + .005, '#f4f0ea');   // black frame, white paper
  const cx = 18, cy = 30;
  ARTGEO = { at, AH };
  if (ART_KIND === 'bulb') {                                                      // the earlier print: a light bulb whose filament turns into a heart
    const paint = '#1c1c20', heart = '#d8443a';
    for (let a = 0; a < TAU; a += .02) { const ang = a - Math.PI / 2;               // the bulb's glass
      const px = cx + Math.cos(ang) * 15, py = cy + Math.sin(ang) * 17;
      if (py > cy + 12 && Math.abs(px - cx) < 9) continue;                        // open at the bottom where the neck joins
      dot(px, py, paint); }
    for (let py = cy + 12; py <= cy + 26; py += .5) { const w = 9 - (py - cy - 12) * .2; dot(cx - w, py, paint); dot(cx + w, py, paint); }   // neck
    for (const py of [cy + 28, cy + 31, cy + 34]) for (let px = cx - 6; px <= cx + 6; px += .5) dot(px, py, paint);                  // screw base
    for (let px = cx - 3; px <= cx + 3; px += .5) dot(px, cy + 37, paint);
    // two wires rise from the base and curve into a heart
    for (let py = cy + 26; py >= cy + 9; py -= .5) { dot(cx - 2 - (cy + 26 - py) * .05, py, heart); dot(cx + 2 + (cy + 26 - py) * .05, py, heart); }
    for (let t = 0; t < TAU; t += .015) {
      const hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      dot(cx + hx * .5, cy + 1 - hy * .5, heart);
    }
  } else if (ART_KIND === 'hiroshige') {
    // after Hiroshige, "Sudden Shower over Shin-Ōhashi Bridge" (1857, public domain): ink sky, a pale far bank,
    // Prussian-blue river, a timber bridge with hurrying figures, a raftsman, and slanting rain over everything
    const X0 = 2, X1 = 34, Y0 = 3, Y1 = 95, h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5; return s - Math.floor(s); };
    const deck = x => 50 + (x - X0) * .42;                                        // the bridge falls from left to right
    for (let py = Y0; py <= Y1; py += .5) for (let px = X0; px <= X1; px += .5) {   // half steps: the wall's perspective stretches the grid
      let col;
      if (py < 24) col = mix('#1f2224', '#6d716c', (py - Y0) / 21);                // bokashi: dark cloud fading downwards
      else if (py < 33) col = mix('#8c918a', '#a7aaa0', (py - 24) / 9);           // grey mist over the far bank
      else if (py < 37 + Math.sin(px * .9) * 1.2) col = '#3c4a3f';                  // far bank with low trees
      else col = mix('#4d7a8c', '#244a68', (py - 37) / (Y1 - 37));                 // the river, deepening to Prussian blue
      if (py >= deck(px) - 1.5 && py <= deck(px) + 1.5) col = py <= deck(px) + .5 ? '#c09a64' : '#7c5a3a';   // timber deck and its shadow side
      else if (py > deck(px) + 1 && py < deck(px) + 9 && Math.floor(px - X0) % 5 === 1) col = '#4e3a2a';   // piles
      dot(px, py, col);
    }
    for (const [fx, c1] of [[9, '#2a2622'], [14, '#3a3530'], [21, '#2a2622'], [25, '#3a3530']]) {   // figures under straw hats and umbrellas
      const fy = deck(fx) - 2; for (let k = 0; k < 3; k += .5) { dot(fx, fy - k, c1); dot(fx + .5, fy - k, c1); } for (let k = -1.5; k <= 2; k += .5) { dot(fx + k, fy - 3.5, '#d6c49a'); dot(fx + k * .6, fy - 4, '#d6c49a'); }
    }
    for (let px = 4; px <= 13; px++) dot(px, 80, '#6b4c32');                        // the raft and its raftsman with a pole
    dot(11, 78, '#2a2622'); dot(11, 79, '#2a2622'); for (let k = 0; k < 7; k++) dot(13 + k * .3, 79 - k, '#2a2622');
    for (let n = 0; n < 36; n++) {                                                // rain: fine slanting lines
      const sx = X0 + h(n, 1) * (X1 - X0), sy = Y0 + h(n, 2) * (Y1 - Y0 - 8), len = 4 + h(n, 3) * 6;
      for (let k = 0; k < len; k++) { const px = sx + k * .18, py = sy + k; if (px <= X1 && py <= Y1) dot(px, py, h(n, 4) < .5 ? '#3e4549' : '#687074'); }
    }
  }
  ART = at(cx, cy);
  // right wall: floating oak shelves with a curated mix of books and objects (they open Experience)
  const yAt = (x, f) => { const t = toX(OX + W, OY, x), b = toX(OX + W, OY + 194, x); return t + (b - t) * f; };
  const xa = OX + W + 6, xb = VW - 4;
  const quad = (x0, x1, f0, f1, col) => poly(c, [[x0, yAt(x0, f0)], [x1, yAt(x1, f0)], [x1, yAt(x1, f1)], [x0, yAt(x0, f1)]], col);
  const BOOK = ['#2f3a4e', '#3d5243', '#b98a3e', '#9c4a38', '#ddd3c0', '#3a3a3e', '#8a9a80', '#6e2e38', '#c9b48e', '#4a5a6e'];
  // light comes from the window (left): each spine is rounded from a lit edge to a shaded one, with cloth grain
  const book = (x, w, h, f, col, band) => {
    quad(x + w, x + w + 1.4, f - h + .012, f, 'rgba(10,8,6,.22)');                  // soft shadow on the wall
    const n = Math.max(3, Math.round(w / .5));
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n, k = u < .3 ? mix(col, '#ffffff', .24 * (1 - u / .3)) : mix(col, '#000000', .42 * ((u - .3) / .7) ** 1.3);
      quad(x + w * i / n, x + w * (i + 1) / n + .06, f - h, f, k);
    }
    for (let j = 0; j < 14; j++) { const fx = x + .2 + hash(x * 97 + j) * (w - .5), ff = f - h + hash(x * 31 + j * 7) * h; r(c, fx, yAt(fx, ff), 1, 1, rgba(hash(j * 3 + x) < .5 ? '#000000' : '#ffffff', .08)); }
    quad(x, x + w, f - h, f - h + .006, mix(col, '#ffffff', .32));                  // top edge catching the light
    quad(x, x + w, f - .009, f, 'rgba(0,0,0,.22)');                                 // contact shade on the shelf
    if (band && w > 2.4) {
      quad(x + .4, x + w - .9, f - h * .8, f - h * .8 + .005, '#d8b85a'); quad(x + .4, x + w - .9, f - h * .2, f - h * .2 + .005, '#d8b85a');
      quad(x + .5, x + w - 1, f - h * .62, f - h * .44, mix(col, '#000000', .35)); quad(x + .7, x + w - 1.2, f - h * .56, f - h * .54, '#c8a84e');   // title label
    }
    return x + w + .3;
  };
  const row = (x, f, specs) => { for (const [w, h, ci, band] of specs) x = book(x, w, h, f, BOOK[ci], band); return x; };
  const leaning = (x, w, h, f, col) => { poly(c, [[x, yAt(x, f)], [x + w, yAt(x + w, f)], [x + w + 3, yAt(x + w + 3, f - h)], [x + 3, yAt(x + 3, f - h)]], col);
    poly(c, [[x + w - .8, yAt(x + w - .8, f)], [x + w, yAt(x + w, f)], [x + w + 3, yAt(x + w + 3, f - h)], [x + w + 2.2, yAt(x + w + 2.2, f - h)]], mix(col, '#000000', .3)); };
  const flat = (x, f, specs) => specs.forEach(([L, ci, dx], j) => { quad(x + dx, x + dx + L, f - (j + 1) * .02, f - j * .02, BOOK[ci]); quad(x + dx, x + dx + L, f - (j + 1) * .02, f - (j + 1) * .02 + .004, mix(BOOK[ci], '#ffffff', .25)); });
  const shelf = f => {
    quad(xa, xb, f + .014, f + .04, 'rgba(0,0,0,.3)');                              // shadow under the board
    quad(xa, xb, f, f + .014, '#7a5638'); quad(xa, xb, f + .009, f + .014, '#5e4129');   // front face, darker lower half
    for (let k = 0; k < 7; k++) { const gx2 = xa + hash(f * 1000 + k) * (xb - xa - 8); quad(gx2, gx2 + 3 + hash(k + f * 99) * 6, f + .005 + (k % 2) * .003, f + .007 + (k % 2) * .003, '#6a4a30'); }   // grain
    quad(xa, xb, f, f + .003, '#b08454');                                           // lit top edge
  };
  // a rounded ceramic: dark body, lit side, highlight
  const pot = (x, y, rx, ry, col) => { ell(c, x, y, rx, ry, mix(col, '#000000', .3)); ell(c, x - rx * .2, y - ry * .05, rx * .78, ry * .9, col); ell(c, x - rx * .45, y - ry * .2, rx * .28, ry * .5, mix(col, '#ffffff', .4)); };
  const F = [.28, .45, .62, .79];
  F.forEach(shelf);
  // top shelf: a trailing plant, then a run of hardbacks
  quad(xa + 2, xa + 8, F[0] - .05, F[0], '#d8d2c8'); quad(xa + 6, xa + 8, F[0] - .05, F[0], '#b4aca0'); quad(xa + 2, xa + 3.4, F[0] - .05, F[0], '#ece8e0');
  quad(xa + 1.6, xa + 8.4, F[0] - .054, F[0] - .046, '#f2eee6'); quad(xa + 2, xa + 8, F[0] - .009, F[0], 'rgba(0,0,0,.2)');
  for (let k = 0; k < 11; k++) { const x = xa + 3 + (k % 3) * 2, y = yAt(x, F[0] - .05 + k * .02), col = k % 3 === 0 ? '#5a9a58' : k % 3 === 1 ? '#3e7046' : '#2f5a38'; ell(c, x + Math.sin(k) * 1.2, y, 1.6, 1.1, col); r(c, x + Math.sin(k) * 1.2 - 1, y - .6, 1, 1, '#7ab870'); }
  row(xa + 12, F[0], [[2.6, .1, 0, 1], [3.2, .115, 7, 1], [2.2, .095, 4, 0], [3, .11, 2, 1], [2.4, .1, 6, 0]]);
  // second shelf: a long run, one book leaning, a small ceramic vase
  const e1 = row(xa + 2, F[1], [[2.4, .1, 3, 1], [3, .112, 0, 1], [2.2, .098, 8, 0], [3.4, .116, 1, 1], [2.6, .104, 5, 1], [2.2, .094, 4, 0]]);
  leaning(e1 + .2, 2.6, .1, F[1], BOOK[9]);
  const vx = xb - 5; ell(c, vx + 1.5, yAt(vx, F[1] - .03), 1.6, 3, 'rgba(10,8,6,.2)'); pot(vx, yAt(vx, F[1] - .035), 2.2, 3.3, '#cfc6b6');
  r(c, vx - .8, yAt(vx, F[1] - .078), 1.8, 1.6, '#bfb6a6'); r(c, vx - .8, yAt(vx, F[1] - .078), 1, 1.6, '#e8e2d6'); r(c, vx - 1.1, yAt(vx, F[1] - .082), 2.4, .8, '#ece6da');
  // third shelf: a horizontal stack, a framed photo, three upright books
  flat(xa + 2, F[2], [[11, 3, 0], [10, 4, .6], [12, 0, -.4]]);
  quad(xa + 22, xa + 23.4, F[2] - .072, F[2], 'rgba(10,8,6,.22)');
  quad(xa + 16, xa + 22, F[2] - .075, F[2], '#141416'); quad(xa + 16, xa + 16.6, F[2] - .075, F[2], '#3a3a40');
  quad(xa + 16.8, xa + 21.2, F[2] - .067, F[2] - .008, '#f4f0ea'); quad(xa + 16.8, xa + 21.2, F[2] - .067, F[2] - .062, '#c8c2b6');
  quad(xa + 17.4, xa + 20.6, F[2] - .05, F[2] - .014, '#9ab4c8'); quad(xa + 17.4, xa + 20.6, F[2] - .028, F[2] - .014, '#5a7a68');
  poly(c, [[xa + 17.4, yAt(xa + 17.4, F[2] - .028)], [xa + 18.8, yAt(xa + 18.8, F[2] - .046)], [xa + 20.6, yAt(xa + 20.6, F[2] - .03)]], '#6a7e96');
  row(xa + 25, F[2], [[2.8, .108, 1, 1], [2.4, .1, 2, 0], [3.2, .114, 7, 1]]);
  // bottom shelf: books held by a black bookend, and a low ceramic bowl
  const e3 = row(xa + 2, F[3], [[3, .112, 5, 1], [2.4, .1, 8, 0], [2.8, .108, 0, 1], [2.2, .096, 6, 0], [3.4, .118, 3, 1]]);
  quad(e3 + .3, e3 + 1.3, F[3] - .07, F[3], '#141416');
  const bx = xb - 7; ell(c, bx + 1.5, yAt(bx, F[3] - .01), 4, 1.2, 'rgba(10,8,6,.25)'); ell(c, bx, yAt(bx, F[3] - .018), 4, 2, '#1e1e22');
  ell(c, bx - 1, yAt(bx, F[3] - .02), 2.6, 1.4, '#34343a'); ell(c, bx, yAt(bx, F[3] - .03), 3.6, .9, '#5a5a62'); ell(c, bx + .4, yAt(bx, F[3] - .03), 2.8, .5, '#2a2a2e');
  // below the shelves, an acoustic guitar stands against the wall in the shade
  const gx = xa + 13, gy = f => yAt(gx, f), gs = (gy(1) - gy(0)) / 1;                  // wall height in pixels here
  ell(c, gx + 1, gy(.985), 7, 1.2, 'rgba(0,0,0,.25)');                                  // contact shadow on the floor
  ell(c, gx, gy(.925), 6, gs * .058, '#6e4528'); ell(c, gx, gy(.84), 4.6, gs * .042, '#6e4528');   // lower and upper bout
  ell(c, gx - 1.2, gy(.915), 3.4, gs * .04, '#84552f'); ell(c, gx - .8, gy(.835), 2.4, gs * .028, '#84552f');   // lit spruce top
  ell(c, gx + 1.4, gy(.93), 3.4, gs * .045, 'rgba(30,16,8,.45)'); ell(c, gx + 1, gy(.845), 2.4, gs * .03, 'rgba(30,16,8,.4)');   // shaded right side of the body
  ell(c, gx, gy(.872), 1.9, 1.9, 'rgba(232,210,170,.2)'); ell(c, gx, gy(.872), 1.5, 1.5, '#24170f');   // rosette and sound hole
  r(c, gx - 2, gy(.95), 4, 1, '#2e1e14');                                               // bridge
  r(c, gx - 1, gy(.62), 2, gy(.81) - gy(.62), '#3e281a'); r(c, gx - 1, gy(.62), 1, gy(.81) - gy(.62), '#4c3322');   // neck
  r(c, gx - 1.5, gy(.575), 3, gy(.62) - gy(.575), '#2e1e14');                          // headstock
  for (const f of [.585, .605]) { r(c, gx - 2.5, gy(f), 1, 1, '#9a9286'); r(c, gx + 1.5, gy(f), 1, 1, '#9a9286'); }   // tuners
  for (const dx of [-.5, .5]) strokePath(c, [[gx + dx, gy(.95)], [gx + dx, gy(.62)]], 'rgba(220,214,200,.35)', .5);   // strings
  // a pair of boxing gloves hung by their laces from the underside of the bottom shelf
  const gl = (x, f) => [x, yAt(x, f)], [px0, py0] = gl(xb - 9, F[3] + .036);
  for (const [dx, f1] of [[-2.5, F[3] + .075], [2.5, F[3] + .09]]) { const [lx, ly] = gl(xb - 9 + dx, f1); strokePath(c, [[px0, py0], [lx, ly]], '#cfc6b6'); }
  for (const [x, f, col] of [[xb - 11.5, F[3] + .09, '#7a2a26'], [xb - 6.5, F[3] + .105, '#6c2522']]) {
    const [cx2, cy2] = gl(x, f), cs = yAt(x, .03) - yAt(x, 0);
    r(c, cx2 - 2, cy2 - cs * .9, 4, cs * .35, '#d8d0c2');                               // white cuff
    ell(c, cx2, cy2 + cs * .4, 2.8, cs * 1.1, col); ell(c, cx2 - .8, cy2 + cs * .2, 1.2, cs * .6, mix(col, '#ffffff', .18));   // glove and its sheen
    ell(c, cx2 + 2, cy2 + cs * .1, 1.1, cs * .45, mix(col, '#000000', .2));             // the thumb
    ell(c, cx2 + .9, cy2 + cs * .75, 1.6, cs * .55, mix(col, '#000000', .32)); r(c, cx2 - 1.4, cy2 + cs * .05, 1, 1, mix(col, '#ffffff', .45));   // shade and a glint
  }
}

function drawShellFront(c) {
  // modern desk chair seen from behind: grey upholstery on a slim black frame
  ell(c, 300, VH - 2, 34, 5, 'rgba(20,10,6,.35)');
  for (const [a, b] of [[[272, 247], [266, 272]], [[328, 247], [334, 272]], [[290, 248], [288, 272]], [[310, 248], [312, 272]]]) strokePath(c, [a, b], '#1c1c20', 2);
  poly(c, [[268, 240], [332, 240], [335, 249], [265, 249]], '#6e6e74'); r(c, 266, 248, 68, 1, '#1c1c20');
  poly(c, [[277, 198], [323, 198], [326, 238], [274, 238]], '#1c1c20');
  poly(c, [[279, 200], [321, 200], [323, 236], [277, 236]], '#8e8e94');
  r(c, 279, 200, 42, 2, '#a8a8ae'); r(c, 279, 220, 44, 1, '#7e7e84');
  // monstera in a terracotta pot, bottom left
  poly(c, [[2, 242], [44, 242], [40, 272], [6, 272]], '#b86a46'); r(c, 0, 240, 46, 4, '#c8784f');
  const LV = [[30, 214, 22, 13, -.5, '#3e7046'], [58, 200, 24, 14, -.2, '#2f5a36'], [16, 186, 20, 12, -1.1, '#4f8a50'], [46, 172, 22, 12, -.7, '#3e7046'], [74, 222, 18, 11, .25, '#4f8a50'], [6, 220, 16, 10, -1.6, '#2f5a36']];
  for (const [x, y, a, b, rot] of LV) strokePath(c, [[22, 242], [x, y]], '#2a4a2c', 2);
  for (const [x, y, a, b, rot, col] of LV) {
    ell(c, x, y, a, b, col, rot);
    ell(c, x - Math.cos(rot) * a * .2, y - Math.sin(rot) * a * .2 - 2, a * .55, b * .35, lite(col, .12), rot);
    for (let k = -2; k <= 2; k++) {                                            // the monstera's slits
      const px = x + Math.cos(rot) * k * a * .32, py = y + Math.sin(rot) * k * a * .32;
      strokePath(c, [[px - Math.sin(rot) * b * .25, py + Math.cos(rot) * b * .25], [px - Math.sin(rot) * b * 1.05, py + Math.cos(rot) * b * 1.05]], '#1e3a22', 1);
    }
  }
}
const lite = (c, t) => mix(c, '#ffffff', t);

// light for the shell, from the same sources as the back wall
function drawShellLight(c) {
  const E = ENV;
  c.globalCompositeOperation = 'source-over'; c.fillStyle = E.ambient; c.fillRect(0, 0, VW, VH);
  c.globalCompositeOperation = 'lighter';
  glow(c, OX + 192, OY + 80, 320, E.winCol, E.winA * 1.05);
  glow(c, OX + GEO.lamp.light[0], OY + GEO.lamp.light[1], 180, '#ffa860', .75 * E.lamp);
  glow(c, OX + MON.x + MON.w / 2, OY + 112, 120, '#6a88c0', .3);
  glow(c, VW / 2, 160, 280, '#b07050', .2 + .2 * E.lamp);
  const sun = sunInfo(E);
  if (sun) for (const [x0, x1] of GEO.panesX) poly(c, [[OX + x0 + sun.dx * 1.4, OY + 222], [OX + x1 + sun.dx * 1.4, OY + 222], [OX + x1 + sun.dx * 2.2 + 18, VH - 6], [OX + x0 + sun.dx * 2.2 - 18, VH - 6]], rgba(sun.col, .4 * sun.s));
  c.globalCompositeOperation = 'source-over';
}
// light the static shell layers once per change of the hour
function litLayer(dst, src) {
  const d = dst.getContext('2d');
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH); d.drawImage(src, 0, 0);
  d.globalCompositeOperation = 'multiply'; d.drawImage(SHL, 0, 0);
  d.globalCompositeOperation = 'destination-in'; d.drawImage(src, 0, 0);
  d.globalCompositeOperation = 'source-over';
}
function updateShell() { drawShellLight(sl); litLayer(LITB, SHB); litLayer(LITF, SHF); }
drawShellBack(sb); drawShellFront(sf);

updateEnv();

function render(t) {
  o.clearRect(0, 0, W, H);
  drawOutside(o, t);
  ax.globalCompositeOperation = 'source-over';
  ax.clearRect(0, 0, W, H); ax.drawImage(ROOM, 0, 0); drawClockHands(ax); ax.drawImage(DESKL, DDX, DDY);
  mx.clearRect(0, 0, W, H); mx.drawImage(A, 0, 0);
  ax.globalCompositeOperation = 'multiply'; ax.drawImage(L, 0, 0);
  ax.globalCompositeOperation = 'destination-in'; ax.drawImage(MASK, 0, 0);
  ax.globalCompositeOperation = 'source-over';
  o.drawImage(A, 0, 0);
  drawEmissive(o, t, hover || (openId && SPOTS.find(s => s.id === openId)));
  oc.clearRect(0, 0, VW, VH);
  oc.drawImage(LITB, 0, 0);
  drawArtLive(oc, t);
  oc.drawImage(IN, OX, OY);
  oc.drawImage(LITF, Math.round(-PX * 3), Math.round(-PY * 1.5));
  oc.save(); oc.translate(OX, OY); drawHover(oc, t, hover); oc.restore();
  oc.drawImage(VIG, 0, 0);
}

// ---------- view: cover the viewport, zoom to an object when its panel opens ----------
const scene = document.getElementById('scene'), panel = document.getElementById('panel'), body = document.getElementById('panel-body');
const kicker = document.getElementById('panel-title'), tip = document.getElementById('tip'), modeBtn = document.getElementById('mode');
const HEAD = 56;
let vw = 0, vh = 0, portrait = false, s0 = 1, cur = { fx: VW / 2, fy: 132, z: 1, p: 0 }, goal = { ...cur }, xf = { ox: 0, oy: 0, s: 1 };
let hover = null, openId = null;

function layout() {
  vw = innerWidth; vh = innerHeight;
  portrait = vw <= 760 || vw / vh <= 1;
  // portrait: a band under the header, leaving room below for the name and the section buttons
  s0 = portrait ? Math.max(1, Math.min(vw / 262, (vh - HEAD - 380) / VH)) : Math.max(vw / VW, vh / VH);
  document.documentElement.style.setProperty('--band-bottom', Math.round(HEAD + VH * s0) + 'px');
  stackPortrait();
  if (!openId) { goal.fx = portrait ? 215 + OX : VW / 2; goal.fy = portrait ? 128 : 132; }
  else aim(openId);
}
// portrait: the section buttons and the disclaimer follow the intro, whatever its height
function stackPortrait() {
  requestAnimationFrame(() => {
    if (!portrait) return;
    const intro = document.getElementById('intro'), ib = intro ? intro.getBoundingClientRect().bottom : HEAD + VH * s0;
    html.style.setProperty('--menu-top', Math.round(ib + 14) + 'px');
    requestAnimationFrame(() => html.style.setProperty('--disc-top', Math.round(document.querySelector('.touch-menu').getBoundingClientRect().bottom + 12) + 'px'));
  });
}
if (document.fonts) document.fonts.ready.then(stackPortrait);
function panelBox() { return portrait ? { w: vw, h: vh * .62 } : { w: Math.min(500, vw * .44), h: vh }; }
function aim(id) {
  const nav = NAV_ONLY.find(q => q.id === id), s = SPOTS.find(q => q.id === (nav ? nav.at : id)), pb = panelBox();
  const aw = portrait ? vw : vw - pb.w, ah = portrait ? vh - pb.h - HEAD : vh - HEAD;
  goal.fx = OX + s.x + s.w / 2; goal.fy = OY + s.y + s.h / 2;
  goal.z = clamp(Math.min(aw * .55 / (s.w * s0), ah * .55 / (s.h * s0)), 1, 1.8);   // frame the object with some of the room around it; never closer than 1.8x
  goal.p = 1;
}
function place() {
  const s = s0 * cur.z, pb = panelBox();
  const closed = portrait ? { x: vw / 2, y: HEAD + VH * s0 / 2 } : { x: vw / 2, y: vh / 2 };
  const opened = portrait ? { x: vw / 2, y: HEAD + (vh - pb.h - HEAD) / 2 } : { x: (vw - pb.w) / 2, y: HEAD / 2 + vh / 2 };
  const axp = closed.x + (opened.x - closed.x) * cur.p, ayp = closed.y + (opened.y - closed.y) * cur.p;
  let ox = axp - cur.fx * s, oy = ayp - cur.fy * s;
  const right = portrait ? vw : vw - pb.w * cur.p;     // the scene may slide under the open panel
  ox = VW * s > right ? clamp(ox, right - VW * s, 0) : (right - VW * s) / 2;   // slide whenever the room is wider than the space beside the panel
  if (!portrait || cur.p > 0) oy = clamp(oy, Math.min(0, vh - VH * s), portrait ? HEAD : 0);
  xf = { ox, oy, s };
  cv.style.transform = `translate(${ox.toFixed(2)}px,${oy.toFixed(2)}px) scale(${s.toFixed(4)})`;
}
function toNative(cx, cy) { return { x: (cx - xf.ox) / xf.s - OX, y: (cy - xf.oy) / xf.s - OY }; }   // back-wall coordinates
function hit(p) { return SPOTS.find(s => p.x >= s.x - 3 && p.x <= s.x + s.w + 3 && p.y >= s.y - 3 && p.y <= s.y + s.h + 3) || null; }

// ---------- panel ----------
function fill(id) {
  body.textContent = '';
  for (const sid of SOURCES[id]) {
    const src = document.getElementById(sid); if (!src) continue;
    const c = src.cloneNode(true);
    c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    c.classList.remove('section'); c.classList.add('panel-section');
    body.append(c);
  }
  body.scrollTop = 0;
}
function openPanel(id) {
  const s = SPOTS.find(q => q.id === id) || NAV_ONLY.find(q => q.id === id); if (!s) return;
  openId = id; fill(id);
  kicker.textContent = `${s.n} · ${s.label}`;
  panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-open');
  document.querySelectorAll('[data-go]').forEach(a => a.classList.toggle('on', a.dataset.go === id));
  hover = null; tip.classList.remove('show'); scene.classList.remove('hot');
  aim(id); if (reduce) cur = { ...goal };
  panel.focus({ preventScroll: true });
}
function closePanel() {
  if (!openId) return;
  openId = null;
  panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('panel-open');
  document.querySelectorAll('[data-go]').forEach(a => a.classList.remove('on'));
  goal = { fx: portrait ? 215 + OX : VW / 2, fy: portrait ? 128 : 132, z: 1, p: 0 }; if (reduce) cur = { ...goal };
}
const lofi = () => html.classList.contains('lofi');
function sync() { if (lofi()) return; const id = location.hash.slice(1); if (SOURCES[id]) openPanel(id); else closePanel(); }
function go(id) { if (location.hash === '#' + id) openPanel(id); else location.hash = id; }
function toDesk() { if (location.hash) history.pushState(null, '', location.pathname + location.search); closePanel(); }

addEventListener('hashchange', sync);
addEventListener('popstate', sync);
document.getElementById('close').addEventListener('click', toDesk);
addEventListener('keydown', e => { if (e.key === 'Escape' && openId) toDesk(); });
document.getElementById('home').addEventListener('click', e => { if (!lofi()) { e.preventDefault(); toDesk(); } });

scene.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') { hasPointer = true; TX = e.clientX / vw * 2 - 1; TY = e.clientY / vh * 2 - 1; }
  if (openId || e.pointerType === 'touch') return;
  const h = hit(toNative(e.clientX, e.clientY));
  if (h !== hover) { hover = h; scene.classList.toggle('hot', !!h); }
  if (h) { tip.textContent = `${h.n} · ${h.label}`; tip.style.left = e.clientX + 'px'; tip.style.top = (e.clientY - 14) + 'px'; tip.classList.add('show'); }
  else tip.classList.remove('show');
});
scene.addEventListener('pointerleave', () => { hover = null; tip.classList.remove('show'); scene.classList.remove('hot'); });
scene.addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const h = hit(toNative(e.clientX, e.clientY));
  if (h) go(h.id); else if (openId) toDesk();
});

// ---------- LO-FI toggle ----------
function setMode(isLofi, save) {
  html.classList.toggle('lofi', isLofi);
  modeBtn.textContent = isLofi ? 'Scene' : 'LO-FI';
  modeBtn.setAttribute('aria-pressed', String(isLofi));
  if (save) try { localStorage.setItem('jn-mode', isLofi ? 'lofi' : 'scene'); } catch (e) {}
  if (isLofi) { closePanel(); cur = { ...goal }; if (master) master.gain.setTargetAtTime(0, AC.currentTime, .2); }
  else { layout(); sync(); cur = { ...goal }; if (master && soundOn) master.gain.setTargetAtTime(.35, AC.currentTime, .4); }
}
modeBtn.addEventListener('click', () => setMode(!lofi(), true));
// ---------- optional soundscape: a soft ambient mix generated in the browser, off until asked ----------
// River and wind (filtered noise that moves slowly), a warm pad drifting through quiet chords, birds by day and crickets at
// night, all in a light reverb. It fades in and out, pauses while the tab is hidden and remembers the visitor's choice.
const soundBtn = document.getElementById('sound');
let AC = null, master = null, wet = null, dry = null, bus = null, soundOn = false, padNodes = [], chordI = 0;
const VOL = .32;
function noiseBuf(sec, kind) {
  const len = AC.sampleRate * sec, buf = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = .997 * b0 + w * .029591; b1 = .985 * b1 + w * .032534; b2 = .95 * b2 + w * .048056; d[i] = (b0 + b1 + b2 + w * .1848) * .25; }   // pink
    }
  }
  return buf;
}
function loop(buf, ...chain) { const s = AC.createBufferSource(); s.buffer = buf; s.loop = true; let n = s; for (const c of chain) { n.connect(c); n = c; } s.start(); return n; }
function lfo(param, rate, depth) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); }
function filt(type, f, q = .7) { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function gain(v) { const g = AC.createGain(); g.gain.value = v; return g; }
function startSound() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3; comp.connect(AC.destination);
  master = gain(0); master.connect(comp);
  dry = gain(1); dry.connect(master);
  // a light room reverb from a generated, decaying impulse
  const ir = AC.createBuffer(2, AC.sampleRate * 2.6, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  const conv = AC.createConvolver(); conv.buffer = ir; wet = gain(.35); conv.connect(wet); wet.connect(master);
  bus = gain(1); bus.connect(conv); bus.connect(dry);                          // everything sent here also gets the reverb
  const brown = noiseBuf(6, 'brown'), pink = noiseBuf(6, 'pink');
  // river: a low rush whose brightness moves slowly, and a quieter babble on top
  const rl = filt('lowpass', 520); lfo(rl.frequency, .05, 140);
  loop(brown, rl, gain(.5)).connect(dry);
  const bb = filt('bandpass', 1300, 1.2), bg = gain(.05); lfo(bg.gain, .23, .03); lfo(bb.frequency, .11, 300);
  loop(pink, bb, bg).connect(dry);
  // wind in the trees: soft swells every few seconds
  const wb = filt('bandpass', 700, .6), wg = gain(.07); lfo(wg.gain, .07, .05); lfo(wb.frequency, .03, 250);
  loop(pink, wb, wg).connect(bus);
  // warm pad: detuned triangles under a low-pass, drifting through four quiet chords
  const pf = filt('lowpass', 900, .5), pg = gain(.022); lfo(pf.frequency, .04, 250); lfo(pg.gain, .09, .006);
  pf.connect(pg); pg.connect(bus);
  for (let v = 0; v < 4; v++) for (const det of [-5, 5]) { const o = AC.createOscillator(); o.type = 'triangle'; o.detune.value = det; o.connect(pf); o.start(); padNodes.push(o); }
  setChord(true); setInterval(() => setChord(false), 16000);
  document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else if (soundOn) AC.resume(); });
  setInterval(soundTick, 300);
}
const CHORDS = [[146.83, 220, 277.18, 329.63], [123.47, 185, 246.94, 293.66], [98, 146.83, 246.94, 293.66], [110, 164.81, 220, 277.18]];   // D(add9), Bm7, Gmaj7, A
function setChord(now) {
  const ch = CHORDS[chordI++ % CHORDS.length], t = AC.currentTime;
  padNodes.forEach((o, i) => { const f = ch[i >> 1] * (ENV.stars > .5 ? .5 : 1) * (i >> 1 === 3 && ENV.stars > .5 ? 2 : 1); if (now) o.frequency.value = f; else o.frequency.setTargetAtTime(f, t, 2.5); });
}
// a bird phrase: a few short notes with vibrato, panned somewhere in the trees
function bird(vol) {
  const pan = AC.createStereoPanner ? AC.createStereoPanner() : null, out = gain(1);
  if (pan) { pan.pan.value = Math.random() * 1.6 - .8; out.connect(pan); pan.connect(bus); } else out.connect(bus);
  const base = 2200 + Math.random() * 1600, n = 2 + (Math.random() * 5 | 0), gap = .09 + Math.random() * .08;
  for (let k = 0; k < n; k++) {
    const t = AC.currentTime + k * gap, d = .06 + Math.random() * .07, o = AC.createOscillator(), g = AC.createGain(), vib = AC.createOscillator(), vg = AC.createGain();
    const f = base * (1 + (Math.random() - .5) * .35);
    o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (.85 + Math.random() * .35), t + d);
    vib.frequency.value = 28 + Math.random() * 20; vg.gain.value = f * .03; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(out); o.start(t); vib.start(t); o.stop(t + d + .02); vib.stop(t + d + .02);
  }
}
function cricket(vol) {
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), am = AC.createOscillator(), ag = AC.createGain();
  o.frequency.value = 4300 + Math.random() * 300; am.frequency.value = 30; ag.gain.value = vol * .5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * .5, t + .02); g.gain.linearRampToValueAtTime(0, t + .35);
  am.connect(ag); ag.connect(g.gain); o.connect(g); g.connect(dry); o.start(t); am.start(t); o.stop(t + .4); am.stop(t + .4);
}
function soundTick() {
  if (!soundOn || !AC || lofi() || document.hidden) return;
  const day = 1 - ENV.lamp, night = ENV.stars;
  if (day > .3 && SEASON !== SEASONS.winter && Math.random() < .07 * day) bird(.022 * day);
  if (night > .3 && SEASON !== SEASONS.winter && Math.random() < .35 * night) cricket(.012 * night);
}
function setSound(on, save) {
  if (on && !AC) startSound();
  soundOn = on;
  if (AC) { if (on) AC.resume(); master.gain.setTargetAtTime(on && !lofi() ? VOL : 0, AC.currentTime, on ? 1.2 : .4); }
  soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.textContent = on ? 'Sound off' : 'Sound on';
  if (save) try { localStorage.setItem('jn-sound', on ? 'on' : 'off'); } catch (e) {}
}
let pending = null;                       // a remembered 'on' waiting for the first interaction
soundBtn?.addEventListener('click', () => { if (pending) { pending(); setSound(false, true); return; } setSound(!soundOn, true); });
// browsers only allow sound after a click or key press: if the visitor had it on, it returns with their first interaction
try {
  if (soundBtn && localStorage.getItem('jn-sound') === 'on') {
    soundBtn.textContent = 'Sound off'; soundBtn.setAttribute('aria-pressed', 'true');
    const resume = e => { if (e.target === soundBtn) return; pending(); setSound(true, false); };
    pending = () => { removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); pending = null; };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
  }
} catch (e) {}
// keyboard users can jump straight to the text version
document.getElementById('skip')?.addEventListener('click', e => { e.preventDefault(); setMode(true, true); const m = document.getElementById('lofi'); m.setAttribute('tabindex', '-1'); m.focus(); });

// ---------- loop ----------
let last = 0, t0 = performance.now(), envT = performance.now();
// the visitor's local time and the part of the day the light shows
const timeChip = document.getElementById('local-time');
let chipT = 0;
function updateTimeChip() {
  if (!timeChip) return;
  const h = hourNow(), hh = String(Math.floor(h)).padStart(2, '0'), mm = String(Math.floor((h * 60) % 60)).padStart(2, '0');
  const part = h < 5 ? 'Night' : h < 7 ? 'Dawn' : h < 12 ? 'Morning' : h < 14 ? 'Midday' : h < 17.5 ? 'Afternoon' : h < 19.5 ? 'Dusk' : h < 21.5 ? 'Evening' : 'Night';
  timeChip.textContent = `${hh}:${mm} · ${part}`;
}
updateTimeChip(); setInterval(updateTimeChip, 10000);   // also runs while the animation is paused
function frame(now) {
  requestAnimationFrame(frame);
  if (lofi() || document.hidden || now - last < (vw < 760 ? 50 : 30)) return;   // about 20 fps on phones, 33 on larger screens
  const rawDt = (now - last) / 1000, dt = Math.min(.1, rawDt); last = now;
  const t = reduce ? 4 : (now - t0) / 1000;
  if (!FIXED && now - envT > 30000) { envT = now; updateEnv(); }
  if (reduce || !PARALLAX) { PX = PY = 0; }
  else {
    const tx = openId ? 0 : hasPointer ? TX : Math.sin(t * .12) * .5, ty = openId ? 0 : hasPointer ? TY : Math.sin(t * .09) * .3, kp = 1 - Math.exp(-dt * 3);
    PX += (tx - PX) * kp; PY += (ty - PY) * kp;
  }
  DDX = stillMode ? 0 : -Math.round(PX); DDY = stillMode ? 0 : -Math.round(PY * .6);
  const k = 1 - Math.exp(-Math.min(.4, rawDt) * 5.5);                         // the camera uses real time, so it arrives on time on slow devices too
  for (const key of ['fx', 'fy', 'z', 'p']) cur[key] += (goal[key] - cur[key]) * k;
  place();
  render(t);
  if (now - chipT > 1000) { chipT = now; updateTimeChip(); }
}
addEventListener('resize', () => { layout(); cur = { ...goal, p: cur.p }; });
layout(); cur = { ...goal };
setMode(lofi(), false);
requestAnimationFrame(frame);
// optional GPU post-process (bloom, light shafts, river shimmer): ?fx=gl
if (new URLSearchParams(location.search).get('fx') === 'gl') { const fx = document.createElement('script'); fx.src = 'fx-gl.js'; document.body.append(fx); }
})();
