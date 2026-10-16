/* =========================================================
   Inkt — echte .docx-export (Office Open XML) en extra import
   Schrijft native Word-alinea's, opmaak, lijsten, tabellen,
   afbeeldingen, koppelingen, voetnoten, opmerkingen,
   bijgehouden wijzigingen, kop/voettekst en pagina-instelling.
   ========================================================= */
'use strict';

App.JSZIP = 'vendor/jszip.min.js';
App.Docx = {};

(() => {
  const NS = {
    w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  };
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const twipCm = (cm) => Math.round((cm / 2.54) * 1440);
  const twipMm = (mm) => Math.round((mm / 25.4) * 1440);
  const cv = document.createElement('canvas').getContext('2d');
  const hex = (css) => {
    if (!css || /transparent|inherit|initial|currentcolor/i.test(css)) return null;
    cv.fillStyle = '#000000'; cv.fillStyle = css;
    const v = cv.fillStyle;
    if (v.startsWith('#')) return v.slice(1).toUpperCase();
    const m = v.match(/[\d.]+/g);
    if (!m || (m[3] !== undefined && +m[3] < 0.05)) return null;
    return m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const ptOf = (v) => {
    if (!v) return null;
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    if (/pt$/.test(v)) return n;
    if (/px$/.test(v)) return n * 0.75;
    return null;
  };
  const firstFont = (f) => (f || '').split(',')[0].replace(/["']/g, '').trim();

  /* ---------- Context ---------- */
  const makeCtx = (doc) => ({
    doc, rid: 20, rels: [], media: [], abstracts: {}, abstractList: [], nums: [], footnotes: [], comments: [],
    bm: 1, rev: 1, pic: 1, cmtFirst: {}, cmtLast: {}, cmtIds: {}, cmtOpen: new Set(),
    rel(type, target, external) { const id = 'rId' + this.rid++; this.rels.push({ id, type, target, external }); return id; },
  });

  /* ---------- Opmaak van tekstfragmenten ---------- */
  const HILITE_NAMES = { FFFF00: 'yellow', '00FF00': 'green', '00FFFF': 'cyan', FF00FF: 'magenta', '0000FF': 'blue', FF0000: 'red', '000080': 'darkBlue', '008080': 'darkCyan', '008000': 'darkGreen', '800080': 'darkMagenta', '800000': 'darkRed', '808000': 'darkYellow', '808080': 'darkGray', C0C0C0: 'lightGray', '000000': 'black' };
  const rPr = (f) => {
    let s = '';
    if (f.rStyle) s += `<w:rStyle w:val="${f.rStyle}"/>`;
    if (f.font) s += `<w:rFonts w:ascii="${X(f.font)}" w:hAnsi="${X(f.font)}" w:cs="${X(f.font)}"/>`;
    if (f.b) s += '<w:b/><w:bCs/>';
    if (f.i) s += '<w:i/><w:iCs/>';
    if (f.caps) s += '<w:caps/>';
    if (f.smallcaps) s += '<w:smallCaps/>';
    if (f.strike) s += '<w:strike/>';
    if (f.color) s += `<w:color w:val="${f.color}"/>`;
    if (f.spacing) s += `<w:spacing w:val="${Math.round(f.spacing * 20)}"/>`;
    if (f.size) s += `<w:sz w:val="${Math.round(f.size * 2)}"/><w:szCs w:val="${Math.round(f.size * 2)}"/>`;
    if (f.u) s += `<w:u w:val="${f.u}"/>`;
    // Word-markeerkleuren als echte markering, andere achtergronden als arcering
    if (f.shd && HILITE_NAMES[f.shd.toUpperCase()]) s += `<w:highlight w:val="${HILITE_NAMES[f.shd.toUpperCase()]}"/>`;
    else if (f.shd) s += `<w:shd w:val="clear" w:color="auto" w:fill="${f.shd}"/>`;
    if (f.vert) s += `<w:vertAlign w:val="${f.vert}"/>`;
    return s ? `<w:rPr>${s}</w:rPr>` : '';
  };
  const run = (text, f, del) => {
    if (!text) return '';
    const parts = text.split('\t');
    return parts.map((p, i) => (i ? `<w:r>${rPr(f)}<w:tab/></w:r>` : '') + (p ? `<w:r>${rPr(f)}<w:${del ? 'delText' : 't'} xml:space="preserve">${X(p)}</w:${del ? 'delText' : 't'}></w:r>` : '')).join('');
  };
  const styleFmt = (el, f) => {
    const st = el.style;
    if (!st) return f;
    f = { ...f };
    const fw = st.fontWeight; if (fw) f.b = fw === 'bold' || +fw >= 600;
    if (st.fontStyle) f.i = st.fontStyle === 'italic';
    const td = st.textDecorationLine || st.textDecoration || '';
    if (/underline/.test(td)) f.u = { double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' }[st.textDecorationStyle] || 'single';
    if (/line-through/.test(td)) f.strike = true;
    if (/none/.test(td) && !/underline|line-through/.test(td)) { f.u = null; f.strike = false; }
    if (st.color) f.color = hex(st.color) || f.color;
    if (st.backgroundColor) f.shd = hex(st.backgroundColor) || f.shd;
    const sz = ptOf(st.fontSize); if (sz) f.size = sz;
    if (st.fontFamily) f.font = firstFont(st.fontFamily);
    if (st.textTransform === 'uppercase') f.caps = true;
    if (/small-caps/.test(st.fontVariant || st.fontVariantCaps || '')) f.smallcaps = true;
    const ls = ptOf(st.letterSpacing); if (ls) f.spacing = ls;
    if (st.verticalAlign === 'super') f.vert = 'superscript';
    if (st.verticalAlign === 'sub') f.vert = 'subscript';
    return f;
  };
  const bmName = (id) => ('_' + String(id).replace(/[^A-Za-z0-9_]/g, '_')).slice(0, 40);

  /* ---------- Inline-inhoud ---------- */
  const inline = (node, f, ctx, opt = {}) => {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        let t = c.data.replace(/\u200B/g, '');
        if (!opt.pre) t = t.replace(/[\r\n]+/g, ' ');
        if (opt.pre && t.includes('\n')) { out += t.split('\n').map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + run(line, f, opt.del)).join(''); return; }
        out += run(t, f, opt.del);
        return;
      }
      if (c.nodeType !== 1) return;
      const tag = c.tagName, cls = c.classList;
      let nf = f;
      if (cls.contains('cmt')) {
        const id = ctx.cmtIds[c.dataset.cid];
        let pre = '', post = '';
        if (id !== undefined && ctx.cmtFirst[c.dataset.cid] === c) pre = `<w:commentRangeStart w:id="${id}"/>`;
        if (id !== undefined && ctx.cmtLast[c.dataset.cid] === c) post = `<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
        out += pre + inline(c, styleFmt(c, f), ctx, opt) + post;
        return;
      }
      // verborgen index- en citaatmarkeringen als echte XE/TA-velden (Agent B)
      if (cls.contains('xe') || cls.contains('ta')) {
        const q = (v) => String(v || '').replace(/"/g, "'");
        const instr = cls.contains('xe')
          ? ` XE "${q(c.dataset.entry)}${c.dataset.sub ? ':' + q(c.dataset.sub) : ''}"${c.dataset.see ? ` \\t "Zie ${q(c.dataset.see)}"` : ''}${c.dataset.b ? ' \\b' : ''}${c.dataset.i ? ' \\i' : ''} `
          : ` TA \\l "${q(c.dataset.long)}" \\s "${q(c.dataset.short)}" \\c ${(+c.dataset.cat || 0) + 1} `;
        out += `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${X(instr)}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
        return;
      }
      switch (tag) {
        case 'B': case 'STRONG': nf = { ...f, b: true }; break;
        case 'I': case 'EM': nf = { ...f, i: true }; break;
        case 'U': nf = { ...f, u: 'single' }; break;
        case 'S': case 'STRIKE': nf = { ...f, strike: true }; break;
        case 'SUB': nf = { ...f, vert: 'subscript' }; break;
        case 'SUP':
          if (cls.contains('en-ref')) {
            ctx.endnotes = ctx.endnotes || [];
            ctx.endnotes.push(c.dataset.note || '');
            out += `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:endnoteReference w:id="${ctx.endnotes.length}"/></w:r>`;
            return;
          }
          if (cls.contains('fn-ref')) {
            ctx.footnotes.push(c.dataset.note || '');
            out += `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${ctx.footnotes.length}"/></w:r>`;
            return;
          }
          nf = { ...f, vert: 'superscript' }; break;
        case 'CODE': nf = { ...f, font: 'Consolas' }; break;
        case 'MARK': nf = { ...f, shd: 'FFFF00' }; break;
        case 'FONT':
          nf = { ...f };
          if (c.getAttribute('color')) nf.color = hex(c.getAttribute('color'));
          if (c.getAttribute('face')) nf.font = firstFont(c.getAttribute('face'));
          if (c.getAttribute('size')) nf.size = [8, 10, 12, 14, 18, 24, 36][+c.getAttribute('size') - 1] || nf.size;
          break;
        case 'BR': out += '<w:r><w:br/></w:r>'; return;
        case 'IMG': out += drawing(c, ctx); return;
        case 'A': {
          const href = c.getAttribute('href') || '';
          const inner = inline(c, { ...styleFmt(c, f), rStyle: 'Hyperlink' }, ctx, opt);
          if (!href) { out += inner; return; }
          if (href.startsWith('#')) out += `<w:hyperlink w:anchor="${bmName(href.slice(1))}" w:history="1">${inner}</w:hyperlink>`;
          else out += `<w:hyperlink r:id="${ctx.rel(REL + 'hyperlink', X(href), true)}" w:history="1">${inner}</w:hyperlink>`;
          return;
        }
        case 'INS':
          if (cls.contains('trk')) { out += `<w:ins w:id="${ctx.rev++}" w:author="${X(c.dataset.author || 'Inkt')}" w:date="${new Date(+c.dataset.time || Date.now()).toISOString().slice(0, 19)}Z">${inline(c, f, ctx, opt)}</w:ins>`; return; }
          nf = { ...f, u: 'single' }; break;
        case 'DEL':
          if (cls.contains('trk')) { out += `<w:del w:id="${ctx.rev++}" w:author="${X(c.dataset.author || 'Inkt')}" w:date="${new Date(+c.dataset.time || Date.now()).toISOString().slice(0, 19)}Z">${inline(c, f, ctx, { ...opt, del: true })}</w:del>`; return; }
          nf = { ...f, strike: true }; break;
        case 'SPAN': case 'LABEL':
          if (cls.contains('tab')) { out += `<w:r>${rPr(f)}<w:tab/></w:r>`; return; }
          if (cls.contains('eq')) { out += run(c.dataset.tex || c.textContent, { ...f, i: true, font: 'Cambria Math' }); return; }
          if (cls.contains('wa')) nf = { ...styleFmt(c, f), b: true, size: 32, color: hex(getComputedStyle(App.ed).getPropertyValue('--doc-accent')) };
          else nf = styleFmt(c, f);
          if (cls.contains('mf') || cls.contains('fld') || cls.contains('cite') || cls.contains('cap-num')) { out += run(c.textContent, nf, opt.del); return; }
          break;
        default:
          if (/^(P|DIV|H\d|LI|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(tag)) { out += inline(c, f, ctx, opt); return; }
          nf = styleFmt(c, f);
      }
      out += inline(c, nf, ctx, opt);
    });
    return out;
  };

  /* ---------- Afbeeldingen ---------- */
  const drawing = (img, ctx) => {
    const m = img._media;
    if (!m) return img.alt ? run(`[${img.alt}]`, { i: true }) : '';
    const n = ctx.pic++;
    const cx = Math.round(m.w * 9525), cy = Math.round(m.h * 9525);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${n}" name="Afbeelding ${n}" descr="${X(img.alt || '')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${m.name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${m.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  const b64ToBytes = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const prepareImages = async (root, ctx) => {
    const imgs = $$('img', root);
    for (const img of imgs) {
      try {
        let src = img.getAttribute('src') || '';
        const im = await App.loadImg(src);
        let w = parseFloat(img.style.width) || im.naturalWidth;
        let h = parseFloat(img.style.height) || (im.naturalHeight * w) / (im.naturalWidth || 1);
        let type = (src.match(/^data:image\/(png|jpeg|jpg|gif)/) || [])[1];
        if (!type) {
          // SVG, webp of extern: omzetten naar PNG
          const c = document.createElement('canvas');
          const k = /svg/.test(src.slice(0, 30)) ? 2 : 1;
          c.width = Math.max(1, Math.round((im.naturalWidth || w) * k)); c.height = Math.max(1, Math.round((im.naturalHeight || h) * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          src = c.toDataURL('image/png'); type = 'png';
        }
        if (type === 'jpg') type = 'jpeg';
        const bytes = b64ToBytes(src.split(',')[1]);
        const name = `image${ctx.media.length + 1}.${type === 'jpeg' ? 'jpeg' : type}`;
        const rid = ctx.rel(REL + 'image', 'media/' + name);
        ctx.media.push({ name, bytes });
        img._media = { name, rid, w, h };
      } catch { /* afbeelding overslaan */ }
    }
  };

  /* ---------- Alinea's ---------- */
  const pPr = (el, base = {}) => {
    const st = el.style || {};
    let s = '';
    if (base.style) s += `<w:pStyle w:val="${base.style}"/>`;
    if (base.keepNext || st.breakAfter === 'avoid') s += '<w:keepNext/>';
    if (st.breakInside === 'avoid') s += '<w:keepLines/>';
    if (st.breakBefore === 'page') s += '<w:pageBreakBefore/>';
    if (base.num) s += `<w:numPr><w:ilvl w:val="${base.num.lvl}"/><w:numId w:val="${base.num.id}"/></w:numPr>`;
    if (el.closest && el.closest('.no-ln')) s += '<w:suppressLineNumbers/>';
    const bd = [];
    const bside = (side, v) => { if (v && v !== 'none' && !/^0/.test(v)) bd.push(`<w:${side} w:val="single" w:sz="6" w:space="4" w:color="${hex(v.replace(/^[\d.]+px\s+\w+\s+/, '')) || '555555'}"/>`); };
    if (base.box) ['top', 'left', 'bottom', 'right'].forEach((sd) => bd.push(`<w:${sd} w:val="single" w:sz="6" w:space="4" w:color="9A9AAE"/>`));
    else { bside('top', st.borderTop); bside('left', st.borderLeft); bside('bottom', st.borderBottom); bside('right', st.borderRight); }
    if (bd.length) s += `<w:pBdr>${bd.join('')}</w:pBdr>`;
    const bg = hex(st.backgroundColor);
    if (bg) s += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
    // tabstops (Agent B: data-tabs="pos-cm:uitlijning:opvulteken;...")
    if (el.dataset && el.dataset.tabs && App.getTabs) {
      const tv = { l: 'left', c: 'center', r: 'right', d: 'decimal', bar: 'bar' }, tl = { none: 'none', dot: 'dot', dash: 'hyphen', line: 'underscore' };
      s += `<w:tabs>${App.getTabs(el).map((t) => `<w:tab w:val="${tv[t.align] || 'left'}" w:leader="${tl[t.leader] || 'none'}" w:pos="${twipCm(t.pos)}"/>`).join('')}</w:tabs>`;
    }
    const sp = [];
    const mt = ptOf(st.marginTop), mb = ptOf(st.marginBottom);
    if (mt != null) sp.push(`w:before="${Math.round(mt * 20)}"`);
    if (mb != null) sp.push(`w:after="${Math.round(mb * 20)}"`);
    const lh = parseFloat(st.lineHeight);
    if (lh && !/px|pt/.test(st.lineHeight)) sp.push(`w:line="${Math.round(lh * 240)}" w:lineRule="auto"`);
    if (sp.length) s += `<w:spacing ${sp.join(' ')}/>`;
    const ml = ptOf(st.marginLeft) || 0, mr = ptOf(st.marginRight) || 0, ti = ptOf(st.textIndent) || 0;
    if (ml || mr || ti || base.indent) {
      const left = Math.round((ml + (base.indent || 0)) * 20) + (ti < 0 ? Math.round(-ti * 20) : 0);
      s += `<w:ind w:left="${left}" w:right="${Math.round(mr * 20)}"${ti > 0 ? ` w:firstLine="${Math.round(ti * 20)}"` : ti < 0 ? ` w:hanging="${Math.round(-ti * 20)}"` : ''}/>`;
    }
    const ta = st.textAlign || base.align;
    const jc = { center: 'center', right: 'right', justify: 'both', left: 'left' }[ta];
    if (jc) s += `<w:jc w:val="${jc}"/>`;
    return s ? `<w:pPr>${s}</w:pPr>` : '';
  };
  const bookmarks = (el, ctx) => {
    if (!el.id) return { s: '', e: '' };
    const id = ctx.bm++;
    return { s: `<w:bookmarkStart w:id="${id}" w:name="${bmName(el.id)}"/>`, e: `<w:bookmarkEnd w:id="${id}"/>` };
  };
  const STYLE_OF = (el) => {
    const t = el.tagName, c = el.classList;
    if (App.docxStyleOf) { const us = App.docxStyleOf(el); if (us) return us; }
    if (/^H[1-6]$/.test(t)) return 'Heading' + Math.min(4, +t[1]);
    if (t === 'BLOCKQUOTE') return c.contains('intense') ? 'IntenseQuote' : 'Quote';
    if (t === 'PRE') return 'Code';
    if (c.contains('title')) return 'Title';
    if (c.contains('subtitle')) return 'Subtitle';
    if (c.contains('caption')) return 'Caption';
    if (c.contains('nospace')) return 'NoSpacing';
    return null;
  };
  const para = (el, ctx, base = {}) => {
    const b = bookmarks(el, ctx);
    const style = base.style || STYLE_OF(el);
    let f = {};
    if (el.classList && el.classList.contains('dropcap')) f = {};
    const body = inline(el, styleFmt(el, f), ctx, { pre: el.tagName === 'PRE' || /pre/.test(el.style.whiteSpace || '') });
    return `<w:p>${pPr(el, { ...base, style })}${b.s}${body}${b.e}</w:p>`;
  };
  const emptyP = '<w:p/>';

  /* ---------- Lijsten ---------- */
  const abstractFor = (ctx, key) => {
    if (ctx.abstracts[key] != null) return ctx.abstracts[key];
    const id = ctx.abstractList.length;
    const bullets = { disc: '•', circle: '○', square: '▪', 'lst-dash': '–', 'lst-arrow': '➢', 'lst-check': '✓', 'lst-star': '★', 'lst-diamond': '◆', checklist: '☐' };
    const ordered = { decimal: ['decimal', '%L.'], 'lst-paren': ['decimal', '%L)'], 'lower-alpha': ['lowerLetter', '%L.'], 'upper-alpha': ['upperLetter', '%L.'], 'lower-roman': ['lowerRoman', '%L.'], 'upper-roman': ['upperRoman', '%L.'], 'decimal-leading-zero': ['decimalZero', '%L.'] };
    let lvls = '';
    for (let l = 0; l < 9; l++) {
      const ind = `<w:pPr><w:ind w:left="${720 * (l + 1)}" w:hanging="360"/></w:pPr>`;
      if (bullets[key] || !ordered[key]) {
        const ch = key === 'disc' ? ['•', '○', '▪'][l % 3] : (bullets[key] || '•');
        lvls += `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${ch}"/><w:lvlJc w:val="left"/>${ind}</w:lvl>`;
      } else {
        const [fmt, txt] = l === 0 ? ordered[key] : [['lowerLetter', 'lowerRoman', 'decimal'][(l - 1) % 3], '%L.'];
        lvls += `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt.replace('%L', '%' + (l + 1))}"/><w:lvlJc w:val="left"/>${ind}</w:lvl>`;
      }
    }
    ctx.abstractList.push(`<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${lvls}</w:abstractNum>`);
    ctx.abstracts[key] = id;
    return id;
  };
  const list = (el, ctx, lvl) => {
    const ordered = el.tagName === 'OL';
    const custom = Array.from(el.classList).find((c) => /^lst-|checklist/.test(c));
    const key = custom || el.style.listStyleType || (ordered ? 'decimal' : 'disc');
    const abs = abstractFor(ctx, key);
    const numId = ctx.nums.length + 1;
    ctx.nums.push(`<w:num w:numId="${numId}"><w:abstractNumId w:val="${abs}"/><w:lvlOverride w:ilvl="${lvl}"><w:startOverride w:val="${el.start || 1}"/></w:lvlOverride></w:num>`);
    let out = '';
    Array.from(el.children).forEach((li) => {
      if (li.tagName !== 'LI') { out += blocks(li, ctx); return; }
      const nested = Array.from(li.children).filter((x) => x.tagName === 'UL' || x.tagName === 'OL');
      const blocksIn = Array.from(li.children).filter((x) => /^(P|H\d|PRE|BLOCKQUOTE)$/.test(x.tagName));
      const base = { num: { lvl, id: numId }, style: 'ListParagraph' };
      if (blocksIn.length) {
        blocksIn.forEach((b, i) => { out += para(b, ctx, i === 0 ? { ...base, style: STYLE_OF(b) || 'ListParagraph' } : { style: 'ListParagraph', indent: 36 * (lvl + 1) }); });
      } else {
        const clone = li.cloneNode(true);
        Array.from(clone.children).forEach((x) => { if (x.tagName === 'UL' || x.tagName === 'OL') x.remove(); });
        if (key === 'checklist') clone.prepend(li.classList.contains('done') ? '☑ ' : '');
        out += para(clone, ctx, base);
      }
      nested.forEach((n) => { out += list(n, ctx, lvl + 1); });
    });
    return out;
  };

  /* ---------- Tabellen ---------- */
  const HEAD_FILL = { 'ts-accent': 'accent', 'ts-soft': 'C1E4F5', 'ts-dark': '2A2A35', 'ts-green': '2F855A', 'ts-orange': 'DD6B20' };
  const table = (t, ctx) => {
    const g = App.tableGrid(t);
    const ncols = Math.max(1, ...g.map((r) => (r || []).length));
    const pos = new Map();
    g.forEach((row, r) => (row || []).forEach((cell, c) => { if (!pos.has(cell)) pos.set(cell, [r, c]); }));
    const cls = t.classList;
    const g2 = App.geom();
    const total = Math.round((g2.W - g2.ml - g2.mr) * 15);
    const firstRow = t.rows[0] ? Array.from(t.rows[0].cells) : [];
    let widths = new Array(ncols).fill(Math.floor(total / ncols));
    const pxs = firstRow.map((c) => parseFloat(c.style.width));
    if (pxs.length && pxs.every((v) => v > 0) && firstRow.every((c) => (c.colSpan || 1) === 1) && firstRow.length === ncols) {
      const isPct = firstRow[0].style.width.endsWith('%');
      widths = pxs.map((v) => Math.round(isPct ? (total * v) / 100 : v * 15));
    }
    const line = (on) => (on ? '<w:VAL w:val="single" w:sz="4" w:space="0" w:color="000000"/>' : '<w:VAL w:val="nil"/>');
    const sides = { top: 1, left: 1, bottom: 1, right: 1, insideH: 1, insideV: 1 };
    if (cls.contains('b-none')) Object.keys(sides).forEach((k) => { sides[k] = 0; });
    if (cls.contains('b-outer')) { sides.insideH = 0; sides.insideV = 0; }
    if (cls.contains('b-inner')) { sides.top = 0; sides.left = 0; sides.bottom = 0; sides.right = 0; }
    if (cls.contains('b-horizontal') || cls.contains('ts-minimal')) { sides.left = 0; sides.right = 0; sides.insideV = 0; }
    const borders = Object.entries(sides).map(([k, v]) => line(v).replace('VAL', k)).join('');
    const styleKey = Array.from(cls).find((c) => HEAD_FILL[c]);
    let headFill = styleKey ? HEAD_FILL[styleKey] : null;
    if (headFill === 'accent') headFill = hex(getComputedStyle(App.ed).getPropertyValue('--doc-accent')) || '156082';
    const headWhite = styleKey && styleKey !== 'ts-soft';
    let xml = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${t.style.width === 'auto' ? 0 : 5000}" w:type="${t.style.width === 'auto' ? 'auto' : 'pct'}"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="${t.style.tableLayout === 'fixed' ? 'fixed' : 'autofit'}"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
    xml += `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    g.forEach((row, r) => {
      const tr = t.rows[r];
      const isHead = tr && tr.querySelector('th') && r === 0;
      xml += `<w:tr>${isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
      for (let c = 0; c < ncols; c++) {
        const cell = row ? row[c] : null;
        if (!cell) { xml += `<w:tc><w:tcPr><w:tcW w:w="${widths[c]}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`; continue; }
        const [cr, cc] = pos.get(cell);
        if (cc !== c) continue;
        const cs = cell.colSpan || 1, rs = cell.rowSpan || 1;
        const w = widths.slice(c, c + cs).reduce((a, b) => a + b, 0);
        let tcPr = `<w:tcW w:w="${w}" w:type="dxa"/>`;
        if (cs > 1) tcPr += `<w:gridSpan w:val="${cs}"/>`;
        if (rs > 1 || cr !== r) tcPr += cr === r ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
        const head = cell.tagName === 'TH';
        let fill = hex(cell.style.backgroundColor);
        if (!fill && head && headFill) fill = headFill;
        if (!fill && cls.contains('banded') && r % 2 === 1 && !head) fill = 'F0F0FA';
        if (fill) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
        const va = { middle: 'center', bottom: 'bottom' }[cell.style.verticalAlign];
        if (va) tcPr += `<w:vAlign w:val="${va}"/>`;
        let content = '';
        if (cr === r) {
          const f0 = head ? { b: true, color: headWhite ? 'FFFFFF' : null } : (cls.contains('first-col') && c === 0 ? { b: true } : {});
          if (cell.querySelector('p,h1,h2,h3,h4,ul,ol,table,pre,blockquote')) content = blocks(cell, ctx, f0);
          else content = `<w:p>${pPr(cell, {})}${inline(cell, styleFmt(cell, f0), ctx)}</w:p>`;
        }
        xml += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content || '<w:p/>'}</w:tc>`;
        c += cs - 1;
      }
      xml += '</w:tr>';
    });
    return xml + '</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
  };

  /* ---------- Inhoudsopgave als Word-veld ---------- */
  const toc = (el, ctx) => {
    const levels = +el.dataset.levels || 3;
    const g2 = App.geom();
    const tabPos = Math.round((g2.W - g2.ml - g2.mr) * 15);
    let xml = `<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr>${run('Inhoudsopgave', {})}</w:p>`;
    xml += `<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-${levels}" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>`;
    $$('a.toc-entry', el).forEach((a) => {
      const lvl = (a.className.match(/lvl(\d)/) || [0, 1])[1];
      const target = (a.getAttribute('href') || '').slice(1);
      xml += `<w:p><w:pPr><w:pStyle w:val="TOC${lvl}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tabPos}"/></w:tabs></w:pPr><w:hyperlink w:anchor="${bmName(target)}" w:history="1">${run(a.querySelector('.t').textContent, {})}<w:r><w:tab/></w:r>${run(a.querySelector('.pg').textContent, {})}</w:hyperlink></w:p>`;
    });
    xml += '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    return xml;
  };

  /* ---------- Blokken ---------- */
  const blocks = (container, ctx, f0 = null) => {
    let out = '';
    let loose = null;
    const flushLoose = () => { if (loose) { out += `<w:p>${inline(loose, f0 || {}, ctx)}</w:p>`; loose = null; } };
    Array.from(container.childNodes).forEach((el) => {
      if (el.nodeType === 3 || (el.nodeType === 1 && /^(SPAN|B|I|U|A|STRONG|EM|IMG|BR|FONT|SUP|SUB|INS|DEL|S|CODE|MARK)$/.test(el.tagName))) {
        if (el.nodeType === 3 && !el.data.trim() && !loose) return;
        loose = loose || document.createElement('p');
        loose.appendChild(el.cloneNode(true));
        return;
      }
      flushLoose();
      if (el.nodeType !== 1) return;
      const t = el.tagName, c = el.classList;
      if (/^(P|H[1-6]|PRE|BLOCKQUOTE)$/.test(t)) {
        if (t === 'BLOCKQUOTE' && el.querySelector('p')) { Array.from(el.children).forEach((p) => { out += para(p, ctx, { style: c.contains('intense') ? 'IntenseQuote' : 'Quote' }); }); return; }
        if (f0) { out += `<w:p>${pPr(el, { style: STYLE_OF(el) })}${inline(el, styleFmt(el, f0), ctx)}</w:p>`; return; }
        out += para(el, ctx, { keepNext: /^H/.test(t) });
      } else if (t === 'UL' || t === 'OL') out += list(el, ctx, 0);
      else if (t === 'TABLE') out += table(el, ctx);
      else if (t === 'HR') out += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9C9D4"/></w:pBdr></w:pPr></w:p>';
      else if (c.contains('section-break')) out += `⁣SECT:${el.dataset.type === 'continuous' ? 'continuous' : 'nextPage'}⁣`;
      else if (c.contains('page-break')) out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      else if (c.contains('col-break')) out += '<w:p><w:r><w:br w:type="column"/></w:r></w:p>';
      else if (c.contains('toc')) out += toc(el, ctx);
      else if (c.contains('footnotes') || c.contains('endnotes')) { /* als echte voet-/eindnoten geëxporteerd */ }
      else if (c.contains('textbox')) { Array.from(el.children).forEach((p) => { out += /^(P|H\d)$/.test(p.tagName) ? para(p, ctx, { box: true }) : blocks(p, ctx); }); }
      else if (t === 'IMG') out += `<w:p>${drawing(el, ctx)}</w:p>`;
      else out += blocks(el, ctx, f0);
    });
    flushLoose();
    return out;
  };

  /* ---------- Kop- en voettekst ---------- */
  const hfXml = (tag, html, ctx) => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    let body = blocks(d, ctx) || emptyP;
    // velden (gemarkeerd met U+2063) vervangen door echte Word-velden
    const fieldRun = (k) => {
      if (k === 'page') return '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>';
      if (k === 'pages') return '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple>';
      if (k === 'date') return '<w:fldSimple w:instr=" DATE \\@ &quot;d MMMM yyyy&quot; "><w:r><w:t>' + X(App.fmtDate(Date.now())) + '</w:t></w:r></w:fldSimple>';
      return run(App.doc.title, {});
    };
    body = body.replace(/⁣(\w+)⁣/g, (_, k) => `</w:t></w:r>${fieldRun(k)}<w:r><w:t xml:space="preserve">`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}">${body}</w:${tag}>`;
  };
  const markFields = (html) => {
    const d = document.createElement('div'); d.innerHTML = html || '';
    d.querySelectorAll('.fld').forEach((f) => f.replaceWith(document.createTextNode('⁣' + f.dataset.fld + '⁣')));
    return d.innerHTML;
  };

  /* ---------- Stijlen ---------- */
  const stylesXml = (look) => {
    const { body, head, headColor, accent, line, after, lang, size } = look;
    const font = (f) => `<w:rFonts w:ascii="${X(f)}" w:hAnsi="${X(f)}" w:cs="${X(f)}" w:eastAsia="${X(f)}"/>`;
    const pst = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra}${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
    // Word 365: koppen niet vet; Kop 1/2 in het kopletterype, Kop 3/4 in het tekstlettertype
    const heading = (n, sz, extra = '') => pst('Heading' + n, 'heading ' + n, `<w:keepNext/><w:keepLines/><w:spacing w:before="${[0, 360, 160, 160, 80][n]}" w:after="${[0, 80, 80, 80, 40][n]}"/><w:outlineLvl w:val="${n - 1}"/>`, `${font(n <= 2 ? head : body)}${extra}<w:color w:val="${headColor}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`, '<w:uiPriority w:val="9"/>');
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS.w}">
<w:docDefaults><w:rPrDefault><w:rPr>${font(body)}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="${lang}" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="${Math.round(after * 20)}" w:line="${Math.round(line * 240)}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
${heading(1, 40)}${heading(2, 32)}${heading(3, 28)}${heading(4, 24, '<w:i/><w:iCs/>')}
${pst('Title', 'Title', '<w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:contextualSpacing/>', `${font(head)}<w:spacing w:val="-10"/><w:kern w:val="28"/><w:sz w:val="56"/><w:szCs w:val="56"/>`)}
${pst('Subtitle', 'Subtitle', '<w:spacing w:after="160"/>', '<w:color w:val="595959"/><w:spacing w:val="15"/><w:sz w:val="28"/><w:szCs w:val="28"/>')}
${pst('Quote', 'Quote', `<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${accent}"/></w:pBdr><w:ind w:left="284"/>`, '<w:i/><w:iCs/><w:color w:val="444444"/>')}
${pst('IntenseQuote', 'Intense Quote', `<w:pBdr><w:top w:val="single" w:sz="4" w:space="10" w:color="${accent}"/><w:bottom w:val="single" w:sz="4" w:space="10" w:color="${accent}"/></w:pBdr><w:spacing w:before="360" w:after="360"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/>`, `<w:i/><w:iCs/><w:color w:val="${accent}"/>`)}
${pst('Caption', 'caption', '<w:spacing w:after="200" w:line="240" w:lineRule="auto"/>', '<w:i/><w:iCs/><w:color w:val="555555"/><w:sz w:val="18"/><w:szCs w:val="18"/>')}
${pst('NoSpacing', 'No Spacing', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '')}
${pst('Code', 'Code', '<w:shd w:val="clear" w:color="auto" w:fill="F4F4F8"/><w:spacing w:after="160" w:line="276" w:lineRule="auto"/>', `${font('Consolas')}<w:sz w:val="19"/><w:szCs w:val="19"/>`)}
${pst('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/>', '')}
${pst('FootnoteText', 'footnote text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="18"/><w:szCs w:val="18"/>')}
${pst('TOCHeading', 'TOC Heading', '<w:spacing w:before="240" w:after="120"/>', `${font(head)}<w:b/><w:color w:val="${headColor}"/><w:sz w:val="32"/><w:szCs w:val="32"/>`)}
${pst('TOC1', 'toc 1', '<w:spacing w:after="60"/>', '<w:b/>')}${pst('TOC2', 'toc 2', '<w:spacing w:after="60"/><w:ind w:left="220"/>', '')}${pst('TOC3', 'toc 3', '<w:spacing w:after="60"/><w:ind w:left="440"/>', '')}
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${accent}"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;
    // Eigen/gewijzigde stijlen (deelvenster Stijlen, js/start-extra.js)
    return App.docxStylesHook ? App.docxStylesHook(xml, { pst, font, X, look }) : xml;
  };

  /* ---------- Hoofdfunctie: blob maken ---------- */
  App.Docx.build = async () => {
    const JSZip = window.JSZip || (await App.loadScript(App.JSZIP), window.JSZip);
    const m = App.doc.meta;
    const root = document.createElement('div');
    const accentCss = getComputedStyle(App.ed);
    let html = App.cleanHtml(true);
    ['--doc-accent', '--doc-accent-2', '--doc-head-color', '--doc-head-font', '--doc-font'].forEach((v) => { html = html.split(`var(${v})`).join(accentCss.getPropertyValue(v).trim()); });
    root.innerHTML = html;
    const ctx = makeCtx(App.doc);
    // opmerkingen voorbereiden
    let cid = 0;
    const comments = m.comments.filter((c) => c.text && !c.draft);
    comments.forEach((c) => {
      const anchors = $$(`.cmt[data-cid="${c.id}"]`, root);
      if (!anchors.length) return;
      ctx.cmtIds[c.id] = cid; ctx.cmtFirst[c.id] = anchors[0]; ctx.cmtLast[c.id] = anchors[anchors.length - 1];
      ctx.comments.push({ id: cid++, c });
    });
    await prepareImages(root, ctx);
    const body = blocks(root, ctx) || emptyP;
    const g = App.geom();
    const look = {
      body: firstFont(accentCss.getPropertyValue('--doc-font')) || 'Aptos',
      head: firstFont(accentCss.getPropertyValue('--doc-head-font')) || 'Aptos Display',
      headColor: hex(accentCss.getPropertyValue('--doc-head-color')) || '0F4761',
      accent: hex(accentCss.getPropertyValue('--doc-accent')) || '156082',
      size: Math.round((parseFloat(accentCss.fontSize) || 16) * 0.75 * 2) || 24,
      line: parseFloat(accentCss.getPropertyValue('--doc-line')) || 1.15,
      after: parseFloat(accentCss.getPropertyValue('--doc-after')) || 8,
      lang: m.lang || 'nl-NL',
    };
    const zip = new JSZip();
    const ct = [];
    // kop- en voetteksten
    let sectRefs = '';
    const addHF = (tag, type, html, idx) => {
      if (!html) return;
      const name = `${tag}${idx}.xml`;
      zip.file('word/' + name, hfXml(tag === 'header' ? 'hdr' : 'ftr', markFields(html), ctx));
      const rid = ctx.rel(REL + tag, name);
      ct.push(`<Override PartName="/word/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${tag}+xml"/>`);
      sectRefs += `<w:${tag}Reference w:type="${type}" r:id="${rid}"/>`;
    };
    addHF('header', 'default', m.header, 1);
    if (m.firstDiff) addHF('header', 'first', m.headerFirst || '<p></p>', 2);
    const hRefs = sectRefs; sectRefs = '';
    addHF('footer', 'default', m.footer, 1);
    if (m.firstDiff) addHF('footer', 'first', m.footerFirst || '<p></p>', 2);
    sectRefs = hRefs + sectRefs;
    const pm = m.page.margins;
    const landscape = g.wmm > g.hmm;
    // regelnummers en sectie-einden (Agent B)
    const ln = m.lineNumbers || {};
    const lnNum = ln.mode && ln.mode !== 'none' ? `<w:lnNumType w:countBy="${ln.countBy || 1}"${ln.start > 1 ? ` w:start="${ln.start - 1}"` : ''}${ln.distance ? ` w:distance="${twipCm(ln.distance)}"` : ''} w:restart="${{ page: 'newPage', section: 'newSection' }[ln.mode] || 'continuous'}"/>` : '';
    // kolommen per sectie: als een sectie uit één kolommenblok bestaat, krijgt die sectie echte Word-kolommen
    const secCols = [[]];
    Array.from(root.children).forEach((el) => { if (el.classList.contains('section-break')) secCols.push([]); else if (!el.classList.contains('footnotes') && !el.classList.contains('endnotes') && (el.textContent.trim() || el.querySelector('img,table'))) secCols[secCols.length - 1].push(el); });
    const colsOf = (k) => { const els = secCols[k] || []; return els.length === 1 && els[0].matches('.cols.c2, .cols.c3') ? (els[0].classList.contains('c3') ? 3 : 2) : 1; };
    let secIdx = 0;
    const sectXml = (type, k = secIdx++) => `<w:sectPr>${sectRefs}${type ? `<w:type w:val="${type}"/>` : ''}<w:pgSz w:w="${twipMm(g.wmm)}" w:h="${twipMm(g.hmm)}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${twipCm(pm.t)}" w:right="${twipCm(pm.r)}" w:bottom="${twipCm(pm.b)}" w:left="${twipCm(pm.l)}" w:header="709" w:footer="709" w:gutter="0"/>${lnNum}<w:cols w:space="708"${colsOf(k) > 1 ? ` w:num="${colsOf(k)}"` : ''}/>${m.firstDiff ? '<w:titlePg/>' : ''}<w:docGrid w:linePitch="360"/></w:sectPr>`;
    let prevType = '';
    const bodyX = body.replace(/⁣SECT:(\w+)⁣/g, (_, type) => { const x = `<w:p><w:pPr>${sectXml(prevType)}</w:pPr></w:p>`; prevType = type; return x; });
    const sect = sectXml(prevType);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:body>${bodyX}${sect}</w:body></w:document>`);
    zip.file('word/styles.xml', stylesXml(look));
    ctx.rel(REL + 'styles', 'styles.xml');
    ctx.rel(REL + 'settings', 'settings.xml');
    zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${NS.w}">${m.track ? '<w:trackRevisions/>' : ''}<w:defaultTabStop w:val="${twipCm(m.defaultTab || 1.25)}"/><w:characterSpacingControl w:val="doNotCompress"/>${ctx.footnotes.length ? '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' : ''}${ctx.endnotes && ctx.endnotes.length ? `<w:endnotePr><w:numFmt w:val="${m.endnoteFormat || 'lowerRoman'}"/><w:endnote w:id="-1"/><w:endnote w:id="0"/></w:endnotePr>` : ''}<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    if (ctx.abstractList.length) {
      zip.file('word/numbering.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${NS.w}">${ctx.abstractList.join('')}${ctx.nums.join('')}</w:numbering>`);
      ctx.rel(REL + 'numbering', 'numbering.xml');
      ct.push('<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>');
    }
    if (ctx.footnotes.length) {
      const sep = (type, id, tag) => `<w:footnote w:type="${type}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${tag}/></w:r></w:p></w:footnote>`;
      zip.file('word/footnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes xmlns:w="${NS.w}" xmlns:r="${NS.r}">${sep('separator', -1, 'separator')}${sep('continuationSeparator', 0, 'continuationSeparator')}${ctx.footnotes.map((t, i) => `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${run(' ' + t, {})}</w:p></w:footnote>`).join('')}</w:footnotes>`);
      ctx.rel(REL + 'footnotes', 'footnotes.xml');
      ct.push('<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>');
    }
    // eindnoten (Agent B)
    if (ctx.endnotes && ctx.endnotes.length) {
      const sep = (type, id, tag) => `<w:endnote w:type="${type}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${tag}/></w:r></w:p></w:endnote>`;
      zip.file('word/endnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:endnotes xmlns:w="${NS.w}" xmlns:r="${NS.r}">${sep('separator', -1, 'separator')}${sep('continuationSeparator', 0, 'continuationSeparator')}${ctx.endnotes.map((t, i) => `<w:endnote w:id="${i + 1}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:endnoteRef/></w:r>${run(' ' + t, { size: 10 })}</w:p></w:endnote>`).join('')}</w:endnotes>`);
      ctx.rel(REL + 'endnotes', 'endnotes.xml');
      ct.push('<Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/>');
    }
    if (ctx.comments.length) {
      zip.file('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${NS.w}">${ctx.comments.map(({ id, c }) => `<w:comment w:id="${id}" w:author="${X(c.author)}" w:date="${new Date(c.date).toISOString().slice(0, 19)}Z" w:initials="${X(App.initialsOf(c.author))}"><w:p><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>${run(c.text, {})}</w:p>${c.replies.map((r) => `<w:p>${run(`${r.author}: ${r.text}`, { i: true })}</w:p>`).join('')}</w:comment>`).join('')}</w:comments>`);
      ctx.rel(REL + 'comments', 'comments.xml');
      ct.push('<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>');
    }
    ctx.media.forEach((md) => zip.file('word/media/' + md.name, md.bytes));
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ctx.rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`);
    const now = new Date().toISOString().slice(0, 19) + 'Z';
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(App.doc.title)}</dc:title><dc:creator>${X(m.author || App.settings.author)}</dc:creator><cp:lastModifiedBy>${X(App.settings.author)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(m.created || Date.now()).toISOString().slice(0, 19)}Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Inkt (gemaakt door JJ van Schelven)</Application></Properties>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${ct.join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  };

  /* ---------- Extra bij importeren: pagina-instelling en kop/voettekst ---------- */
  App.Docx.readExtras = async (buffer) => {
    const JSZip = window.JSZip || (await App.loadScript(App.JSZIP), window.JSZip);
    const zip = await JSZip.loadAsync(buffer);
    const read = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
    const doc = await read('word/document.xml');
    if (!doc) return {};
    const W = NS.w;
    const attr = (el, n) => (el ? el.getAttributeNS(W, n) || el.getAttribute('w:' + n) : null);
    const sects = doc.getElementsByTagNameNS(W, 'sectPr');
    const sp = sects[sects.length - 1];
    const out = {};
    if (sp) {
      const sz = sp.getElementsByTagNameNS(W, 'pgSz')[0], mar = sp.getElementsByTagNameNS(W, 'pgMar')[0];
      if (sz) {
        const wmm = (+attr(sz, 'w') / 1440) * 25.4, hmm = (+attr(sz, 'h') / 1440) * 25.4;
        const near = Object.entries(App.PAGE_SIZES).find(([, [a, b]]) => (Math.abs(a - Math.min(wmm, hmm)) < 3 && Math.abs(b - Math.max(wmm, hmm)) < 3));
        out.page = { size: near ? near[0] : 'A4', orient: wmm > hmm ? 'landscape' : 'portrait', margins: { t: 2.54, r: 2.54, b: 2.54, l: 2.54 } };
        if (mar) ['top', 'right', 'bottom', 'left'].forEach((k) => { const v = +attr(mar, k); if (!isNaN(v)) out.page.margins[k[0]] = Math.round((Math.abs(v) / 1440) * 2.54 * 100) / 100; });
      }
      out.firstDiff = sp.getElementsByTagNameNS(W, 'titlePg').length > 0;
      const rels = await read('word/_rels/document.xml.rels');
      const target = (rid) => { const r = rels && Array.from(rels.getElementsByTagName('Relationship')).find((x) => x.getAttribute('Id') === rid); return r ? 'word/' + r.getAttribute('Target').replace(/^\/?word\//, '') : null; };
      const hfHtml = async (path) => {
        const x = await read(path); if (!x) return '';
        return Array.from(x.getElementsByTagNameNS(W, 'p')).map((p) => {
          const jc = attr(p.getElementsByTagNameNS(W, 'jc')[0], 'val') || attr(p.getElementsByTagNameNS(W, 'framePr')[0], 'xAlign');
          let h = '';
          let skip = false; // gecachte veldresultaten overslaan
          const walk = (n) => Array.from(n.childNodes).forEach((c) => {
            if (c.localName === 'fldChar') { const ty = attr(c, 'fldCharType'); if (ty === 'separate') skip = true; if (ty === 'end') skip = false; return; }
            if (skip && c.localName === 't') return;
            if (c.localName === 't') h += App.esc(c.textContent);
            else if (c.localName === 'tab') h += ' ';
            else if (c.localName === 'fldSimple') { const ins = attr(c, 'instr') || ''; h += /NUMPAGES/.test(ins) ? '<span class="fld" data-fld="pages" contenteditable="false"></span>' : /PAGE/.test(ins) ? '<span class="fld" data-fld="page" contenteditable="false"></span>' : App.esc(c.textContent); }
            else if (c.localName === 'instrText') { const t = c.textContent; if (/NUMPAGES/.test(t)) h += '<span class="fld" data-fld="pages" contenteditable="false"></span>'; else if (/PAGE/.test(t)) h += '<span class="fld" data-fld="page" contenteditable="false"></span>'; c._fld = true; }
            else if (c.childNodes && c.localName !== 'instrText') walk(c);
          });
          walk(p);
          // gecachte veldresultaten tussen 'separate' en 'end' verwijderen we niet: eenvoudig houden
          return h.trim() ? `<p style="text-align:${{ center: 'center', right: 'right', end: 'right' }[jc] || 'left'}">${h}</p>` : '';
        }).join('');
      };
      for (const el of Array.from(sp.childNodes)) {
        if (el.localName !== 'headerReference' && el.localName !== 'footerReference') continue;
        const type = attr(el, 'type'), rid = el.getAttributeNS(NS.r, 'id') || el.getAttribute('r:id');
        const path = target(rid); if (!path) continue;
        const key = (el.localName === 'headerReference' ? 'header' : 'footer') + (type === 'first' ? 'First' : '');
        if (type === 'default' || type === 'first') out[key] = await hfHtml(path);
      }
    }
    return out;
  };
})();
