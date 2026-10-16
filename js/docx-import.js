/* =========================================================
   Inkt (gemaakt door JJ van Schelven) — .docx: extra opmaak overnemen.
   De basislezer (mammoth) geeft tekst, koppen, lijsten, tabellen en afbeeldingen. Hier komt daar bovenop,
   rechtstreeks uit word/document.xml: uitlijning, afstand en inspringing, tekstkleur, grootte, lettertype,
   markering, pagina-einden, kolombreedtes en celkleuren van tabellen, en de grootte van afbeeldingen.
   Alinea's worden gekoppeld op tekst; past iets niet precies, dan blijft de basisweergave staan.
   ========================================================= */
'use strict';

App.docxEnrich = async (root, buf) => {
  const JSZip = window.JSZip || (await App.loadScript(App.JSZIP), window.JSZip);
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('word/document.xml'); if (!f) return;
  const xml = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  const byTag = (el, t) => Array.from(el.getElementsByTagName(t));
  const attr = (el, a) => (el ? el.getAttribute(a) : null);
  const child = (el, t) => { if (!el) return null; for (const c of Array.from(el.children)) if (c.nodeName === t) return c; return null; };
  const inside = (el, t) => { for (let p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (p.nodeName === t) return true; return false; };
  const nearestP = (el) => { for (let p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (p.nodeName === 'w:p') return p; return null; };
  const pt = (tw) => (tw == null || tw === '' || isNaN(+tw) ? null : Math.round(+tw / 20 * 100) / 100);
  const HI = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000' };
  const pageBreak = () => { const d = document.createElement('div'); d.className = 'page-break'; d.contentEditable = 'false'; return d; };

  const runsOf = (p) => byTag(p, 'w:r').filter((r) => nearestP(r) === p && !inside(r, 'w:del'));
  const runText = (r) => { let s = ''; for (const c of Array.from(r.children)) { if (c.nodeName === 'w:t') s += c.textContent; else if (c.nodeName === 'w:tab') s += '\t'; } return s; };
  const pText = (p) => runsOf(p).map(runText).join('');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const BLOCK = /^(P|LI|UL|OL|TABLE|H[1-6]|BLOCKQUOTE|PRE)$/;
  const textNodes = (b) => {
    const out = [];
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: (n) => { for (let e = n.parentNode; e && e !== b; e = e.parentNode) if (BLOCK.test(e.tagName)) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) out.push(n);
    return out;
  };
  const ownText = (b) => textNodes(b).map((n) => n.data).join('');
  const wrap = (b, from, to, css) => {
    let pos = 0;
    for (const n of textNodes(b)) {
      const s = pos, e = pos + n.length; pos = e;
      if (e <= from || s >= to) continue;
      let t = n; const start = Math.max(s, from);
      if (s < from) t = n.splitText(from - s);
      if (e > to) t.splitText(to - start);
      const span = document.createElement('span'); span.style.cssText = css; t.before(span); span.appendChild(t);
    }
  };
  const runCss = (rPr) => {
    if (!rPr) return '';
    const st = [];
    const col = attr(child(rPr, 'w:color'), 'w:val'); if (col && /^[0-9a-f]{6}$/i.test(col) && col.toLowerCase() !== '000000') st.push('color:#' + col);
    const sz = attr(child(rPr, 'w:sz'), 'w:val'); if (sz && +sz) st.push('font-size:' + (+sz / 2) + 'pt');
    const hi = attr(child(rPr, 'w:highlight'), 'w:val'); if (hi && HI[hi]) st.push('background-color:' + HI[hi]);
    const shd = attr(child(rPr, 'w:shd'), 'w:fill'); if (!hi && shd && /^[0-9a-f]{6}$/i.test(shd)) st.push('background-color:#' + shd);
    const fnt = child(rPr, 'w:rFonts'); const fam = attr(fnt, 'w:ascii') || attr(fnt, 'w:hAnsi'); if (fam) st.push(`font-family:"${fam}"`);
    if (child(rPr, 'w:caps')) st.push('text-transform:uppercase'); if (child(rPr, 'w:smallCaps')) st.push('font-variant:small-caps');
    if (child(rPr, 'w:dstrike')) st.push('text-decoration:line-through');
    return st.join(';');
  };

  /* ---- alinea's koppelen (op tekst, in volgorde) ---- */
  const xps = byTag(xml, 'w:p').filter((p) => !inside(p, 'w:txbxContent'));
  const blocks = Array.from(root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote'));
  let xi = 0; const pairs = [];
  for (const b of blocks) {
    const t = norm(ownText(b)); let found = -1;
    for (let k = xi; k < Math.min(xps.length, xi + 4); k++) if (norm(pText(xps[k])) === t) { found = k; break; }
    if (found < 0) continue;
    pairs.push([b, xps[found]]); xi = found + 1;
  }
  for (const [b, p] of pairs) {
    const pPr = child(p, 'w:pPr'); const st = [];
    if (pPr) {
      const al = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[attr(child(pPr, 'w:jc'), 'w:val')];
      if (al) st.push('text-align:' + al);
      const sp = child(pPr, 'w:spacing');
      if (sp) {
        const bf = pt(attr(sp, 'w:before')), af = pt(attr(sp, 'w:after'));
        if (bf != null) st.push('margin-top:' + bf + 'pt'); if (af != null) st.push('margin-bottom:' + af + 'pt');
        const ln = attr(sp, 'w:line'); if (ln && +ln && (attr(sp, 'w:lineRule') || 'auto') === 'auto') st.push('line-height:' + Math.round(+ln / 240 * 100) / 100);
      }
      const ind = child(pPr, 'w:ind');
      if (ind && b.tagName !== 'LI') {
        const l = pt(attr(ind, 'w:left') ?? attr(ind, 'w:start')), r = pt(attr(ind, 'w:right') ?? attr(ind, 'w:end')), hg = pt(attr(ind, 'w:hanging')), fl = pt(attr(ind, 'w:firstLine'));
        if (l) st.push('margin-left:' + l + 'pt'); if (r) st.push('margin-right:' + r + 'pt');
        if (hg) st.push('text-indent:-' + hg + 'pt'); else if (fl) st.push('text-indent:' + fl + 'pt');
      }
      const shd = attr(child(pPr, 'w:shd'), 'w:fill'); if (shd && /^[0-9a-f]{6}$/i.test(shd)) st.push('background-color:#' + shd);
      if (child(pPr, 'w:pageBreakBefore') && b.parentNode === root) b.before(pageBreak());
    }
    if (st.length) b.style.cssText += ';' + st.join(';');
    const brs = byTag(p, 'w:br').filter((x) => attr(x, 'w:type') === 'page' && nearestP(x) === p);
    if (brs.length && b.parentNode === root) {
      const rs = runsOf(p); const i = rs.indexOf(brs[0].parentNode);
      const textBefore = rs.slice(0, Math.max(0, i)).some((r) => runText(r));
      if (textBefore) b.after(pageBreak()); else b.before(pageBreak());
    }
    // opmaak per tekstdeel (alleen als de tekst teken voor teken overeenkomt)
    const total = ownText(b), xt = pText(p);
    if (total === xt && total.length) {
      let off = 0;
      for (const r of runsOf(p)) { const len = runText(r).length; const css = runCss(child(r, 'w:rPr')); if (css && len) wrap(b, off, off + len, css); off += len; }
    }
  }

  /* ---- tabellen: randen, kolombreedtes, celkleur ---- */
  const xtbls = byTag(xml, 'w:tbl').filter((t) => !inside(t, 'w:tbl') && !inside(t, 'w:txbxContent'));
  const htbls = Array.from(root.querySelectorAll('table')).filter((t) => !t.parentElement.closest('table'));
  if (xtbls.length === htbls.length) xtbls.forEach((xt, i) => {
    const ht = htbls[i], tblPr = child(xt, 'w:tblPr');
    const bd = child(tblPr, 'w:tblBorders');
    if (bd) { const vals = ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:insideH', 'w:insideV'].map((k) => attr(child(bd, k), 'w:val')); if (vals.every((v) => v === 'none' || v === 'nil')) ht.classList.add('b-none'); }
    const grid = child(xt, 'w:tblGrid');
    if (grid) {
      const cols = byTag(grid, 'w:gridCol').map((c) => pt(attr(c, 'w:w')));
      if (cols.length && cols.every((c) => c)) {
        const cg = document.createElement('colgroup'); cols.forEach((w) => { const c = document.createElement('col'); c.style.width = w + 'pt'; cg.appendChild(c); }); ht.prepend(cg);
        const tw = child(tblPr, 'w:tblW');
        if (!(tw && attr(tw, 'w:type') === 'pct')) { ht.style.width = cols.reduce((a, b) => a + b, 0) + 'pt'; ht.style.maxWidth = '100%'; }
      }
    }
    const xrows = Array.from(xt.children).filter((c) => c.nodeName === 'w:tr'), hrows = Array.from(ht.rows);
    if (xrows.length !== hrows.length) return;
    xrows.forEach((xr, ri) => {
      const xcs = Array.from(xr.children).filter((c) => c.nodeName === 'w:tc'), hcs = Array.from(hrows[ri].cells);
      if (xcs.length !== hcs.length) return;
      xcs.forEach((xc, ci) => {
        const tcPr = child(xc, 'w:tcPr');
        const fill = attr(child(tcPr, 'w:shd'), 'w:fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) hcs[ci].style.backgroundColor = '#' + fill;
        const va = attr(child(tcPr, 'w:vAlign'), 'w:val'); if (va === 'center') hcs[ci].style.verticalAlign = 'middle'; else if (va === 'bottom') hcs[ci].style.verticalAlign = 'bottom';
      });
    });
  });

  /* ---- afbeeldingen: grootte en omloop ---- */
  const imgs = Array.from(root.querySelectorAll('img'));
  const draws = byTag(xml, 'w:drawing').filter((d) => !inside(d, 'w:txbxContent') && !inside(d, 'mc:Fallback'));
  if (imgs.length === draws.length) draws.forEach((d, i) => {
    const ext = byTag(d, 'wp:extent')[0]; const cx = +attr(ext, 'cx');
    if (cx) imgs[i].style.width = Math.round(cx / 9525) + 'px';
    const anchor = child(d, 'wp:anchor');
    if (anchor && !child(anchor, 'wp:wrapNone') && !child(anchor, 'wp:wrapTopAndBottom')) {
      const align = attr(byTag(anchor, 'wp:align')[0], null) || (byTag(anchor, 'wp:align')[0] || {}).textContent;
      if (align === 'right') imgs[i].classList.add('float-right'); else if (align === 'left') imgs[i].classList.add('float-left');
    }
  });
};
