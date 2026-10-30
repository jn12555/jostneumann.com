// Visitor statistics without cookies (GoatCounter, https://www.goatcounter.com). A classic script, added to every page by
// tools/build.py. It loads nothing from GoatCounter and reads nothing from the device: it sends one small request per page
// or section opened (address, title, referring page) and per outbound link or email button selected. GoatCounter stores no
// IP addresses and sets no cookies (privacy.html). Counts only on jostneumann.com, so local tests are never counted.
(function () {
  const CODE = 'jostneumann';   // the GoatCounter site code, as in https://CODE.goatcounter.com; empty switches the statistics off
  if (!CODE || location.hostname !== 'jostneumann.com') return;
  const END = `https://${CODE}.goatcounter.com/count`;
  const send = (p, t, event, ref) => {
    const q = new URLSearchParams({ p, t: t || '', e: event ? 'true' : 'false', rnd: Math.random().toString(36).slice(2) });
    if (ref) q.set('r', ref);
    new Image().src = END + '?' + q;
  };
  const page = location.pathname, name = document.title.split(' – ')[0];
  send(page, document.title, false, document.referrer);

  // a section opened (panel in the scene, or the text version) counts as a page of its own: /#experience, /de/#experience
  const SECTIONS = ['about', 'experience', 'writing', 'resources', 'lab', 'contact'];
  let last = null;
  const onHash = () => {
    const id = location.hash.slice(1);
    if (!SECTIONS.includes(id)) { last = null; return; }
    if (id === last) return;
    last = id;
    const link = document.querySelector(`[data-go="${id}"]`);
    send(page + '#' + id, (link ? link.textContent.replace(/^\d+\s*/, '').trim() : id) + ' – ' + name, false);
  };
  onHash();
  addEventListener('hashchange', onHash);

  // outbound links and the email button count as events
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    if (a.id === 'email-link') { send('email', 'Email button', true); return; }
    if (a.host && a.host !== location.host) send('out/' + a.host.replace(/^www\./, '') + a.pathname.replace(/\/$/, '').slice(0, 60), a.textContent.trim().slice(0, 80), true);
  }, true);
})();
