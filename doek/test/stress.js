/* Doek — stresstests deel 1: helpers, hostile bestanden (sanitizer), rondreis en geschiedenis.
   Draait in de app zelf: node test/run-stress.js  (laadt stress.js en daarna stress2.js, dat alles uitvoert). */
window.__S = (() => {
  const T = []; const test = (name, fn) => T.push({ name, fn });
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'ongelijk') + ': ' + JSON.stringify(a).slice(0, 160) + ' ≠ ' + JSON.stringify(b).slice(0, 160)); };
  const ok = (c, m) => { if (!c) throw new Error(m || 'onwaar'); };
  const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
  const pickR = (a) => a[Math.floor(rnd() * a.length)];
  const des = (o, opts) => App.deserializePres(o, { media: false, ...opts });
  const base = () => JSON.parse(JSON.stringify(App.serializePres({ media: false })));
  const textOf = (o) => App.objText(o);
  const IDRE = /^[A-Za-z0-9_.:-]{1,80}$/;
  const allIds = (P) => { const ids = []; P.slides.forEach((s) => { ids.push(s.id); App.walkObjs(s.objs, (o) => ids.push(o.id)); }); return ids; };
  const withPres = (P, fn) => { const prev = App.pres; App.pres = P; try { return fn(); } finally { App.pres = prev; } };

  /* ---------- A. Hostile files through the sanitizer ---------- */
  for (const [n, v] of [['null', null], ['array', []], ['string', 'x'], ['number', 5], ['true', true]]) test('sanitizer weigert ' + n, () => { let t = false; try { des(v); } catch { t = true; } ok(t, 'had moeten weigeren'); });
  test('leeg object geeft een bruikbare presentatie', () => { const P = des({}); ok(P.slides.length >= 1 && P.masters.length >= 1); });
  test('absurde afmetingen worden begrensd', () => { for (const w of [1e300, -5, NaN, 'abc', Infinity, 0]) { const P = des({ size: { w, h: w } }); ok(P.size.w >= 50 && P.size.w <= 20000 && P.size.h >= 50 && P.size.h <= 20000, 'w=' + w + ' → ' + P.size.w); } });
  test('__proto__ en constructor vervuilen niets', () => { const o = JSON.parse('{"__proto__":{"polluted":1},"slides":[{"id":"a","__proto__":{"polluted2":1},"objs":[{"type":"shape","id":"b","constructor":{"prototype":{"p3":1}}}]}]}'); des(o); ok(({}).polluted === undefined && ({}).polluted2 === undefined && ({}).p3 === undefined); });
  test('gevaarlijke ids worden vervangen', () => { const b = base(); b.slides[0].id = '"><img src=x onerror=alert(1)>'; b.slides[0].objs.forEach((o) => { o.id = "a'b"; }); const P = des(b); ok(allIds(P).every((i) => IDRE.test(i)), 'id niet veilig'); });
  test('dubbele dia-id\'s blijven werken', () => { const b = base(); b.slides.push(JSON.parse(JSON.stringify(b.slides[0]))); const P = des(b); ok(P.slides.length === 2); });
  test('gevaarlijke koppelingen verdwijnen', () => { const b = base(); b.slides[0].objs.push({ id: 'z1', type: 'shape', x: 0, y: 0, w: 10, h: 10, link: { kind: 'url', url: 'javascript:alert(1)' }, hover: { kind: 'url', url: 'data:text/html,<script>' }, text: { paras: [{ runs: [{ t: 'a', link: { kind: 'url', url: ' JaVaScRiPt:1' } }] }] } }); const P = des(b); ok(!JSON.stringify(P.slides).match(/javascript:|data:text/i), 'onveilige koppeling bleef staan'); });
  test('kleuren met url()/expression worden geweigerd', () => { const b = base(); b.slides[0].bg = { type: 'solid', color: 'url(javascript:1)' }; b.slides[0].objs.push({ id: 'c1', type: 'shape', x: 0, y: 0, w: 5, h: 5, fill: { type: 'solid', color: 'expression(alert(1))' }, line: { type: 'solid', color: '#fff;background:url(x)' } }); const P = des(b); ok(!JSON.stringify(P.slides).match(/url\(|expression/i), 'kleur niet geweigerd'); });
  test('media met gevaarlijke url wordt niet gebruikt', () => { const m = App.cleanMedia({ a1: { mime: 'image/svg+xml', url: 'javascript:alert(1)' }, a2: { mime: 'text/html', url: 'data:text/html,<script>1</script>' }, a3: { mime: 'image/png', url: 'data:image/png;base64,AAAA' } }); ok(!Object.values(m).some((x) => /javascript:|text\/html/i.test(x.url)), JSON.stringify(m).slice(0, 200)); });
  test('diep geneste groepen (5000 niveaus): geen crash, snel', () => { let o = { id: 'leaf', type: 'shape', x: 0, y: 0, w: 1, h: 1 }; for (let i = 0; i < 5000; i++) o = { id: 'g' + i, type: 'group', x: 0, y: 0, w: 10, h: 10, cw: 10, ch: 10, children: [o] }; const b = base(); b.slides[0].objs.push(o); const t0 = performance.now(); let P = null; try { P = des(b); } catch (e) { if (e instanceof RangeError) throw new Error('stack overflow bij inlezen'); throw e; } ok(performance.now() - t0 < 3000, 'te traag'); withPres(P, () => { App.renderSlide(P.slides[0], { mode: 'thumb' }); }); });
  test('diep geneste groepen (200): renderen binnen 3 s', () => { let o = { id: 'leaf', type: 'shape', x: 0, y: 0, w: 1, h: 1 }; for (let i = 0; i < 200; i++) o = { id: 'g' + i, type: 'group', x: 0, y: 0, w: 100, h: 100, cw: 100, ch: 100, children: [o] }; const b = base(); b.slides[0].objs.push(o); const P = des(b); withPres(P, () => { const t0 = performance.now(); App.renderSlide(P.slides[0], { mode: 'thumb' }); ok(performance.now() - t0 < 3000, 'render te traag'); }); });
  test('5000 dia\'s inlezen < 5 s', () => { const b = base(); const s = b.slides[0]; b.slides = Array.from({ length: 5000 }, (_, i) => ({ ...JSON.parse(JSON.stringify(s)), id: 's' + i })); const t0 = performance.now(); const P = des(b); ok(P.slides.length === 5000, 'aantal ' + P.slides.length); ok(performance.now() - t0 < 5000, 'tijd ' + Math.round(performance.now() - t0)); });
  test('tekst met HTML wordt nooit als HTML weergegeven', () => { const b = base(); b.slides[0].objs.push({ id: 'h1', type: 'shape', x: 10, y: 10, w: 300, h: 100, text: { paras: [{ runs: [{ t: '<img src=x onerror="window.__pwn=1"><script>window.__pwn=2</script>' }] }] } }); const P = des(b); withPres(P, () => { const el = App.renderSlide(P.slides[0], { mode: 'edit' }); document.body.appendChild(el); try { ok(!el.querySelector('img[src="x"], script'), 'html gerenderd'); ok(!window.__pwn, 'code uitgevoerd'); } finally { el.remove(); } }); });
  test('NaN/Infinity/strings in getallen blijven eindig', () => { const b = base(); b.slides[0].objs.push({ id: 'n1', type: 'shape', x: 'abc', y: Infinity, w: '1e999', h: NaN, rot: 'x', text: { paras: [{ runs: [{ t: 'a', sz: 'groot' }] }] } }); const P = des(b); const o = P.slides[0].objs.find((q) => q.id === 'n1'); ok(o && [o.x, o.y, o.w, o.h].every((v) => v === undefined || Number.isFinite(v)), JSON.stringify(o).slice(0, 200)); });
  test('grafiek met gigantische reeksen wordt begrensd', () => { const c = App.cleanChart({ kind: 'column', cats: Array(50000).fill('a'), series: Array(1000).fill({ name: 'x', vals: Array(50000).fill(1) }) }); ok(c.series.length <= 255 && c.cats.length <= 10000 && c.series[0].vals.length <= 10000); });
  test('diagram met 100000 items wordt begrensd', () => { const b = base(); b.slides[0].objs.push({ id: 'd1', type: 'diagram', x: 0, y: 0, w: 500, h: 300, dia: { layout: '../x', items: Array(100000).fill({ text: 'a', lvl: 99 }) } }); const P = des(b); const d = P.slides[0].objs.find((o) => o.id === 'd1'); ok(d.dia.items.length <= 500 && /^[A-Za-z0-9]+$/.test(d.dia.layout)); });

  /* ---------- B. Rondreis ---------- */
  test('serialiseren → inlezen → serialiseren behoudt de dia\'s', () => { const a = App.serializePres({ media: false }); const P = des(JSON.parse(JSON.stringify(a))); const n = withPres(P, () => App.serializePres({ media: false }).slides.length); eq(n, a.slides.length); });
  test('cleanForSave laat geen _ velden achter', () => { eq(App.cleanForSave({ a: 1, _x: 2, b: [{ _y: 1, c: 3 }] }), { a: 1, b: [{ c: 3 }] }); });

  /* ---------- C. Geschiedenis ---------- */
  test('200 willekeurige bewerkingen, alles ongedaan en opnieuw', () => {
    const snap = () => JSON.stringify(App.serializePres({ media: false, noShare: true }), (k, v) => (k === 'modified' ? undefined : v));
    const s0 = snap();
    for (let i = 0; i < 200; i++) {
      const act = pickR(['add', 'move', 'del', 'text', 'slide', 'dup']);
      App.run(() => {
        const sl = App.cur();
        if (act === 'add') App.addObj(App.newObj('shape', { x: rnd() * 800, y: rnd() * 500, w: 50 + rnd() * 100, h: 40, geom: 'rect' }));
        else if (act === 'move' && sl.objs.length) { const o = pickR(sl.objs); if (o.x === undefined) return false; o.x += 5; }
        else if (act === 'del' && sl.objs.length > 1) sl.objs.splice(Math.floor(rnd() * sl.objs.length), 1);
        else if (act === 'text') { const o = sl.objs.find((q) => q.text); if (!o) return false; o.text = { paras: [{ runs: [{ t: 't' + i }] }] }; }
        else if (act === 'slide') { App.pres.slides.push(App.newSlide(App.layoutOf(sl))); App.state.slide = App.pres.slides.length - 1; }
        else if (act === 'dup' && sl.objs.length) { const c = App.cloneObj(pickR(sl.objs)); if (!c) return false; sl.objs.push(c); }
        else return false;
      });
    }
    const sEnd = snap();
    for (let i = 0; i < 400; i++) App.exec('undo');
    eq(snap(), s0, 'na alles ongedaan maken');
    for (let i = 0; i < 400; i++) App.exec('redo');
    ok(snap() === sEnd, 'na alles opnieuw verschilt het van het einde');
  });
  test('undo en redo zonder geschiedenis gooien niets', () => { for (let i = 0; i < 50; i++) App.exec('undo'); App.exec('redo'); });

  return { T, test, eq, ok, rnd, pickR, des, base, textOf, IDRE, allIds, withPres };
})();
