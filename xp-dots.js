// Experience in data dots (Personal Website). A classic script: it sets window.XPDOTS. mount(root) finds the
// experience timeline inside root and puts a small dot chart above it: one dot per month of work since the first
// role, coloured by sector. Two views, by year (a calendar grid) and by sector (rows with the years per sector);
// the dots fly between them. Hovering or tapping a dot lights up its role in the list, and the other way round.
// The data are read from the timeline itself (dates, titles, organizations), so the list stays the only source.
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
  const GHOST = '#2a2430';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = p => 1 - Math.pow(1 - p, 3);

  // "March 2025 – present" -> [start, end] as month numbers (year * 12 + month)
  function parseWhen(s, now) {
    const parts = s.toLowerCase().split(/\s*[–—-]\s*/), m = p => { const r = p.match(/([a-z]+)\s+(\d{4})/); return r && MONTHS.includes(r[1]) ? +r[2] * 12 + MONTHS.indexOf(r[1]) : null; };
    const a = m(parts[0] || ''), b = /present/.test(parts[1] || '') ? now : m(parts[1] || '');
    return a != null && b != null && b >= a ? [a, b] : null;
  }
  const fmt = n => SHORT[n % 12] + ' ' + Math.floor(n / 12);

  function readRoles(list, now) {
    const roles = [];
    list.querySelectorAll(':scope > li').forEach(li => {
      const when = li.querySelector('.when'), h = li.querySelector('h3'), org = li.querySelector('.org'); if (!when || !h) return;
      const span = parseWhen(when.textContent, now); if (!span) return;
      const orgText = org ? org.textContent : '', sector = SECTORS.find(s => s.test.test(orgText));
      roles.push({ li, title: h.textContent.trim(), org: orgText.split('·')[0].trim(), start: span[0], end: span[1], sector });
    });
    return roles.sort((a, b) => a.start - b.start);
  }

  function mount(root) {
    const list = root && root.querySelector('.timeline'); if (!list) return;
    const old = list.parentElement.querySelector('.xp-viz'); if (old) old.remove();   // a clone of the page section brings an empty copy
    const now = (() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); })();
    const roles = readRoles(list, now); if (!roles.length) return;

    // one dot per month; where two roles overlap by a month, the later role keeps it
    const first = roles[0].start, owner = new Map();
    for (const r of roles) for (let n = r.start; n <= r.end; n++) owner.set(n, r);
    const dots = [...owner.keys()].sort((a, b) => a - b).map((n, i) => ({ n, i, role: owner.get(n), x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, t0: 0, a: 0 }));
    const sectors = SECTORS.map(s => ({ ...s, months: dots.filter(d => d.role.sector === s).length })).filter(s => s.months).sort((a, b) => b.months - a.months);
    roles.forEach(r => { r.sector = sectors.find(s => s.id === r.sector.id) || r.sector; });   // point the roles at the counted copies
    const y0 = Math.floor(first / 12), y1 = Math.floor(now / 12);

    // markup: two view chips, the canvas, a tooltip and a one-line caption
    const fig = document.createElement('figure'); fig.className = 'xp-viz';
    fig.innerHTML = '<div class="xp-bar"><p class="xp-kicker">Experience in data dots</p><div class="xp-views" role="group" aria-label="View">' +
      '<button type="button" class="chip" data-view="year" aria-pressed="true">By year</button><button type="button" class="chip" data-view="sector" aria-pressed="false">By sector</button></div></div>' +
      '<div class="xp-stage"><canvas></canvas><div class="xp-tip" aria-hidden="true"></div></div>' +
      `<figcaption>Each dot is one month of professional experience since ${MONTHS[first % 12].replace(/^./, c => c.toUpperCase())} ${Math.floor(first / 12)}, coloured by sector. Hover over or tap a dot to see the role; select it to go to the entry below.</figcaption>`;
    list.parentElement.insertBefore(fig, list);
    const cv = fig.querySelector('canvas'), tip = fig.querySelector('.xp-tip'), stage = fig.querySelector('.xp-stage'), c = cv.getContext('2d');
    const years = (dots.length / 12).toFixed(1).replace(/\.0$/, '');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `Dot chart of ${dots.length} months (about ${years} years) of professional experience by year and sector: ` + sectors.map(s => `${s.label} ${(s.months / 12).toFixed(1)} years`).join(', ') + '.');

    let view = 'year', W = 0, H = 0, P = 6, S = 4, LAY = null, hover = null, hoverSector = null, raf = 0, visible = true;

    // layout: the year grid on top (3 x 4 months per year), the sector rows below; ghost cells stay where no dot is
    function layout() {
      W = Math.max(240, Math.round(stage.clientWidth));
      const Y = y1 - y0 + 1;
      P = Math.max(4, Math.min(11, Math.floor((W - 4) / (Y * 3 + (Y - 1) * 1.3))));
      S = Math.max(2, Math.round(P * .72));
      const colW = 3 * P, gap = Math.round(P * 1.3), gridW = Y * colW + (Y - 1) * gap, gx = Math.round((W - gridW) / 2), gy = 4;
      const cells = [], labels = [], every = colW + gap >= 22 ? 1 : 2;
      for (let y = y0; y <= y1; y++) {
        const cx = gx + (y - y0) * (colW + gap);
        for (let m = 0; m < 12; m++) cells.push({ n: y * 12 + m, x: cx + (m % 3) * P, y: gy + Math.floor(m / 3) * P });
        if ((y - y0) % every === 0 || y === y1) labels.push({ x: cx + colW / 2, text: "'" + String(y).slice(2) });
      }
      const gridBottom = gy + 4 * P + 18;
      const per = Math.max(10, Math.floor((W - 4) / P)), rows = [];
      let top = gridBottom + 10;
      for (const s of sectors) {
        const n = Math.ceil(s.months / per);
        rows.push({ s, top, dotsTop: top + 18, per, n });
        top += 18 + n * P + 10;
      }
      H = top;
      LAY = { cells, labels, gridBottom, rows, gx, gridW };
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    function step(now) {
      let moving = false;
      for (const d of dots) {
        const p = Math.min(1, Math.max(0, (now - d.t0) / DUR));
        if (p < 1) moving = true;
        const e = ease(p), arc = view === 'sector' || d.sy > d.ty ? Math.sin(p * Math.PI) * -14 : 0;   // a small hop on the way
        d.x = d.sx + (d.tx - d.sx) * e; d.y = d.sy + (d.ty - d.sy) * e + (p < 1 ? arc : 0);
        d.a = Math.min(1, d.a + (reduce ? 1 : .08));
      }
      return moving;
    }

    function draw(now) {
      c.clearRect(0, 0, W, H);
      const active = d => hover ? d.role === hover : hoverSector ? d.role.sector === hoverSector : true;
      // ghost cells of the year grid, then year labels
      c.fillStyle = GHOST;
      for (const q of LAY.cells) if (q.n >= first && q.n <= now_m) c.fillRect(Math.round(q.x), Math.round(q.y), S, S);
      c.font = '14px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#8a8078';
      for (const l of LAY.labels) c.fillText(l.text, l.x, LAY.gridBottom - 2);
      // sector rows: label with the years, and ghost slots for the dots
      c.textAlign = 'left';
      for (const r of LAY.rows) {
        const on = hoverSector === r.s || (hover && hover.sector === r.s);
        c.font = '16px VT323, ui-monospace, monospace'; c.fillStyle = r.s.color; c.globalAlpha = hover || hoverSector ? (on ? 1 : .45) : 1;
        c.fillRect(2, r.top + 4, S + 1, S + 1);
        const txt = `${r.s.label.toUpperCase()}  ${(r.s.months / 12).toFixed(1)} YRS`;
        c.fillText(txt, 2 + S + 7, r.top + 12);
        c.globalAlpha = 1; c.fillStyle = GHOST;
        for (let k = 0; k < r.s.months; k++) c.fillRect(2 + (k % r.per) * P, r.dotsTop + Math.floor(k / r.per) * P, S, S);
      }
      // the dots; the newest month blinks like a cursor
      const t = now / 1000;
      for (const d of dots) {
        if (d.a <= 0) continue;
        const on = active(d), latest = d.n === now_m && !reduce && Math.floor(t * 1.6) % 2 === 0;
        const tw = !reduce && !hover && !hoverSector && Math.sin(t * 1.3 + d.n * 2.399) > .996;   // a quiet twinkle
        c.globalAlpha = d.a * (on ? 1 : .22) * (latest ? .35 : 1);
        c.fillStyle = tw ? '#fff6dc' : d.role.sector.color;
        const grow = on && (hover || hoverSector) ? 1 : 0;
        c.fillRect(Math.round(d.x) - grow * .5, Math.round(d.y) - grow * .5, S + grow, S + grow);
      }
      c.globalAlpha = 1;
    }
    const now_m = now;

    function frame(ts) {
      raf = 0;
      if (!cv.isConnected) { stop(); return; }
      const moving = step(ts);
      draw(ts);
      if (!visible) return;
      if (moving || hover || hoverSector) raf = requestAnimationFrame(frame);
      else if (!reduce) { setTimeout(() => { if (!raf && cv.isConnected) raf = requestAnimationFrame(frame); }, 90); }   // idle: about ten frames a second for the twinkle and the cursor
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    // hit testing on the canvas
    function pick(e) {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      let best = null, bd = (P * .9) ** 2;
      for (const d of dots) { const dx = d.x + S / 2 - x, dy = d.y + S / 2 - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = d; } }
      const row = !best && LAY.rows.find(r => y >= r.top && y < r.top + 16 && x < W * .8);
      return { d: best, row, x, y };
    }
    function setHover(role, sector, at) {
      if (role === hover && sector === hoverSector && !at) return;
      hover = role; hoverSector = sector;
      roles.forEach(r => r.li.classList.toggle('xp-on', r === role));
      if (role && at) {
        tip.innerHTML = `<b>${role.title}</b><span>${role.org} · ${fmt(role.start)} – ${role.end === now ? 'present' : fmt(role.end)}</span>`;
        tip.classList.add('show');
        const tw = tip.offsetWidth, left = Math.max(0, Math.min(W - tw, at.x - tw / 2)), above = at.y - tip.offsetHeight - 10;
        tip.style.left = left + 'px'; tip.style.top = (above < 0 ? at.y + 14 : above) + 'px';
      } else tip.classList.remove('show');
      cv.style.cursor = role ? 'pointer' : sector ? 'default' : '';
      kick();
    }
    cv.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const h = pick(e); setHover(h.d ? h.d.role : null, h.row ? h.row.s : null, h.d ? h : null); });
    cv.addEventListener('pointerleave', () => setHover(null, null));
    cv.addEventListener('click', e => {
      const h = pick(e);
      if (!h.d) { setHover(null, h.row ? h.row.s : null); return; }
      if (e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) {   // first tap shows the role, the second goes to it
        if (hover !== h.d.role) { setHover(h.d.role, null, h); return; }
      }
      const li = h.d.role.li;
      li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      li.classList.remove('xp-flash'); void li.offsetWidth; li.classList.add('xp-flash');
    });
    roles.forEach(r => {
      r.li.addEventListener('mouseenter', () => setHover(r, null));
      r.li.addEventListener('mouseleave', () => setHover(null, null));
    });
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
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { const w = Math.round(stage.clientWidth); if (w && w !== W) { layout(); targets(0); dots.forEach(d => { d.t0 = 0; }); kick(); } }) : null;
    if (ro) ro.observe(stage);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(cv);
    function stop() { if (ro) ro.disconnect(); if (io) io.disconnect(); }
    if (document.fonts) document.fonts.ready.then(kick);
    kick();
  }

  window.XPDOTS = { mount };
  // the text version (and the page without the scene) shows the section itself
  const init = () => { const s = document.getElementById('experience'); if (s) mount(s); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
