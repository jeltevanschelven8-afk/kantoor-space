/* =========================================================
   Doek (gemaakt door JJ van Schelven) — afdrukken en exporteren: Bestand › Afdrukken met voorbeeld
   (volledige pagina's, notitiepagina's, overzicht, hand-outs), PDF, dia's en objecten als PNG/JPEG/SVG,
   de presentatie als video (overgangen en animaties beeld voor beeld) en ontbrekende lettertypen melden.
   Een dia wordt een afbeelding via SVG met foreignObject: stijlen, lettertypen en media gaan als
   data-URL mee in het SVG-bestand, zodat het canvas schoon blijft en er niets van internet komt.
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const T = (s) => App.t(s);
  const esc = (s) => App.esc(s);
  const r2 = (v) => App.round(v, 2);
  const MM = 96 / 25.4;   // px per mm
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const abortErr = () => new DOMException(T('Geannuleerd'), 'AbortError');

  /* ---------- Stijlen (één keer toevoegen) ---------- */
  const CSS = `.pd-pr{display:flex;gap:28px;align-items:stretch;min-height:calc(100vh - 170px)}
.pd-pr-set{width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:5px;padding-bottom:20px}
.pd-pr-go{display:flex;gap:10px;margin-bottom:6px}
.pd-pr-btn{width:96px;height:84px;border:1px solid var(--line-strong);border-radius:4px;background:var(--panel);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px}
.pd-pr-btn:hover{background:var(--hover);border-color:#9e9e9e}
.pd-pr-btn .i{font-size:34px;font-variation-settings:"FILL" 0,"wght" 200,"GRAD" 0,"opsz" 40}
.pd-pr-h{font-size:13px;font-weight:600;margin:14px 0 3px;padding-bottom:3px;border-bottom:1px solid var(--line)}
.pd-pr-f{display:flex;flex-direction:column;gap:3px;font-size:12px}
.pd-pr-f>span{color:var(--muted)}
.pd-pr-set select,.pd-pr-set input[type=text]{width:100%;height:30px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--panel);color:var(--text);padding:0 8px;outline:none}
.pd-pr-set select:focus,.pd-pr-set input[type=text]:focus{border-color:var(--accent)}
.pd-pr-set input.bad{border-color:#c50f1f;box-shadow:inset 0 -1px 0 #c50f1f}
.pd-pr-set .chk{white-space:normal;font-size:12.5px;padding:3px 2px}
.pd-pr-set .pd-pr-2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pd-pr-pv{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--canvas);border-radius:4px;min-height:420px}
.pd-pv-stage{flex:1;min-height:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.pd-pv-box{position:relative;flex-shrink:0;box-shadow:var(--page-shadow);background:#fff}
.pd-pv-box>.pd-pg{position:absolute;left:0;top:0;transform-origin:0 0}
.pd-pv-empty{color:var(--muted);font-size:13px}
.pd-pv-nav{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px 10px;font-size:12.5px;color:var(--text)}
.pd-pv-nav .qb{width:28px;height:28px;border:0;background:transparent;border-radius:var(--radius);color:var(--icon)}
.pd-pv-nav .qb:hover{background:var(--hover)}
.pd-pv-nav .qb[disabled]{opacity:.35;cursor:default}
.pd-pg{position:relative;overflow:hidden;background:#fff;color:#111;font-family:Inter,"Segoe UI",system-ui,sans-serif;box-sizing:border-box}
.pd-pg *{box-sizing:border-box}
.pd-sb{position:absolute;background:#fff}
.pd-sb.fr{box-shadow:0 0 0 1px #6b6b6b}
.pd-sb>.thumb-wrap{position:absolute;left:0;top:0}
.pd-hf{position:absolute;font-size:9pt;line-height:1.2;color:#505050;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46%}
.pd-lines{position:absolute;background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(var(--lh) - 1px),#9a9a9a calc(var(--lh) - 1px),#9a9a9a var(--lh))}
.pd-notes{position:absolute;font-size:12pt;line-height:1.45;color:#111;overflow:hidden;white-space:pre-wrap;overflow-wrap:break-word}
.pd-notes p{margin:0 0 4pt}
.pd-ol{position:absolute;overflow:hidden}
.pd-ol p{margin:0;font-size:11pt;line-height:1.4;padding-top:2pt;color:#111;overflow-wrap:break-word}
.pd-ol p.t{font-size:13pt;font-weight:600;padding-top:9pt}
.pd-ol p.t:first-child{padding-top:0}
.pd-ol p.hid{color:#777}
.pd-c-gray .pd-sb{filter:grayscale(1)}
.pd-c-bw .pd-sb{filter:grayscale(1)}
.pd-c-bw .sl-bg{background:#fff !important}
.pd-c-bw .sl-bg>*{display:none !important}
.pd-c-bw .geo path:not([fill="none"]){fill:#fff !important;fill-opacity:1 !important}
.pd-c-bw .geo path[stroke]:not([stroke="none"]),.pd-c-bw .ob.ink path{stroke:#000 !important;stroke-opacity:1 !important}
.pd-c-bw .ob.line .geo path:not([fill="none"]){fill:#000 !important}
.pd-c-bw .ob.diagram .geo path:not([fill="none"]){stroke:#000 !important;stroke-width:1px}
.pd-c-bw .tx,.pd-c-bw .tx *,.pd-c-bw .cell-tx *,.pd-c-bw .eq,.pd-c-bw .eq *,.pd-c-bw .icon-glyph{color:#000 !important;-webkit-text-fill-color:#000 !important;text-shadow:none !important;background:none !important}
.pd-c-bw .tb td{background:#fff !important;border-color:#000 !important}
.pd-c-bw .chart-svg{filter:grayscale(1) contrast(1.3)}
.pd-c-bw .ob.image .geo image,.pd-c-bw .media-ph{filter:grayscale(1) contrast(1.2)}
@media print{body.pd-printing #print-area .pd-pg{box-shadow:none;margin:0}
body.pd-printing *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.pd-ex .field{margin-bottom:10px}
.pd-ex .pd-ex-opts{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}
.pd-ex .chk{white-space:normal;font-size:12.5px}
.pd-ex .pd-ex-note{margin:4px 0 0;line-height:1.45}
.pd-prog{height:6px;background:var(--hover);border-radius:3px;overflow:hidden;margin:6px 0 8px}
.pd-prog i{display:block;height:100%;width:0;background:var(--accent);transition:width .12s linear}
.pd-prog-t{font-size:12px;color:var(--muted);min-height:16px}
#pd-fontwarn{position:fixed;right:16px;bottom:36px;z-index:85;width:min(360px,calc(100vw - 32px));background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow-lg);padding:12px 14px 12px;font-size:12.5px;animation:fade .15s ease-out}
#pd-fontwarn .pd-fw-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
#pd-fontwarn .pd-fw-head b{flex:1;font-weight:600;font-size:13px}
#pd-fontwarn .pd-fw-head>.i{color:#b06000;font-size:20px}
#pd-fontwarn .qb{width:26px;height:26px;border:0;background:transparent;border-radius:var(--radius);display:grid;place-items:center;color:var(--icon)}
#pd-fontwarn .qb:hover{background:var(--hover)}
#pd-fontwarn p{margin:0 0 8px;line-height:1.45}
#pd-fontwarn ul{margin:0 0 10px;padding:0;list-style:none;max-height:150px;overflow:auto}
#pd-fontwarn li{display:flex;gap:6px;align-items:baseline;padding:2px 0}
#pd-fontwarn li b{font-weight:600}
#pd-fontwarn li .i{font-size:14px;color:var(--muted);align-self:center}
#pd-fontwarn .pd-fw-foot{display:flex;gap:8px;justify-content:flex-end}`;
  const addCss = () => {
    if (document.getElementById('pd-export-css')) return;
    const s = document.createElement('style'); s.id = 'pd-export-css'; s.textContent = CSS; document.head.appendChild(s);
  };
  addCss();

  // Verborgen werkplek voor dia's die als afbeelding of video worden getekend
  const host = () => {
    let h = document.getElementById('pd-export-host');
    if (!h) {
      h = document.createElement('div'); h.id = 'pd-export-host'; h.setAttribute('aria-hidden', 'true');
      h.style.cssText = 'position:fixed;left:-40000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1';
      document.body.appendChild(h);
    }
    return h;
  };
  const objOf = (slide, id) => { const h = id && App.findObj(id, slide.objs); return h ? h.obj : null; };
  const slideNo = (s) => App.slideIndex(s.id) + 1;
  const canvasBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error(T('De afbeelding kon niet worden gemaakt')))), type || 'image/png', q));
  const blobToData = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

  /* ---------- Dia → afbeelding: stijlen, lettertypen en media verzamelen ---------- */
  const cache = { sheets: '', rules: null, faces: null, data: new Map(), faceCss: new Map() };
  // Adres → data-URL (blob:, eigen server); andere adressen worden nooit opgehaald
  const ownUrl = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'blob:' || (x.origin === location.origin && /^(https?|file):$/.test(x.protocol)) ? x.href : null; } catch { return null; } };
  const toData = (u) => {
    if (!u || /^data:/i.test(u)) return Promise.resolve(u || '');
    const href = ownUrl(u);
    if (!href) return Promise.resolve('');
    if (!cache.data.has(href)) cache.data.set(href, fetch(href).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(blobToData).catch(() => ''));
    return cache.data.get(href);
  };
  // Selectors die op een dia kunnen gelden: alleen klassen (geen id's, geen :hover/:focus)
  const splitSel = (s) => { const out = []; let d = 0, cur = ''; for (const c of s) { if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; if (c === ',' && !d) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const BAD_PSEUDO = /:(hover|focus|focus-visible|focus-within|active|checked|disabled|placeholder-shown|-webkit-scrollbar|-webkit-media)/;
  const selNeeds = (text) => {
    const alts = [];
    splitSel(text || '').forEach((s) => {
      const bare = s.replace(/\[[^\]]*\]/g, '').replace(/:not\([^)]*\)/g, '');
      if (bare.includes('#') || BAD_PSEUDO.test(s)) return;
      const cls = (bare.match(/\.[A-Za-z_-][\w-]*/g) || []).map((c) => c.slice(1));
      if (cls.length) alts.push(cls);
    });
    return alts.length ? alts : null;
  };
  const RANGE = /U\+([0-9A-F?]{1,6})(?:-([0-9A-F]{1,6}))?/gi;
  const parseRanges = (txt) => {
    const out = [];
    for (const m of String(txt || '').matchAll(RANGE)) {
      if (m[1].includes('?')) out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'F'), 16)]);
      else out.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
    }
    return out.length ? out : null;
  };
  // Alle regels en @font-face uit de stijlbladen van de pagina (één keer, tot er een stijlblad bijkomt)
  const collect = () => {
    const sheets = Array.from(document.styleSheets);
    const key = sheets.map((s) => (s.href || (s.ownerNode && s.ownerNode.id) || 'x') + ':' + (() => { try { return s.cssRules.length; } catch { return 0; } })()).join('|');
    if (cache.rules && cache.sheets === key) return cache;
    const rules = [], faces = [];
    const walk = (list, base) => {
      for (const r of list) {
        if (r instanceof CSSStyleRule) { const need = selNeeds(r.selectorText); if (need) rules.push({ text: r.cssText, need }); }
        else if (r instanceof CSSFontFaceRule) {
          const s = r.style;
          const fam = (s.getPropertyValue('font-family') || '').trim().replace(/^["']|["']$/g, '');
          const m = /url\(\s*(["']?)([^"')]+)\1\s*\)/.exec(s.getPropertyValue('src') || '');
          if (!fam || !m) continue;
          let url; try { url = new URL(m[2], base).href; } catch { continue; }
          faces.push({ fam, low: fam.toLowerCase(), url, weight: s.getPropertyValue('font-weight'), style: s.getPropertyValue('font-style'), rangeText: s.getPropertyValue('unicode-range'), ranges: parseRanges(s.getPropertyValue('unicode-range')) });
        } else if (r instanceof CSSImportRule && r.styleSheet) { try { walk(r.styleSheet.cssRules, r.styleSheet.href || base); } catch { /* ander domein */ } }
      }
    };
    sheets.forEach((sh) => { let list; try { list = sh.cssRules; } catch { return; } walk(list, sh.href || location.href); });
    cache.rules = rules; cache.faces = faces; cache.sheets = key;
    return cache;
  };
  const faceCss = (f) => {
    if (!cache.faceCss.has(f.url)) {
      cache.faceCss.set(f.url, toData(f.url).then((d) => (d ? `@font-face{font-family:"${f.fam.replace(/"/g, '')}";src:url(${d});${f.weight ? 'font-weight:' + f.weight + ';' : ''}${f.style ? 'font-style:' + f.style + ';' : ''}${f.rangeText ? 'unicode-range:' + f.rangeText + ';' : ''}}` : '')));
    }
    return cache.faceCss.get(f.url);
  };
  const familiesOf = (root) => {
    const fams = new Set(['inter']);
    const add = (list) => String(list || '').split(',').forEach((x) => { const n = x.trim().replace(/^["']|["']$/g, '').toLowerCase(); if (n) fams.add(n); });
    [root, ...root.querySelectorAll('[style]')].forEach((el) => { if (el.style && el.style.fontFamily) add(el.style.fontFamily); });
    if (root.querySelector('.i')) fams.add('material symbols outlined');
    const kx = root.querySelectorAll('.katex, .katex *');
    if (kx.length) {
      let found = false;
      kx.forEach((el) => { const f = getComputedStyle(el).fontFamily; if (/katex_/i.test(f)) { add(f); found = true; } });
      if (!found) ['katex_main', 'katex_math', 'katex_size1', 'katex_size2', 'katex_size3', 'katex_size4', 'katex_ams'].forEach((f) => fams.add(f));
    }
    return fams;
  };
  const classesOf = (root) => {
    const used = new Set();
    [root, ...root.querySelectorAll('[class]')].forEach((el) => { const c = el.getAttribute('class'); if (c) c.split(/\s+/).forEach((x) => x && used.add(x)); });
    return used;
  };
  // KaTeX (vergelijkingen) moet geladen zijn vóór het tekenen
  const needKatex = (objs) => { let yes = false; App.walkObjs(objs || [], (o) => { if (o.type === 'equation') { yes = true; return false; } return true; }); return yes; };
  const ensureKatex = async (owner) => {
    if (!owner || !App.loadKatex) return;
    const m = owner.objs ? [owner.objs] : [];
    if (owner.layout !== undefined) { const l = App.layoutOf(owner), ms = App.masterOf(owner); m.push(l.objs, ms.objs); }
    if (!m.some(needKatex)) return;
    if (!window.katex) { try { await App.loadKatex(); } catch { return; } }
    const link = document.querySelector('link[data-katex]');
    for (let k = 0; k < 40 && link && !link.sheet; k++) await sleep(50);
  };
  // Media in het eigen (verborgen) DOM: canvas → img, blob:/eigen adressen → data-URL, vreemde adressen eruit
  const inlineMedia = async (root) => {
    const jobs = [];
    root.querySelectorAll('canvas').forEach((c) => {
      try { const i = document.createElement('img'); i.src = c.toDataURL(); i.style.cssText = c.style.cssText; i.width = c.width; i.height = c.height; if (c.getAttribute('class')) i.setAttribute('class', c.getAttribute('class')); c.replaceWith(i); } catch { c.remove(); }
    });
    root.querySelectorAll('iframe, object, embed, script, audio').forEach((e) => e.remove());
    root.querySelectorAll('image').forEach((el) => {
      const u = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (u && !/^data:/i.test(u)) jobs.push(toData(u).then((d) => { el.removeAttributeNS('http://www.w3.org/1999/xlink', 'href'); el.setAttribute('href', d || ''); }));
    });
    root.querySelectorAll('img, video').forEach((el) => {
      const u = el.getAttribute('src');
      if (u && !/^data:/i.test(u)) jobs.push(toData(u).then((d) => { if (d) el.setAttribute('src', d); else el.removeAttribute('src'); }));
    });
    [root, ...root.querySelectorAll('[style]')].forEach((el) => {
      const s = el.getAttribute('style');
      if (!s || !/url\(/i.test(s)) return;
      const found = [...s.matchAll(/url\((['"]?)(.*?)\1\)/g)].map((m) => m[2]).filter((u) => u && !/^(data:|#)/i.test(u));
      if (!found.length) return;
      jobs.push(Promise.all(found.map((u) => toData(u).then((d) => [u, d]))).then((pairs) => {
        const map = new Map(pairs);
        el.setAttribute('style', el.getAttribute('style').replace(/url\((['"]?)(.*?)\1\)/g, (all, q, u) => (map.has(u) ? (map.get(u) ? `url("${map.get(u)}")` : 'none') : all)));
      }));
    });
    await Promise.all(jobs);
  };
  // Video's als stilstaand beeld (poster), geluid zonder beeld
  const stillMedia = (el, owner) => {
    el.querySelectorAll('video').forEach((v) => {
      const ob = v.closest('.ob'), o = ob && owner ? objOf(owner, ob.dataset.id) : null;
      const d = document.createElement('div'); d.className = 'media-ph';
      const u = o ? (App.mediaUrl(o.poster) || (o._frame ? App.safeUrl(o._frame) : '')) : '';
      if (u) d.style.backgroundImage = `url("${u}")`;
      v.replaceWith(d);
    });
    el.querySelectorAll('audio').forEach((a) => a.remove());
  };
  const BASE_CSS = '*{box-sizing:border-box}';
  // Alles wat één getekende dia (of een kader met twee dia's) nodig heeft: stijlregels en lettertypen
  const prepare = async (root) => {
    await inlineMedia(root);
    const C = collect();
    const used = classesOf(root);
    const rules = C.rules.filter((r) => r.need.some((alt) => alt.every((c) => used.has(c)))).map((r) => r.text);
    const fams = familiesOf(root);
    const cps = new Set();
    for (const ch of root.textContent || '') cps.add(ch.codePointAt(0));
    const hits = (ranges) => { if (!ranges) return true; for (const cp of cps) for (const [a, b] of ranges) if (cp >= a && cp <= b) return true; return false; };
    const faces = await Promise.all(C.faces.filter((f) => fams.has(f.low) && hits(f.ranges)).map(faceCss));
    return { css: BASE_CSS + faces.join('') + rules.join('') };
  };

  /* ---------- Tekenen: animatietoestand vastzetten, SVG maken, op canvas zetten ---------- */
  const kebab = (p) => (p === 'cssFloat' ? 'float' : p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
  const SKIP_KF = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  // Waarden van lopende (gepauzeerde) Web Animations tijdelijk als inline-stijl, zodat ze in de SVG meegaan
  const bake = (root) => {
    const targets = new Map();
    (root.getAnimations ? root.getAnimations({ subtree: true }) : []).forEach((a) => {
      const fx = a.effect;
      if (a.playState === 'idle' || !fx || !fx.target || !fx.getKeyframes) return;
      let props = targets.get(fx.target);
      if (!props) targets.set(fx.target, (props = new Set()));
      fx.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => { if (!SKIP_KF.has(p)) props.add(kebab(p)); }));
    });
    if (!targets.size) return () => {};
    const vals = [], saved = [];
    targets.forEach((props, el) => { const cs = getComputedStyle(el); props.forEach((p) => vals.push([el, p, cs.getPropertyValue(p)])); saved.push([el, el.getAttribute('style')]); });
    vals.forEach(([el, p, v]) => { if (v) el.style.setProperty(p, v); });
    return () => saved.forEach(([el, s]) => { if (s === null) el.removeAttribute('style'); else el.setAttribute('style', s); });
  };
  // Tekens die niet in XML mogen, en losse surrogaten (anders weigert de SVG te laden)
  const cleanXml = (s) => {
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
    return s.toWellFormed ? s.toWellFormed() : s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
  };
  const svgDoc = (markup, css, W, H, outW, outH, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${W} ${H}">`
    + `<foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="${XHTML}" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;font:13px/normal Inter,sans-serif;color:#000${bg ? ';background:' + bg : ''}">`
    + `<style><![CDATA[${css.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></style>${markup}</div></foreignObject></svg>`;
  const markupOf = (root) => {
    const restore = bake(root);
    try { return cleanXml(new XMLSerializer().serializeToString(root)); } finally { restore(); }
  };
  const loadSvg = (svg) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => res(img)); };
    img.onerror = () => rej(new Error(T('De afbeelding kon niet worden gemaakt')));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const rasterize = async (root, prep, o) => {
    const img = await loadSvg(svgDoc(markupOf(root), prep.css, o.W, o.H, o.outW, o.outH));
    const cv = o.canvas || document.createElement('canvas');
    if (cv.width !== o.outW) cv.width = o.outW;
    if (cv.height !== o.outH) cv.height = o.outH;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, o.outW, o.outH);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(0, 0, o.outW, o.outH); }
    ctx.drawImage(img, 0, 0, o.outW, o.outH);
    return cv;
  };
  // Uitvoermaat: breedte en/of hoogte, binnen de grenzen van een canvas
  const outSize = (o, W, H) => {
    let w = Math.round(+o.width || 0), h = Math.round(+o.height || 0);
    if (!w && !h) w = W;
    if (!w) w = Math.round(h * W / H);
    if (!h) h = Math.round(w * H / W);
    const k = Math.min(1, 8192 / Math.max(w, h), Math.sqrt(64e6 / (w * h)));
    return { outW: Math.max(1, Math.floor(w * k)), outH: Math.max(1, Math.floor(h * k)) };
  };

  /* ---------- Openbare functies: dia's en objecten als afbeelding ---------- */
  const renderStatic = (slide, mode) => {
    const el = App.renderSlide(slide, { mode: mode || 'export', num: slideNo(slide) });
    el.style.position = 'relative';
    return el;
  };
  // Dia → canvas. o: { width, height, type, fill, mode, canvas }
  App.slideToCanvas = async (slide, o = {}) => {
    const P = App.pres;
    slide = slide || App.cur();
    await ensureKatex(slide);
    const W = P.size.w, H = P.size.h, { outW, outH } = outSize(o, W, H);
    const el = renderStatic(slide, o.mode);
    host().appendChild(el);
    try {
      const prep = await prepare(el);
      return await rasterize(el, prep, { W, H, outW, outH, fill: o.type === 'image/jpeg' ? '#ffffff' : o.fill, canvas: o.canvas });
    } finally { el.remove(); }
  };
  // Dia → data-URL (bijv. miniatuur: { width: 200, type: 'image/jpeg', quality: 0.7 })
  App.slideToImage = async (slide, o = {}) => (await App.slideToCanvas(slide, o)).toDataURL(o.type || 'image/png', o.quality);
  App.slideToBlob = async (slide, o = {}) => canvasBlob(await App.slideToCanvas(slide, o), o.type || 'image/png', o.quality);
  // Dia als zelfstandig SVG-bestand (foreignObject, met stijlen, lettertypen en afbeeldingen erin)
  App.slideToSvg = async (slide, o = {}) => {
    const P = App.pres;
    slide = slide || App.cur();
    await ensureKatex(slide);
    const W = P.size.w, H = P.size.h, { outW, outH } = outSize(o.width ? o : { width: W }, W, H);
    const el = renderStatic(slide, o.mode);
    host().appendChild(el);
    try {
      const prep = await prepare(el);
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgDoc(markupOf(el), prep.css, W, H, outW, outH);
    } finally { el.remove(); }
  };
  // Geselecteerde objecten (in de volgorde van het werkvlak), met de bovenste groep als een kind van een groep is gekozen
  const topObjs = (ids, objs) => objs.filter((o) => ids.some((id) => id === o.id || (o.type === 'group' && App.findObj(id, o.objs || []))));
  const objBounds = (o, owner) => {
    const b = App.box(o, owner);
    let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    if (b.rot) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = b.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const hw = (b.w * c + b.h * s) / 2, hh = (b.w * s + b.h * c) / 2;
      x0 = cx - hw; x1 = cx + hw; y0 = cy - hh; y1 = cy + hh;
    }
    // lijnen, pijlpunten en effecten steken buiten het kader uit
    const fx = o.fx || {}, ln = App.objLine(o);
    let pad = ln && ln.type !== 'none' ? App.num(ln.w, 0.75) * App.PT + (ln.head || ln.tail ? 14 : 2) : 0;
    if (fx.shadow) pad = Math.max(pad, (fx.shadow.blur || 0) * 1.5 + (fx.shadow.dist || 0));
    if (fx.glow) pad = Math.max(pad, (fx.glow.size || 0) * 1.5);
    if (fx.soft) pad = Math.max(pad, 2);
    if (fx.refl) y1 += b.h * (fx.refl.size || 0.5) + (fx.refl.dist || 0);
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  };
  // Objecten → canvas (doorzichtige achtergrond) of SVG-tekst. o: { scale, svg }
  App.objectsToCanvas = async (objs, o = {}) => {
    const s = App.surface(), owner = s.owner, theme = App.masterOf(owner).theme;
    objs = (objs || []).filter(Boolean);
    if (!objs.length) throw new Error(T('Er is niets geselecteerd'));
    await ensureKatex({ objs });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    objs.forEach((ob) => { const [a, b, c, d] = objBounds(ob, owner); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); });
    x0 = Math.floor(x0 - 1); y0 = Math.floor(y0 - 1);
    const W = Math.max(1, Math.ceil(x1 + 1 - x0)), H = Math.max(1, Math.ceil(y1 + 1 - y0));
    const wrap = document.createElement('div');
    wrap.className = 'sl mode-export';
    wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;background:transparent;overflow:hidden`;
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;left:${-x0}px;top:${-y0}px;width:${App.pres.size.w}px;height:${App.pres.size.h}px`;
    const num = owner.layout !== undefined ? slideNo(owner) : 1;
    objs.forEach((ob) => { const e = App.renderObj(ob, { mode: 'export', theme, owner, num, layer: 'slide' }); if (e) { e.classList.add('ly-slide'); inner.appendChild(e); } });
    wrap.appendChild(inner);
    host().appendChild(wrap);
    try {
      const prep = await prepare(wrap);
      if (o.svg) return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgDoc(markupOf(wrap), prep.css, W, H, W, H);
      const { outW, outH } = outSize({ width: W * (o.scale || 2), height: H * (o.scale || 2) }, W, H);
      return await rasterize(wrap, prep, { W, H, outW, outH });
    } finally { wrap.remove(); }
  };
  App.objectsToBlob = async (objs, o = {}) => {
    if (o.svg || o.type === 'image/svg+xml') return new Blob([await App.objectsToCanvas(objs, { ...o, svg: true })], { type: 'image/svg+xml' });
    return canvasBlob(await App.objectsToCanvas(objs, o), 'image/png');
  };
  // Zonder dialoogvenster (Opslaan als › PNG/JPEG/SVG): de huidige dia
  const defWidth = () => Math.max(App.pres.size.w, 1920);
  App.buildExport = async (kind) => {
    const s = App.cur();
    if (kind === 'png' || kind === 'jpg') return App.slideToBlob(s, { width: defWidth(), type: kind === 'jpg' ? 'image/jpeg' : 'image/png', quality: 0.92 });
    if (kind === 'svg') return new Blob([await App.slideToSvg(s)], { type: 'image/svg+xml' });
    throw new Error(T('Onbekend formaat'));
  };
  // Meerdere dia's → één afbeelding of een .zip. o: { kind: 'png'|'jpg', width, slides, onProgress(i, n), signal: { cancelled } }
  App.exportImages = async (o = {}) => {
    const kind = o.kind === 'jpg' ? 'jpg' : 'png', type = kind === 'jpg' ? 'image/jpeg' : 'image/png';
    const slides = (o.slides && o.slides.length ? o.slides : [App.cur()]).filter(Boolean);
    const width = Math.round(+o.width || defWidth());
    if (slides.length === 1 && !o.zip) return App.slideToBlob(slides[0], { width, type, quality: 0.92 });
    if (!window.JSZip) await App.loadScript('vendor/jszip.min.js');
    const zip = new window.JSZip();
    const cv = document.createElement('canvas');
    for (let i = 0; i < slides.length; i++) {
      if (o.signal && o.signal.cancelled) throw abortErr();
      if (o.onProgress) o.onProgress(i, slides.length);
      await App.slideToCanvas(slides[i], { width, type, canvas: cv });
      zip.file(T('Dia') + slideNo(slides[i]) + '.' + kind, await canvasBlob(cv, type, 0.92));
    }
    if (o.onProgress) o.onProgress(slides.length, slides.length);
    return zip.generateAsync({ type: 'blob', compression: 'STORE', mimeType: 'application/zip' });
  };

  /* ---------- Afdrukken: instellingen en bereik ---------- */
  const PS_KEYS = ['what', 'order', 'frame', 'fit', 'color', 'paper', 'orient'];
  const LAYOUTS = [['slides', 'Volledige pagina\'s met dia\'s'], ['notes', 'Notitiepagina\'s'], ['outline', 'Overzicht']];
  const HANDOUTS = [['h1', '1 dia'], ['h2', '2 dia\'s'], ['h3', '3 dia\'s'], ['h4', '4 dia\'s'], ['h6', '6 dia\'s'], ['h9', '9 dia\'s']];
  const WHATS = [...LAYOUTS, ...HANDOUTS].map((x) => x[0]);
  let PS = null, psFor = null;
  const settings = () => {
    if (!PS || psFor !== App.pres.id) {
      const saved = App.store.get('print', {}) || {};
      PS = { what: 'slides', order: 'h', range: 'all', custom: '', hidden: false, frame: false, fit: true, color: 'color', paper: App.LANG === 'en' ? 'letter' : 'a4', orient: '', page: 0 };
      PS_KEYS.forEach((k) => { if (saved[k] !== undefined) PS[k] = saved[k]; });
      if (!WHATS.includes(PS.what)) PS.what = 'slides';
      // kop- en voettekst van notitiepagina's en hand-outs volgen de presentatie (Invoegen › Koptekst en voettekst)
      const hf = App.pres.hf || {};
      PS.hfDate = !!hf.dt; PS.hfNum = !!hf.sldNum; PS.hfHead = ''; PS.hfFoot = hf.ftr && hf.ftrText ? hf.ftrText : '';
      psFor = App.pres.id;
    }
    return PS;
  };
  const savePs = () => { const o = {}; PS_KEYS.forEach((k) => { o[k] = PS[k]; }); App.store.set('print', o); };
  const perPage = (what) => (/^h\d$/.test(what) ? +what.slice(1) : 1);
  const orientOf = (ps) => ps.orient || (ps.what === 'slides' && App.pres.size.w >= App.pres.size.h ? 'landscape' : 'portrait');
  const paper = (ps) => {
    const p = ps.paper === 'letter' ? [215.9, 279.4] : [210, 297];
    const [wmm, hmm] = orientOf(ps) === 'landscape' ? [p[1], p[0]] : p;
    return { wmm, hmm, w: wmm * MM, h: hmm * MM };
  };
  // "1-3, 5" → [0, 1, 2, 4] (0-gebaseerd); ook "3-" (tot het eind) en "-2"; null = ongeldig
  App.parseSlideRange = (text, n) => {
    const s = String(text == null ? '' : text).replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-').trim();
    if (!s) return null;
    const out = [];
    for (const p of s.split(/[\s,;]+/)) {
      if (!p) continue;
      const m = /^(\d+)?-(\d+)?$/.exec(p);
      if (m) {
        if (!m[1] && !m[2]) return null;
        let a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : n;
        if (a < 1 || b < 1) return null;
        if (a > b) [a, b] = [b, a];
        for (let k = a; k <= Math.min(b, n); k++) out.push(k - 1);
      } else if (/^\d+$/.test(p)) { const k = +p; if (k < 1) return null; if (k <= n) out.push(k - 1); }
      else return null;
    }
    return [...new Set(out)];
  };
  const printSlides = (ps) => {
    const P = App.pres, all = P.slides, r = ps.range || 'all';
    if (r === 'cur') return [App.cur()];
    let list;
    if (r === 'sel') list = App.selSlides ? App.selSlides() : [App.cur()];
    else if (r === 'custom') { const idx = App.parseSlideRange(ps.custom, all.length); list = idx ? idx.map((i) => all[i]) : []; }
    else if (r.startsWith('sec:')) list = all.filter((s) => s.sec === r.slice(4));
    else if (r.startsWith('show:')) { const cs = (P.shows || []).find((x) => x.id === r.slice(5)); list = cs ? cs.slides.map((id) => App.slideById(id)).filter(Boolean) : []; }
    else list = all.slice();
    return ps.hidden ? list : list.filter((s) => !s.hidden);
  };

  /* ---------- Afdrukken: pagina's ---------- */
  const M = 48, HF_Y = 0.3 * 96;   // marge (0,5 inch) en plaats van kop- en voettekst
  const fitBox = (aw, ah) => { const P = App.pres, k = Math.max(0.01, Math.min(aw / P.size.w, ah / P.size.h)); return { w: P.size.w * k, h: P.size.h * k }; };
  const div = (cls, css, text) => { const d = document.createElement('div'); d.className = cls; if (css) d.style.cssText = css; if (text != null) d.textContent = text; return d; };
  const slideBox = (s, x, y, w, ps) => {
    const P = App.pres, h = w * P.size.h / P.size.w;
    const box = div('pd-sb' + (ps.frame ? ' fr' : ''), `left:${r2(x)}px;top:${r2(y)}px;width:${r2(w)}px;height:${r2(h)}px`);
    box.appendChild(App.slideThumb(s, w, { mode: 'print', num: slideNo(s) }));
    return box;
  };
  const dateText = () => {
    const hf = App.pres.hf || {};
    if (hf.dtAuto === false && hf.dtText) return hf.dtText;
    return new Date().toLocaleDateString(App.LANG === 'en' ? 'en-US' : 'nl-NL', hf.dtFmt === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'numeric', year: 'numeric' });
  };
  // Overzicht: titels en tekst van opsommingen
  const olBlocks = (slides) => {
    const out = [];
    slides.forEach((s) => {
      out.push({ lvl: -1, t: slideNo(s) + '. ' + (App.slideTitle ? App.slideTitle(s) : ''), hid: !!s.hidden });
      s.objs.filter((o) => o.ph && App.phFamily(o.ph.type) === 'body' && o.text).forEach((o) => o.text.paras.forEach((p) => {
        const t = p.runs.map((r) => r.t).join('').replace(/\v/g, ' ');
        if (t.trim()) out.push({ lvl: App.clamp(p.lvl || 0, 0, 8), t });
      }));
    });
    return out;
  };
  const olEl = (b) => {
    const p = document.createElement('p');
    if (b.lvl < 0) p.className = 't' + (b.hid ? ' hid' : '');
    else p.style.paddingLeft = r2(14 + b.lvl * 18) + 'pt';
    p.textContent = (b.lvl >= 0 ? '• ' : '') + b.t;
    return p;
  };
  const olArea = (pp) => ({ x: M + 8, y: M + 22, w: pp.w - 2 * M - 16, h: pp.h - 2 * M - 44 });
  const outlinePages = (ps, slides) => {
    const blocks = olBlocks(slides);
    if (!blocks.length) return [];
    const area = olArea(paper(ps));
    let m = document.getElementById('pd-measure');
    if (!m) { m = div('pd-pg'); m.id = 'pd-measure'; m.setAttribute('aria-hidden', 'true'); m.style.cssText = 'position:fixed;left:-40000px;top:0;visibility:hidden;width:auto;height:auto;overflow:visible'; document.body.appendChild(m); }
    const ol = div('pd-ol', `position:static;width:${r2(area.w)}px`);
    blocks.forEach((b) => ol.appendChild(olEl(b)));
    m.replaceChildren(ol);
    const pages = [];
    let cur = [], used = 0;
    Array.from(ol.children).forEach((el, i) => {
      const h = el.offsetHeight + 1;
      if (cur.length && used + h > area.h) { pages.push(cur); cur = []; used = 0; }
      cur.push(blocks[i]); used += h;
    });
    if (cur.length) pages.push(cur);
    m.replaceChildren();
    return pages.map((b) => ({ kind: 'outline', blocks: b }));
  };
  const pageSpecs = (ps) => {
    const slides = printSlides(ps);
    if (!slides.length) return [];
    if (ps.what === 'notes') return slides.map((s) => ({ kind: 'notes', slides: [s] }));
    if (ps.what === 'outline') return outlinePages(ps, slides);
    if (!/^h\d$/.test(ps.what)) return slides.map((s) => ({ kind: 'slide', slides: [s] }));
    const n = perPage(ps.what), out = [];
    for (let i = 0; i < slides.length; i += n) out.push({ kind: 'handout', n, slides: slides.slice(i, i + n) });
    return out;
  };
  App.printPages = (opts) => pageSpecs({ ...settings(), ...(opts || {}) });

  // Hand-outs: kolommen × rijen (staand / liggend)
  const HAND = { 1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 2], 6: [2, 3], 9: [3, 3] };
  const HAND_L = { 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] };
  const lines = (x, y, w, h) => {
    const lh = 0.32 * 96, n = Math.max(0, Math.floor(h / lh));
    return div('pd-lines', `left:${r2(x)}px;top:${r2(y)}px;width:${r2(w)}px;height:${r2(n * lh)}px;--lh:${r2(lh)}px`);
  };
  // Notities van de presentator (zelfde eenvoudige opmaak als het notitiedeelvenster)
  const notesEl = (s, css) => {
    const d = div('pd-notes', css);
    const paras = s.notes && s.notes.paras ? s.notes.paras : [];
    paras.forEach((p) => {
      const el = document.createElement('p');
      if (p.lvl) el.style.paddingLeft = (p.lvl * 18) + 'pt';
      p.runs.forEach((r) => {
        if (!r.t) return;
        const sp = document.createElement('span');
        if (r.b) sp.style.fontWeight = '700';
        if (r.i) sp.style.fontStyle = 'italic';
        if (r.u) sp.style.textDecoration = 'underline';
        App.fillRunText(sp, r.t);
        el.appendChild(sp);
      });
      if (!el.childNodes.length) el.appendChild(document.createElement('br'));
      d.appendChild(el);
    });
    return d;
  };
  // Eén vel papier (px op 96 dpi); no = paginanummer vanaf 0
  const buildPage = (spec, ps, no) => {
    const pp = paper(ps), land = orientOf(ps) === 'landscape';
    const pg = div('pd-pg pg pd-c-' + (ps.color === 'gray' || ps.color === 'bw' ? ps.color : 'color'), `width:${r2(pp.w)}px;height:${r2(pp.h)}px`);
    if (spec.kind === 'slide') {
      const m = ps.fit ? 0.18 * 96 : 0.6 * 96;
      const b = fitBox(pp.w - 2 * m, pp.h - 2 * m);
      pg.appendChild(slideBox(spec.slides[0], (pp.w - b.w) / 2, (pp.h - b.h) / 2, b.w, ps));
      return pg;
    }
    const hf = (css, text) => { if (text) pg.appendChild(div('pd-hf', css, text)); };
    hf(`left:${M}px;top:${HF_Y}px`, ps.hfHead);
    hf(`right:${M}px;top:${HF_Y}px;text-align:right`, ps.hfDate ? dateText() : '');
    hf(`left:${M}px;bottom:${HF_Y}px`, ps.hfFoot);
    hf(`right:${M}px;bottom:${HF_Y}px;text-align:right`, ps.hfNum ? String(no + 1) : '');
    const area = { x: M, y: M + 22, w: pp.w - 2 * M, h: pp.h - 2 * M - 44 };
    if (spec.kind === 'notes') {
      const s = spec.slides[0];
      const b = fitBox(area.w * 0.86, area.h * 0.44);
      const sx = area.x + (area.w - b.w) / 2, sy = area.y + 8;
      pg.appendChild(slideBox(s, sx, sy, b.w, { ...ps, frame: true }));
      const ny = sy + b.h + 26;
      pg.appendChild(notesEl(s, `left:${r2(area.x + area.w * 0.07)}px;top:${r2(ny)}px;width:${r2(area.w * 0.86)}px;height:${r2(Math.max(0, area.y + area.h - ny))}px`));
      return pg;
    }
    if (spec.kind === 'outline') {
      const a = olArea(pp);
      const ol = div('pd-ol', `left:${r2(a.x)}px;top:${r2(a.y)}px;width:${r2(a.w)}px;height:${r2(a.h)}px`);
      spec.blocks.forEach((b) => ol.appendChild(olEl(b)));
      pg.appendChild(ol);
      return pg;
    }
    const n = spec.n || perPage(ps.what);
    const sq = Math.ceil(Math.sqrt(n));
    const [cols, rows] = (land ? HAND_L : HAND)[n] || [sq, Math.ceil(n / sq)];
    const gap = n >= 9 ? 16 : 28;
    const cw = (area.w - gap * (cols - 1)) / cols, ch = (area.h - gap * (rows - 1)) / rows;
    const vert = ps.order === 'v' && cols > 1 && rows > 1;
    spec.slides.forEach((s, i) => {
      const c = vert ? Math.floor(i / rows) : i % cols, r = vert ? i % rows : Math.floor(i / cols);
      const x = area.x + c * (cw + gap), y = area.y + r * (ch + gap);
      if (n === 3 && !land) {   // dia links, regels voor aantekeningen rechts
        const b = fitBox(cw * 0.46, ch);
        const by = y + (ch - b.h) / 2;
        pg.appendChild(slideBox(s, x, by, b.w, ps));
        pg.appendChild(lines(x + cw * 0.52, by, cw * 0.48, b.h));
      } else if (n === 3) {   // liggend: dia boven, regels eronder
        const b = fitBox(cw, ch * 0.45);
        pg.appendChild(slideBox(s, x + (cw - b.w) / 2, y, b.w, ps));
        pg.appendChild(lines(x, y + b.h + 18, cw, ch - b.h - 18));
      } else {
        const b = fitBox(cw, ch);
        pg.appendChild(slideBox(s, x + (cw - b.w) / 2, y + (ch - b.h) / 2, b.w, ps));
      }
    });
    return pg;
  };

  /* ---------- Afdrukken: #print-area vullen (ook voor de PDF van het Windows-programma) ---------- */
  let prepared = false, autoPrep = false;
  App.preparePrint = (opts) => {
    if (prepared || !App.pres) return 0;
    const area = document.getElementById('print-area');
    if (!area) return 0;
    if (st.edit && App.textEdit) App.textEdit.stop();
    const ps = { ...settings(), ...(opts || {}) };
    const specs = pageSpecs(ps), pp = paper(ps);
    // net iets lager dan het papier, zodat afronding nooit een lege extra pagina geeft
    area.replaceChildren(...specs.map((s, i) => { const pg = buildPage(s, ps, i); pg.style.height = r2(pp.h - 1) + 'px'; return pg; }));
    let stl = document.getElementById('pd-print-page');
    if (!stl) { stl = document.createElement('style'); stl.id = 'pd-print-page'; document.head.appendChild(stl); }
    stl.textContent = `@media print{@page{size:${r2(pp.wmm)}mm ${r2(pp.hmm)}mm;margin:0}html,body{width:auto!important;height:auto!important;background:#fff!important}}`;
    document.body.classList.add('pd-printing');
    prepared = true;
    return specs.length;
  };
  App.afterPrint = () => {
    if (!prepared) return;
    prepared = false; autoPrep = false;
    const area = document.getElementById('print-area');
    if (area) area.replaceChildren();
    const stl = document.getElementById('pd-print-page');
    if (stl) stl.textContent = '';
    document.body.classList.remove('pd-printing');
  };
  // Afdrukken via het menu van de browser: dan toch de juiste pagina's
  window.addEventListener('beforeprint', () => { if (!prepared) { App.preparePrint(); autoPrep = true; } });
  window.addEventListener('afterprint', () => { if (autoPrep) App.afterPrint(); });
  // Afbeeldingen alvast decoderen, zodat ze op papier niet ontbreken
  const warm = async (root) => {
    const urls = new Set();
    root.querySelectorAll('image').forEach((e) => { const u = e.getAttribute('href'); if (u) urls.add(u); });
    root.querySelectorAll('img').forEach((e) => { if (e.src) urls.add(e.src); });
    root.querySelectorAll('[style*="url("]').forEach((e) => { for (const m of e.getAttribute('style').matchAll(/url\((['"]?)(.*?)\1\)/g)) if (m[2] && m[2][0] !== '#') urls.add(m[2]); });
    const all = [...urls].slice(0, 500).map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); });
    await Promise.race([Promise.all(all), sleep(5000)]);
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, sleep(2000)]);
    await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), sleep(250)]);
  };

  /* ---------- Bestand › Afdrukken: instellingen links, voorbeeld rechts ---------- */
  const pv = { page: 0, specs: [], el: null };
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(T(label))}</option>`;
  const chk = (id, on, label, dis) => `<label class="chk"><input type="checkbox" id="${id}"${on ? ' checked' : ''}${dis ? ' disabled' : ''}> ${esc(T(label))}</label>`;
  App.printPage = () => {
    const ps = settings(), P = App.pres;
    const sel = App.selSlides ? App.selSlides() : [];
    if ((ps.range.startsWith('sec:') && !(P.sections || []).some((x) => 'sec:' + x.id === ps.range)) || (ps.range.startsWith('show:') && !(P.shows || []).some((x) => 'show:' + x.id === ps.range))) ps.range = 'all';
    const ranges = [opt('all', 'Alle dia\'s afdrukken', ps.range)];
    if (sel.length > 1 || ps.range === 'sel') ranges.push(opt('sel', 'Selectie afdrukken', ps.range));
    ranges.push(opt('cur', 'Huidige dia afdrukken', ps.range), opt('custom', 'Aangepast bereik', ps.range));
    (P.sections || []).forEach((x) => ranges.push(`<option value="sec:${esc(x.id)}"${ps.range === 'sec:' + x.id ? ' selected' : ''}>${esc(T('Sectie: {0}').replace('{0}', x.name))}</option>`));
    (P.shows || []).forEach((x) => ranges.push(`<option value="show:${esc(x.id)}"${ps.range === 'show:' + x.id ? ' selected' : ''}>${esc(T('Aangepaste voorstelling: {0}').replace('{0}', x.name))}</option>`));
    const native = App.native && App.native.ok;
    pv.page = 0;
    setTimeout(wire, 0);
    return `<h1>${esc(T('Afdrukken'))}</h1>
      <div class="pd-pr">
        <div class="pd-pr-set">
          <div class="pd-pr-go">
            <button class="pd-pr-btn" data-act="pdPrint" title="${esc(T('Afdrukken (Ctrl+P)'))}"><span class="i">print</span>${esc(T('Afdrukken'))}</button>
            <button class="pd-pr-btn" data-act="pdPdf" title="${esc(T('Opslaan als PDF'))}"><span class="i">picture_as_pdf</span>PDF</button>
          </div>
          <p class="muted small" style="margin:0 0 4px;line-height:1.45">${esc(T(native ? 'De printer en het aantal exemplaren kies je in het afdrukvenster. Met PDF maak je meteen een PDF-bestand.' : 'De printer en het aantal exemplaren kies je in het afdrukvenster. Voor een PDF kies je daar “Opslaan als PDF”.'))}</p>
          <div class="pd-pr-h">${esc(T('Instellingen'))}</div>
          <label class="pd-pr-f"><span>${esc(T('Dia\'s'))}</span><select id="pd-range">${ranges.join('')}</select></label>
          <input type="text" id="pd-custom" value="${esc(ps.custom)}" placeholder="${esc(T('Bijvoorbeeld 1-3, 5'))}" title="${esc(T('Dianummers en bereiken, gescheiden door komma\'s'))}" spellcheck="false" autocomplete="off">
          <label class="pd-pr-f"><span>${esc(T('Afdrukindeling'))}</span><select id="pd-what"><optgroup label="${esc(T('Afdrukindeling'))}">${LAYOUTS.map(([v, l]) => opt(v, l, ps.what)).join('')}</optgroup><optgroup label="${esc(T('Hand-outs'))}">${HANDOUTS.map(([v, l]) => opt(v, l, ps.what)).join('')}</optgroup></select></label>
          <label class="pd-pr-f"><span>${esc(T('Volgorde op de pagina'))}</span><select id="pd-order">${opt('h', 'Horizontaal', ps.order)}${opt('v', 'Verticaal', ps.order)}</select></label>
          ${chk('pd-frame', ps.frame, 'Dia\'s kaderen')}
          ${chk('pd-fit', ps.fit, 'Aanpassen aan papierformaat')}
          ${chk('pd-hidden', ps.hidden, 'Verborgen dia\'s afdrukken', !P.slides.some((s) => s.hidden))}
          <div class="pd-pr-2">
            <label class="pd-pr-f"><span>${esc(T('Afdrukstand'))}</span><select id="pd-orient">${opt('', 'Automatisch', ps.orient)}${opt('portrait', 'Staand', ps.orient)}${opt('landscape', 'Liggend', ps.orient)}</select></label>
            <label class="pd-pr-f"><span>${esc(T('Papier'))}</span><select id="pd-paper">${opt('a4', 'A4', ps.paper)}${opt('letter', 'Letter', ps.paper)}</select></label>
          </div>
          <label class="pd-pr-f"><span>${esc(T('Kleur'))}</span><select id="pd-color">${opt('color', 'Kleur', ps.color)}${opt('gray', 'Grijstinten', ps.color)}${opt('bw', 'Zuiver zwart-wit', ps.color)}</select></label>
          <div class="pd-pr-h">${esc(T('Kop- en voettekst'))}</div>
          <p class="muted small" style="margin:0 0 2px">${esc(T('Voor notitiepagina\'s, hand-outs en het overzicht.'))}</p>
          <div class="pd-pr-2">${chk('pd-hf-date', ps.hfDate, 'Datum')}${chk('pd-hf-num', ps.hfNum, 'Paginanummer')}</div>
          <input type="text" id="pd-hf-head" value="${esc(ps.hfHead)}" placeholder="${esc(T('Koptekst'))}" autocomplete="off">
          <input type="text" id="pd-hf-foot" value="${esc(ps.hfFoot)}" placeholder="${esc(T('Voettekst'))}" autocomplete="off">
        </div>
        <div class="pd-pr-pv">
          <div class="pd-pv-stage notranslate" translate="no"><div class="pd-pv-box"></div></div>
          <div class="pd-pv-nav"><button class="qb" data-act="pdPrev" title="${esc(T('Vorige pagina'))}"><span class="i">chevron_left</span></button><span id="pd-pv-lbl"></span><button class="qb" data-act="pdNext" title="${esc(T('Volgende pagina'))}"><span class="i">chevron_right</span></button></div>
        </div>
      </div>`;
  };
  const pvRoot = () => document.querySelector('#backstage .pd-pr');
  const wire = () => {
    const root = pvRoot();
    if (!root || root._pd) return;
    root._pd = true;
    // live bijwerken tijdens het typen (change komt pas bij het verlaten van het veld)
    root.addEventListener('input', (e) => { if (e.target.matches('#pd-custom, #pd-hf-head, #pd-hf-foot')) App.printChange(e.target); });
    root.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select')) return;
      if (e.key === 'PageDown') { e.preventDefault(); goPage(1); } else if (e.key === 'PageUp') { e.preventDefault(); goPage(-1); }
    });
    const stage = root.querySelector('.pd-pv-stage');
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!stage.isConnected) ro.disconnect(); else fitPreview(); }); ro.observe(stage); }
    refresh();
  };
  const syncUi = (root) => {
    const ps = settings();
    const $r = (s) => root.querySelector(s);
    if ($r('#pd-order')) $r('#pd-order').disabled = !['h4', 'h6', 'h9'].includes(ps.what);
    root.querySelectorAll('#pd-hf-date, #pd-hf-num, #pd-hf-head, #pd-hf-foot').forEach((x) => { x.disabled = ps.what === 'slides'; });
    if ($r('#pd-frame')) $r('#pd-frame').disabled = ps.what === 'outline' || ps.what === 'notes';
    if ($r('#pd-fit')) $r('#pd-fit').disabled = ps.what !== 'slides';
    if ($r('#pd-custom')) $r('#pd-custom').classList.toggle('bad', ps.range === 'custom' && !!ps.custom.trim() && App.parseSlideRange(ps.custom, App.pres.slides.length) === null);
  };
  const refresh = () => {
    const root = pvRoot();
    if (!root) return;
    syncUi(root);
    pv.specs = pageSpecs(settings());
    pv.page = App.clamp(pv.page, 0, Math.max(0, pv.specs.length - 1));
    drawPreview(root);
  };
  const drawPreview = (root) => {
    const box = root.querySelector('.pd-pv-box'), lbl = root.querySelector('#pd-pv-lbl');
    const n = pv.specs.length, ps = settings();
    box.replaceChildren();
    root.querySelectorAll('[data-act="pdPrev"], [data-act="pdNext"]').forEach((b) => { b.disabled = b.dataset.act === 'pdPrev' ? pv.page <= 0 : pv.page >= n - 1; });
    if (!n) {
      pv.el = null;
      box.style.cssText = 'width:auto;height:auto;box-shadow:none;background:transparent';
      box.appendChild(div('pd-pv-empty', '', T(ps.range === 'custom' ? 'Geen dia\'s in dit bereik. Typ bijvoorbeeld 1-3, 5.' : 'Er is niets om af te drukken.')));
      lbl.textContent = '';
      return;
    }
    box.style.cssText = '';
    pv.el = buildPage(pv.specs[pv.page], ps, pv.page);
    box.appendChild(pv.el);
    lbl.textContent = T('{0} van {1}').replace('{0}', pv.page + 1).replace('{1}', n);
    fitPreview();
  };
  const fitPreview = () => {
    const root = pvRoot();
    if (!root || !pv.el || !pv.el.isConnected) return;
    const stage = root.querySelector('.pd-pv-stage'), box = root.querySelector('.pd-pv-box');
    const pw = parseFloat(pv.el.style.width), ph = parseFloat(pv.el.style.height);
    const k = Math.min(Math.max(60, stage.clientWidth - 48) / pw, Math.max(60, stage.clientHeight - 32) / ph, 1.4);
    box.style.width = r2(pw * k) + 'px'; box.style.height = r2(ph * k) + 'px';
    pv.el.style.transform = `scale(${App.round(k, 4)})`;
  };
  const goPage = (d) => {
    const root = pvRoot();
    if (!root || !pv.specs.length) return;
    const p = App.clamp(pv.page + d, 0, pv.specs.length - 1);
    if (p !== pv.page) { pv.page = p; drawPreview(root); }
  };
  // Klikken en wijzigingen in het Bestand-scherm (file.js roept deze aan)
  App.printAction = (a) => {
    if (!/^pd[A-Z]/.test(a || '')) return false;
    if (a === 'pdPrint') App.exec('print', 'now');
    else if (a === 'pdPdf') App.exec('print', 'pdf');
    else if (a === 'pdPrev') goPage(-1);
    else if (a === 'pdNext') goPage(1);
    return true;
  };
  const CHANGE = { 'pd-range': 'range', 'pd-custom': 'custom', 'pd-what': 'what', 'pd-order': 'order', 'pd-frame': 'frame', 'pd-fit': 'fit', 'pd-hidden': 'hidden', 'pd-orient': 'orient', 'pd-paper': 'paper', 'pd-color': 'color', 'pd-hf-date': 'hfDate', 'pd-hf-num': 'hfNum', 'pd-hf-head': 'hfHead', 'pd-hf-foot': 'hfFoot' };
  App.printChange = (t) => {
    const k = t && CHANGE[t.id];
    if (!k) return false;
    const ps = settings(), v = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'custom') {
      ps.custom = String(v).slice(0, 300);
      if (ps.custom.trim() && ps.range !== 'custom') { ps.range = 'custom'; const r = document.getElementById('pd-range'); if (r) r.value = 'custom'; }
    } else if (k === 'hfHead' || k === 'hfFoot') ps[k] = String(v).slice(0, 200);
    else ps[k] = v;
    if (k === 'range' && v === 'custom') setTimeout(() => { const c = document.getElementById('pd-custom'); if (c) { c.focus(); c.select(); } }, 0);
    if (PS_KEYS.includes(k)) savePs();
    if (k === 'what' || k === 'range' || k === 'custom') pv.page = 0;
    refresh();
    return true;
  };

  /* ---------- Afdrukken en PDF ---------- */
  let busy = false;
  const printNow = async (opts) => {
    if (busy) return;
    const ps = { ...settings(), ...(opts || {}) };
    if (!pageSpecs(ps).length) { App.toast(T('Er is niets om af te drukken.'), 'info'); return; }
    busy = true;
    try {
      App.preparePrint(opts);
      await warm(document.getElementById('print-area'));
      window.print();
    } finally { App.afterPrint(); busy = false; }
  };
  const printPdf = async () => {
    if (busy) return;
    if (!pageSpecs(settings()).length) { App.toast(T('Er is niets om af te drukken.'), 'info'); return; }
    if (App.native && App.native.ok && App.native.pdf) {
      // in het Windows-programma: een echte PDF (native.pdf roept zelf preparePrint en afterPrint aan)
      busy = true;
      try {
        App.preparePrint();
        await warm(document.getElementById('print-area'));
        const r = await App.native.pdf(App.safeName(App.pres.title) + '.pdf');
        if (r && !r.cancelled) App.toast(T('PDF opgeslagen'), 'picture_as_pdf');
      } catch (e) { App.toast(T('PDF maken is mislukt: {0}').replace('{0}', e.message), 'error', { ms: 6000 }); }
      finally { App.afterPrint(); busy = false; }
      return;
    }
    App.toast(T('Kies in het afdrukvenster “Opslaan als PDF” als printer.'), 'picture_as_pdf', { ms: 7000 });
    await sleep(300);
    await printNow();
  };
  App.def('print', (arg) => {
    if (st.edit && App.textEdit) App.textEdit.stop();
    if (arg === 'pdf') return printPdf();
    if (arg === 'now') return printNow();
    App.exec('openBackstage', 'print');
    return undefined;
  });

  /* @@VERVOLG@@ */
})();
