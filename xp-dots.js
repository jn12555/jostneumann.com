// Data dots for the About, Areas of expertise, Experience and Resources sections (Personal Website). A classic script: it sets window.XPDOTS.
// mount(root) looks inside root for the experience timeline and the resources lists and puts a small dot chart above
// each. Experience: one dot per month of work, coloured by sector, by year (a calendar grid, with the advisory roles,
// degrees and certifications of each year under it) or by sector (rows with the years per sector). Resources: one dot
// per publication, talk or media item, dropped into its year, with filters that also filter the list. Hovering or
// tapping a dot lights up its entry in the list, and the other way round. drawScreen() paints a pixel copy of the open
// chart on the desk screen in the room (room.js). All data are read from the lists on the page, which stay the only source.
(function () {
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SECTORS = [   // matched against the organization line, first match wins
    { id: 'un', label: 'United Nations', color: '#5fb4ef', test: /UN Tourism|United Nations/i },
    { id: 'phil', label: 'Philanthropy', color: '#ffb35a', test: /Care Foundation/i },
    { id: 'hum', label: 'Humanitarian', color: '#ef7a5f', test: /Rescue/i },
    { id: 'priv', label: 'Private sector', color: '#9ad57f', test: /Agri|Holding/i },
    { id: 'res', label: 'Research', color: '#c3b2f2', test: /./ },
  ];
  const GROUPS = [   // resources, matched against the heading above each list
    { id: 'pub', label: 'Publications', color: '#ffe7a8', test: /publication/i },
    { id: 'talk', label: 'Talks', color: '#7ff5d2', test: /talk|panel/i },
    { id: 'media', label: 'Media', color: '#c3a6ff', test: /media|coverage/i },
  ];
  const GHOST = '#2a2430', ADV = '#e8ddc8', EDU = '#ffe7a8', CERT = '#7ff5d2';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = p => 1 - Math.pow(1 - p, 3);
  const drop = p => { const n = 7.5625, d = 2.75; return p < 1 / d ? n * p * p : p < 2 / d ? n * (p -= 1.5 / d) * p + .75 : p < 2.5 / d ? n * (p -= 2.25 / d) * p + .9375 : n * (p -= 2.625 / d) * p + .984375; };   // a small bounce on landing
  const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const nowMonth = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };
  const STATE = {};   // what the desk screen shows: the chart in the open panel

  // "March 2025 – present" -> [start, end] as month numbers (year * 12 + month)
  function parseWhen(s, now) {
    const parts = s.toLowerCase().split(/\s*[–—-]\s*/), m = p => { const r = p.match(/([a-z]+)\s+(\d{4})/); return r && MONTHS.includes(r[1]) ? +r[2] * 12 + MONTHS.indexOf(r[1]) : null; };
    const a = m(parts[0] || ''), b = /present/.test(parts[1] || '') ? now : m(parts[1] || '');
    return a != null && b != null && b >= a ? [a, b] : null;
  }
  const fmt = n => SHORT[n % 12] + ' ' + Math.floor(n / 12);
  // the list that follows a heading whose text matches re
  function listAfter(scope, re) {
    const h = [...scope.querySelectorAll('h2')].find(q => re.test(q.textContent)); if (!h) return [];
    let el = h.nextElementSibling; while (el && el.tagName !== 'UL') el = el.nextElementSibling;
    return el ? [...el.children] : [];
  }

  // shared frame: kicker, chips, canvas stage with a tooltip, caption; and a frame loop that idles at ten frames a second
  function figure(kicker, chips, caption, label) {
    const fig = document.createElement('figure'); fig.className = 'xp-viz';
    fig.innerHTML = `<div class="xp-bar"><p class="xp-kicker">${kicker}</p><div class="xp-views" role="group" aria-label="${label}">${chips}</div></div>` +
      `<div class="xp-stage"><canvas role="img"></canvas><div class="xp-tip" aria-hidden="true"></div></div><figcaption>${caption}</figcaption>`;
    return fig;
  }
  function loop(cv, stage, onResize, tick) {
    let raf = 0, visible = true, W = 0;
    const frame = ts => {
      raf = 0;
      if (!cv.isConnected) { if (ro) ro.disconnect(); if (io) io.disconnect(); return; }
      const busy = tick(ts);
      if (!visible) return;
      if (busy) raf = requestAnimationFrame(frame);
      else if (!reduce) setTimeout(() => { if (!raf && cv.isConnected) raf = requestAnimationFrame(frame); }, 90);   // idle: the twinkle and the cursor
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { const w = Math.round(stage.clientWidth); if (w && w !== W) { W = w; onResize(); kick(); } }) : null;
    if (ro) ro.observe(stage);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(cv);
    if (document.fonts) document.fonts.ready.then(kick);
    W = Math.round(stage.clientWidth);
    return kick;
  }
  function sizeCanvas(cv, c, W, H) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function showTip(tip, html, at, W) {
    if (!html) { tip.classList.remove('show'); return; }
    tip.innerHTML = html; tip.classList.add('show');
    const tw = tip.offsetWidth, above = at.y - tip.offsetHeight - 10;
    tip.style.left = Math.max(0, Math.min(W - tw, at.x - tw / 2)) + 'px'; tip.style.top = (above < 0 ? at.y + 14 : above) + 'px';
  }
  const isTouch = e => e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents);
  function flash(li) {
    if (!li) return;
    li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    li.classList.remove('xp-flash'); void li.offsetWidth; li.classList.add('xp-flash');
  }
  const own = (root, fig) => { const k = fig.dataset.kind; if (!STATE[k] || !STATE[k].fig.isConnected || fig.closest('.panel')) return true; return false; };

  // ---------- Experience ----------
  function mountExperience(root) {
    const list = root.querySelector('.timeline'); if (!list) return;
    const old = list.parentElement.querySelector('.xp-viz'); if (old) old.remove();   // a clone of the page section brings an empty copy
    const now = nowMonth(), roles = [];
    list.querySelectorAll(':scope > li').forEach(li => {
      const when = li.querySelector('.when'), h = li.querySelector('h3'), org = li.querySelector('.org'); if (!when || !h) return;
      const span = parseWhen(when.textContent, now); if (!span) return;
      const orgText = org ? org.textContent : '';
      roles.push({ li, title: h.textContent.trim(), org: orgText.split('·')[0].trim(), start: span[0], end: span[1], sector: SECTORS.find(s => s.test.test(orgText)) });
    });
    if (!roles.length) return;
    roles.sort((a, b) => a.start - b.start);

    // advisory roles, degrees and certifications (by year only, as listed)
    const scope = root.querySelector('.two-col') || document.getElementById('education') || root, extras = [];
    const read = (re, kind) => listAfter(scope, re).forEach(li => {
      const h = li.querySelector('h3'), org = li.querySelector('.org'); if (!h || !org) return;
      const m = org.textContent.match(/(\d{4})(?:\s*[–-]\s*(\d{4}))?\s*$/); if (!m) return;
      extras.push({ li, kind, title: h.textContent.trim(), org: org.textContent.trim(), from: +m[1], to: +(m[2] || m[1]) });
    });
    read(/advisory/i, 'adv'); read(/^\s*education\s*$/i, 'edu'); read(/certification/i, 'cert');

    // one dot per month; where two roles overlap by a month, the later role keeps it
    const first = roles[0].start, owner = new Map();
    for (const r of roles) for (let n = r.start; n <= r.end; n++) owner.set(n, r);
    const dots = [...owner.keys()].sort((a, b) => a - b).map((n, i) => ({ n, i, role: owner.get(n), x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, t0: 0, a: 0 }));
    const sectors = SECTORS.map(s => ({ ...s, months: dots.filter(d => d.role.sector === s).length })).filter(s => s.months).sort((a, b) => b.months - a.months);
    roles.forEach(r => { r.sector = sectors.find(s => s.id === r.sector.id) || r.sector; r.li.style.setProperty('--hl', r.sector.color); });   // point the roles at the counted copies; --hl colours the linked highlight
    extras.forEach(e => e.li.style.setProperty('--hl', e.kind === 'adv' ? ADV : e.kind === 'edu' ? EDU : CERT));
    const wy0 = Math.floor(first / 12), y1 = Math.floor(now / 12), y0 = Math.min(wy0, ...extras.map(e => e.from));
    const advIn = y => extras.filter(e => e.kind === 'adv' && e.from <= y && e.to >= y), eduIn = y => extras.filter(e => e.kind !== 'adv' && e.from === y);
    const maxAdv = Math.max(0, ...Array.from({ length: y1 - y0 + 1 }, (_, k) => advIn(y0 + k).length));
    const hasEdu = extras.some(e => e.kind !== 'adv');

    const startName = MONTHS[first % 12].replace(/^./, ch => ch.toUpperCase()) + ' ' + wy0;
    const fig = figure('Experience in data dots',
      '<button type="button" class="chip" data-view="year" aria-pressed="true">By year</button><button type="button" class="chip" data-view="sector" aria-pressed="false">By sector</button>',
      `Each dot is one month of professional experience since ${startName}, coloured by sector.` + (maxAdv ? ' Hollow dots under each year count the advisory roles held that year;' : '') +
      (hasEdu ? ' triangles mark degrees and diamonds certifications.' : '') + ' Hover over or tap a dot for details; select it to go to the entry below.', 'View');
    fig.dataset.kind = 'experience';
    list.parentElement.insertBefore(fig, list);
    const cv = fig.querySelector('canvas'), tip = fig.querySelector('.xp-tip'), stage = fig.querySelector('.xp-stage'), c = cv.getContext('2d');
    cv.setAttribute('aria-label', `Dot chart of ${dots.length} months (about ${(dots.length / 12).toFixed(1)} years) of professional experience by year and sector: ` +
      sectors.map(s => `${s.label} ${(s.months / 12).toFixed(1)} years`).join(', ') + (maxAdv ? `; with ${extras.filter(e => e.kind === 'adv').length} advisory roles, degrees and certifications by year` : '') + '.');

    let view = 'year', W = 0, H = 0, P = 6, S = 4, LAY = null, hover = null;   // hover: { role } | { sector } | { items }
    const st = { fig, get view() { return view; }, get hover() { return hover; }, dots, sectors, y0: wy0, y1, now };
    if (own(root, fig)) STATE.experience = st;

    // layout: year grid on top (3 x 4 months per year), advisory dots and degree marks under it, sector rows below
    function layout() {
      W = Math.max(240, Math.round(stage.clientWidth));
      const Y = y1 - y0 + 1;
      P = Math.max(4, Math.min(11, Math.floor((W - 4) / (Y * 3 + (Y - 1) * 1.3))));
      S = Math.max(2, Math.round(P * .72));
      const colW = 3 * P, gap = Math.round(P * 1.3), gridW = Y * colW + (Y - 1) * gap, gx = Math.round((W - gridW) / 2), gy = 4;
      const cells = [], labels = [], adv = [], marks = [], every = colW + gap >= 22 ? 1 : 2;
      const advTop = gy + 4 * P + Math.round(P * .8), advRows = Math.ceil(maxAdv / 3), labelY = advTop + advRows * P + (advRows ? 13 : 9), M = S + 2, markTop = labelY + 5;
      for (let y = y0; y <= y1; y++) {
        const cx = gx + (y - y0) * (colW + gap);
        for (let m = 0; m < 12; m++) cells.push({ n: y * 12 + m, x: cx + (m % 3) * P, y: gy + Math.floor(m / 3) * P });
        advIn(y).forEach((e, k, all) => adv.push({ x: cx + (k % 3) * P, y: advTop + Math.floor(k / 3) * P, year: y, items: all }));
        const ed = eduIn(y); ed.forEach((e, k) => marks.push({ x: cx + colW / 2 - (ed.length * (M + 2) - 2) / 2 + k * (M + 2), y: markTop, item: e }));
        if ((y - y0) % every === 0 || y === y1) labels.push({ x: cx + colW / 2, text: "'" + String(y).slice(2) });
      }
      const gridBottom = (hasEdu ? markTop + M : labelY) + 6;
      const per = Math.max(10, Math.floor((W - 4) / P)), rows = [];
      let top = gridBottom + 10;
      for (const s of sectors) { const n = Math.ceil(s.months / per); rows.push({ s, top, dotsTop: top + 18, per, n }); top += 18 + n * P + 10; }
      H = top;
      LAY = { cells, labels, labelY, adv, marks, M, rows };
      sizeCanvas(cv, c, W, H);
    }
    function targets(stagger) {
      const at = performance.now(), cell = new Map(LAY.cells.map(q => [q.n, q])), seen = new Map();
      for (const d of dots) {
        let x, y;
        if (view === 'year') { const q = cell.get(d.n); x = q.x; y = q.y; }
        else { const row = LAY.rows.find(r => r.s === d.role.sector), k = seen.get(row) || 0; seen.set(row, k + 1); x = 2 + (k % row.per) * P; y = row.dotsTop + Math.floor(k / row.per) * P; }
        d.sx = d.x; d.sy = d.y; d.tx = x; d.ty = y; d.t0 = reduce ? at - 1e4 : at + (stagger ? d.i * stagger : 0);
      }
    }
    const DUR = 700;
    function step(ts) {
      let moving = false;
      for (const d of dots) {
        const p = Math.min(1, Math.max(0, (ts - d.t0) / DUR));
        if (p < 1) moving = true;
        const e = ease(p), arc = view === 'sector' || d.sy > d.ty ? Math.sin(p * Math.PI) * -14 : 0;   // a small hop on the way
        d.x = d.sx + (d.tx - d.sx) * e; d.y = d.sy + (d.ty - d.sy) * e + (p < 1 ? arc : 0);
        d.a = Math.min(1, d.a + (reduce ? 1 : .08));
      }
      return moving;
    }
    const dotOn = d => !hover || (hover.role ? d.role === hover.role : hover.sector ? d.role.sector === hover.sector : false);
    const itemOn = items => !hover || (hover.items ? items.some(i => hover.items.includes(i)) : false);
    function diamond(x, y, s, fill) { c.beginPath(); c.moveTo(x + s / 2, y); c.lineTo(x + s, y + s / 2); c.lineTo(x + s / 2, y + s); c.lineTo(x, y + s / 2); c.closePath(); c.fillStyle = fill; c.fill(); }
    function triangle(x, y, s, fill) { c.beginPath(); c.moveTo(x + s / 2, y); c.lineTo(x + s, y + s); c.lineTo(x, y + s); c.closePath(); c.fillStyle = fill; c.fill(); }
    function draw(ts) {
      c.clearRect(0, 0, W, H);
      const t = ts / 1000, fade = view === 'sector' ? .45 : 1;
      c.fillStyle = GHOST;
      for (const q of LAY.cells) if (q.n >= first && q.n <= now) c.fillRect(Math.round(q.x), Math.round(q.y), S, S);
      // advisory roles as hollow dots, degrees and certifications as small marks
      for (const q of LAY.adv) { c.globalAlpha = fade * (itemOn(q.items) ? 1 : .25); c.strokeStyle = ADV; c.lineWidth = 1; c.strokeRect(Math.round(q.x) + .5, Math.round(q.y) + .5, S - 1, S - 1); }
      for (const q of LAY.marks) { c.globalAlpha = fade * (itemOn([q.item]) ? 1 : .25); (q.item.kind === 'edu' ? triangle : diamond)(q.x, q.y, LAY.M, q.item.kind === 'edu' ? EDU : CERT); }
      c.globalAlpha = 1;
      c.font = '14px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#8a8078';
      for (const l of LAY.labels) c.fillText(l.text, l.x, LAY.labelY);
      // sector rows: label with the years, and ghost slots for the dots
      c.textAlign = 'left';
      for (const r of LAY.rows) {
        const on = hover && ((hover.sector === r.s) || (hover.role && hover.role.sector === r.s));
        c.font = '16px VT323, ui-monospace, monospace'; c.fillStyle = r.s.color; c.globalAlpha = hover ? (on ? 1 : .45) : 1;
        c.fillRect(2, r.top + 4, S + 1, S + 1);
        c.fillText(`${r.s.label.toUpperCase()}  ${(r.s.months / 12).toFixed(1)} YRS`, 2 + S + 7, r.top + 12);
        c.globalAlpha = 1; c.fillStyle = GHOST;
        for (let k = 0; k < r.s.months; k++) c.fillRect(2 + (k % r.per) * P, r.dotsTop + Math.floor(k / r.per) * P, S, S);
      }
      // the dots; the newest month blinks like a cursor
      for (const d of dots) {
        if (d.a <= 0) continue;
        const on = dotOn(d), latest = d.n === now && !reduce && Math.floor(t * 1.6) % 2 === 0;
        const tw = !reduce && !hover && Math.sin(t * 1.3 + d.n * 2.399) > .996;   // a quiet twinkle
        c.globalAlpha = d.a * (on ? 1 : .22) * (latest ? .35 : 1);
        c.fillStyle = tw ? '#fff6dc' : d.role.sector.color;
        const grow = on && hover ? 1 : 0;
        c.fillRect(Math.round(d.x) - grow * .5, Math.round(d.y) - grow * .5, S + grow, S + grow);
      }
      c.globalAlpha = 1;
    }

    function pick(e) {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, near = (qx, qy, s) => (qx + s / 2 - x) ** 2 + (qy + s / 2 - y) ** 2;
      let best = null, bd = (P * .9) ** 2;
      for (const d of dots) { const q = near(d.x, d.y, S); if (q < bd) { bd = q; best = { d }; } }
      for (const q of LAY.adv) { const v = near(q.x, q.y, S); if (v < bd) { bd = v; best = { adv: q }; } }
      for (const q of LAY.marks) { const v = near(q.x, q.y, LAY.M); if (v < bd) { bd = v; best = { mark: q }; } }
      const row = !best && LAY.rows.find(r => y >= r.top && y < r.top + 16 && x < W * .8);
      return { hit: best, row, x, y };
    }
    function describe(h) {
      if (!h.hit) return null;
      if (h.hit.d) { const r = h.hit.d.role; return { hover: { role: r }, lis: [r.li], html: `<b>${esc(r.title)}</b><span>${esc(r.org)} · ${fmt(r.start)} – ${r.end === now ? 'present' : fmt(r.end)}</span>` }; }
      if (h.hit.adv) { const q = h.hit.adv; return { hover: { items: q.items }, lis: q.items.map(i => i.li), html: `<b>Advisory roles, ${q.year}</b><span>${q.items.map(i => esc(i.title + ', ' + i.org.split('·')[0].trim())).join('<br>')}</span>` }; }
      const i = h.hit.mark.item; return { hover: { items: [i] }, lis: [i.li], html: `<b>${esc(i.title)}</b><span>${esc(i.org)}</span>` };
    }
    const allLis = roles.map(r => r.li).concat(extras.map(e => e.li));
    function setHover(hv, lis, html, at) {
      hover = hv;
      allLis.forEach(li => li.classList.toggle('xp-on', !!lis && lis.includes(li)));
      showTip(tip, html, at, W);
      cv.style.cursor = html ? 'pointer' : '';
      kick();
    }
    let lastKey = null;
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const h = pick(e), d = describe(h), key = d ? d.html : h.row ? h.row.s.id : null;
      if (key === lastKey) return; lastKey = key;
      if (d) setHover(d.hover, d.lis, d.html, h); else setHover(h.row ? { sector: h.row.s } : null, null, null);
    });
    cv.addEventListener('pointerleave', () => { lastKey = null; setHover(null, null, null); });
    cv.addEventListener('click', e => {
      const h = pick(e), d = describe(h);
      if (!d) { setHover(h.row ? { sector: h.row.s } : null, null, null); return; }
      if (isTouch(e) && lastKey !== d.html) { lastKey = d.html; setHover(d.hover, d.lis, d.html, h); return; }   // first tap shows, the second goes there
      flash(d.lis[0]);
    });
    roles.forEach(r => { r.li.addEventListener('mouseenter', () => setHover({ role: r }, [r.li], null)); r.li.addEventListener('mouseleave', () => setHover(null, null, null)); });
    extras.forEach(x => { x.li.addEventListener('mouseenter', () => setHover({ items: [x] }, [x.li], null)); x.li.addEventListener('mouseleave', () => setHover(null, null, null)); });
    fig.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      if (view === b.dataset.view) return;
      view = b.dataset.view;
      fig.querySelectorAll('[data-view]').forEach(q => q.setAttribute('aria-pressed', String(q === b)));
      targets(view === 'sector' ? 4 : 3); kick();
    }));

    // start: dots drift in from a loose scatter, month by month
    layout();
    dots.forEach(d => { d.x = Math.random() * (W - S); d.y = Math.random() * (H - S); d.a = reduce ? 1 : 0; });
    targets(reduce ? 0 : 7);
    const kick = loop(cv, stage, () => { layout(); targets(0); dots.forEach(d => { d.t0 = 0; }); }, ts => { const moving = step(ts); draw(ts); return moving || !!hover; });
    kick();
  }

  // ---------- Resources ----------
  function mountResources(root) {
    const li0 = [...root.querySelectorAll('ul.plain > li')].find(li => li.querySelector('.kw')); if (!li0) return;
    const sec = li0.closest('section'); if (!sec) return;
    const old = sec.querySelector('.xp-viz'); if (old) old.remove();
    const items = [], groupsSeen = [];
    sec.querySelectorAll('h2.sub').forEach(h => {
      const g = GROUPS.find(q => q.test.test(h.textContent)); let ul = h.nextElementSibling; while (ul && ul.tagName !== 'UL') ul = ul.nextElementSibling;
      if (!g || !ul) return;
      groupsSeen.push({ g, h, ul });
      [...ul.children].forEach(li => {
        const a = li.querySelector('h3'), org = li.querySelector('.org'); if (!a || !org) return;
        const m = org.textContent.match(/(?:(january|february|march|april|may|june|july|august|september|october|november|december)\s+)?((?:19|20)\d{2})/i); if (!m) return;
        items.push({ li, g, title: a.textContent.trim(), org: org.textContent.trim(), year: +m[2], when: +m[2] * 12 + (m[1] ? MONTHS.indexOf(m[1].toLowerCase()) : 0) });
      });
    });
    if (!items.length) return;
    items.sort((a, b) => a.when - b.when).forEach((it, i) => Object.assign(it, { i, x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, t0: 0, a: 0, ta: 1 }));
    items.forEach(it => it.li.style.setProperty('--hl', it.g.color));
    const ry0 = Math.min(...items.map(i => i.year)), ry1 = Math.max(...items.map(i => i.year));
    const groups = GROUPS.filter(g => items.some(i => i.g === g));

    const chips = '<button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>' +
      groups.map(g => `<button type="button" class="chip" data-filter="${g.id}" aria-pressed="false" style="--c:${g.color}"><i></i>${g.label}</button>`).join('');
    const fig = figure('Resources in data dots', chips,
      'Each dot is one publication, talk or media item, placed by year and coloured by type. The buttons filter the list below; hover over or tap a dot for the title, and select it to go to the item.', 'Filter');
    fig.dataset.kind = 'resources';
    sec.insertBefore(fig, groupsSeen[0].h);
    const cv = fig.querySelector('canvas'), tip = fig.querySelector('.xp-tip'), stage = fig.querySelector('.xp-stage'), c = cv.getContext('2d');
    cv.setAttribute('aria-label', `Dot chart of ${items.length} resources by year, ${ry0} to ${ry1}: ` + groups.map(g => `${items.filter(i => i.g === g).length} ${g.label.toLowerCase()}`).join(', ') + '.');

    let filter = 'all', hover = null, W = 0, H = 0, D = 12, LAY = null;
    const st = { fig, get filter() { return filter; }, get hover() { return hover; }, items, y0: ry0, y1: ry1 };
    if (own(root, fig)) STATE.resources = st;
    const shown = it => filter === 'all' || it.g.id === filter;

    function layout() {
      W = Math.max(240, Math.round(stage.clientWidth));
      const n = ry1 - ry0 + 1, colW = W / n, maxStack = Math.max(...Array.from({ length: n }, (_, k) => items.filter(i => i.year === ry0 + k).length));
      D = Math.round(Math.max(8, Math.min(16, colW * .42)));
      const pitch = D + 4, base = 14 + maxStack * pitch;
      H = base + 24;
      LAY = { colW, pitch, base, cols: Array.from({ length: n }, (_, k) => ({ year: ry0 + k, cx: colW * (k + .5) })) };
      sizeCanvas(cv, c, W, H);
    }
    function targets(stagger, fromTop) {
      const at = performance.now(), stack = {};
      for (const it of items) {
        const col = LAY.cols[it.year - ry0], k = shown(it) ? (stack[it.year] = (stack[it.year] || 0) + 1) - 1 : -1;
        it.sx = fromTop ? col.cx - D / 2 : it.x; it.sy = fromTop ? -D - 6 - it.i * 4 : it.y;
        it.tx = col.cx - D / 2; it.ty = k >= 0 ? LAY.base - D - k * LAY.pitch : LAY.base - D;   // filtered-out dots sink to the floor and fade
        it.ta = k >= 0 ? 1 : 0; it.t0 = reduce ? at - 1e4 : at + (stagger ? it.i * stagger : 0); it.fall = !!fromTop;
      }
    }
    const DUR = 650;
    function step(ts) {
      let moving = false;
      for (const it of items) {
        const p = Math.min(1, Math.max(0, (ts - it.t0) / (it.fall ? 900 : DUR)));
        if (p < 1) moving = true;
        const e = it.fall ? drop(p) : ease(p);
        it.x = it.sx + (it.tx - it.sx) * e; it.y = it.sy + (it.ty - it.sy) * e;
        const da = it.ta - it.a; if (Math.abs(da) > .01) { it.a += reduce ? da : Math.sign(da) * Math.min(Math.abs(da), .1); moving = true; } else it.a = it.ta;
        if (it.fall && p > 0 && it.ta) it.a = Math.max(it.a, Math.min(1, p * 3));
      }
      return moving;
    }
    function draw(ts) {
      c.clearRect(0, 0, W, H);
      const t = ts / 1000;
      c.fillStyle = GHOST; c.fillRect(0, LAY.base + 1, W, 1);
      c.font = '14px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (const col of LAY.cols) {
        const n = items.filter(i => i.year === col.year && shown(i)).length;
        c.fillStyle = '#8a8078'; c.fillText(String(col.year), col.cx, LAY.base + 17);
        if (n) { c.fillStyle = '#5f5866'; c.fillText(String(n), col.cx, LAY.base - D - (n - 1) * LAY.pitch - 5); }
      }
      for (const it of items) {
        if (it.a <= .01) continue;
        const on = !hover || hover === it, tw = !reduce && !hover && Math.sin(t * 1.1 + it.i * 2.399) > .995;
        c.globalAlpha = it.a * (on ? 1 : .25);
        c.fillStyle = tw ? '#fff6dc' : it.g.color;
        const g = hover === it ? 2 : 0;
        c.fillRect(Math.round(it.x) - g, Math.round(it.y) - g, D + 2 * g, D + 2 * g);
      }
      c.globalAlpha = 1;
    }
    function pick(e) {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const it = items.find(i => i.a > .5 && x >= i.x - 3 && x <= i.x + D + 3 && y >= i.y - 3 && y <= i.y + D + 3);
      return { it, x, y };
    }
    const html = it => `<b>${esc(it.title)}</b><span>${esc(it.org.length > 120 ? it.org.slice(0, 117) + '…' : it.org)}</span>`;
    function setHover(it, at) {
      hover = it || null;
      items.forEach(i => i.li.classList.toggle('xp-on', i === hover));
      showTip(tip, it && at ? html(it) : null, at, W);
      cv.style.cursor = it ? 'pointer' : '';
      kick();
    }
    cv.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const h = pick(e); if ((h.it || null) !== hover) setHover(h.it, h); });
    cv.addEventListener('pointerleave', () => setHover(null));
    cv.addEventListener('click', e => {
      const h = pick(e); if (!h.it) { setHover(null); return; }
      if (isTouch(e) && hover !== h.it) { setHover(h.it, h); return; }
      flash(h.it.li);
    });
    items.forEach(it => { it.li.addEventListener('mouseenter', () => setHover(it)); it.li.addEventListener('mouseleave', () => setHover(null)); });
    fig.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
      if (filter === b.dataset.filter) return;
      filter = b.dataset.filter;
      fig.querySelectorAll('[data-filter]').forEach(q => q.setAttribute('aria-pressed', String(q === b)));
      groupsSeen.forEach(({ g, h, ul }) => { const off = filter !== 'all' && g.id !== filter; h.classList.toggle('xp-hide', off); ul.classList.toggle('xp-hide', off); });
      setHover(null); targets(25, false); kick();
    }));

    // start: the dots fall into their years like rain, oldest first
    layout();
    targets(reduce ? 0 : 90, !reduce);
    const kick = loop(cv, stage, () => { layout(); targets(0, false); items.forEach(i => { i.t0 = 0; i.fall = false; }); }, ts => { const moving = step(ts); draw(ts); return moving || !!hover; });
    kick();
  }

  // ---------- About ----------
  // the figures in the About text as dot tiles; each tile is linked to its phrase in the text, which gets a highlighter sweep
  function wrapPhrase(prose, phrase, key) {
    let mk = prose.querySelector(`mark[data-key="${key}"]`);   // a clone of the page section brings the mark along
    if (mk) return mk;
    const walk = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const i = n.nodeValue.indexOf(phrase); if (i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + phrase.length);
      mk = document.createElement('mark'); mk.className = 'xp-mark'; mk.dataset.key = key; r.surroundContents(mk);
      return mk;
    }
    return null;
  }
  function mountAbout(root) {
    const prose = [...root.querySelectorAll('.prose')].find(q => { const h = q.closest('section') && q.closest('section').querySelector('h2'); return h && /^\s*about\s*$/i.test(h.textContent); });
    if (!prose) return;
    const sec = prose.closest('section'), old = sec.querySelector('.xp-viz'); if (old) old.remove();
    const text = prose.textContent, figs = [];
    let m = text.match(/approximately EUR (\d+) million of philanthropic capital/);
    if (m) figs.push({ key: 'inv', n: +m[1], num: k => `EUR ${k} million`, lab: 'philanthropic capital invested in destination projects, approximately', unit: '1 dot = EUR 1 million', color: '#ffb35a', phrase: m[0] });
    m = text.match(/more than EUR (\d+) million from institutional donors/);
    if (m) figs.push({ key: 'mob', n: +m[1], num: k => `EUR ${k} million`, lab: 'mobilized from institutional donors, more than', unit: '1 dot = EUR 1 million', color: '#ffe7a8', phrase: m[0] });
    if (!figs.length) return;

    const fig = document.createElement('figure'); fig.className = 'xp-viz'; fig.dataset.kind = 'about';
    fig.innerHTML = '<div class="xp-bar"><p class="xp-kicker">About in data dots</p></div><div class="xp-tiles"></div>' +
      '<figcaption>Each dot stands for one unit, as noted on the tile. Hover over or tap a tile or a highlighted phrase in the text to link the two.</figcaption>';
    sec.insertBefore(fig, prose);
    const box = fig.querySelector('.xp-tiles');
    let hover = null;
    const setHover = f => { hover = f; figs.forEach(q => { q.tile.classList.toggle('xp-on', q === f); if (q.mark) q.mark.classList.toggle('xp-on', q === f); q.kick(); }); };
    for (const f of figs) {
      const tile = document.createElement('div'); tile.className = 'xp-tile'; tile.style.setProperty('--hl', f.color);
      tile.innerHTML = `<p class="xp-num">${f.num(f.n)}</p><p class="xp-lab">${esc(f.lab)}</p><canvas role="img"></canvas><p class="xp-unit">${f.unit}</p>`;
      box.append(tile);
      const cv = tile.querySelector('canvas'), c = cv.getContext('2d'), num = tile.querySelector('.xp-num');
      cv.setAttribute('aria-label', `${f.num(f.n)}: ${f.lab}; ${f.unit}.`);
      f.tile = tile; f.mark = wrapPhrase(prose, f.phrase, f.key);
      if (f.mark) f.mark.style.setProperty('--hl', f.color);
      let W = 0, H = 0, P = 7, S = 5, per = 1, started = 0;
      const layout = () => {
        W = Math.max(160, Math.round(cv.clientWidth || tile.clientWidth - 26)); P = f.n > 100 ? 6 : 8; S = P - 2;
        per = Math.max(1, Math.floor((W + P - S) / P)); H = Math.ceil(f.n / per) * P - (P - S); sizeCanvas(cv, c, W, H);
      };
      const tick = ts => {   // the dots fill in once the tile is on screen, the number counting with them; hovering sends a wave through them
        const r = cv.getBoundingClientRect();
        if (!started && r.width && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0) started = ts;
        const span = reduce ? 0 : 1100, p = !started ? 0 : span ? Math.min(1, (ts - started) / span) : 1, shown = Math.round(f.n * ease(p)), t = ts / 1000;
        num.textContent = f.num(shown);
        c.clearRect(0, 0, W, H);
        for (let k = 0; k < f.n; k++) {
          const x = (k % per) * P, y = Math.floor(k / per) * P;
          if (k >= shown) { c.globalAlpha = 1; c.fillStyle = GHOST; c.fillRect(x, y, S, S); continue; }
          const wave = hover === f && !reduce ? Math.max(0, Math.sin(k * .35 - t * 7)) : 0, tw = !reduce && hover !== f && Math.sin(t * 1.2 + k * 2.399) > .995;
          c.globalAlpha = hover && hover !== f ? .35 : 1;
          c.fillStyle = tw || wave > .85 ? '#fff6dc' : f.color;
          const g = wave > .6 ? 1 : 0;
          c.fillRect(x - g * .5, y - g * .5, S + g, S + g);
        }
        c.globalAlpha = 1;
        return !started || p < 1 || hover === f;
      };
      layout();
      f.kick = loop(cv, tile, layout, tick);
      tile.addEventListener('mouseenter', () => setHover(f)); tile.addEventListener('mouseleave', () => setHover(null));
      tile.addEventListener('click', () => setHover(hover === f ? null : f));
      if (f.mark) {
        f.mark.addEventListener('mouseenter', () => setHover(f)); f.mark.addEventListener('mouseleave', () => setHover(null));
        f.mark.addEventListener('click', () => { setHover(f); tile.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); });
      }
      f.kick();
    }
  }

  // ---------- Areas of expertise ----------
  // each card gets a small dot icon that gathers into shape as the cards rise in; hovering a card sends a ripple through it
  const ICONS = [   // 9 x 7 dots, matched against the card's keyword
    { test: /tour/i, color: '#9ad57f', rows: ['......##.', '......##.', '..#......', '.###..#..', '#####.##.', '#########', '#########'] },
    { test: /invest/i, color: '#ffb35a', rows: ['........#', '......#.#', '......#.#', '....#.#.#', '..#.#.#.#', '#.#.#.#.#', '#########'] },
    { test: /develop/i, color: '#5fb4ef', rows: ['..#####..', '.#..#..#.', '#..###..#', '#########', '#..###..#', '.#..#..#.', '..#####..'] },
    { test: /data/i, color: '#7ff5d2', rows: ['#.#.#.#.#', '.........', '#.#.#.###', '......#..', '#.#.###.#', '..#......', '###.#.#.#'] },
  ];
  function mountExpertise(root) {
    const list = [...root.querySelectorAll('ul.cards')].find(u => { const h = u.closest('section') && u.closest('section').querySelector('h2'); return h && /expertise/i.test(h.textContent); });
    if (!list) return;
    const P = 4, S = 3, W = 9 * P - 1, H = 7 * P - 1;
    [...list.children].forEach((li, idx) => {
      const kw = li.querySelector('.kw'), icon = kw && ICONS.find(q => q.test.test(kw.textContent)); if (!icon) return;
      const old = li.querySelector('canvas.xp-icon'); if (old) old.remove();   // a clone of the page section brings an empty copy
      li.classList.add('xp-card'); li.classList.remove('xp-in'); li.style.setProperty('--hl', icon.color); li.style.setProperty('--d', idx * 120 + 'ms');
      const cv = document.createElement('canvas'); cv.className = 'xp-icon'; cv.setAttribute('aria-hidden', 'true'); li.prepend(cv);
      const c = cv.getContext('2d'); sizeCanvas(cv, c, W, H); cv.style.width = W + 'px';
      const dots = [];
      icon.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') dots.push({ tx: x * P, ty: y * P, sx: Math.random() * (W - S), sy: Math.random() * (H - S), k: dots.length }); }));
      let started = 0, hover = false;
      const tick = ts => {
        const r = cv.getBoundingClientRect();
        if (!started && r.width && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0) { started = ts; li.classList.add('xp-in'); }
        const t = ts / 1000, base = started ? ts - started - idx * 120 : -1;
        let moving = !started;
        c.clearRect(0, 0, W, H);
        for (const d of dots) {
          const p = reduce ? 1 : Math.min(1, Math.max(0, (base - d.k * 14) / 650)); if (p < 1) moving = true;
          const e = ease(p), dist = Math.hypot(d.tx - W / 2, d.ty - H / 2);
          const rip = hover && !reduce ? Math.sin(t * 9 - dist * .35) * 1.4 : 0, tw = !reduce && !hover && Math.sin(t * 1.1 + d.k * 2.399) > .993;
          c.globalAlpha = started ? Math.min(1, .25 + p) : .25;
          c.fillStyle = tw ? '#fff6dc' : icon.color;
          c.fillRect(Math.round(d.sx + (d.tx - d.sx) * e), Math.round(d.sy + (d.ty - d.sy) * e + rip), S, S);
        }
        c.globalAlpha = 1;
        return moving || hover;
      };
      const kick = loop(cv, li, () => {}, tick);
      setTimeout(() => li.classList.add('xp-in'), 2500);   // never leave a card hidden, even where frames are held back
      li.addEventListener('mouseenter', () => { hover = true; kick(); }); li.addEventListener('mouseleave', () => { hover = false; kick(); });
      kick();
    });
  }

  // ---------- desk screen (room.js) ----------
  // a pixel copy of the open chart, drawn into the flat screen image before it is bent onto the curved monitor
  const SCREEN = {};
  function drawScreen(g, kind, X, Y, w, h, t) {
    const s = STATE[kind]; if (!s || !s.fig.isConnected) return false;
    const mem = SCREEN[kind] || (SCREEN[kind] = { pts: new Map() }), out = [];
    if (kind === 'experience') {
      if (s.view === 'year') {   // a 2 x 6 grid of months per year, January at the bottom left
        const n = s.y1 - s.y0 + 1, px = Math.max(6, Math.floor(w / n)), ox = X + Math.floor((w - n * px) / 2 + (px - 5) / 2), top = Y + Math.floor((h - 17) / 2);
        for (const d of s.dots) { const m = d.n % 12; out.push([d, ox + (Math.floor(d.n / 12) - s.y0) * px + (m % 2) * 3, top + (5 - Math.floor(m / 2)) * 3]); }
      } else {   // rows per sector
        const per = Math.max(10, Math.floor(w / 3)), lines = s.sectors.reduce((a, q) => a + Math.ceil(q.months / per), 0), total = lines * 3 + (s.sectors.length - 1);
        let top = Y + Math.max(0, Math.floor((h - total) / 2));
        for (const q of s.sectors) {
          let k = 0;
          for (const d of s.dots) if (d.role.sector === q) { out.push([d, X + (k % per) * 3, top + Math.floor(k / per) * 3]); k++; }
          top += Math.ceil(q.months / per) * 3 + 1;
        }
      }
    } else {
      const n = s.y1 - s.y0 + 1, px = Math.floor(w / n), ox = X + Math.floor((w - n * px) / 2 + px / 2) - 1, stack = {}, base = Y + h - 3;
      for (const it of s.items) {
        if (!(s.filter === 'all' || it.g.id === s.filter)) continue;
        const k = (stack[it.year] = (stack[it.year] || 0) + 1) - 1;
        out.push([it, ox + (it.year - s.y0) * px, base - k * 4]);
      }
      g.fillStyle = 'rgba(232,236,244,.18)'; g.fillRect(X, base + 3, w, 1);
    }
    const dt = Math.min(.5, Math.max(0, t - (mem.t || t))), hv = s.hover, k = reduce ? 1 : 1 - Math.exp(-dt * 7), sz = kind === 'experience' ? 2 : 3;   // eased by time, so slow devices arrive as fast
    mem.t = t;
    const live = new Set();
    for (const [d, tx, ty] of out) {
      live.add(d);
      let p = mem.pts.get(d); if (!p) { p = { x: X + Math.random() * w, y: Y + Math.random() * h }; mem.pts.set(d, p); }
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
      const on = !hv || (kind === 'experience' ? (hv.role ? d.role === hv.role : hv.sector ? d.role.sector === hv.sector : false) : hv === d);
      const blink = kind === 'experience' && d.n === s.now && !reduce && Math.floor(t * 1.6) % 2 === 0;
      g.globalAlpha = (on ? 1 : .25) * (blink ? .3 : 1);
      g.fillStyle = kind === 'experience' ? d.role.sector.color : d.g.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    for (const d of [...mem.pts.keys()]) if (!live.has(d)) mem.pts.delete(d);   // filtered out: they come back from elsewhere
    g.globalAlpha = 1;
    return true;
  }
  const has = kind => !!(STATE[kind] && STATE[kind].fig.isConnected && STATE[kind].fig.closest('.panel'));

  function mount(root) { if (!root) return; mountAbout(root); mountExpertise(root); mountExperience(root); mountResources(root); }
  window.XPDOTS = { mount, drawScreen, has };
  // the text version (and the page without the scene) shows the sections themselves
  const init = () => ['about', 'expertise', 'experience', 'resources'].forEach(id => { const s = document.getElementById(id); if (s) mount(s); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
