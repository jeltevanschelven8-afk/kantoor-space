/* Doek — stresstests deel 2: tabellen, zoeken/vervangen, samenvoegen, formaat, pptx en tekstbewerking. Voert alle tests uit. */
(async () => {
  const { T, test, eq, ok, rnd, pickR, des, base, textOf } = window.__S;

  /* ---------- D. Tabellen ---------- */
  const tblOk = (o) => { ok(o.rows.length >= 1 && o.cols.length >= 1, 'lege tabel'); o.rows.forEach((r, ri) => { eq(r.cells.length, o.cols.length, 'rij ' + ri + ' celaantal'); r.cells.forEach((c, ci) => { if (c.span) ok(ri + (c.span.r || 1) <= o.rows.length && ci + (c.span.c || 1) <= o.cols.length, 'span buiten tabel'); ok(c.merged || c.text, 'cel zonder tekst'); }); }); ok(o.cols.every((w) => Number.isFinite(w) && w > 0) && o.rows.every((r) => Number.isFinite(r.h) && r.h > 0), 'maat niet eindig'); };
  test('tabel: 300 willekeurige bewerkingen houden de structuur heel', () => {
    App.insertTable(4, 4); const o = App.sel1(); ok(o && o.type === 'table');
    for (let i = 0; i < 300; i++) {
      const a = pickR(['row+', 'col+', 'row-', 'col-', 'merge']); const t = App.obj(o.id); if (!t) break;
      const r = Math.floor(rnd() * t.rows.length), c = Math.floor(rnd() * t.cols.length), r2 = Math.min(t.rows.length - 1, r + Math.floor(rnd() * 3)), c2 = Math.min(t.cols.length - 1, c + Math.floor(rnd() * 3));
      App.state.sel = [o.id]; App.state.cell = { id: o.id, r, c, r2, c2 };
      try {
        if (a === 'row+') App.exec('tableInsert', pickR(['above', 'below'])); else if (a === 'col+') App.exec('tableInsert', pickR(['left', 'right']));
        else if (a === 'row-' && t.rows.length > 1) App.exec('tableDelete', 'rows'); else if (a === 'col-' && t.cols.length > 1) App.exec('tableDelete', 'cols');
        else if (a === 'merge') App.exec('tableMerge');
      } catch (e) { throw new Error('actie ' + a + ': ' + e.message); }
      const cur = App.obj(o.id); if (!cur) break; tblOk(cur); if (cur.rows.length > 40 || cur.cols.length > 40) break;
    }
  });
  test('tabel: 100 rijen × 50 kolommen renderen < 3 s', () => { App.insertTable(100, 50); const o = App.sel1(); const t0 = performance.now(); App.renderSlide(App.cur(), { mode: 'edit' }); const dt = performance.now() - t0; App.removeObjs([o.id]); ok(dt < 3000, 'tijd ' + Math.round(dt)); });
  test('tabel plakken uit TSV met rare invoer', () => { for (const t of ['', '\t', 'a\tb\n', 'a\t'.repeat(500) + '\n' + 'b\t'.repeat(500), '"x\ty"\tz', '<td>'.repeat(10)]) { const r = App.tables.fromTsv(t); if (r) tblOk(r); } });
  test('tabel plakken uit HTML met scripts en enorme colspan', () => { const o = App.tables.fromHtml('<table><tr><td colspan="99999999">a<script>window.__p=1</script></td><td>b</td></tr></table>'); ok(o); tblOk(o); ok(!window.__p); });

  /* ---------- E. Zoeken en vervangen ---------- */
  const withText = (txt) => { const sl = App.cur(); const o = App.newObj('shape', { x: 10, y: 10, w: 400, h: 100, geom: 'rect', text: { paras: [{ runs: [{ t: txt }] }] } }); App.run(() => { sl.objs.push(o); }); return o; };
  const doReplace = (q, r, opts = {}) => { App.exec('find', q); $('#find-case').checked = !!opts.cs; $('#find-whole').checked = !!opts.whole; $('#find-input').value = q; $('#find-input').dispatchEvent(new Event('input')); $('#replace-input').value = r; App.exec('replaceAll'); App.exec('closeFind'); $('#find-case').checked = false; $('#find-whole').checked = false; };
  for (const [name, text, q, r, want, opts] of [
    ['reguliere tekens', 'a.b*c(d)[e]', '.', '-', 'a-b*c(d)[e]'], ['haakjes en sterren', 'a*b*c', '*', '+', 'a+b+c'], ['vervanging bevat zoekterm', 'aa', 'a', 'aa', 'aaaa'],
    ['leeg vervangen', 'abcabc', 'b', '', 'acac'], ['emoji', '😀x😀', '😀', 'o', 'oxo'], ['hoofdlettergevoelig', 'Aa aA', 'a', 'z', 'Az zA', { cs: true }], ['heel woord', 'cat concat cat.', 'cat', 'dog', 'dog concat dog.', { whole: true }],
    ['dollar-tekens in vervanging', 'abc', 'b', '$&$1$$', 'a$&$1$$c'], ['backslashes', 'a\\b', '\\', '/', 'a/b'],
  ]) test('vervangen: ' + name, () => { const o = withText(text); doReplace(q, r, opts); const got = textOf(App.obj(o.id)); App.removeObjs([o.id]); eq(got, want); });
  test('vervangen: 20000 treffers < 5 s', () => { const o = withText('ab '.repeat(20000)); const t0 = performance.now(); doReplace('ab', 'c'); const dt = performance.now() - t0; const got = textOf(App.obj(o.id)); App.removeObjs([o.id]); ok(got.startsWith('c c c') && dt < 5000, 'tijd ' + Math.round(dt) + ' begin ' + got.slice(0, 12)); });
  test('zoeken met lege of rare term geeft geen crash', () => { for (const q of ['', ' ', '\n', '\\', '(', '[']) { App.exec('find', q); $('#find-input').value = q; $('#find-input').dispatchEvent(new Event('input')); App.exec('findNext'); } App.exec('closeFind'); });

  /* ---------- F. Samenvoegen (delen) ---------- */
  const mut = (d) => { const o = JSON.parse(JSON.stringify(d)); const act = pickR(['edit', 'addobj', 'delobj', 'addslide', 'delslide', 'swap']); const sl = pickR(o.slides); if (act === 'edit' && sl.objs.length) pickR(sl.objs).x = Math.round(rnd() * 100); else if (act === 'addobj') sl.objs.push({ id: 'n' + Math.floor(rnd() * 1e9), type: 'shape', x: 1, y: 1, w: 5, h: 5 }); else if (act === 'delobj' && sl.objs.length) sl.objs.splice(0, 1); else if (act === 'addslide') o.slides.splice(Math.floor(rnd() * o.slides.length), 0, { ...JSON.parse(JSON.stringify(sl)), id: 'sl' + Math.floor(rnd() * 1e9) }); else if (act === 'delslide' && o.slides.length > 1) o.slides.splice(Math.floor(rnd() * o.slides.length), 1); else if (act === 'swap' && o.slides.length > 1) o.slides.reverse(); return o; };
  test('samenvoegen: 300 willekeurige botsingen blijven geldig', () => {
    const b = base(); b.slides = Array.from({ length: 5 }, (_, i) => ({ ...JSON.parse(JSON.stringify(b.slides[0])), id: 's' + i }));
    for (let i = 0; i < 300; i++) {
      let l = b, r = b; for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) l = mut(l); for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) r = mut(r);
      const m = App.mergeShared.docs(b, l, r); ok(m && Array.isArray(m.slides) && m.slides.length >= 1, 'geen dia\'s');
      const ids = m.slides.map((s) => s.id); ok(new Set(ids).size === ids.length, 'dubbele dia-id\'s');
      m.slides.forEach((s) => { const oi = s.objs.map((x) => x.id); ok(new Set(oi).size === oi.length, 'dubbele object-id\'s'); });
      des(JSON.parse(JSON.stringify(m)));
    }
  });
  test('samenvoegen zonder basis of met lege kanten gooit niets', () => { const b = base(); for (const [x, l, r] of [[null, b, b], [b, b, b], [b, { ...b, slides: [] }, b], [b, b, { ...b, slides: [] }], [null, b, { ...b, masters: [] }]]) { const m = App.mergeShared.docs(x, l, r); ok(m && m.slides); } });

  /* ---------- G. Formaat, pptx, tekstbewerking ---------- */
  test('diaformaat wijzigen met extreme waarden houdt getallen eindig', () => { for (const [w, h] of [[50, 50], [20000, 20000], [1280, 100], [100, 5000]]) { App.run(() => App.resizePres(w, h, pickR(['fit', 'max']))); const bad = []; App.walkObjs(App.cur().objs, (o) => { [o.x, o.y, o.w, o.h].forEach((v) => { if (v !== undefined && !Number.isFinite(v)) bad.push(o.id); }); }); ok(!bad.length, 'niet-eindig na ' + w + 'x' + h); } });
  test('pptx lezen: rommel geeft een duidelijke fout, geen hang', async () => { for (const buf of [new ArrayBuffer(0), new Uint8Array([1, 2, 3]).buffer, new TextEncoder().encode('PK\x03\x04garbage'.repeat(100)).buffer]) { let threw = false; try { await Promise.race([App.Pptx.read(buf, 'x'), new Promise((_, rj) => setTimeout(() => rj(new Error('HANG')), 5000))]); } catch (e) { threw = true; ok(e.message !== 'HANG', 'hang'); } ok(threw, 'geen fout'); } });
  test('zip-bom (kleine zip die enorm uitpakt) blijft snel of wordt afgewezen', async () => { const z = new JSZip(); z.file('[Content_Types].xml', '<a/>'.repeat(10)); z.file('ppt/presentation.xml', 'A'.repeat(50 * 1024 * 1024)); const buf = await z.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }); ok(buf.byteLength < 200000, 'zip niet klein: ' + buf.byteLength); const t0 = performance.now(); try { await Promise.race([App.Pptx.read(buf, 'x'), new Promise((_, rj) => setTimeout(() => rj(new Error('HANG')), 15000))]); } catch (e) { ok(e.message !== 'HANG', 'hang'); } ok(performance.now() - t0 < 15000); });
  test('tekstbewerking: extreme plakinvoer', () => { const o = withText(''); App.textEdit.start(o.id); for (const t of ['x'.repeat(200000), '\n'.repeat(5000), '\u0000‮﻿', '<b>x</b>']) App.textEdit.insertText(t); App.textEdit.stop(); const got = textOf(App.obj(o.id)); App.removeObjs([o.id]); ok(!got.includes('\u0000'), 'nulteken bleef staan'); ok(got.includes('<b>x</b>'), 'tekst vervormd'); });

  /* ---------- Uitvoeren ---------- */
  if (window.__list) return T.map((t) => t.name);
  const res = { pass: 0, fail: 0, failures: [], total: T.length };
  for (const t of T.filter((x) => !window.__only || x.name === window.__only)) {
    if (App.history.reset) App.history.reset();
    try { await t.fn(); res.pass++; } catch (e) { res.fail++; res.failures.push(t.name + ' → ' + (e && e.message ? e.message : e)); }
  }
  window.__stress = res; return res;
})()
