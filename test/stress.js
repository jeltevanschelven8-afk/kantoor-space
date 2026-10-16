/* Inkt — stresstest (gemaakt door JJ van Schelven). Draait in de browser tegen de app in het iframe. */
'use strict';
(async () => {
  const results = []; window.__results = results;
  const out = document.getElementById('out'), status = document.getElementById('status');
  const frame = document.getElementById('app');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const row = (r) => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="${r.ok ? 'ok' : 'fail'}">${r.ok ? 'OK' : 'FOUT'}</td><td>${r.name}</td><td>${r.ms.toFixed(0)} ms</td><td><pre></pre></td>`; tr.querySelector('pre').textContent = r.info || ''; out.appendChild(tr); };
  // Een test die de pagina bevriest: na herladen wordt hij als HANG gemeld en overgeslagen (?reset wist dit)
  const LS = window.localStorage;
  if (location.search.includes('reset')) { LS.removeItem('stress.hangs'); LS.removeItem('stress.current'); }
  const hangs = JSON.parse(LS.getItem('stress.hangs') || '[]');
  const unfinished = LS.getItem('stress.current');
  if (unfinished && !hangs.includes(unfinished)) { hangs.push(unfinished); LS.setItem('stress.hangs', JSON.stringify(hangs)); }
  LS.removeItem('stress.current');
  const test = async (name, fn, maxMs = 3000) => {
    if (hangs.includes(name)) { const r = { name, ok: false, ms: 0, info: 'HANG: bevroor de pagina bij een vorige run' }; results.push(r); row(r); return false; }
    LS.setItem('stress.current', name);
    try { return await test2(name, fn, maxMs); } finally { LS.removeItem('stress.current'); }
  };
  const test2 = async (name, fn, maxMs) => {
    const t0 = performance.now(); let ok = false, info = '';
    try { const r = await fn(); ok = r === true || (r && r.ok !== false); info = typeof r === 'string' ? r : (r && r.info) || ''; if (ok && performance.now() - t0 > maxMs) { ok = false; info = `te traag (> ${maxMs} ms) ` + info; } }
    catch (e) { ok = false; info = 'uitzondering: ' + (e && e.message || e); }
    const r = { name, ok, ms: performance.now() - t0, info }; results.push(r); row(r); return ok;
  };

  // wachten tot de app er is
  let W, App;
  for (let i = 0; i < 100; i++) { W = frame.contentWindow; App = W && W.App; if (App && App.cleanDoc && App.rtfToHtml && App.ed) break; await sleep(200); }
  if (!App) { status.textContent = 'App niet geladen'; return; }
  await sleep(800); App.closeBackstage && App.closeBackstage();
  W.__pwn = 0;
  const BAD_PROTO = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'blob:']);
  const checkEd = () => {
    const ed = App.ed; const bad = [];
    if (W.__pwn) bad.push('code uitgevoerd: ' + W.__pwn);
    ed.querySelectorAll('*').forEach((el) => {
      for (const a of el.attributes) if (/^on/i.test(a.name)) bad.push(`attribuut ${a.name} op ${el.tagName}`);
      if (/^(script|iframe|object|embed|style|link|meta|base|form|input|button|textarea|select|template|svg|math|foreignobject|animate|set)$/i.test(el.localName)) bad.push('tag ' + el.localName);
      if (el.hasAttribute('ping') || el.hasAttribute('autoplay')) bad.push('ping/autoplay');
      if (/position\s*:\s*fixed/i.test(el.getAttribute('style') || '')) bad.push('position:fixed');
      if (el.id && W.document.getElementById(el.id) !== el) bad.push('id-botsing ' + el.id);
      if (el.hasAttribute('name')) bad.push('name-attribuut');
    });
    ed.querySelectorAll('a[href]').forEach((a) => { let p = ''; try { p = new URL(a.getAttribute('href'), W.location.href).protocol; } catch { p = 'ongeldig'; } if (BAD_PROTO.has(p)) bad.push('href ' + p + ' ' + JSON.stringify(a.getAttribute('href'))); });
    ed.querySelectorAll('[src],[srcset],[poster],[background],[xlink\\:href]').forEach((el) => { for (const n of ['src', 'srcset', 'poster', 'background', 'xlink:href']) { const v = el.getAttribute(n); if (v == null) continue; let p = ''; try { p = new URL(v.split(',')[0].trim().split(' ')[0], W.location.href).protocol; } catch { p = 'ongeldig'; } if (p === 'javascript:' || p === 'file:' || p === 'vbscript:' || (p === 'data:' && !/^\s*data:image\//i.test(v))) bad.push(`${n} ${p}`); } });
    return bad;
  };
  const load = async (html, meta) => { App.loadDoc({ id: 'stress', title: 'Stress', html, meta }); await sleep(30); };

  /* ---------- 1. Veiligheidsfilter ---------- */
  const XSS = {
    'onerror': '<img src=x onerror="window.__pwn=1">',
    'ONERROR hoofdletters': '<IMG SRC=x ONERROR="window.__pwn=2">',
    'javascript:-href': '<a href="javascript:window.__pwn=3">x</a>',
    'tab in scheme': '<a href="java\tscript:window.__pwn=4">x</a>',
    'newline in scheme': '<a href="java\nscript:window.__pwn=5">x</a>',
    'control-teken vooraan': '<a href="\u0001javascript:window.__pwn=6">x</a>',
    'entity colon': '<a href="javascript&colon;window.__pwn=7">x</a>',
    'entity letters': '<a href="&#106;avascript:window.__pwn=8">x</a>',
    'gemengde hoofdletters': '<a href="JaVaScRiPt:window.__pwn=9">x</a>',
    'file-koppeling': '<a href="file:///C:/Windows/notepad.exe">x</a>',
    'data:text/html': '<a href="data:text/html,<script>parent.__pwn=10</script>">x</a>',
    'svg script': '<svg><script>window.__pwn=11</script></svg>',
    'svg animate': '<svg><a><animate attributeName="href" to="javascript:window.__pwn=12"/><text>x</text></a></svg>',
    'svg set': '<svg><a xlink:href="#"><set attributeName="href" to="javascript:window.__pwn=13"/></a></svg>',
    'foreignObject': '<svg><foreignObject><img src=x onerror="window.__pwn=14"></foreignObject></svg>',
    'math': '<math><maction actiontype="statusline#x" xlink:href="javascript:window.__pwn=15">x</maction></math>',
    'iframe srcdoc': '<iframe srcdoc="<script>parent.__pwn=16</script>"></iframe>',
    'object/embed': '<object data="javascript:window.__pwn=17"></object><embed src="javascript:window.__pwn=18">',
    'meta refresh': '<meta http-equiv="refresh" content="0;url=javascript:window.__pwn=19">',
    'base href': '<base href="javascript:window.__pwn=20//">',
    'form formaction': '<form action="javascript:window.__pwn=21"><button formaction="javascript:window.__pwn=22">x</button></form>',
    'input autofocus onfocus': '<input autofocus onfocus="window.__pwn=23">',
    'details ontoggle': '<details open ontoggle="window.__pwn=24">x</details>',
    'video source onerror': '<video><source src=x onerror="window.__pwn=25"></video>',
    'style expression': '<p style="width:expression(window.__pwn=26)">x</p>',
    'style url js': '<p style="background:url(javascript:window.__pwn=27)">x</p>',
    'srcset js': '<img srcset="javascript:window.__pwn=28 1x">',
    'img src data:text/html': '<img src="data:text/html,<script>parent.__pwn=29</script>">',
    'use href data': '<svg><use href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PjwvY3NjcmlwdD48L3N2Zz4="/></svg>',
    'mXSS noscript': '<noscript><p title="</noscript><img src=x onerror=window.__pwn=30>"></noscript>',
    'mXSS style': '<style><img src=x onerror="window.__pwn=31"></style>',
    'mXSS template': '<template><img src=x onerror="window.__pwn=32"></template>',
    'mXSS svg style': '<svg><style><img src=x onerror="window.__pwn=33"></style></svg>',
    'mXSS p in form': '<form><math><mtext></form><form><mglyph><style></math><img src onerror="window.__pwn=34">',
    'DOM clobbering id': '<p id="dialog-layer">x</p><p id="toast-layer">y</p><p id="editor">z</p>',
    'DOM clobbering name': '<img name="loadDoc" src=x><a name="ed">x</a>',
    'is-attribuut': '<p is="x-y">x</p>',
    'target _blank': '<a href="https://example.com" target="_blank">x</a>',
    'commentaar met script': '<!--<script>window.__pwn=35</script>--><p>x</p>',
    'cdata': '<![CDATA[<script>window.__pwn=36</script>]]>',
    'xmp/plaintext': '<xmp><script>window.__pwn=37</script></xmp><plaintext><script>window.__pwn=38</script>',
    'textarea escape': '<textarea></textarea><img src=x onerror="window.__pwn=39">',
    'title escape': '<title></title><img src=x onerror="window.__pwn=40">',
    'unicode in attribuutnaam': '<img src=x on\u0000error="window.__pwn=41">',
    'nested quotes': '<a href=\'javascript:window.__pwn=42\' title=">">x</a>',
    'ping-attribuut': '<a href="https://example.com" ping="https://evil.example/log">x</a>',
    'autoplay': '<audio autoplay src="https://example.com/a.mp3"></audio><video autoplay src="https://example.com/v.mp4"></video>',
    'position fixed overlay': '<p style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999">dekt alles af</p>',
    'id van het bewerkvenster': '<p id="editor">z</p><p id="pages">q</p>',
    'href alleen stuurtekens': '<a href="\u0000\u0001\t">x</a>',
    'volwidth javascript': '<a href="ｊavascript:window.__pwn=43">x</a>',
    'href 1 MB': '<a href="https://example.com/' + 'a'.repeat(1000000) + '">x</a>',
  };
  for (const [name, html] of Object.entries(XSS)) {
    await test('filter: ' + name, async () => { W.__pwn = 0; await load(html); await sleep(60); const bad = checkEd(); return bad.length ? { ok: false, info: bad.join('; ') + '\n' + App.ed.innerHTML.slice(0, 200) } : true; });
  }
  await test('filter: kop-/voettekst en opmerkingen', async () => {
    W.__pwn = 0;
    await load('<p>x</p>', { header: '<img src=x onerror="window.__pwn=50">', footerFirst: '<a href="javascript:window.__pwn=51">x</a>', comments: [{ id: '"><img src=x onerror=window.__pwn=52>', text: { toString() { return 'x'; } }, author: ['a'], replies: 'nee' }, null, 5] });
    await sleep(100);
    const h = App.doc.meta; const bad = [];
    if (W.__pwn) bad.push('code uitgevoerd ' + W.__pwn);
    if (/onerror|javascript:/i.test(h.header + h.footerFirst)) bad.push('kop/voet niet schoon');
    if (!Array.isArray(h.comments) || h.comments.some((c) => typeof c.text !== 'string' || !Array.isArray(c.replies) || /[^\w-]/.test(c.id))) bad.push('opmerkingen niet schoon: ' + JSON.stringify(h.comments).slice(0, 120));
    return bad.length ? { ok: false, info: bad.join('; ') } : true;
  });
  await test('filter: 20.000 diep genest', async () => { await load('<b>'.repeat(20000) + 'x' + '</b>'.repeat(20000)); return App.ed.textContent.includes('x') ? true : { ok: false, info: 'inhoud weg' }; }, 5000);
  await test('filter: 4 MB document', async () => { const big = ('<p>' + 'woord '.repeat(200) + '</p>').repeat(3300); await load(big); return App.ed.children.length > 3000 ? true : { ok: false, info: 'blokken: ' + App.ed.children.length }; }, 15000);
  await test('cleanDocData: rare typen', async () => {
    const cases = [undefined, null, 5, 'tekst', [], { html: 5 }, { html: {} }, { html: null, meta: null }, { html: '<p>x</p>', meta: 'nee' }, { html: '<p>x</p>', meta: { comments: 'x', header: 7, page: { margins: { t: 'abc', b: -5, l: 1e9, r: null }, size: 'XXL', orient: 'diagonaal' } } }, { html: '<p>x</p>', title: 'T'.repeat(1e6) }];
    const bad = [];
    for (const c of cases) { try { const r = App.cleanDocData(c); if (c && typeof c === 'object' && !Array.isArray(c)) { if (typeof r.html !== 'string') bad.push('html niet string'); if (r.title && r.title.length > 300) bad.push('titel te lang'); if (r.meta && r.meta.comments && !Array.isArray(r.meta.comments)) bad.push('comments'); } } catch (e) { bad.push('uitzondering bij ' + JSON.stringify(c).slice(0, 40) + ': ' + e.message); } }
    return bad.length ? { ok: false, info: bad.join('; ') } : true;
  });
  await test('loadDoc: extreme marges en formaat', async () => {
    await load('<p>a</p><p>b</p><p>c</p>', { page: { size: 'XXL', orient: 'diagonaal', margins: { t: 20, b: 20, l: 'abc', r: -3 } } });
    await sleep(50); const g = App.geom();
    const m = App.doc.meta.page.margins;
    return Number.isFinite(g.W) && [g.mt, g.mb, g.ml, g.mr].every((v) => Number.isFinite(v) && v >= 0) && m.t <= 10 && App.pages.count < 50 ? JSON.stringify(m) : { ok: false, info: JSON.stringify(g) + ' pagina\'s ' + App.pages.count };
  }, 4000);
  await test('openLink: alleen web en e-mail', () => {
    const opened = []; const orig = W.open; W.open = (u) => { opened.push(u); return null; };
    try { ['javascript:1', 'file:///C:/x.exe', 'data:text/html,x', 'vbscript:x', 'https://example.com', 'mailto:a@b.nl', 'ftp://x', '\u0001javascript:x', 'java\tscript:x'].forEach((u) => App.openLink(u)); } finally { W.open = orig; }
    const bad = opened.filter((u) => !/^(https:|mailto:)/.test(u));
    return bad.length || opened.length !== 2 ? { ok: false, info: 'geopend: ' + opened.join(', ') } : true;
  });

  /* ---------- 2. RTF-lezer (in een Worker, met time-out) ---------- */
  const rtfSrc = App.rtfToHtml.toString();
  const escSrc = App.esc.toString();
  const workerCode = `const App = { esc: ${escSrc} }; App.rtfToHtml = ${rtfSrc}; onmessage = (e) => { const t = performance.now(); try { const r = App.rtfToHtml(e.data); postMessage({ ok: true, ms: performance.now() - t, len: r.length, out: r.slice(0, 300) }); } catch (err) { postMessage({ ok: false, err: String(err) }); } };`;
  const rtf = (input, ms = 2000) => new Promise((res) => {
    const w = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' })));
    const t = setTimeout(() => { w.terminate(); res({ ok: false, err: 'HANG (> ' + ms + ' ms)' }); }, ms);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); res(e.data); };
    w.postMessage(input);
  });
  const RTF = {
    'uc negatief': '{\\rtf1\\uc-1\\u233?x\\par}',
    'uc enorm': '{\\rtf1\\uc999999999\\u233?x\\par tekst}',
    'onafgesloten groepen': '{\\rtf1' + '{'.repeat(50000) + 'x',
    'te veel sluithaken': '{\\rtf1 x' + '}'.repeat(50000),
    'hex aan het eind': "{\\rtf1 x\\'",
    'ongeldige hex': "{\\rtf1 x\\'zz y}",
    'u zonder getal': '{\\rtf1 x\\u y}',
    'u enorm': '{\\rtf1 x\\u99999999999999? y}',
    'surrogaatpaar': '{\\rtf1 \\u-10179?\\u-8706? y}',
    'lang stuurwoord': '{\\rtf1 \\' + 'a'.repeat(200) + ' x}',
    'negatieve grootte': '{\\rtf1 \\fs-10 x\\cf99999 y\\cf-1 z}',
    'bin': '{\\rtf1 \\bin10 \\\\{}x\\par}',
    'tabel zonder row': '{\\rtf1 \\trowd\\cellx1000 a\\cell b\\cell x}',
    'tekst na tabel': '{\\rtf1 \\trowd\\cellx1000\\intbl a\\cell b\\cell\\row \\pard Daarna gewone tekst.\\par}',
    'twee tabellen': '{\\rtf1 \\trowd\\intbl a\\cell\\row \\pard tussen\\par \\trowd\\intbl b\\cell\\row \\pard einde\\par}',
    'leeg': '',
    'geen rtf': 'Dit is gewoon tekst zonder rtf.',
    'alleen stuurtekens': '\\\\\\\\\\\\{{{}}}\\',
    'colortbl kapot': '{\\rtf1{\\colortbl;\\red300\\green-1\\blueX;;;}\\cf3 x}',
    '2 MB par': '{\\rtf1 ' + '\\par x'.repeat(300000) + '}',
    'diepe groepen 100k': '{\\rtf1 ' + '{\\b '.repeat(100000) + 'x' + '}'.repeat(100000) + '}',
    'null-bytes': '{\\rtf1 a\u0000b\\par}',
  };
  for (const [name, input] of Object.entries(RTF)) {
    await test('rtf: ' + name, async () => { const r = await rtf(input, name.startsWith('2 MB') || name.startsWith('diepe') ? 8000 : 2000); if (!r.ok) return { ok: false, info: r.err }; let info = r.out; if (name === 'tekst na tabel' && !/<\/table><p>Daarna gewone tekst\./.test(r.out)) return { ok: false, info: 'tekst in tabel gezogen: ' + r.out }; if (name === 'twee tabellen' && (r.out.match(/<table/g) || []).length !== 2) return { ok: false, info: 'tabellen: ' + r.out }; if (name === 'null-bytes' && r.out.includes('\u0000')) return { ok: false, info: 'null-byte in uitvoer' }; return info; }, 9000);
  }

  /* ---------- 3. ODT-lezer ---------- */
  const JSZip = W.JSZip || (await App.loadScript(App.JSZIP), W.JSZip);
  const odt = async (files) => { const z = new JSZip(); for (const [n, c] of Object.entries(files)) z.file(n, c); return App.odtToHtml(await z.generateAsync({ type: 'arraybuffer' })); };
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
  const wrapOdt = (body) => `<?xml version="1.0"?><office:document-content ${NS}><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  await test('odt: geen content.xml', async () => { try { await odt({ 'mimetype': 'x' }); return { ok: false, info: 'geen fout' }; } catch (e) { return 'fout: ' + e.message; } });
  await test('odt: kapotte XML geeft een fout', async () => { try { const h = await odt({ 'content.xml': '<office:document-content><office:text><text:p>x' }); return { ok: false, info: 'geen fout, uitvoer: ' + h.slice(0, 100) }; } catch (e) { return 'fout: ' + e.message; } });
  await test('odt: text:c enorm', async () => { const h = await odt({ 'content.xml': wrapOdt('<text:p>a<text:s text:c="999999999"/>b</text:p>') }); return h.length < 100000 ? true : { ok: false, info: 'lengte ' + h.length }; }, 4000);
  await test('odt: 30.000 geneste spans (fout of inhoud, geen hang)', async () => { try { const h = await odt({ 'content.xml': wrapOdt('<text:p>' + '<text:span>'.repeat(30000) + 'x' + '</text:span>'.repeat(30000) + '</text:p>') }); return h.includes('x') ? true : { ok: false, info: h.slice(0, 100) }; } catch (e) { return 'nette fout: ' + e.message; } }, 6000);
  await test('odt: 200 geneste spans', async () => { const h = await odt({ 'content.xml': wrapOdt('<text:p>' + '<text:span>'.repeat(200) + 'x' + '</text:span>'.repeat(200) + '</text:p>') }); return h.includes('x') ? true : { ok: false, info: h.slice(0, 100) }; }, 6000);
  await test('odt: afbeelding buiten het zip', async () => { const h = await odt({ 'content.xml': wrapOdt('<text:p><draw:frame><draw:image xlink:href="../../../etc/passwd"/></draw:frame></text:p>') }); return /<img/.test(h) ? { ok: false, info: h } : true; });
  await test('odt: script in tekst', async () => { const h = await odt({ 'content.xml': wrapOdt('<text:p>&lt;img src=x onerror=alert(1)&gt;<text:a xlink:href="javascript:alert(1)">k</text:a></text:p>') }); await load(h); return checkEd().length ? { ok: false, info: checkEd().join(';') } : true; });
  await test('odt: 20.000 alinea\'s', async () => { const h = await odt({ 'content.xml': wrapOdt('<text:p>alinea</text:p>'.repeat(20000)) }); return h.length > 20000 ? true : { ok: false }; }, 8000);
  await test('odt: colspan enorm', async () => { const h = await odt({ 'content.xml': wrapOdt('<table:table><table:table-row><table:table-cell table:number-columns-spanned="99999999999"><text:p>x</text:p></table:table-cell></table:table-row></table:table>') }); await load(h); return App.ed.querySelector('td') ? true : { ok: false, info: h }; });

  /* ---------- 4. DOCX-verrijking ---------- */
  await test('docx: heen en terug met 1500 alinea\'s en opmaak', async () => {
    let html = ''; for (let i = 0; i < 1500; i++) html += `<p style="text-align:${['left', 'center', 'right'][i % 3]}">Alinea ${i} met <span style="color:#c00000">rood</span> en <b>vet</b></p>`;
    await load(html); const blob = await App.buildBlob('docx'); const r = await App.fileToDoc(new W.File([blob], 't.docx'));
    const d = W.document.createElement('div'); d.innerHTML = r.html;
    const c = d.querySelectorAll('p[style*="center"]').length, red = d.querySelectorAll('span[style*="192, 0, 0"], span[style*="c00000"]').length;
    return c >= 499 && red >= 1400 ? `gecentreerd ${c}, rood ${red}` : { ok: false, info: `gecentreerd ${c}, rood ${red}` };
  }, 20000);
  await test('docx: kapot zip', async () => { try { const r = await App.fileToDoc(new W.File([new Uint8Array([80, 75, 3, 4, 1, 2, 3])], 'k.docx')); return { ok: false, info: 'geen fout: ' + r.html.slice(0, 50) }; } catch (e) { return 'fout: ' + e.message; } });
  await test('docx: geen document.xml', async () => { const z = new JSZip(); z.file('x.txt', 'x'); try { const r = await App.fileToDoc(new W.File([await z.generateAsync({ type: 'arraybuffer' })], 'leeg.docx')); return { ok: false, info: 'geen fout: ' + r.html.slice(0, 50) }; } catch (e) { return 'fout: ' + e.message; } });

  /* ---------- 5. Opslag ---------- */
  await test('opslag: versies met rommel', () => {
    const ls = W.localStorage; const keys = ['inkt.ver.r1', 'inkt.ver.r2', 'inkt.ver.r3', 'inkt.ver.r4'];
    ls.setItem('inkt.ver.r1', 'geen json'); ls.setItem('inkt.ver.r2', '{"a":1}'); ls.setItem('inkt.ver.r3', 'null'); ls.setItem('inkt.ver.r4', '[{"t":1},{"t":"x"},null,5]');
    try { const r = App.pruneVersions(); return typeof r === 'boolean' ? true : { ok: false }; } catch (e) { return { ok: false, info: e.message }; } finally { keys.forEach((k) => ls.removeItem(k)); }
  });
  await test('opslag: reserve-opslag zonder IndexedDB', async () => {
    const orig = Object.getOwnPropertyDescriptor(W, 'indexedDB') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(W), 'indexedDB');
    try {
      Object.defineProperty(W, 'indexedDB', { configurable: true, get() { throw new Error('geblokkeerd'); } });
      const setOrig = App.store.set; App.store.set = (k, v) => (k.startsWith('doc.') ? false : setOrig.call(App.store, k, v));
      App.newDoc('blank'); App.ed.innerHTML = '<p>reserve</p>'; App.markDirty();
      let ok = true; try { App.saveLocal(true); } catch (e) { ok = false; }
      await sleep(300);
      App.store.set = setOrig;
      const got = await App.loadStored(App.doc.id);
      return ok ? 'opslaan gaf geen uitzondering; loadStored: ' + (got ? 'iets' : 'null') : { ok: false, info: 'uitzondering' };
    } finally { if (orig) Object.defineProperty(W, 'indexedDB', orig); else delete W.indexedDB; }
  }, 4000);

  /* ---------- 6. Paginering en lint ---------- */
  await test('layout: tabel met 3000 rijen', async () => { let rows = ''; for (let i = 0; i < 3000; i++) rows += `<tr><td>${i}</td><td>x</td></tr>`; await load(`<table class="doc-table ts-grid"><tbody>${rows}</tbody></table>`); return `pagina's ${App.pages.count}, gesplitste rijen ${App.ed.querySelectorAll('tr.pg-row').length}`; }, 15000);
  await test('layout: rij hoger dan een pagina', async () => { await load(`<table class="doc-table ts-grid"><tbody><tr><td>${'regel<br>'.repeat(120)}</td></tr><tr><td>na</td></tr></tbody></table><p>einde</p>`); return `pagina's ${App.pages.count}`; }, 5000);
  await test('layout: marges groter dan de pagina', async () => { await load('<p>a</p><p>b</p><p>c</p><p>d</p>', { page: { size: 'A4', orient: 'portrait', margins: { t: 15, b: 15, l: 2, r: 2 } } }); return `pagina's ${App.pages.count}`; }, 5000);
  await test('layout: 300 koppen direct achter elkaar', async () => { await load('<h2>Kop</h2>'.repeat(300) + '<p>x</p>'); return `pagina's ${App.pages.count}`; }, 8000);
  await test('lint: 200× passen', () => { for (let i = 0; i < 200; i++) App.fitRibbon(); return true; }, 3000);
  await test('opmerkingen: 500 opmerkingen weergeven', async () => {
    let html = ''; const comments = []; for (let i = 0; i < 500; i++) { html += `<p>Tekst <span class="cmt" data-cid="c${i}">hier</span></p>`; comments.push({ id: 'c' + i, text: 'Opmerking ' + i, author: 'A', date: Date.now(), replies: [] }); }
    await load(html, { comments }); await sleep(100); return `kaarten ${W.document.querySelectorAll('#comment-pane .c-card').length}`;
  }, 15000);

  App.newDoc('blank');
  const fails = results.filter((r) => !r.ok).length;
  status.textContent = `Klaar: ${results.length} tests, ${fails} fout.`;
  window.__done = true;
})();
