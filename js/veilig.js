/* =========================================================
   Inkt (gemaakt door JJ van Schelven) — veilig openen.
   Een document (.inkt, .html, .docx, gedeelde map, koppeling of opslag) kan nooit code uitvoeren:
   scripts, gebeurtenis-attributen (onclick, onerror, ...) en gevaarlijke koppelingen worden verwijderd.
   Anders dan App.sanitize (plakken) blijft alle eigen opmaak van Inkt behouden.
   ========================================================= */
'use strict';

App.cleanDoc = (html) => {
  if (!html || typeof html !== 'string') return '';
  // <template> voert niets uit en laadt geen afbeeldingen, ook niet tijdens het opschonen
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  // svg en math ook weg: documenten gebruiken alleen <img> (vormen en grafieken zijn afbeeldingen)
  const BAD = /^(script|style|link|meta|base|iframe|frame|frameset|object|embed|applet|form|input|button|select|textarea|option|portal|template|slot|noscript|title|head|html|body|dialog|svg|math|foreignobject|animate|animatemotion|animatetransform|set|handler|listener)$/i;
  const URL_ATTR = /^(href|src|xlink:href|action|formaction|poster|background|cite|longdesc|lowsrc|dynsrc|srcset|data|codebase|ping)$/i;
  // De browser haalt tabs, regeleinden en stuurtekens zelf uit een adres ("java\tscript:" wordt javascript:): eerst wij
  const bare = (v) => Array.from(String(v)).filter((ch) => { const c = ch.charCodeAt(0); return !(c <= 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff); }).join('');
  const okHref = (v) => /^(https?:|mailto:|tel:|#)/i.test(v) || !/^[a-z][a-z0-9+.-]*:/i.test(v);
  const okSrc = (v) => /^(data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-icon|avif)[;,]|blob:|https?:)/i.test(v) || !/^[a-z][a-z0-9+.-]*:/i.test(v);
  const ed = App.ed;
  const walk = (root) => {
    Array.from(root.childNodes).forEach((n) => {
      if (n.nodeType === 8) { n.remove(); return; }
      if (n.nodeType !== 1) return;
      const tag = n.localName || '';
      if (BAD.test(tag)) { n.remove(); return; }
      Array.from(n.attributes).forEach((a) => {
        const name = a.name.toLowerCase(), v = a.value;
        if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'autofocus' || name === 'is' || name === 'name' || name === 'ping' || name === 'autoplay') { n.removeAttribute(a.name); return; }
        if (URL_ATTR.test(name)) {
          const b = bare(v);
          const ok = name === 'src' || name === 'srcset' || name === 'poster' || name === 'background' ? okSrc(b) : okHref(b);
          if (!ok) n.removeAttribute(a.name); else if (b !== v) n.setAttribute(a.name, b);
          return;
        }
        // id's die een onderdeel van Inkt zelf nabootsen (bv. "dialog-layer") weg: anders kaapt het document de interface
        if (name === 'id') { const ex = document.getElementById(v); if (!v || (ex && !(ed && ex !== ed && ed.contains(ex)))) n.removeAttribute('id'); return; }
        if (name === 'ping' || name === 'autoplay') { n.removeAttribute(a.name); return; }
        // een vast gepositioneerd stuk kan de interface van Inkt afdekken
        if (name === 'style' && /position\s*:\s*fixed/i.test(v)) { n.setAttribute('style', v.replace(/position\s*:\s*fixed\s*(!important)?;?/gi, '')); }
        if (name === 'style' && /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(v)) n.removeAttribute(a.name);
      });
      if (tag === 'a' && n.getAttribute('target')) n.removeAttribute('target');
      walk(n);
    });
  };
  walk(tpl.content);
  // Te diep geneste opmaak (duizenden <b> in elkaar) legt de browser lam: alles dieper dan 40 niveaus wordt platgeslagen
  const deep = []; const tw = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { let d = 0; for (let p = n.parentNode; p && p !== tpl.content; p = p.parentNode) d++; if (d > 40) deep.push(n); }
  deep.forEach((n) => n.replaceWith(...n.childNodes));
  return tpl.innerHTML;
};

// Gegevens van een document (inhoud, kop-/voettekst, opmerkingen) opschonen
App.cleanDocData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data, html: App.cleanDoc(typeof data.html === 'string' ? data.html : '') };
  if (data.title != null) out.title = String(data.title).slice(0, 300);
  const m = data.meta && typeof data.meta === 'object' ? { ...data.meta } : null;
  if (m) {
    ['header', 'footer', 'headerFirst', 'footerFirst', 'headerEven', 'footerEven'].forEach((k) => { if (k in m) m[k] = App.cleanDoc(typeof m[k] === 'string' ? m[k] : ''); });
    const str = (x) => (x == null ? '' : String(x));
    // pagina-instelling: alleen bekende formaten en marges tussen 0 en 10 cm; de rest vult loadDoc met de standaard
    if (m.page && typeof m.page === 'object') {
      const p = { ...m.page };
      if (!(App.PAGE_SIZES && App.PAGE_SIZES[p.size])) delete p.size;
      if (p.orient !== 'portrait' && p.orient !== 'landscape') delete p.orient;
      if (p.margins && typeof p.margins === 'object') { const mg = {}; ['t', 'b', 'l', 'r'].forEach((k) => { const v = Number(p.margins[k]); if (Number.isFinite(v)) mg[k] = Math.min(10, Math.max(0, v)); }); p.margins = mg; } else delete p.margins;
      m.page = p;
    } else delete m.page;
    if (Array.isArray(m.comments)) m.comments = m.comments.filter((c) => c && typeof c === 'object').map((c) => ({ ...c, id: str(c.id).replace(/[^\w-]/g, ''), text: str(c.text), author: str(c.author), replies: Array.isArray(c.replies) ? c.replies.filter((r) => r && typeof r === 'object').map((r) => ({ ...r, text: str(r.text), author: str(r.author) })) : [] }));
    else delete m.comments;
    out.meta = m;
  }
  return out;
};

(() => {
  // Elke manier van laden gaat door het filter
  const origLoad = App.loadDoc;
  App.loadDoc = (data) => origLoad(App.cleanDocData(data));
  // Ook bij lezen (vergelijken, combineren, invoegen uit bestand)
  const origRead = App.fileToDoc;
  App.fileToDoc = async (file) => App.cleanDocData(await origRead(file));
})();

// Koppelingen uit een document: alleen webpagina's en e-mail
App.openLink = (href) => {
  let u; try { u = new URL(href, location.href); } catch { return; }
  if (!/^(https?|mailto):$/.test(u.protocol)) { App.toast(App.t ? App.t('Deze koppeling kan om veiligheidsredenen niet worden geopend.') : 'Deze koppeling kan om veiligheidsredenen niet worden geopend.', 'block'); return; }
  window.open(u.href, '_blank', 'noopener');
};
