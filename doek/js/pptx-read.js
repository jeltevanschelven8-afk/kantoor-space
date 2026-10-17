/* =========================================================
   Doek (gemaakt door JJ van Schelven) — .pptx lezen: PresentationML → Doek-model.
   Masters met thema's, indelingen, dia's, tekst met overerving, vormen en eigen geometrie,
   afbeeldingen, video en audio, tabellen, grafieken, groepen, SmartArt (tekening), overgangen,
   animaties, notities, opmerkingen, secties en aangepaste voorstellingen.
   Een .pptx is onbetrouwbaar: alleen bekende onderdelen worden gelezen, media alleen als
   afbeelding/video/geluid, en alles gaat daarna door App.deserializePres. Nooit innerHTML.
   ========================================================= */
'use strict';

(() => {
  const X = App.Pptx;
  const px = X.px;
  const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
  const clamp = X.clamp;

  /* ---------- XML lezen (op lokale naam, dus los van voorvoegsels) ---------- */
  const kids = (el, name) => { const out = []; if (!el) return out; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) out.push(c); return out; };
  const kid = (el, name) => { if (!el) return null; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; };
  const path = (el, ...names) => { for (const n of names) { el = kid(el, n); if (!el) return null; } return el; };
  const at = (el, n) => (el && el.hasAttribute(n) ? el.getAttribute(n) : null);
  const num = (el, n, d) => { const v = at(el, n); if (v === null || v === '') return d; const x = Number(v); return Number.isFinite(x) ? x : d; };
  const bool = (el, n, d) => { const v = at(el, n); return v === null ? d : v === '1' || v === 'true' || v === 'on'; };
  const rid = (el, n) => (el ? el.getAttributeNS(X.NS.r, n) || el.getAttributeNS(X.R_STRICT, n) || el.getAttribute('r:' + n) || null : null);
  const all = (el, name) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : []);
  const txt = (el) => (el ? el.textContent || '' : '');
  const strip = (o) => { Object.keys(o).forEach((k) => { if (o[k] === undefined) delete o[k]; }); return o; };
  const pick = (v, list) => (list.includes(v) ? v : undefined);

  /* ---------- Het pakket ---------- */
  const mk = (zip) => {
    const names = new Map();
    Object.keys(zip.files).forEach((n) => { if (!zip.files[n].dir) names.set(n.toLowerCase(), n); });
    return { zip, names, notes: [], xml: new Map(), rels: new Map(), media: new Map(), themes: new Map(), slideByPath: new Map(), slideBySldId: new Map(), slideIds: [], showIds: new Map(), layoutByPath: new Map(), masterCtx: new Map(), authors: new Map(), hf: [], defOther: [] };
  };
  // Melding (Nederlands; file.js vertaalt bij het tonen)
  const note = (R, s, ...a) => { const t = a.reduce((x, v, i) => x.replace('{' + i + '}', String(v)), s); if (!R.notes.includes(t)) R.notes.push(t); };
  const fileOf = (R, p) => { const n = R.names.get(String(p || '').replace(/^\//, '').toLowerCase()); return n ? R.zip.files[n] : null; };
  const sizeOf = (f) => (f && f._data && Number.isFinite(f._data.uncompressedSize) ? f._data.uncompressedSize : 0);
  const MAX_XML = 64 * 1024 * 1024;
  const readXml = async (R, p) => {
    const key = String(p || '').toLowerCase();
    if (R.xml.has(key)) return R.xml.get(key);
    let root = null;
    const f = fileOf(R, p);
    if (f) {
      try {
        if (sizeOf(f) > MAX_XML) throw new Error('te groot');
        const s = (await f.async('string')).replace(/^﻿/, '');
        if (/<!DOCTYPE/i.test(s)) throw new Error('DOCTYPE');   // OOXML heeft nooit een DTD (geen entiteiten)
        const doc = new DOMParser().parseFromString(s, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error('XML');
        root = doc.documentElement;
      } catch (e) { note(R, 'Een onderdeel van het bestand is beschadigd en is overgeslagen: {0}', String(p).split('/').pop()); root = null; }
    }
    R.xml.set(key, root);
    return root;
  };
  const resolve = (dir, t) => {
    let s = String(t || '').replace(/\\/g, '/');
    try { s = decodeURIComponent(s); } catch { /* laten zoals het is */ }
    const out = [];
    (s.startsWith('/') ? s.slice(1) : dir + s).split('/').forEach((x) => { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return out.join('/');
  };
  // Relaties van een onderdeel: rId → { type (laatste deel), full, ext, raw, target (absoluut pad) }
  const relsOf = async (R, p) => {
    const key = String(p).toLowerCase();
    if (R.rels.has(key)) return R.rels.get(key);
    const map = new Map();
    const i = p.lastIndexOf('/'), dir = p.slice(0, i + 1);
    const root = await readXml(R, dir + '_rels/' + p.slice(i + 1) + '.rels');
    kids(root, 'Relationship').forEach((r) => {
      const type = at(r, 'Type') || '', raw = at(r, 'Target') || '', ext = at(r, 'TargetMode') === 'External';
      map.set(at(r, 'Id'), { type: type.slice(type.lastIndexOf('/') + 1), full: type, ext, raw, target: ext ? raw : resolve(dir, raw) });
    });
    R.rels.set(key, map);
    return map;
  };
  const relOfType = (rels, type, test) => { for (const r of rels.values()) if (r.type === type && (!test || test(r))) return r; return null; };

  /* ---------- Media: alleen afbeeldingen, video en geluid ---------- */
  const IMG = /^image\/(png|jpeg|gif|bmp|webp|svg\+xml)$/, VID = /^video\/(mp4|webm)$/, AUD = /^audio\/(mpeg|wav|mp4|ogg)$/;
  const asc = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
  const sniff = (b) => {
    if (b.length < 4) return null;
    if (b[0] === 0x89 && asc(b, 1, 3) === 'PNG') return 'image/png';
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (asc(b, 0, 4) === 'GIF8') return 'image/gif';
    if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
    if (asc(b, 0, 4) === 'RIFF' && asc(b, 8, 4) === 'WEBP') return 'image/webp';
    if (asc(b, 0, 4) === 'RIFF' && asc(b, 8, 4) === 'WAVE') return 'audio/wav';
    if (asc(b, 4, 4) === 'ftyp') return /^M4[AB] /.test(asc(b, 8, 4)) ? 'audio/mp4' : 'video/mp4';
    if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'video/webm';
    if (asc(b, 0, 4) === 'OggS') return 'audio/ogg';
    if (asc(b, 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'audio/mpeg';
    if ((b[0] === 0xD7 && b[1] === 0xCD && b[2] === 0xC6 && b[3] === 0x9A) || (b[0] === 1 && b[1] === 0 && b[2] === 0 && b[3] === 0 && asc(b, 40, 4) === ' EMF')) return 'image/x-wmf';
    if (asc(b, 0, 4) === 'II*\u0000' || asc(b, 0, 4) === 'MM\u0000*') return 'image/tiff';
    const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 4096)).replace(/^﻿/, '').trimStart();
    if (head[0] === '<' && /<svg[\s>]/i.test(head)) return 'image/svg+xml';
    return null;
  };
  // Natuurlijke afmetingen uit de kop van het bestand (zonder te decoderen)
  const imgSize = (b, mime) => {
    try {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (mime === 'image/png') return { w: dv.getUint32(16), h: dv.getUint32(20) };
      if (mime === 'image/gif') return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
      if (mime === 'image/bmp') return { w: Math.abs(dv.getInt32(18, true)), h: Math.abs(dv.getInt32(22, true)) };
      if (mime === 'image/jpeg') {
        let i = 2;
        while (i + 9 < b.length) {
          if (b[i] !== 0xFF) { i++; continue; }
          const m = b[i + 1], len = dv.getUint16(i + 2);
          if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) };
          i += 2 + len;
        }
      }
      if (mime === 'image/webp') {
        const k = asc(b, 12, 4);
        if (k === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3FFF, h: dv.getUint16(28, true) & 0x3FFF };
        if (k === 'VP8L') { const v = dv.getUint32(21, true); return { w: (v & 0x3FFF) + 1, h: ((v >> 14) & 0x3FFF) + 1 }; }
        if (k === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      }
      if (mime === 'image/svg+xml') {
        const s = new TextDecoder().decode(b.subarray(0, 8192));
        const tag = /<svg[^>]*>/i.exec(s);
        if (tag) {
          const w = /\swidth\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag[0]), h = /\sheight\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag[0]);
          if (w && h) return { w: +w[1], h: +h[1] };
          const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag[0]);
          if (vb) return { w: +vb[1], h: +vb[2] };
        }
      }
    } catch { /* onbekend */ }
    return null;
  };
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32766) s += btoa(String.fromCharCode.apply(null, u8.subarray(i, i + 32766))); return s; };
  // Mediabestand uit een relatie → id in App.media (of null, met een melding)
  const loadMedia = async (R, rel, want) => {
    if (!rel) return null;
    const nm = String(rel.raw || rel.target || '').split('/').pop();
    if (rel.ext) { note(R, want === 'image' ? 'Gekoppelde (externe) afbeeldingen zijn niet overgenomen.' : 'Gekoppelde (externe) media zijn niet overgenomen: {0}', nm); return null; }
    const key = rel.target.toLowerCase() + '|' + want;
    if (R.media.has(key)) return R.media.get(key);
    let id = null;
    try {
      const f = fileOf(R, rel.target);
      if (!f) throw new Error('ontbreekt');
      if (sizeOf(f) > X.MAX_MEDIA) note(R, 'Een mediabestand is groter dan 300 MB en is weggelaten: {0}', nm);
      else {
        const u8 = await f.async('uint8array');
        let mime = sniff(u8);
        if (want === 'audio' && mime === 'video/mp4') mime = 'audio/mp4';
        if (want === 'video' && mime === 'audio/mp4') mime = 'video/mp4';
        const ok = want === 'image' ? IMG.test(mime || '') : want === 'video' ? VID.test(mime || '') : AUD.test(mime || '');
        if (!ok) {
          if (mime === 'image/x-wmf' || mime === 'image/tiff') note(R, 'Afbeeldingen in EMF-, WMF- of TIFF-formaat kunnen niet worden weergegeven en zijn weggelaten.');
          else note(R, 'Dit bestandstype wordt niet ondersteund en is weggelaten: {0}', nm);
        } else {
          const nat = want === 'image' ? imgSize(u8, mime) : null;
          id = App.addMedia(`data:${mime};base64,${b64(u8)}`, mime, nm, nat && nat.w > 0 && nat.h > 0 ? { nat } : {});
        }
      }
    } catch (e) { note(R, 'Een mediabestand kon niet worden gelezen: {0}', nm); id = null; }
    R.media.set(key, id);
    return id;
  };

  /* ---------- Kleuren ---------- */
  const COLOR_TAGS = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr']);
  const colorEl = (el) => { if (!el) return null; if (COLOR_TAGS.has(el.localName)) return el; for (const c of kids(el)) if (COLOR_TAGS.has(c.localName)) return c; return null; };
  const hex6 = (v) => (/^[0-9a-f]{6}$/i.test(v || '') ? '#' + v.toLowerCase() : null);
  // kleurbewerkingen (lumMod, tint, …) toepassen op '#rrggbb'
  const applyMods = (hex, mods) => {
    let [r, g, b] = App.hexToRgb(hex);
    const hsl = (fn) => { const [H, S, L] = App.rgbToHsl(r, g, b); const [h2, s2, l2] = fn(H, S, L); [r, g, b] = App.hslToRgb(((h2 % 1) + 1) % 1, clamp(s2, 0, 1), clamp(l2, 0, 1)); };
    for (const m of mods) {
      const v = num(m, 'val', 0) / 100000;
      switch (m.localName) {
        case 'lumMod': hsl((H, S, L) => [H, S, L * v]); break;
        case 'lumOff': hsl((H, S, L) => [H, S, L + v]); break;
        case 'satMod': hsl((H, S, L) => [H, S * v, L]); break;
        case 'satOff': hsl((H, S, L) => [H, S + v, L]); break;
        case 'hueMod': hsl((H, S, L) => [H * v, S, L]); break;
        case 'hueOff': hsl((H, S, L) => [H + num(m, 'val', 0) / 21600000, S, L]); break;
        case 'tint': r = r * v + 255 * (1 - v); g = g * v + 255 * (1 - v); b = b * v + 255 * (1 - v); break;
        case 'shade': r *= v; g *= v; b *= v; break;
        case 'comp': hsl((H, S, L) => [H + 0.5, S, L]); break;
        case 'inv': r = 255 - r; g = 255 - g; b = 255 - b; break;
        case 'gray': { const y = 0.3 * r + 0.59 * g + 0.11 * b; r = g = b = y; break; }
        case 'red': r = v * 255; break; case 'green': g = v * 255; break; case 'blue': b = v * 255; break;
        case 'redMod': r *= v; break; case 'greenMod': g *= v; break; case 'blueMod': b *= v; break;
        case 'redOff': r += v * 255; break; case 'greenOff': g += v * 255; break; case 'blueOff': b += v * 255; break;
        default: break;
      }
    }
    return App.rgbToHex(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
  };
  // { ref: ColorRef, alpha } uit een kleurelement (of een element met een kleur erin); C.map = schemeClr → Doek-sleutel
  const colorOf = (el, C) => {
    const c = colorEl(el);
    if (!c) return null;
    let base = null, slot = null, alpha = 1;
    const v = at(c, 'val');
    switch (c.localName) {
      case 'srgbClr': base = hex6(v) || '#000000'; break;
      case 'sysClr': base = hex6(at(c, 'lastClr')) || (/^(window|btnHighlight|highlightText|menu)$/.test(v || '') ? '#ffffff' : '#000000'); break;
      case 'prstClr': base = X.namedColor(v); break;
      case 'scrgbClr': { const g = (x) => { x = clamp(x / 100000, 0, 1); return (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255; }; base = App.rgbToHex(g(num(c, 'r', 0)), g(num(c, 'g', 0)), g(num(c, 'b', 0))); break; }
      case 'hslClr': base = App.rgbToHex(...App.hslToRgb(num(c, 'hue', 0) / 21600000, clamp(num(c, 'sat', 0) / 100000, 0, 1), clamp(num(c, 'lum', 0) / 100000, 0, 1))); break;
      default: {   // schemeClr
        if (v === 'phClr') {
          const ph = C && C.phClr;
          if (!ph) { base = '#000000'; break; }
          if (ph.alpha !== undefined) alpha = ph.alpha;
          if (ph.ref[0] === '#' || ph.ref.includes('/')) base = App.color(ph.ref, C.theme); else slot = ph.ref;
          break;
        }
        const s = (C && C.map && C.map[v]) || null;
        if (s && s[0] === '#') base = s; else if (s) slot = s; else base = '#000000';
      }
    }
    const mods = kids(c);
    let lumMod = null, lumOff = null, other = false;
    for (const m of mods) {
      const mv = num(m, 'val', 0);
      if (m.localName === 'alpha') alpha *= mv / 100000;
      else if (m.localName === 'alphaMod') alpha *= mv / 100000;
      else if (m.localName === 'alphaOff') alpha += mv / 100000;
      else if (m.localName === 'lumMod' && lumMod === null) lumMod = mv;
      else if (m.localName === 'lumOff' && lumOff === null) lumOff = mv;
      else other = true;
    }
    const colorMods = mods.filter((m) => !/^alpha/.test(m.localName));
    let ref = null;
    if (slot && !other) {
      const m = lumMod === null ? 100000 : lumMod, o = lumOff === null ? 0 : lumOff;
      if (lumMod === null && lumOff === null) ref = slot;
      else if (o === 0 && m < 100000 && (100000 - m) % 1000 === 0) ref = slot + '/d' + (100 - m / 1000);
      else if (o > 0 && m + o === 100000 && o % 1000 === 0 && o <= 100000) ref = slot + '/l' + o / 1000;
    }
    if (!ref) ref = colorMods.length ? applyMods(base || App.color(slot, C.theme), colorMods) : base || App.color(slot, C.theme);
    alpha = clamp(alpha, 0, 1);
    return alpha < 0.9995 ? { ref, alpha: Math.round(alpha * 1000) / 1000 } : { ref };
  };

  /* ---------- Opvulling, lijn en effecten ---------- */
  const FILL_TAGS = new Set(['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill']);
  const solid = (k) => strip({ type: 'solid', color: k.ref, alpha: k.alpha });
  const gradOf = (g, C) => {
    const stops = kids(kid(g, 'gsLst'), 'gs').map((s) => { const k = colorOf(s, C) || { ref: '#000000' }; return strip({ p: clamp(num(s, 'pos', 0) / 100000, 0, 1), color: k.ref, alpha: k.alpha }); }).sort((a, b) => a.p - b.p);
    if (stops.length < 2) return stops.length ? strip({ type: 'solid', color: stops[0].color, alpha: stops[0].alpha }) : { type: 'solid', color: 'accent1' };
    const lin = kid(g, 'lin'), pth = kid(g, 'path');
    if (pth) {
      const kind = at(pth, 'path') === 'rect' ? 'rect' : at(pth, 'path') === 'shape' ? 'path' : 'radial';
      const r = kid(pth, 'fillToRect');
      const o = { type: 'grad', kind, stops };
      if (r) { const cx = (num(r, 'l', 0) / 100000 + 1 - num(r, 'r', 0) / 100000) / 2, cy = (num(r, 't', 0) / 100000 + 1 - num(r, 'b', 0) / 100000) / 2; if (Math.abs(cx - 0.5) > 0.001 || Math.abs(cy - 0.5) > 0.001) { o.cx = r3(clamp(cx, 0, 1)); o.cy = r3(clamp(cy, 0, 1)); } }
      return o;
    }
    return { type: 'grad', kind: 'linear', angle: lin ? r3(X.deg(num(lin, 'ang', 0))) : 90, stops };
  };
  // Eén opvulelement (zonder afbeelding) → Fill
  const fillEl = (c, C) => {
    switch (c && c.localName) {
      case 'noFill': return { type: 'none' };
      case 'solidFill': { const k = colorOf(c, C); return k ? solid(k) : { type: 'solid', color: 'accent1' }; }
      case 'gradFill': return gradOf(c, C);
      case 'pattFill': return { type: 'pattern', pat: /^[A-Za-z0-9]{1,20}$/.test(at(c, 'prst') || '') ? at(c, 'prst') : 'pct50', fg: (colorOf(kid(c, 'fgClr'), C) || { ref: 'tx1' }).ref, bg: (colorOf(kid(c, 'bgClr'), C) || { ref: 'bg1' }).ref };
      case 'grpFill': return C.grpFill ? App.clone(C.grpFill) : undefined;
      case 'blipFill': return C.phClr ? solid(C.phClr) : undefined;
      default: return undefined;
    }
  };
  // Opvulling van een element (spPr, bgPr, tcPr): het eerste opvulkind; afbeeldingen asynchroon
  const fillOf = async (parent, C) => {
    for (const c of kids(parent)) {
      if (!FILL_TAGS.has(c.localName)) continue;
      if (c.localName !== 'blipFill') return fillEl(c, C);
      const blip = kid(c, 'blip');
      const media = blip ? await blipMedia(blip, C) : null;
      if (!media) return { type: 'solid', color: 'bg2' };
      const tile = kid(c, 'tile');
      const o = { type: 'img', media, mode: tile ? 'tile' : 'stretch' };
      const am = kid(blip, 'alphaModFix'); if (am) o.alpha = clamp(num(am, 'amt', 100000) / 100000, 0, 1);
      if (tile) { const sx = num(tile, 'sx', 100000) / 100000, sy = num(tile, 'sy', 100000) / 100000; if (sx !== 1) o.sx = r3(clamp(sx, 0.01, 100)); if (sy !== 1) o.sy = r3(clamp(sy, 0.01, 100)); }
      return o;
    }
    return undefined;
  };
  // Afbeelding van een a:blip (svg heeft voorrang boven de png-terugval)
  const blipMedia = async (blip, C) => {
    for (const e of kids(kid(blip, 'extLst'), 'ext')) {
      const s = kid(e, 'svgBlip');
      if (s) { const id = await loadMedia(C.R, C.rels.get(rid(s, 'embed')), 'image'); if (id) return id; }
    }
    const emb = rid(blip, 'embed'), lnk = rid(blip, 'link');
    if (emb) return loadMedia(C.R, C.rels.get(emb), 'image');
    if (lnk) note(C.R, 'Gekoppelde (externe) afbeeldingen zijn niet overgenomen.');
    return null;
  };
  const DASH = { solid: 'solid', dot: 'sysDot', dash: 'dash', lgDash: 'lgDash', dashDot: 'dashDot', lgDashDot: 'lgDashDot', lgDashDotDot: 'lgDashDotDot', sysDash: 'sysDash', sysDot: 'sysDot', sysDashDot: 'sysDashDot', sysDashDotDot: 'sysDashDotDot' };
  const ARROWS = ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'], SZ = ['sm', 'med', 'lg'];
  // a:ln → Line; base = lijn uit de vormstijl (lnRef), waar de eigen lijn op voortbouwt
  const lineOf = (ln, C, base) => {
    if (!ln) return base ? App.clone(base) : undefined;
    const out = base && base.type === 'solid' ? App.clone(base) : { type: 'solid', color: 'tx1', w: 0.75 };
    let filled = !!(base && base.type === 'solid');
    for (const c of kids(ln)) {
      switch (c.localName) {
        case 'noFill': return { type: 'none' };
        case 'solidFill': { const k = colorOf(c, C); if (k) { out.color = k.ref; out.alpha = k.alpha; } filled = true; break; }
        case 'gradFill': { const g = gradOf(c, C); const s = g.stops ? g.stops[0] : g; out.color = s.color; out.alpha = s.alpha; filled = true; break; }
        case 'pattFill': { const k = colorOf(kid(c, 'fgClr'), C); if (k) out.color = k.ref; filled = true; break; }
        case 'prstDash': out.dash = DASH[at(c, 'val')] || 'solid'; break;
        case 'custDash': out.dash = 'dash'; break;
        case 'round': case 'bevel': case 'miter': out.join = c.localName; break;
        case 'headEnd': case 'tailEnd': {
          const t = pick(at(c, 'type'), ARROWS) || 'none';
          const k = c.localName === 'headEnd' ? 'head' : 'tail';
          if (t === 'none') delete out[k]; else out[k] = strip({ type: t, w: pick(at(c, 'w'), SZ), len: pick(at(c, 'len'), SZ) });
          break;
        }
        default: break;
      }
    }
    if (!filled) return { type: 'none' };   // a:ln zonder opvulling en zonder stijl: geen zichtbare lijn
    if (at(ln, 'w') !== null) out.w = X.lnPt(num(ln, 'w', 9525));
    const cap = { flat: 'flat', rnd: 'rnd', sq: 'sq' }[at(ln, 'cap')]; if (cap) out.cap = cap;
    const cmpd = pick(at(ln, 'cmpd'), ['sng', 'dbl', 'thickThin', 'thinThick', 'tri']); if (cmpd) out.cmpd = cmpd;
    return strip(out);
  };
  const angDeg = (v) => { const d = X.deg(v) % 360; return d > 180 ? r3(d - 360) : r3(d); };
  // effectLst + scene3d/sp3d → Effects; base = effecten uit de vormstijl
  const fxOf = (spPr, C, base) => {
    const out = base ? App.clone(base) : {};
    const lst = kid(spPr, 'effectLst');
    if (lst) {
      ['shadow', 'glow', 'soft', 'refl'].forEach((k) => delete out[k]);
      for (const e of kids(lst)) {
        switch (e.localName) {
          case 'outerShdw': case 'innerShdw': case 'prstShdw': {
            const k = colorOf(e, C) || { ref: '#000000' };
            out.shadow = { type: e.localName === 'innerShdw' ? 'inner' : 'outer', color: k.ref, alpha: k.alpha === undefined ? 1 : k.alpha, blur: px(num(e, 'blurRad', 0)), dist: px(num(e, 'dist', 0)), dir: r3(X.deg(num(e, 'dir', 0))) };
            break;
          }
          case 'glow': { const k = colorOf(e, C) || { ref: 'accent1' }; out.glow = { color: k.ref, alpha: k.alpha === undefined ? 1 : k.alpha, size: px(num(e, 'rad', 0)) }; break; }
          case 'softEdge': { const s = px(num(e, 'rad', 0)); if (s > 0) out.soft = s; break; }
          case 'reflection': out.refl = { alpha: r3(clamp(num(e, 'stA', 100000) / 100000, 0, 1)), size: r3(clamp(num(e, 'endPos', 100000) / 100000, 0, 1)), dist: px(num(e, 'dist', 0)), blur: px(num(e, 'blurRad', 0)) }; break;
          default: break;
        }
      }
    }
    const rot = path(spPr, 'scene3d', 'camera', 'rot');
    if (rot) { const x = angDeg(num(rot, 'lat', 0)), y = angDeg(num(rot, 'lon', 0)); if (x || y) { const fov = num(path(spPr, 'scene3d', 'camera'), 'fov', 0); out.rot3d = { x, y, persp: fov ? clamp(Math.round(500 / Math.tan((fov / 60000 / 2) * Math.PI / 180)), 50, 20000) : 900 }; } }
    const bev = path(spPr, 'sp3d', 'bevelT');
    if (bev) out.bevel = { type: /^[A-Za-z]{1,20}$/.test(at(bev, 'prst') || '') ? at(bev, 'prst') : 'circle', w: px(num(bev, 'w', 76200)), h: px(num(bev, 'h', 76200)) };
    return Object.keys(out).length ? out : undefined;
  };
  // p:style (lnRef/fillRef/effectRef/fontRef) → { fill, line, fx, font: { idx, color } } via de opmaak van het thema
  const styleOf = (st, C) => {
    const out = {};
    if (!st) return out;
    const ref = (n) => { const r = kid(st, n); return r ? { idx: at(r, 'idx'), k: colorOf(r, C) } : null; };
    const F = C.fmt || { fill: [], ln: [], effect: [], bg: [] };
    const fr = ref('fillRef'), lr = ref('lnRef'), er = ref('effectRef'), tr = ref('fontRef');
    if (fr) {
      const i = Number(fr.idx) || 0;
      if (i === 0) out.fill = { type: 'none' };
      else { const el = i >= 1001 ? F.bg[i - 1001] : F.fill[i - 1]; out.fill = (el && fillEl(el, { ...C, phClr: fr.k })) || (fr.k ? solid(fr.k) : undefined); }
    }
    if (lr) {
      const i = Number(lr.idx) || 0;
      if (i === 0) out.line = { type: 'none' };
      else { const el = F.ln[i - 1]; out.line = el ? lineOf(el, { ...C, phClr: lr.k }, lr.k ? { type: 'solid', ...solid(lr.k), w: 0.75 } : undefined) : lr.k ? { ...solid(lr.k), w: 0.75 } : undefined; }
    }
    if (er) { const i = Number(er.idx) || 0; const el = i > 0 ? F.effect[i - 1] : null; if (el) out.fx = fxOf(el, { ...C, phClr: er.k }); }
    if (tr) out.font = { idx: tr.idx, color: tr.k ? tr.k.ref : null };
    return out;
  };

  /* ---------- Tekst ---------- */
  const ALIGN = { l: 'l', ctr: 'ctr', r: 'r', just: 'just', dist: 'dist', justLow: 'just', thaiDist: 'dist' };
  const fontName = (t) => (!t ? null : /^\+mj/.test(t) ? '+mj' : /^\+mn/.test(t) ? '+mn' : t);
  const JUMP = { firstslide: 'first', lastslide: 'last', nextslide: 'next', previousslide: 'prev', endshow: 'end', lastslideviewed: 'lastViewed' };
  const linkOf = (h, C) => {
    if (!h) return undefined;
    const action = at(h, 'action') || '';
    const id = rid(h, 'id'), rel = id ? C.rels.get(id) : null;
    if (/^ppaction:\/\/hlinkshowjump/i.test(action)) { const m = /jump=([a-z]+)/i.exec(action); const k = m && JUMP[m[1].toLowerCase()]; return k ? { kind: k } : undefined; }
    if (/^ppaction:\/\/hlinksldjump/i.test(action) || (rel && !rel.ext && rel.type === 'slide')) { const s = rel && C.R.slideByPath.get(rel.target.toLowerCase()); return s ? { kind: 'slide', slide: s } : undefined; }
    if (/^ppaction:\/\/customshow/i.test(action)) { const m = /id=(\d+)/i.exec(action); const s = m && C.R.showIds.get(m[1]); return s ? strip({ kind: 'show', show: s, ret: /return=true/i.test(action) || undefined }) : undefined; }
    if (/^ppaction:\/\/(media|noaction)/i.test(action)) return undefined;
    if (rel && rel.ext && /^(https?:|mailto:)/i.test(rel.raw.trim())) return { kind: 'url', url: rel.raw.trim() };
    if (action || (rel && rel.ext)) note(C.R, 'Koppelingen naar programma\'s, macro\'s of bestanden zijn weggelaten.');
    return undefined;
  };
  const runProps = (rPr, C) => {
    const o = {};
    if (!rPr) return o;
    if (at(rPr, 'sz') !== null) o.sz = clamp(num(rPr, 'sz', 1800) / 100, 1, 4000);
    if (at(rPr, 'b') !== null) o.b = bool(rPr, 'b');
    if (at(rPr, 'i') !== null) o.i = bool(rPr, 'i');
    const u = at(rPr, 'u'); if (u && /^[A-Za-z]{1,20}$/.test(u)) o.u = u;
    const s = at(rPr, 'strike'); if (s) o.s = s === 'sngStrike' ? 'sng' : s === 'dblStrike' ? 'dbl' : 'noStrike';
    if (at(rPr, 'baseline') !== null && num(rPr, 'baseline', 0)) o.base = r3(num(rPr, 'baseline', 0) / 1000);
    const cap = at(rPr, 'cap'); if (cap === 'all' || cap === 'small') o.caps = cap;
    if (at(rPr, 'spc') !== null && num(rPr, 'spc', 0)) o.spc = num(rPr, 'spc', 0) / 100;
    if (at(rPr, 'kern') !== null) o.kern = num(rPr, 'kern', 0) / 100;
    const lang = at(rPr, 'lang'); if (lang && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang)) o.lang = lang;
    for (const c of kids(rPr)) {
      switch (c.localName) {
        case 'solidFill': { const k = colorOf(c, C); if (k) { o.color = k.ref; if (k.alpha !== undefined) o.alpha = k.alpha; } break; }
        case 'gradFill': o.fill = gradOf(c, C); break;
        case 'noFill': o.fill = { type: 'none' }; break;
        case 'pattFill': { const k = colorOf(kid(c, 'fgClr'), C); if (k) o.color = k.ref; break; }
        case 'ln': { const l = lineOf(c, C); if (l && l.type !== 'none') o.ln = l; break; }
        case 'effectLst': { const fx = fxOf(rPr, C); if (fx) o.fx = fx; break; }
        case 'highlight': { const k = colorOf(c, C); if (k) o.hl = k.ref; break; }
        case 'latin': { const f = fontName(at(c, 'typeface')); if (f) o.font = f; break; }
        case 'hlinkClick': { const l = linkOf(c, C); if (l) o.link = l; break; }
        default: break;
      }
    }
    return o;
  };
  const spcOf = (el) => { const p = kid(el, 'spcPts'), q = kid(el, 'spcPct'); return p ? num(p, 'val', 0) / 100 : q ? r3(num(q, 'val', 0) / 100000 * 18 * 1.2) : undefined; };
  const bulletOf = (pPr, C) => {
    let type = null;
    const b = {};
    for (const c of kids(pPr)) {
      switch (c.localName) {
        case 'buNone': type = 'none'; break;
        case 'buChar': type = 'char'; b.char = (at(c, 'char') || '•').slice(0, 2); break;
        case 'buAutoNum': type = 'auto'; b.scheme = /^[A-Za-z]{1,30}$/.test(at(c, 'type') || '') ? at(c, 'type') : 'arabicPeriod'; if (at(c, 'startAt') !== null) b.start = clamp(num(c, 'startAt', 1) | 0, 1, 32767); break;
        case 'buBlip': type = 'char'; b.char = '•'; break;
        case 'buClr': { const k = colorOf(c, C); if (k) b.color = k.ref; break; }
        case 'buSzPct': b.sz = r3(clamp(num(c, 'val', 100000) / 100000, 0.25, 4)); break;
        case 'buFont': { const f = fontName(at(c, 'typeface')); if (f) b.font = f; break; }
        default: break;
      }
    }
    if (!type) return undefined;
    if (type === 'none') return { type: 'none' };
    if (type === 'auto') delete b.font;
    return strip({ type, ...b });
  };
  const paraProps = (pPr, C) => {
    const o = {};
    if (!pPr) return o;
    const al = at(pPr, 'algn'); if (al) o.align = ALIGN[al] || 'l';
    if (at(pPr, 'lvl') !== null) o.lvl = clamp(num(pPr, 'lvl', 0) | 0, 0, 8);
    if (at(pPr, 'marL') !== null) o.marL = px(num(pPr, 'marL', 0));
    if (at(pPr, 'indent') !== null) o.indent = px(num(pPr, 'indent', 0));
    if (bool(pPr, 'rtl')) o.rtl = true;
    const ls = kid(pPr, 'lnSpc');
    if (ls) { const p = kid(ls, 'spcPts'), q = kid(ls, 'spcPct'); if (p) o.lnSpc = { pt: num(p, 'val', 1200) / 100 }; else if (q) o.lnSpc = { pct: r3(num(q, 'val', 100000) / 100000) }; }
    const sb = kid(pPr, 'spcBef'); if (sb) { const v = spcOf(sb); if (v !== undefined) o.spcBef = v; }
    const sa = kid(pPr, 'spcAft'); if (sa) { const v = spcOf(sa); if (v !== undefined) o.spcAft = v; }
    const bu = bulletOf(pPr, C); if (bu) o.bullet = bu;
    const tl = kid(pPr, 'tabLst');
    if (tl) { const t = kids(tl, 'tab').map((x) => ({ pos: px(num(x, 'pos', 0)), algn: pick(at(x, 'algn'), ['l', 'ctr', 'r', 'dec']) || 'l' })); if (t.length) o.tabs = t; }
    return o;
  };
  const lvlOf = (el, C) => { const o = { ...paraProps(el, C), ...runProps(kid(el, 'defRPr'), C) }; delete o.lvl; delete o.link; return o; };
  const lstOf = (lst, C) => {
    if (!lst) return undefined;
    const o = {};
    for (let i = 1; i <= 9; i++) { const l = kid(lst, `lvl${i}pPr`); if (l) { const v = lvlOf(l, C); delete v.lang; if (Object.keys(v).length) o[i - 1] = v; } }
    return Object.keys(o).length ? o : undefined;
  };
  const bodyPropsOf = (bp) => {
    const o = {};
    if (!bp) return o;
    const an = at(bp, 'anchor'); if (an) o.vAlign = an === 'ctr' ? 'ctr' : an === 'b' ? 'b' : 't';
    if (['lIns', 'tIns', 'rIns', 'bIns'].some((k) => at(bp, k) !== null)) o.ins = { l: px(num(bp, 'lIns', 91440)), t: px(num(bp, 'tIns', 45720)), r: px(num(bp, 'rIns', 91440)), b: px(num(bp, 'bIns', 45720)) };
    const wr = at(bp, 'wrap'); if (wr) o.wrap = wr !== 'none';
    const nc = num(bp, 'numCol', 1); if (nc > 1) o.cols = { n: Math.min(16, nc | 0), gap: px(num(bp, 'spcCol', 0)) };
    const v = at(bp, 'vert'); if (v) o.vert = { horz: 'horz', vert: 'vert', vert270: 'vert270', eaVert: 'eaVert', wordArtVert: 'stacked', wordArtVertRtl: 'stacked', mongolianVert: 'vert' }[v] || 'horz';
    if (bool(bp, 'rtlCol')) o.rtl = true;
    for (const c of kids(bp)) {
      if (c.localName === 'normAutofit') {
        o.fit = 'shrink';
        const f = num(c, 'fontScale', 100000), s = num(c, 'lnSpcReduction', 0);
        if (f < 100000 || s > 0) o.scale = { font: r3(clamp(f / 100000, 0.05, 1)), spc: r3(clamp(1 - s / 100000, 0.05, 1)) };
      } else if (c.localName === 'spAutoFit') o.fit = 'resize';
      else if (c.localName === 'noAutofit') o.fit = 'none';
      else if (c.localName === 'prstTxWarp') { const p = at(c, 'prst'); if (p && p !== 'textNoShape' && /^text[A-Za-z0-9]{1,30}$/.test(p)) o.warp = p; }
    }
    return o;
  };
  const parasOf = (txBody, C) => {
    const out = [];
    for (const p of kids(txBody, 'p')) {
      const para = paraProps(kid(p, 'pPr'), C);
      const runs = [];
      const add = (els) => {
        for (const r of els) {
          if (r.localName === 'r') { const run = runProps(kid(r, 'rPr'), C); run.t = txt(kid(r, 't')); runs.push(run); }
          else if (r.localName === 'br') { if (runs.length) runs[runs.length - 1].t += '\v'; else { const run = runProps(kid(r, 'rPr'), C); run.t = '\v'; runs.push(run); } }
          else if (r.localName === 'fld') {
            const run = runProps(kid(r, 'rPr'), C);
            run.t = txt(kid(r, 't'));
            const ty = at(r, 'type') || '';
            if (ty === 'slidenum') run.fld = { type: 'slidenum' }; else if (/^datetime\d{0,2}$/.test(ty)) run.fld = { type: ty === 'datetime' ? 'datetime1' : ty };
            runs.push(run);
          } else if (r.localName === 'AlternateContent') { note(C.R, 'Vergelijkingen in tekst zijn als gewone tekst overgenomen.'); add(kids(kid(r, 'Fallback'))); }
        }
      };
      add(kids(p));
      const end = kid(p, 'endParaRPr');
      if (end) { const e = runProps(end, C); delete e.link; delete e.lang; if (Object.keys(e).length) para.end = e; }
      para.runs = runs.length ? runs : [{ t: '' }];
      out.push(para);
    }
    return out.length ? out : [{ runs: [{ t: '' }] }];
  };
  const bodyOf = (txBody, C) => {
    if (!txBody) return undefined;
    const body = { ...bodyPropsOf(kid(txBody, 'bodyPr')), paras: parasOf(txBody, C) };
    const lst = lstOf(kid(txBody, 'lstStyle'), C);
    if (lst) body.lst = lst;
    return body;
  };

  /* ---------- Geometrie ---------- */
  const xfrmOf = (x) => {
    if (!x) return null;
    const off = kid(x, 'off'), ext = kid(x, 'ext');
    if (!off && !ext) return null;
    const o = { x: px(num(off, 'x', 0)), y: px(num(off, 'y', 0)), w: Math.max(0, px(num(ext, 'cx', 0))), h: Math.max(0, px(num(ext, 'cy', 0))) };
    const rot = r3(X.deg(num(x, 'rot', 0)) % 360); if (rot) o.rot = rot;
    if (bool(x, 'flipH')) o.flipH = true;
    if (bool(x, 'flipV')) o.flipV = true;
    return o;
  };
  const adjOf = (geom) => {
    const o = {};
    for (const g of kids(kid(geom, 'avLst'), 'gd')) { const n = at(g, 'name') || '', m = /^val\s+(-?\d+(\.\d+)?)$/.exec((at(g, 'fmla') || '').trim()); if (/^adj\d{0,2}$/.test(n) && m) o[n] = Number(m[1]); }
    return Object.keys(o).length ? o : undefined;
  };
  // Hulplijnen (gdLst) van eigen geometrie uitrekenen; geeft een functie naam/getal → waarde
  const guides = (cg, w, h) => {
    const v = { w, h, l: 0, t: 0, r: w, b: h, hc: w / 2, vc: h / 2, ss: Math.min(w, h), ls: Math.max(w, h), cd2: 10800000, cd4: 5400000, cd8: 2700000, '3cd4': 16200000, '3cd8': 8100000, '5cd8': 13500000, '7cd8': 18900000 };
    [2, 3, 4, 5, 6, 8, 10, 12, 16, 32].forEach((n) => { v['wd' + n] = w / n; v['hd' + n] = h / n; v['ssd' + n] = v.ss / n; });
    const val = (s) => { if (s === null || s === undefined) return 0; if (s in v) return v[s]; const n = Number(s); return Number.isFinite(n) ? n : 0; };
    const A = Math.PI / 10800000;
    const ev = (f) => {
      const [op, a, b, c] = String(f || 'val 0').trim().split(/\s+/);
      const x = val(a), y = val(b), z = val(c);
      switch (op) {
        case 'val': return x; case '*/': return z ? x * y / z : 0; case '+-': return x + y - z; case '+/': return z ? (x + y) / z : 0;
        case '?:': return x > 0 ? y : z; case 'abs': return Math.abs(x); case 'at2': return Math.atan2(y, x) / A; case 'cat2': return x * Math.cos(Math.atan2(z, y));
        case 'cos': return x * Math.cos(y * A); case 'max': return Math.max(x, y); case 'min': return Math.min(x, y); case 'mod': return Math.sqrt(x * x + y * y + z * z);
        case 'pin': return y < x ? x : y > z ? z : y; case 'sat2': return x * Math.sin(Math.atan2(z, y)); case 'sin': return x * Math.sin(y * A);
        case 'sqrt': return Math.sqrt(Math.max(0, x)); case 'tan': return x * Math.tan(y * A); default: return 0;
      }
    };
    [kid(cg, 'avLst'), kid(cg, 'gdLst')].forEach((l) => kids(l, 'gd').forEach((g) => { v[at(g, 'name')] = ev(at(g, 'fmla')); }));
    return val;
  };
  // Boog (arcTo) vanaf (x0, y0) als kubische Bézier-stukken; hoeken zijn 'zichtbare' hoeken zoals in OOXML
  const arcTo = (sub, x0, y0, wR, hR, stDeg, swDeg) => {
    if (!wR || !hR || !swDeg) return [x0, y0];
    const R = Math.PI / 180, par = (d) => Math.atan2(wR * Math.sin(d * R), hR * Math.cos(d * R));
    const t1 = par(stDeg);
    let t2 = par(stDeg + swDeg);
    if (Math.abs(swDeg) >= 360) t2 = t1 + Math.sign(swDeg) * 2 * Math.PI;
    else { while (swDeg > 0 && t2 <= t1) t2 += 2 * Math.PI; while (swDeg < 0 && t2 >= t1) t2 -= 2 * Math.PI; }
    const cx = x0 - wR * Math.cos(t1), cy = y0 - hR * Math.sin(t1);
    const n = Math.max(1, Math.ceil(Math.abs(t2 - t1) / (Math.PI / 2) - 1e-9)), dt = (t2 - t1) / n, k = 4 / 3 * Math.tan(dt / 4);
    let ex = x0, ey = y0;
    for (let i = 0; i < n; i++) {
      const a1 = t1 + i * dt, a2 = a1 + dt;
      ex = cx + wR * Math.cos(a2); ey = cy + hR * Math.sin(a2);
      sub.pts.push({ x: r3(ex), y: r3(ey), c1: [r3(cx + wR * (Math.cos(a1) - k * Math.sin(a1))), r3(cy + hR * (Math.sin(a1) + k * Math.cos(a1)))], c2: [r3(cx + wR * (Math.cos(a2) + k * Math.sin(a2))), r3(cy + hR * (Math.sin(a2) - k * Math.cos(a2)))] });
    }
    return [ex, ey];
  };
  // a:custGeom → Doek-pad { w, h, subs } in px van de vorm (W, H in EMU)
  const pathOf = (cg, W, H) => {
    const subs = [];
    const outW = px(W) || 1, outH = px(H) || 1;
    let noFill = true, noStroke = true;
    for (const p of kids(kid(cg, 'pathLst'), 'path')) {
      const w = num(p, 'w', 0) || W || 1, h = num(p, 'h', 0) || H || 1;
      const g = guides(cg, w, h), sx = outW / w, sy = outH / h;
      const P = (pt) => ({ x: r3(g(at(pt, 'x')) * sx), y: r3(g(at(pt, 'y')) * sy) });
      if (at(p, 'fill') !== 'none') noFill = false;
      if (at(p, 'stroke') !== '0' && at(p, 'stroke') !== 'false') noStroke = false;
      let sub = null, cx = 0, cy = 0;
      const begin = () => { if (!sub) sub = { closed: false, pts: [{ x: r3(cx), y: r3(cy) }] }; };
      const done = () => { if (sub && sub.pts.length > 1) subs.push(sub); sub = null; };
      for (const c of kids(p)) {
        const pts = kids(c, 'pt').map(P);
        switch (c.localName) {
          case 'moveTo': if (pts[0]) { done(); cx = pts[0].x; cy = pts[0].y; sub = { closed: false, pts: [{ x: cx, y: cy }] }; } break;
          case 'lnTo': if (pts[0]) { begin(); sub.pts.push(pts[0]); cx = pts[0].x; cy = pts[0].y; } break;
          case 'cubicBezTo': if (pts.length === 3) { begin(); sub.pts.push({ x: pts[2].x, y: pts[2].y, c1: [pts[0].x, pts[0].y], c2: [pts[1].x, pts[1].y] }); cx = pts[2].x; cy = pts[2].y; } break;
          case 'quadBezTo': if (pts.length === 2) { begin(); const [q, e] = pts; sub.pts.push({ x: e.x, y: e.y, c1: [r3(cx + 2 / 3 * (q.x - cx)), r3(cy + 2 / 3 * (q.y - cy))], c2: [r3(e.x + 2 / 3 * (q.x - e.x)), r3(e.y + 2 / 3 * (q.y - e.y))] }); cx = e.x; cy = e.y; } break;
          case 'arcTo': begin(); [cx, cy] = arcTo(sub, cx, cy, g(at(c, 'wR')) * sx, g(at(c, 'hR')) * sy, g(at(c, 'stAng')) / 60000, g(at(c, 'swAng')) / 60000); break;
          case 'close': if (sub) { sub.closed = true; cx = sub.pts[0].x; cy = sub.pts[0].y; done(); } break;
          default: break;
        }
      }
      done();
    }
    return subs.length ? { path: { w: outW, h: outH, subs }, noFill, noStroke } : null;
  };

  /* ---------- Gemeenschappelijke objectgegevens ---------- */
  const PH_TYPES = ['title', 'ctrTitle', 'subTitle', 'body', 'obj', 'dt', 'ftr', 'sldNum', 'pic', 'chart', 'tbl', 'media', 'clipArt', 'dgm', 'hdr', 'sldImg'];
  const nvOf = (nv, C) => {
    const c = kid(nv, 'cNvPr');
    const o = { spid: at(c, 'id'), name: (at(c, 'name') || '').slice(0, 200), nvPr: kid(nv, 'nvPr') };
    const d = at(c, 'descr'); if (d) o.alt = d.slice(0, 2000);
    if (bool(c, 'hidden')) o.hidden = true;
    const hc = kid(c, 'hlinkClick'), hh = kid(c, 'hlinkHover');
    if (hc) o.link = linkOf(hc, C);
    if (hh) o.hover = linkOf(hh, C);
    for (const e of kids(kid(c, 'extLst'), 'ext')) {
      const u = (at(e, 'uri') || '').toUpperCase();
      if (u === X.EXT.decorative) { const dv = kid(e, 'decorative'); if (dv && bool(dv, 'val', true)) o.decorative = true; }
      if (u === X.EXT.doek) { const pd = kid(e, 'obj'); if (pd) o.pd = { json: at(pd, 'json') || '', fp: at(pd, 'fp') || '' }; }
    }
    const ph = kid(o.nvPr, 'ph');
    if (ph) o.ph = { type: pick(at(ph, 'type') || 'obj', PH_TYPES) || 'body', idx: clamp(num(ph, 'idx', 0), 0, 1e9) | 0, custom: bool(ph, 'hasCustomPrompt') };
    const lk = all(nv, 'spLocks')[0] || all(nv, 'picLocks')[0] || all(nv, 'cxnSpLocks')[0] || all(nv, 'grpSpLocks')[0] || all(nv, 'graphicFrameLocks')[0];
    if (lk && (bool(lk, 'noMove') || bool(lk, 'noResize'))) o.locked = true;
    if (bool(kid(nv, 'cNvSpPr'), 'txBox')) o.txbox = true;
    return o;
  };
  const baseObj = (type, nv, xf, C) => {
    const o = strip({ id: App.uid('o'), type, name: nv.name || App.t(App.OBJ_NAMES[type] || 'Object'), hidden: nv.hidden, locked: nv.locked, alt: nv.alt, decorative: nv.decorative, link: nv.link, hover: nv.hover });
    if (xf) Object.assign(o, strip({ x: xf.x, y: xf.y, w: xf.w, h: xf.h, rot: xf.rot, flipH: xf.flipH, flipV: xf.flipV }));
    if (nv.ph) o.ph = { type: nv.ph.type, idx: nv.ph.idx };
    if (nv.pd) o._pd = nv.pd;
    if (nv.spid && C.spid) C.spid.set(nv.spid, o.id);
    return o;
  };

  /* ---------- Vormen (p:sp) ---------- */
  const spOf = async (el, C) => {
    const nv = nvOf(kid(el, 'nvSpPr'), C);
    const spPr = kid(el, 'spPr');
    const xf = xfrmOf(kid(spPr, 'xfrm'));
    const pg = kid(spPr, 'prstGeom'), cg = kid(spPr, 'custGeom');
    const prst = pg ? at(pg, 'prst') : null;
    if (prst && X.LINE_GEOMS.test(prst) && !nv.ph) return lineObj(el, nv, spPr, xf, prst, C);
    const o = baseObj('shape', nv, nv.ph && !xf ? null : xf, C);
    o.geom = prst && /^[A-Za-z0-9]{1,40}$/.test(prst) ? prst : 'rect';
    if (pg) { const adj = adjOf(pg); if (adj) o.adj = adj; }
    if (nv.txbox) o.txbox = true;
    const st = styleOf(kid(el, 'style'), C);
    const plain = !nv.ph && !nv.txbox;
    let cust = null;
    if (cg) { const e = kid(spPr, 'xfrm'); cust = pathOf(cg, num(path(e, 'ext'), 'cx', 0), num(path(e, 'ext'), 'cy', 0)); if (cust) o.path = cust.path; }
    const fill = await fillOf(spPr, C);
    if (fill) o.fill = fill; else if (st.fill) o.fill = st.fill; else if (plain) o.fill = { type: 'none' };
    const line = lineOf(kid(spPr, 'ln'), C, st.line);
    if (line) o.line = line; else if (plain) o.line = { type: 'none' };
    if (cust && cust.noFill) o.fill = { type: 'none' };
    if (cust && cust.noStroke) o.line = { type: 'none' };
    const fx = fxOf(spPr, C, st.fx); if (fx) o.fx = fx;
    const tb = kid(el, 'txBody');
    if (tb) o.text = bodyOf(tb, C);
    if (o.text && plain) shapeTextDefaults(o, st, C);
    if (o.text && nv.txbox && o.text.fit === undefined) o.text.fit = 'none';   // OOXML: zonder autofit-element niet passend maken
    if (nv.ph && (C.kind === 'master' || C.kind === 'layout')) {
      // de tekst in placeholders van master/indeling is alleen voorbeeldtekst
      if (C.kind === 'layout' && nv.ph.custom && o.text) { const t = App.plainText(o.text).trim(); if (t) o.ph.prompt = t.slice(0, 500); }
      o.text = { ...(o.text || {}), paras: [{ runs: [{ t: '' }] }] };
    }
    return o;
  };
  // Doek geeft gewone vormen lichte, gecentreerde tekst; OOXML gebruikt de standaardtekststijl en fontRef
  const shapeTextDefaults = (o, st, C) => {
    const other = (C.master && C.master.tx && C.master.tx.other) || [];
    const lvls = new Set(o.text.paras.map((p) => p.lvl || 0));
    const lst = o.text.lst || {};
    lvls.forEach((lvl) => {
      const l = { ...(lst[lvl] || {}) };
      const color = st.font && st.font.color ? st.font.color : (other[lvl] && other[lvl].color) || 'tx1';
      if (l.color === undefined && color !== 'lt1') l.color = color;
      const al = (other[lvl] && other[lvl].align) || 'l';
      if (l.align === undefined && al !== 'ctr') l.align = al;
      if (l.font === undefined && st.font && st.font.idx === 'major') l.font = '+mj';
      if (Object.keys(l).length) lst[lvl] = l;
    });
    if (Object.keys(lst).length) o.text.lst = lst;
    if (o.text.vAlign === undefined) o.text.vAlign = 't';
  };
  // Lijnvormen en verbindingslijnen → type 'line' met eindpunten
  const lineObj = (el, nv, spPr, xf, prst, C) => {
    const o = baseObj('line', nv, null, C);
    const b = xf || { x: 0, y: 0, w: 0, h: 0 };
    const inv = prst === 'lineInv';
    let a = [0, inv ? 1 : 0], e = [1, inv ? 0 : 1];
    const fl = ([u, v]) => [b.flipH ? 1 - u : u, b.flipV ? 1 - v : v];
    a = fl(a); e = fl(e);
    let p1 = [b.x + a[0] * b.w, b.y + a[1] * b.h], p2 = [b.x + e[0] * b.w, b.y + e[1] * b.h];
    const straight = /^(line|lineInv|straightConnector1)$/.test(prst);
    if (b.rot && straight) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, t = b.rot * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
      const rp = ([x, y]) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co];
      p1 = rp(p1); p2 = rp(p2);
    } else if (b.rot) o.rot = b.rot;
    o.pts = [p1.map(r3), p2.map(r3)];
    o.geom = straight ? (prst === 'straightConnector1' ? 'straightConnector1' : 'line') : prst;
    const adj = adjOf(kid(spPr, 'prstGeom')); if (adj) o.adj = adj;
    const st = styleOf(kid(el, 'style'), C);
    o.line = lineOf(kid(spPr, 'ln'), C, st.line) || { type: 'none' };
    const fx = fxOf(spPr, C, st.fx); if (fx) o.fx = fx;
    const cn = all(el, 'cNvCxnSpPr')[0];
    if (cn) {
      const s = kid(cn, 'stCxn'), t = kid(cn, 'endCxn');
      if (s || t) o._conn = strip({ st: s ? { spid: at(s, 'id'), site: num(s, 'idx', 0) } : undefined, end: t ? { spid: at(t, 'id'), site: num(t, 'idx', 0) } : undefined });
    }
    Object.assign(o, { x: Math.min(o.pts[0][0], o.pts[1][0]), y: Math.min(o.pts[0][1], o.pts[1][1]), w: Math.abs(o.pts[1][0] - o.pts[0][0]), h: Math.abs(o.pts[1][1] - o.pts[0][1]) });
    return o;
  };
  const cxnOf = (el, C) => {
    const nv = nvOf(kid(el, 'nvCxnSpPr'), C);
    const spPr = kid(el, 'spPr');
    const pg = kid(spPr, 'prstGeom');
    return lineObj(el, nv, spPr, xfrmOf(kid(spPr, 'xfrm')), (pg && at(pg, 'prst')) || 'straightConnector1', C);
  };

  /* ---------- Afbeeldingen, video en geluid (p:pic) ---------- */
  const picOf = async (el, C, frameXf) => {
    const nv = nvOf(kid(el, 'nvPicPr'), C);
    const spPr = kid(el, 'spPr');
    const xf = frameXf || xfrmOf(kid(spPr, 'xfrm'));
    const bf = kid(el, 'blipFill'), blip = kid(bf, 'blip');
    const nvPr = nv.nvPr;
    const vf = kid(nvPr, 'videoFile') || kid(nvPr, 'quickTimeFile'), af = kid(nvPr, 'audioFile') || kid(nvPr, 'wavAudioFile');
    let pm = null;
    for (const e of kids(kid(nvPr, 'extLst'), 'ext')) { const m = kid(e, 'media'); if (m) pm = m; }
    const img = blip ? await blipMedia(blip, C) : null;
    const st = styleOf(kid(el, 'style'), C);
    if (vf || af || pm) {
      let rel = pm ? C.rels.get(rid(pm, 'embed')) : null;
      if (!rel && (vf || af)) rel = C.rels.get(rid(vf || af, 'link')) || C.rels.get(rid(vf || af, 'embed'));
      const kind = af && !vf ? 'audio' : vf ? 'video' : rel && /\.(mp3|wav|m4a|ogg|oga|wma|aac)$/i.test(rel.target) ? 'audio' : 'video';
      const media = rel ? await loadMedia(C.R, rel, kind) : null;
      if (media) {
        const o = baseObj(kind, nv, xf, C);
        o.media = media;
        if (img && kind === 'video') o.poster = img;
        o.play = 'click';
        const tr = kid(pm, 'trim'), fd = kid(pm, 'fade');
        if (tr && (num(tr, 'st', 0) || num(tr, 'end', 0))) o._trim = { st: num(tr, 'st', 0) / 1000, end: num(tr, 'end', 0) / 1000 };
        if (fd && (num(fd, 'in', 0) || num(fd, 'out', 0))) o.fade = { in: r3(num(fd, 'in', 0) / 1000), out: r3(num(fd, 'out', 0) / 1000) };
        const bm = kids(kid(pm, 'bmkLst'), 'bmk').map((b) => ({ t: r3(num(b, 'time', 0) / 1000), name: (at(b, 'name') || '').slice(0, 100) }));
        if (bm.length) o.marks = bm;
        const line = lineOf(kid(spPr, 'ln'), C, st.line); if (line && line.type !== 'none') o.line = line;
        return o;
      }
      if (!img) return null;
    }
    const o = baseObj('image', nv, nv.ph && !xf ? null : xf, C);
    o.media = img;
    if (img && App.media[img] && App.media[img].nat) o.nat = { ...App.media[img].nat };
    else if (xf) o.nat = { w: Math.max(1, Math.round(xf.w)), h: Math.max(1, Math.round(xf.h)) };
    const sr = kid(bf, 'srcRect');
    if (sr) { const c = { l: num(sr, 'l', 0) / 100000, t: num(sr, 't', 0) / 100000, r: num(sr, 'r', 0) / 100000, b: num(sr, 'b', 0) / 100000 }; if (c.l || c.t || c.r || c.b) o.crop = { l: r3(c.l), t: r3(c.t), r: r3(c.r), b: r3(c.b) }; }
    const pic = {};
    for (const c of kids(blip)) {
      switch (c.localName) {
        case 'alphaModFix': pic.alpha = r3(clamp(num(c, 'amt', 100000) / 100000, 0, 1)); break;
        case 'lum': { const br = num(c, 'bright', 0), ct = num(c, 'contrast', 0); if (br === 70000 && ct === -70000) pic.recolor = 'wash'; else { if (br) pic.bright = r3(clamp(br / 100000, -1, 1)); if (ct) pic.contrast = r3(clamp(ct / 100000, -1, 1)); } break; }
        case 'grayscl': pic.recolor = 'gray'; break;
        case 'biLevel': pic.recolor = 'bw'; break;
        case 'duotone': {
          const cs = kids(c).filter((x) => COLOR_TAGS.has(x.localName)).map((x) => colorOf(x, C)).filter(Boolean);
          const light = cs.length > 1 ? cs[1] : cs[0];
          if (light && /^#d9c3a5$/i.test(App.color(light.ref, C.theme) || '')) pic.recolor = 'sepia';
          else if (light) pic.recolor = 'duo:' + light.ref;
          break;
        }
        case 'clrChange': { const k = colorOf(kid(c, 'clrFrom'), C); if (k) pic.chroma = App.color(k.ref, C.theme); break; }
        case 'blur': { const b = px(num(c, 'rad', 0)); if (b) pic.blur = r3(b); break; }
        case 'extLst': if (all(c, 'artisticFilm').length || all(c, 'imgEffect').length) note(C.R, 'Artistieke effecten van afbeeldingen zijn weggelaten.'); break;
        default: break;
      }
    }
    if (Object.keys(pic).length) o.pic = pic;
    const pg = kid(spPr, 'prstGeom'), prst = pg && at(pg, 'prst');
    if (prst && prst !== 'rect' && /^[A-Za-z0-9]{1,40}$/.test(prst)) { o.geom = prst; const adj = adjOf(pg); if (adj) o.adj = adj; }
    const line = lineOf(kid(spPr, 'ln'), C, st.line); if (line && line.type !== 'none') o.line = line;
    const fx = fxOf(spPr, C, st.fx); if (fx) o.fx = fx;
    if (bool(all(el, 'picLocks')[0], 'noChangeAspect') === false) o.lockAspect = false;
    return o;
  };

  /* ---------- Groepen ---------- */
  const scaleDeep = (o, sx, sy) => {
    if (o.pts) o.pts = o.pts.map(([x, y]) => [r3(x * sx), r3(y * sy)]);
    if (o.x !== undefined) { o.x = r3(o.x * sx); o.y = r3(o.y * sy); o.w = r3(o.w * sx); o.h = r3(o.h * sy); }
    if (o.type === 'table') { o.cols = o.cols.map((w) => r3(w * sx)); o.rows.forEach((r) => { r.h = r3(r.h * sy); }); }
    if (o.type === 'group') o.objs.forEach((c) => scaleDeep(c, sx, sy));
  };
  const mapInto = (o, cx, cy, sx, sy) => {
    if (o.pts) o.pts = o.pts.map(([x, y]) => [r3((x - cx) * sx), r3((y - cy) * sy)]);
    if (o.x !== undefined) { o.x = r3((o.x - cx) * sx); o.y = r3((o.y - cy) * sy); o.w = r3(o.w * sx); o.h = r3(o.h * sy); }
    if (sx !== 1 || sy !== 1) {
      if (o.type === 'group') o.objs.forEach((c) => scaleDeep(c, sx, sy));
      if (o.type === 'table') { o.cols = o.cols.map((w) => r3(w * sx)); o.rows.forEach((r) => { r.h = r3(r.h * sy); }); }
    }
  };
  const grpOf = async (el, C, depth) => {
    const nv = nvOf(kid(el, 'nvGrpSpPr'), C);
    const gp = kid(el, 'grpSpPr'), xe = kid(gp, 'xfrm');
    const xf = xfrmOf(xe) || { x: 0, y: 0, w: 0, h: 0 };
    const co = kid(xe, 'chOff'), ce = kid(xe, 'chExt');
    const cx = co ? px(num(co, 'x', 0)) : xf.x, cy = co ? px(num(co, 'y', 0)) : xf.y;
    const cw = ce ? px(num(ce, 'cx', 0)) : xf.w, ch = ce ? px(num(ce, 'cy', 0)) : xf.h;
    const sx = cw > 0 ? xf.w / cw : 1, sy = ch > 0 ? xf.h / ch : 1;
    const grpFill = await fillOf(gp, C);
    const g = baseObj('group', nv, xf, C);
    g.objs = await treeOf(el, { ...C, grpFill }, depth + 1);
    g.objs.forEach((o) => mapInto(o, cx, cy, sx, sy));
    return g;
  };

  /* ---------- Kaders: tabellen, grafieken, SmartArt, OLE ---------- */
  const tableOf = async (tbl, nv, xf, C) => {
    const o = baseObj('table', nv, xf, C);
    const pr = kid(tbl, 'tblPr');
    o.cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => Math.max(1, px(num(g, 'w', 0))));
    o.rows = [];
    for (const tr of kids(tbl, 'tr')) {
      const cells = [];
      for (const tc of kids(tr, 'tc')) {
        const cell = { text: bodyOf(kid(tc, 'txBody'), C) || { paras: [{ runs: [{ t: '' }] }] } };
        ['vAlign', 'ins', 'fit', 'wrap', 'vert', 'cols', 'warp', 'scale'].forEach((k) => delete cell.text[k]);
        const gs = num(tc, 'gridSpan', 1), rs = num(tc, 'rowSpan', 1);
        if (gs > 1 || rs > 1) cell.span = { c: Math.max(1, gs | 0), r: Math.max(1, rs | 0) };
        if (bool(tc, 'hMerge') || bool(tc, 'vMerge')) cell.merged = true;
        const tp = kid(tc, 'tcPr');
        if (tp) {
          const an = at(tp, 'anchor'); if (an) cell.vAlign = an === 'ctr' ? 'ctr' : an === 'b' ? 'b' : 't';
          if (['marL', 'marR', 'marT', 'marB'].some((k) => at(tp, k) !== null)) cell.ins = { l: px(num(tp, 'marL', 91440)), t: px(num(tp, 'marT', 45720)), r: px(num(tp, 'marR', 91440)), b: px(num(tp, 'marB', 45720)) };
          const bd = {};
          [['lnL', 'l'], ['lnR', 'r'], ['lnT', 't'], ['lnB', 'b'], ['lnTlToBr', 'd1'], ['lnBlToTr', 'd2']].forEach(([n, k]) => { const l = kid(tp, n); if (l) { const v = lineOf(l, C); if (v) bd[k] = v; } });
          if (Object.keys(bd).length) cell.bd = bd;
          const f = await fillOf(tp, C); if (f) cell.fill = f;
        }
        cells.push(cell);
      }
      while (cells.length < o.cols.length) cells.push({ text: { paras: [{ runs: [{ t: '' }] }] }, merged: true });
      o.rows.push({ h: Math.max(1, px(num(tr, 'h', 0))) || 40, cells: cells.slice(0, Math.max(1, o.cols.length)) });
    }
    if (!o.cols.length) o.cols = [o.w || 100];
    const sid = txt(kid(pr, 'tableStyleId')).trim();
    o.tstyle = strip({ id: sid ? X.tableStyleIn(sid) : 'none', first: bool(pr, 'firstRow') || undefined, last: bool(pr, 'lastRow') || undefined, bandR: bool(pr, 'bandRow') || undefined, bandC: bool(pr, 'bandCol') || undefined, firstC: bool(pr, 'firstCol') || undefined, lastC: bool(pr, 'lastCol') || undefined });
    if (!sid && kid(pr, 'tableStyle')) o.tstyle.id = 'medium2:accent1';
    return o;
  };
  const SMART = { default: 'basicBlockList', vList2: 'verticalBulletList', hList1: 'horizontalBulletList', process1: 'basicProcess', chevron1: 'basicChevronProcess', hChevron3: 'closedChevronProcess', arrow2: 'continuousArrowProcess', process2: 'verticalProcess', cycle2: 'basicCycle', cycle1: 'textCycle', cycle5: 'continuousCycle', radial1: 'basicRadial', orgChart1: 'orgChart', hierarchy1: 'hierarchy', hierarchy2: 'horizontalHierarchy', venn1: 'basicVenn', venn3: 'linearVenn', venn2: 'stackedVenn', target1: 'basicTarget', matrix1: 'titledMatrix', matrix3: 'basicMatrix', pyramid1: 'basicPyramid', pyramid3: 'invertedPyramid', balance1: 'balance' };
  // SmartArt-gegevensmodel → Doek-diagram (als er geen tekening is)
  const dataDia = async (data, C, loRel) => {
    const pts = new Map(), parent = new Map(), order = new Map();
    let root = null;
    for (const p of all(data, 'pt')) {
      const id = at(p, 'modelId'), ty = at(p, 'type') || 'node';
      if (ty === 'doc') root = id;
      if (ty === 'node' || ty === 'asst' || ty === 'doc') pts.set(id, { id, ty, text: all(kid(p, 't'), 't').map(txt).join('') });
    }
    for (const c of all(data, 'cxn')) { const ty = at(c, 'type') || 'parOf'; if (ty !== 'parOf') continue; parent.set(at(c, 'destId'), at(c, 'srcId')); order.set(at(c, 'destId'), num(c, 'srcOrd', 0)); }
    const childs = (id) => [...pts.values()].filter((p) => parent.get(p.id) === id).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
    const items = [];
    const walk = (id, lvl) => { if (items.length > 500) return; childs(id).forEach((p) => { if (p.ty === 'doc') return; items.push(strip({ id: App.uid('d'), text: p.text.slice(0, 2000), lvl: clamp(lvl, 0, 8), asst: p.ty === 'asst' || undefined })); walk(p.id, lvl + 1); }); };
    if (root) walk(root, 0);
    if (!items.length) return null;
    let layout = 'basicBlockList';
    const lo = loRel && !loRel.ext ? await readXml(C.R, loRel.target) : null;
    const uid = at(lo, 'uniqueId') || '';
    const k = uid.split('/').pop();
    if (SMART[k] && (!App.Diagrams || !App.Diagrams.byId || App.Diagrams.byId(SMART[k]))) layout = SMART[k];
    return { layout, items, color: 'accent1', look: 'flat' };
  };
  const dgmOf = async (ids, nv, xf, C) => {
    const dm = C.rels.get(rid(ids, 'dm'));
    const data = dm && !dm.ext ? await readXml(C.R, dm.target) : null;
    let dr = null;
    const ext = all(data, 'dataModelExt')[0];
    if (ext && at(ext, 'relId')) dr = C.rels.get(at(ext, 'relId'));
    if (!dr) { const drs = [...C.rels.values()].filter((r) => r.type === 'diagramDrawing'); if (drs.length === 1) dr = drs[0]; }
    const droot = dr && !dr.ext ? await readXml(C.R, dr.target) : null;
    const tree = kid(droot, 'spTree');
    if (tree) {
      const g = baseObj('group', nv, xf, C);
      g.objs = await treeOf(tree, { ...C, rels: await relsOf(C.R, dr.target), path: dr.target, spid: null }, 1);
      if (g.objs.length) { note(C.R, 'SmartArt is overgenomen als een groep vormen.'); return [g]; }
    }
    const dia = data ? await dataDia(data, C, C.rels.get(rid(ids, 'lo'))) : null;
    if (dia) { const o = baseObj('diagram', nv, xf, C); o.dia = dia; note(C.R, 'SmartArt zonder tekening is vereenvoudigd tot een Doek-diagram.'); return [o]; }
    note(C.R, 'Een SmartArt-afbeelding kon niet worden overgenomen.');
    return [];
  };
  const frameOf = async (el, C) => {
    const nv = nvOf(kid(el, 'nvGraphicFramePr'), C);
    const xf = xfrmOf(kid(el, 'xfrm')) || { x: 0, y: 0, w: 100, h: 100 };
    const gd = path(el, 'graphic', 'graphicData'), uri = at(gd, 'uri') || '';
    if (/\/table$/.test(uri) && kid(gd, 'tbl')) return [await tableOf(kid(gd, 'tbl'), nv, xf, C)];
    if (/drawingml\/2006\/chart$/.test(uri) && kid(gd, 'chart')) return [await chartObj(kid(gd, 'chart'), nv, xf, C)];
    if (/\/diagram$/.test(uri)) return dgmOf(kid(gd, 'relIds'), nv, xf, C);
    if (/\/ole$/.test(uri)) {
      const pic = all(gd, 'pic')[0];
      note(C.R, 'OLE-objecten (ingesloten bestanden) zijn als afbeelding overgenomen.');
      if (pic) { const o = await picOf(pic, C, xf); if (o) { o.name = nv.name || o.name; if (nv.spid && C.spid) C.spid.set(nv.spid, o.id); return [o]; } }
      return [];
    }
    note(C.R, 'Een onderdeel dat Doek niet kent is weggelaten.');
    return [];
  };
  // Zoom naar een dia (pslz) → Doek-zoomobject
  const zoomOf = (choice, C) => {
    const gf = all(choice, 'graphicFrame')[0], zo = all(choice, 'sldZmObj')[0];
    if (!gf || !zo) return null;
    const sid = C.R.slideBySldId.get(at(zo, 'sldId'));
    if (!sid) return null;
    const o = baseObj('zoom', nvOf(kid(gf, 'nvGraphicFramePr'), C), xfrmOf(kid(gf, 'xfrm')) || { x: 0, y: 0, w: 320, h: 180 }, C);
    o.slide = sid;
    if (bool(all(zo, 'zmPr')[0], 'returnToParent')) o.ret = true;
    return o;
  };
  const altOf = async (el, C, depth) => {
    const ch = kid(el, 'Choice'), fb = kid(el, 'Fallback');
    const req = (at(ch, 'Requires') || '').split(/\s+/).filter(Boolean);
    if (req.includes('pslz')) { const z = zoomOf(ch, C); if (z) return [z]; }
    if (!fb || !kids(fb).length) { note(C.R, 'Een onderdeel dat Doek niet kent is weggelaten.'); return []; }
    note(C.R, req.includes('a14') ? 'Vergelijkingen zijn als afbeelding overgenomen.' : req.some((r) => /^am3d/.test(r)) ? '3D-modellen zijn als afbeelding overgenomen.' : req.some((r) => /^cx\d*$/.test(r)) ? 'Grafieken van een nieuw type (zoals waterval of trechter) zijn als afbeelding overgenomen.' : req.includes('p14') || req.includes('aink') ? 'Inkt is als afbeelding overgenomen.' : 'Een onderdeel dat Doek niet kent is als afbeelding overgenomen.');
    return treeOf(fb, C, depth + 1);
  };
  // Eigen Doek-gegevens (diagram, vergelijking, pictogram, inkt, zoom) terugzetten als de vorm niet is bewerkt
  const fingerprint = (o) => (o.type === 'group' && o._ink ? 'n' + o.objs.length : App.objText(o).replace(/\s+/g, ' ').trim().slice(0, 200));
  const restore = (o, C) => {
    const pd = o._pd;
    delete o._pd;
    let src = null;
    try { if (pd.json.length < 4e6) src = JSON.parse(pd.json); } catch { src = null; }
    if (!src || typeof src !== 'object' || !/^(diagram|equation|icon|ink|zoom)$/.test(src.type)) return o;
    if (src.type === 'ink') o._ink = true;
    if (pd.fp && pd.fp !== fingerprint(o)) return o;
    const out = { ...src, id: o.id, name: o.name };
    ['x', 'y', 'w', 'h', 'rot', 'flipH', 'flipV', 'hidden', 'locked', 'alt', 'decorative', 'link'].forEach((k) => { if (o[k] !== undefined) out[k] = o[k]; else delete out[k]; });
    if (src.type === 'zoom') { out.slide = C.R.slideIds[src.slideNo] || undefined; delete out.slideNo; delete out.link; if (!out.slide) return o; }
    if (src.type === 'equation' && out.alt && /^LaTeX: /.test(out.alt)) delete out.alt;
    return out;
  };
  const SHAPES = new Set(['sp', 'pic', 'cxnSp', 'grpSp', 'graphicFrame', 'AlternateContent', 'contentPart']);
  const oneOf = async (el, C, depth) => {
    switch (el.localName) {
      case 'sp': return [await spOf(el, C)];
      case 'pic': return [await picOf(el, C)];
      case 'cxnSp': return [cxnOf(el, C)];
      case 'grpSp': return [await grpOf(el, C, depth)];
      case 'graphicFrame': return frameOf(el, C);
      case 'AlternateContent': return altOf(el, C, depth);
      case 'contentPart': note(C.R, 'Inkt is weggelaten.'); return [];
      default: return [];
    }
  };
  const treeOf = async (parent, C, depth = 0) => {
    const out = [];
    if (!parent || depth > 20) return out;
    for (const el of kids(parent)) {
      if (!SHAPES.has(el.localName)) continue;
      try {
        for (const o of await oneOf(el, C, depth)) if (o) out.push(o._pd ? restore(o, C) : o);
      } catch (e) { console.warn('pptx', e); note(C.R, 'Een object op {0} kon niet worden gelezen en is weggelaten.', C.where || 'een dia'); }
    }
    return out;
  };
  // verbindingen (stCxn/endCxn) koppelen zodra alle objecten van het werkvlak bekend zijn
  const linkConns = (objs, C) => App.walkObjs(objs, (o) => {
    if (!o._conn) return true;
    const c = {};
    ['st', 'end'].forEach((k) => { const v = o._conn[k]; const id = v && C.spid && C.spid.get(v.spid); if (id) c[k] = { obj: id, site: Math.max(0, v.site | 0) }; });
    if (Object.keys(c).length) o.conn = c;
    delete o._conn;
    return true;
  });

  /* ---------- Grafieken (c:chartSpace) ---------- */
  const CH_KIND = { barChart: 'bar', bar3DChart: 'bar', lineChart: 'line', line3DChart: 'line', stockChart: 'line', pieChart: 'pie', pie3DChart: 'pie', ofPieChart: 'pie', doughnutChart: 'doughnut', areaChart: 'area', area3DChart: 'area', surfaceChart: 'area', surface3DChart: 'area', scatterChart: 'scatter', bubbleChart: 'bubble', radarChart: 'radar' };
  const cache = (ref) => {
    if (!ref) return [];
    let c = kid(ref, 'strCache') || kid(ref, 'numCache') || (/Lit$/.test(ref.localName) ? ref : null);
    if (!c && ref.localName === 'multiLvlStrRef') { const lv = kids(kid(ref, 'multiLvlStrCache'), 'lvl'); c = lv[0] || null; if (c) c = { pts: kids(c, 'pt'), n: num(kid(kid(ref, 'multiLvlStrCache'), 'ptCount'), 'val', 0) }; }
    if (!c) return [];
    const pts = c.pts || kids(c, 'pt'), n = c.n !== undefined ? c.n : num(kid(c, 'ptCount'), 'val', 0);
    const out = new Array(Math.min(Math.max(n, 0), 10000)).fill(null);
    pts.forEach((p) => { const i = num(p, 'idx', -1); if (i >= 0 && i < 10000) out[i] = txt(kid(p, 'v')); });
    return out;
  };
  const dataOf = (el) => (el ? cache(kid(el, 'strRef') || kid(el, 'numRef') || kid(el, 'strLit') || kid(el, 'numLit') || kid(el, 'multiLvlStrRef')) : null);
  const nums = (a) => (a || []).map((v) => (v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)));
  const rich = (el) => { const r = path(el, 'tx', 'rich'); return r ? kids(r, 'p').map((p) => all(p, 't').map(txt).join('')).join(' ').trim() : ''; };
  const serFill = (sp, C) => { if (!sp) return null; const f = kid(sp, 'solidFill'); if (f) return colorOf(f, C); const ln = kid(sp, 'ln'); const lf = ln && kid(ln, 'solidFill'); return lf ? colorOf(lf, C) : null; };
  const lblOf = (d) => {
    if (!d || bool(kid(d, 'delete'), 'val')) return null;
    const v = (n) => bool(kid(d, n), 'val', false);
    const pos = { outEnd: 'out', inEnd: 'in', ctr: 'ctr', inBase: 'base', bestFit: 'best', t: 'out', b: 'out', l: 'out', r: 'out' }[at(kid(d, 'dLblPos'), 'val')];
    const o = strip({ on: v('showVal') || v('showCatName') || v('showPercent') || v('showSerName'), val: v('showVal') || undefined, cat: v('showCatName') || undefined, pct: v('showPercent') || undefined, ser: v('showSerName') || undefined, pos });
    return o.on ? o : null;
  };
  const MARK = { circle: 'circle', square: 'square', diamond: 'diamond', triangle: 'triangle', none: 'none' };
  const TREND = { linear: 'linear', exp: 'exp', log: 'log', poly: 'poly', power: 'power', movingAvg: 'movavg' };
  const axisOf = (ax, isVal) => {
    if (!ax) return undefined;
    const o = {};
    if (bool(kid(ax, 'delete'), 'val')) o.on = false;
    const t = kid(ax, 'title'); if (t) { const s = rich(t); if (s) o.title = s.slice(0, 300); }
    const grid = !!kid(ax, 'majorGridlines'); if (isVal || grid) o.grid = grid;
    const sc = kid(ax, 'scaling');
    if (at(kid(sc, 'orientation'), 'val') === 'maxMin') o.rev = true;
    if (kid(sc, 'min')) o.min = num(kid(sc, 'min'), 'val', 0);
    if (kid(sc, 'max')) o.max = num(kid(sc, 'max'), 'val', 0);
    if (kid(sc, 'logBase')) o.log = true;
    if (kid(ax, 'majorUnit')) o.major = num(kid(ax, 'majorUnit'), 'val', 1);
    const nf = at(kid(ax, 'numFmt'), 'formatCode'); if (nf && nf !== 'General') o.fmt = nf.slice(0, 60);
    return o;
  };
  const parseChart = (root, C) => {
    const ch = kid(root, 'chart'), pa = kid(ch, 'plotArea');
    const out = { kind: 'column', cats: [], series: [] };
    const axes = {};
    kids(pa).forEach((a) => { if (/^(catAx|valAx|dateAx|serAx)$/.test(a.localName)) axes[at(kid(a, 'axId'), 'val')] = a; });
    const valAx = kids(pa, 'valAx');
    const groups = kids(pa).filter((g) => CH_KIND[g.localName]);
    let catDone = false, labels = null, idx = 0;
    const kinds = [];
    groups.forEach((g) => {
      let kind = CH_KIND[g.localName];
      if (kind === 'bar') kind = at(kid(g, 'barDir'), 'val') === 'bar' ? 'bar' : 'column';
      const grouping = at(kid(g, 'grouping'), 'val');
      const sub = grouping === 'stacked' ? 'stacked' : grouping === 'percentStacked' ? 'percent' : 'clustered';
      const ids = kids(g, 'axId').map((a) => at(a, 'val'));
      const second = ids.some((id) => axes[id] && axes[id].localName === 'valAx' && valAx.indexOf(axes[id]) > 0 && at(kid(axes[id], 'axPos'), 'val') !== 'b');
      const showMarkers = !kid(g, 'marker') || bool(kid(g, 'marker'), 'val', true);
      kinds.push({ kind, sub, second, g });
      labels = labels || lblOf(kid(g, 'dLbls'));
      if (kind === 'column' || kind === 'bar') { const gw = kid(g, 'gapWidth'), ov = kid(g, 'overlap'); if (gw) out.gap = clamp(num(gw, 'val', 150), 0, 500); if (ov && sub === 'clustered' && num(ov, 'val', 0)) out.overlap = clamp(num(ov, 'val', 0), -100, 100); }
      if (kind === 'doughnut') out.hole = clamp(num(kid(g, 'holeSize'), 'val', 50), 10, 90);
      if ((kind === 'pie' || kind === 'doughnut') && kid(g, 'firstSliceAng')) out.firstAng = clamp(num(kid(g, 'firstSliceAng'), 'val', 0), 0, 360);
      for (const s of kids(g, 'ser')) {
        const xy = kind === 'scatter' || kind === 'bubble';
        const tx = kid(s, 'tx');
        const name = tx ? (dataOf(tx) || [])[0] || txt(kid(tx, 'v')) : '';
        const ser = { name: String(name || '').slice(0, 300), vals: nums(dataOf(kid(s, xy ? 'yVal' : 'val'))) };
        if (xy) {
          const xr = dataOf(kid(s, 'xVal')) || [];
          const xn = nums(xr);
          ser.xs = xr.length && xn.every((v, i) => v !== null || xr[i] === null) ? xn : ser.vals.map((_, i) => i + 1);
          if (kind === 'bubble') ser.sizes = nums(dataOf(kid(s, 'bubbleSize')));
        } else if (!catDone) { const c = dataOf(kid(s, 'cat')); if (c && c.length) { out.cats = c.map((v) => String(v ?? '')); catDone = true; } }
        const sp = kid(s, 'spPr');
        const k = kind === 'line' || kind === 'radar' || (kind === 'scatter' && !kid(sp, 'solidFill')) ? (path(sp, 'ln', 'solidFill') ? colorOf(path(sp, 'ln', 'solidFill'), C) : serFill(path(s, 'marker', 'spPr'), C)) : serFill(sp, C);
        if (k) ser.color = k.ref;
        const mk = kid(s, 'marker'), sym = at(kid(mk, 'symbol'), 'val');
        if (kind === 'line' || kind === 'radar' || kind === 'scatter') ser.marker = sym ? MARK[sym] || 'auto' : kind === 'line' && !showMarkers ? 'none' : 'auto';
        if (bool(kid(s, 'smooth'), 'val', false)) ser.smooth = true;
        ser._noLine = !!path(sp, 'ln', 'noFill');
        if (lblOf(kid(s, 'dLbls'))) { ser.labels = true; labels = labels || lblOf(kid(s, 'dLbls')); }
        if (kind === 'pie' || kind === 'doughnut') {
          const n = Math.max(out.cats.length, ser.vals.length), pc = new Array(n).fill(null), ex = new Array(n).fill(0);
          const e0 = num(kid(s, 'explosion'), 'val', 0) / 100;
          ex.fill(e0);
          kids(s, 'dPt').forEach((d) => { const i = num(kid(d, 'idx'), 'val', -1); if (i < 0 || i >= n) return; const f = serFill(kid(d, 'spPr'), C); if (f) pc[i] = f.ref; if (kid(d, 'explosion')) ex[i] = num(kid(d, 'explosion'), 'val', 0) / 100; });
          if (pc.some(Boolean) && !pc.every((c, i) => c === 'accent' + ((i % 6) + 1))) ser.pointColors = pc;
          if (ex.some((v) => v > 0)) ser.explode = ex.map((v) => r3(clamp(v, 0, 1)));
        }
        const tl = kid(s, 'trendline');
        if (tl) {
          const ty = TREND[at(kid(tl, 'trendlineType'), 'val')] || 'linear';
          ser.trend = strip({ type: ty, order: ty === 'poly' ? clamp(num(kid(tl, 'order'), 'val', 2), 2, 6) : undefined, period: ty === 'movavg' ? clamp(num(kid(tl, 'period'), 'val', 2), 2, 100) : undefined, eq: bool(kid(tl, 'dispEq'), 'val', false) || undefined, r2: bool(kid(tl, 'dispRSqr'), 'val', false) || undefined, fwd: num(kid(tl, 'forward'), 'val', 0) || undefined, back: num(kid(tl, 'backward'), 'val', 0) || undefined, name: txt(kid(tl, 'name')) || undefined });
        }
        ser._kind = kind; ser._axis = second ? 2 : undefined; ser._i = idx++;
        out.series.push(ser);
      }
    });
    // soort en variant
    const main = kinds[0] || { kind: 'column', sub: 'clustered' };
    const distinct = new Set(kinds.map((k) => (k.kind === 'bar' ? 'column' : k.kind) + (k.second ? '2' : '')));
    if (distinct.size > 1 && kinds.every((k) => /^(column|bar|line|area)$/.test(k.kind))) {
      out.kind = 'combo';
      out.series.forEach((s) => { s.kind = s._kind === 'bar' ? 'column' : s._kind; if (s._axis) s.axis = 2; });
      out.sub = out.series.some((s) => s.axis === 2) ? 'colLine2' : out.series.some((s) => s.kind === 'area') ? 'areaCol' : 'colLine';
    } else {
      out.kind = main.kind;
      if (/^(column|bar|line|area)$/.test(main.kind)) out.sub = main.sub;
      if (main.kind === 'radar') { const rs = at(kid(main.g, 'radarStyle'), 'val'); out.sub = rs === 'filled' ? 'filled' : out.series.every((s) => s.marker === 'none') || rs === 'standard' ? 'plain' : 'markers'; }
      if (main.kind === 'scatter') {
        const ss = at(kid(main.g, 'scatterStyle'), 'val') || 'lineMarker', s0 = out.series[0] || {};
        const lines = !s0._noLine && ss !== 'marker' && ss !== 'none', marks = s0.marker === 'none' ? false : s0.marker === 'auto' || s0.marker === undefined ? !(ss === 'line' || ss === 'smooth') : true;
        const smooth = s0.smooth || /^smooth/.test(ss);
        out.sub = !lines ? 'markers' : smooth ? (marks ? 'smoothMarkers' : 'smooth') : (marks ? 'linesMarkers' : 'lines');
      }
    }
    out.series.forEach((s) => {
      if (s.color === 'accent' + ((s._i % 6) + 1)) delete s.color;   // standaardpalet van het thema
      if (out.kind === 'scatter' || out.kind === 'radar') { delete s.marker; delete s.smooth; }
      delete s._kind; delete s._axis; delete s._i; delete s._noLine;
    });
    // titel, legenda, labels, assen, tekst
    const t = kid(ch, 'title');
    if (t) out.title = { on: true, text: rich(t).slice(0, 500) };
    else out.title = { on: !bool(kid(ch, 'autoTitleDeleted'), 'val', false) && out.series.length === 1, text: '' };
    const lg = kid(ch, 'legend');
    out.legend = lg ? ({ b: 'b', t: 't', l: 'l', r: 'r', tr: 'r' }[at(kid(lg, 'legendPos'), 'val')] || 'r') : 'none';
    if (labels) out.labels = labels;
    const catAx = kids(pa, 'catAx')[0] || kids(pa, 'dateAx')[0];
    const xy = out.kind === 'scatter' || out.kind === 'bubble';
    const xAx = xy ? valAx.find((a) => at(kid(a, 'axPos'), 'val') === 'b' || at(kid(a, 'axPos'), 'val') === 't') || valAx[0] : catAx;
    const yAx = valAx.filter((a) => a !== xAx);
    const ax = strip({ cat: axisOf(xAx, false), val: axisOf(yAx[0], true), val2: out.kind === 'combo' && yAx[1] ? axisOf(yAx[1], true) : undefined });
    if (Object.keys(ax).length) out.axes = ax;
    const dr = path(root, 'txPr', 'p', 'pPr', 'defRPr');
    if (dr) { const f = strip({ sz: at(dr, 'sz') !== null ? clamp(num(dr, 'sz', 1200) / 100, 4, 200) : undefined, color: kid(dr, 'solidFill') ? colorOf(kid(dr, 'solidFill'), C).ref : undefined }); if (Object.keys(f).length) out.font = f; }
    for (const e of kids(kid(root, 'extLst'), 'ext')) {
      if ((at(e, 'uri') || '').toUpperCase() !== X.EXT.doek) continue;
      const pd = kid(e, 'chart');
      if (pd) { const st = num(pd, 'style', 0); if (st) out.style = st; const pl = at(pd, 'palette'); if (pl) out.palette = pl; }
    }
    return out;
  };
  const chartObj = async (el, nv, xf, C) => {
    const o = baseObj('chart', nv, xf, C);
    const rel = C.rels.get(rid(el, 'id'));
    const root = rel && !rel.ext ? await readXml(C.R, rel.target) : null;
    if (!root || root.localName !== 'chartSpace') { note(C.R, 'Een grafiek kon niet worden gelezen.'); o.chart = { kind: 'column', cats: [], series: [] }; return o; }
    const CC = { ...C, rels: await relsOf(C.R, rel.target), path: rel.target };
    try { o.chart = parseChart(root, CC); } catch (e) { console.warn('grafiek', e); note(C.R, 'Een grafiek kon niet worden gelezen.'); o.chart = { kind: 'column', cats: [], series: [] }; }
    const sp = kid(root, 'spPr');
    if (sp) { const f = await fillOf(sp, CC); if (f && f.type !== 'none') o.fill = f; const l = lineOf(kid(sp, 'ln'), CC); if (l && l.type !== 'none') o.line = l; }
    return o;
  };

  /* ---------- Overgangen ---------- */
  const transName = (t) => { const d = App.Trans && App.Trans.byId && App.Trans.byId(t); return d ? d.name : t; };
  const transOf = async (root, C) => {
    let tr = kid(root, 'transition');
    for (const ac of kids(root, 'AlternateContent')) {
      const ch = kid(ac, 'Choice'), req = (at(ch, 'Requires') || '').split(/\s+/).filter(Boolean);
      const t = (req.every((r) => ['p14', 'p15', 'p159', 'p'].includes(r)) && kid(ch, 'transition')) || kid(kid(ac, 'Fallback'), 'transition');
      if (t) tr = t;
    }
    if (!tr) return undefined;
    const eff = kids(tr).find((c) => c.localName !== 'sndAc' && c.localName !== 'extLst');
    let out = { type: 'none' };
    if (eff) {
      out = X.transIn(eff.localName, (n) => at(eff, n));
      if (out.unknown || out.approx) note(C.R, 'Overgang "{0}" is vervangen door "{1}".', out.from || eff.localName, transName(out.type));
      delete out.unknown; delete out.approx; delete out.from;
    }
    const d = tr.getAttributeNS(X.NS.p14, 'dur') || at(tr, 'p14:dur') || at(tr, 'dur');
    out.dur = d !== null && d !== '' && Number.isFinite(Number(d)) ? clamp(Number(d) / 1000, 0.01, 59) : X.SPEED[at(tr, 'spd') || 'fast'] || 0.5;
    if (at(tr, 'advClick') === '0' || at(tr, 'advClick') === 'false') out.click = false; else out.click = true;
    if (at(tr, 'advTm') !== null) out.after = clamp(num(tr, 'advTm', 0) / 1000, 0, 86400);
    const snd = path(tr, 'sndAc', 'stSnd', 'snd');
    if (snd) { const id = await loadMedia(C.R, C.rels.get(rid(snd, 'embed')), 'audio'); if (id) out.sound = id; }
    if (out.type === 'none' && out.click && out.after === undefined && !out.sound) return undefined;
    return out;
  };

  /* ---------- Animaties (p:timing) ---------- */
  const sec = (v) => (v === null || v === 'indefinite' || v === '' ? 0 : (Number(v) || 0) / 1000);
  const condDelay = (ctn) => sec(at(kid(kid(ctn, 'stCondLst'), 'cond'), 'delay'));
  const BEH = new Set(['set', 'anim', 'animEffect', 'animMotion', 'animScale', 'animRot', 'animClr', 'cmd', 'audio', 'video']);
  const effectOf = (ctn, C) => {
    const e = { cls: at(ctn, 'presetClass'), id: num(ctn, 'presetID', 0), sub: num(ctn, 'presetSubtype', 0), node: at(ctn, 'nodeType'), delay: condDelay(ctn), grp: at(ctn, 'grpId') || '0' };
    const rc = at(ctn, 'repeatCount');
    if (rc === 'indefinite') e.rep = all(kid(ctn, 'endCondLst'), 'cond').some((c) => at(c, 'evt') === 'onNext') ? 'next' : 'end';
    else if (rc !== null && Number(rc) > 1000) e.rep = Math.round(Number(rc) / 10) / 100;
    if (at(ctn, 'fill') === 'remove' || bool(ctn, 'autoRev', false)) e.rew = true;
    const it = kid(ctn, 'iterate');
    if (it && (at(it, 'type') === 'wd' || at(it, 'type') === 'lt')) { e.by = at(it, 'type') === 'wd' ? 'word' : 'letter'; const p = kid(it, 'tmPct'); e.byDelay = p ? r3(clamp(num(p, 'val', 10000) / 100000, 0, 1)) : 0.1; }
    let end = 0, mainEnd = 0;
    const behs = [];
    const walk = (list) => kids(list).forEach((b) => { if (BEH.has(b.localName)) behs.push(b); else if (b.localName === 'par' || b.localName === 'seq') walk(kid(kid(b, 'cTn'), 'childTnLst')); });
    walk(kid(ctn, 'childTnLst'));
    for (const b of behs) {
      const cb = kid(b, 'cBhvr'), bt = kid(cb, 'cTn');
      const st = condDelay(bt), d = sec(at(bt, 'dur'));
      const names = kids(kid(cb, 'attrNameLst'), 'attrName').map(txt);
      const tg = all(kid(cb, 'tgtEl'), 'spTgt')[0];
      if (tg && e.spid === undefined) { e.spid = at(tg, 'spid'); const pr = all(tg, 'pRg')[0]; if (pr) e.para = num(pr, 'st', 0) | 0; }
      const val = at(path(b, 'to', 'strVal'), 'val');
      const isHide = b.localName === 'set' && names.includes('style.visibility') && val === 'hidden';
      if (isHide && e.cls !== 'exit' && st > 0) { e.hideAfter = true; continue; }
      end = Math.max(end, st + d);
      if (!(b.localName === 'set' && d <= 0.002)) mainEnd = Math.max(mainEnd, st + d);
      switch (b.localName) {
        case 'animMotion': { const p = at(b, 'path'); if (p) e.path = p; break; }
        case 'animScale': { const by = kid(b, 'by'); if (by) e.scale = r3(Math.max(num(by, 'x', 100000), num(by, 'y', 100000)) / 100000); break; }
        case 'animRot': if (at(b, 'by') !== null) e.angle = r3(num(b, 'by', 0) / 60000); break;
        case 'animClr': { const k = colorOf(kid(b, 'to'), C); if (k) e.color = k.ref; break; }
        case 'set': if (names.includes('style.opacity') && val !== null && Number.isFinite(Number(val))) e.alpha = r3(clamp(Number(val), 0, 1)); break;
        case 'anim': if (names.includes('style.opacity')) { const tav = kids(kid(b, 'tavLst'), 'tav').pop(); const v = at(path(tav, 'val', 'fltVal'), 'val') || at(path(tav, 'val', 'strVal'), 'val'); if (v !== null && Number.isFinite(Number(v))) e.alpha = r3(clamp(Number(v), 0, 1)); } break;
        case 'cmd': e.cmd = at(b, 'cmd') || ''; break;
        default: break;
      }
    }
    e.dur = r3(Math.max(0.01, mainEnd || end || 0.5));
    return e;
  };
  // Hoofdreeks of interactieve reeks → klikgroepen met effecten (t = begintijd binnen de klikgroep)
  const seqGroups = (seqCtn, C) => {
    const groups = [];
    for (const cpar of kids(kid(seqCtn, 'childTnLst'), 'par')) {
      const cc = kid(cpar, 'cTn');
      const g = { auto: all(kid(cc, 'stCondLst'), 'cond').some((c) => at(c, 'evt') === 'onBegin'), items: [] };
      for (const tpar of kids(kid(cc, 'childTnLst'), 'par')) {
        const tc = kid(tpar, 'cTn');
        if (at(tc, 'presetClass') !== null) { const e = effectOf(tc, C); e.t = e.delay; g.items.push(e); continue; }
        const tdel = condDelay(tc);
        for (const epar of kids(kid(tc, 'childTnLst'), 'par')) {
          const ec = kid(epar, 'cTn');
          if (!ec || at(ec, 'presetClass') === null) continue;
          const e = effectOf(ec, C); e.t = tdel + e.delay; g.items.push(e);
        }
      }
      groups.push(g);
    }
    return groups;
  };
  const textDelay = (a, obj) => {
    if (!a.by || !obj || !obj.text) return 0;
    const n = App.plainText(obj.text, ' ').replace(/\s+/g, a.by === 'word' ? ' ' : '').split(a.by === 'word' ? ' ' : '').filter(Boolean).length;
    return Math.max(0, n - 1) * (a.byDelay !== undefined ? a.byDelay : 0.1) * Math.max(0.01, a.dur || 0.5);
  };
  const effName = (cls, eff) => (App.EFFECT_NAMES && App.EFFECT_NAMES[cls] && App.EFFECT_NAMES[cls][eff]) || eff;
  // Klikgroepen → Doek-animaties (vertragingen omgerekend naar de planner van anim.js)
  const toAnims = (groups, C, trig, objs, media) => {
    const out = [];
    groups.forEach((g, gi) => {
      let prevStart = 0, prevEnd = 0, first = true;
      g.items.forEach((e) => {
        if (e.cls === 'mediacall') {
          const id = C.spid.get(e.spid);
          if (id) { const m = media[id] = media[id] || {}; if (trig && trig.obj === id) m.play = 'click'; else if (!trig) m.play = gi === 0 && g.auto && e.node !== 'clickEffect' ? 'auto' : m.play || 'seq'; }
          return;
        }
        if (!/^(entr|exit|emph|path)$/.test(e.cls || '')) return;
        const obj = C.spid.get(e.spid);
        if (!obj) return;
        let start = e.node === 'withEffect' ? 'with' : e.node === 'afterEffect' ? 'after' : 'click';
        if (first && !(gi === 0 && g.auto)) start = 'click';
        if (!first && start === 'click') start = 'with';
        const delay = first ? e.t : start === 'with' ? e.t - prevStart : e.t - prevEnd;
        const m = X.effIn(e.cls, e.id, e.sub);
        if (m.unknown) note(C.R, 'Animatie-effect {0} is vervangen door "{1}".', e.cls + ' ' + e.id, effName(e.cls, m.eff));
        else if (m.approx) note(C.R, 'Animatie-effect {0} is vervangen door "{1}".', e.cls + ' ' + e.id, effName(e.cls, m.eff));
        const a = strip({ id: App.uid('a'), obj, cls: e.cls, eff: m.eff, dir: m.dir, start, dur: e.dur, delay: r3(Math.max(0, delay)), rep: e.rep, rew: e.rew, by: e.by, byDelay: e.by ? e.byDelay : undefined, trig: trig || undefined });
        if (e.cls === 'path') a.path = e.path ? normPath(e.path) : 'M0 0 L0.25 0';
        if (e.cls === 'emph') { const em = strip({ color: e.color, scale: m.eff === 'grow' ? e.scale : undefined, angle: m.eff === 'spin' ? e.angle : undefined, alpha: m.eff === 'transp' ? e.alpha : undefined }); if (Object.keys(em).length) a.emph = em; }
        if (e.hideAfter) a.after = { type: 'hide' };
        a._para = e.para; a._spid = e.spid; a._grp = e.grp + '|' + (trig ? JSON.stringify(trig) : '');
        const reps = typeof e.rep === 'number' ? e.rep : 1;
        prevStart = e.t; prevEnd = Math.max(prevEnd, e.t + e.dur * reps + textDelay(a, (objs.get(obj) || {})));
        first = false;
        out.push(a);
      });
    });
    return out;
  };
  // per-alinea-opbouw (bldP build="p") weer samenvoegen tot één animatie met seq 'para'
  const mergeParas = (list, bld) => {
    const out = [];
    for (const a of list) {
      const last = out[out.length - 1];
      if (last && a._para !== undefined && last._paras && last._spid === a._spid && last._grp === a._grp && last.cls === a.cls && last.eff === a.eff) { last._paras.push(a._para); continue; }
      if (a._para !== undefined) a._paras = [a._para];
      out.push(a);
    }
    out.forEach((a) => {
      if (a._paras) { if (a._paras.length > 1 && bld.get(a._spid + ':' + a._grp.split('|')[0]) === 'p') a.seq = 'para'; else a.para = a._paras[0]; }
      delete a._paras; delete a._para; delete a._spid; delete a._grp;
    });
    return out;
  };
  // bewegingspad van OOXML ('M 0 0 L 0.25 0 E') naar Doek ('M0 0 L0.25 0')
  const normPath = (p) => {
    const s = String(p).replace(/\s+E\s*$/, '').replace(/([MLCZmlcz])\s*/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    return /^[MLCZmlcz0-9 .eE+-]{1,20000}$/.test(s) ? s.replace(/(\d)([MLCZmlcz])/g, '$1 $2') : 'M0 0 L0.25 0';
  };
  const timingOf = (timing, C, objs) => {
    const res = { anims: [], media: {} };
    if (!timing) return res;
    const bld = new Map();
    kids(kid(timing, 'bldLst'), 'bldP').forEach((b) => bld.set(at(b, 'spid') + ':' + (at(b, 'grpId') || '0'), at(b, 'build') || 'whole'));
    const root = path(timing, 'tnLst', 'par', 'cTn');
    const list = [];
    for (const n of kids(kid(root, 'childTnLst'))) {
      if (n.localName === 'seq') {
        const sc = kid(n, 'cTn'), nt = at(sc, 'nodeType');
        if (nt === 'mainSeq') list.push(...toAnims(seqGroups(sc, C), C, null, objs, res.media));
        else if (nt === 'interactiveSeq') {
          const cond = kids(kid(sc, 'stCondLst'), 'cond').find((c) => /^(onClick|onMediaBookmark)$/.test(at(c, 'evt') || ''));
          const tg = cond && all(cond, 'spTgt')[0], bm = cond && all(cond, 'bmkTgt')[0];
          const id = tg ? C.spid.get(at(tg, 'spid')) : bm ? C.spid.get(at(bm, 'spid')) : null;
          if (!id) continue;
          const trig = at(cond, 'evt') === 'onMediaBookmark' ? { media: id, mark: (at(bm, 'bmkName') || '').slice(0, 100) } : { obj: id };
          list.push(...toAnims(seqGroups(sc, C), C, trig, objs, res.media));
        }
      } else if (n.localName === 'video' || n.localName === 'audio') {
        const cm = kid(n, 'cMediaNode'), tg = all(cm, 'spTgt')[0], id = tg && C.spid.get(at(tg, 'spid'));
        if (!id) continue;
        const m = res.media[id] = res.media[id] || {};
        if (at(cm, 'vol') !== null) m.vol = r3(clamp(num(cm, 'vol', 100000) / 100000, 0, 1));
        if (at(kid(cm, 'cTn'), 'repeatCount') === 'indefinite') m.loop = true;
        if (at(cm, 'showWhenStopped') === '0') m.hide = true;
        if (bool(n, 'fullScrn', false)) m.full = true;
      }
    }
    res.anims = mergeParas(list, bld);
    return res;
  };

  /* ---------- Thema, master en indelingen ---------- */
  const themeOf = async (R, p) => {
    const key = String(p || '').toLowerCase();
    if (R.themes.has(key)) return R.themes.get(key);
    const root = p ? await readXml(R, p) : null;
    const te = kid(root, 'themeElements'), cs = kid(te, 'clrScheme'), fs = kid(te, 'fontScheme'), fm = kid(te, 'fmtScheme');
    const def = App.COLOR_SETS[0].colors, raw = {};
    App.THEME_SLOTS.forEach((k) => {
      const c = colorEl(kid(cs, k));
      raw[k] = (c && (c.localName === 'srgbClr' ? hex6(at(c, 'val')) : c.localName === 'sysClr' ? hex6(at(c, 'lastClr')) || (at(c, 'val') === 'window' ? '#ffffff' : '#000000') : c.localName === 'prstClr' ? X.namedColor(at(c, 'val')) : null)) || def[k];
    });
    const font = (n) => { const t = at(path(fs, n, 'latin'), 'typeface'); return t && t.trim() ? t.trim().slice(0, 80) : (n === 'majorFont' ? 'Calibri Light' : 'Calibri'); };
    const th = {
      name: (at(root, 'name') || at(cs, 'name') || 'Office').slice(0, 200), raw, colorSet: at(cs, 'name') || undefined, fontSet: at(fs, 'name') || undefined,
      fonts: { major: font('majorFont'), minor: font('minorFont') },
      fmt: { fill: kids(kid(fm, 'fillStyleLst')), ln: kids(kid(fm, 'lnStyleLst'), 'ln'), effect: kids(kid(fm, 'effectStyleLst'), 'effectStyle'), bg: kids(kid(fm, 'bgFillStyleLst')) },
    };
    R.themes.set(key, th);
    return th;
  };
  const lvls = (el, C, n) => Array.from({ length: n }, (_, i) => { const l = kid(el, `lvl${i + 1}pPr`); return l ? lvlOf(l, C) : {}; });
  const txStylesOf = (ts, C) => {
    const def = App.defaultTx();
    if (!ts) return def;
    const t = kid(ts, 'titleStyle'), b = kid(ts, 'bodyStyle'), o = kid(ts, 'otherStyle');
    return { title: t ? lvls(t, C, 1) : def.title, body: b ? lvls(b, C, 9) : def.body, other: o ? lvls(o, C, 9) : def.other };
  };
  const bgOf = async (bg, C) => {
    if (!bg) return undefined;
    const pr = kid(bg, 'bgPr');
    if (pr) return fillOf(pr, C);
    const ref = kid(bg, 'bgRef');
    if (!ref) return undefined;
    const i = num(ref, 'idx', 0), k = colorOf(ref, C) || { ref: 'bg1' };
    const F = C.fmt || { fill: [], bg: [] };
    const el = i >= 1001 ? F.bg[i - 1001] : i > 0 ? F.fill[i - 1] : null;
    return (el && fillEl(el, { ...C, phClr: k })) || solid(k);
  };
  const sameBox = (o, m) => o.x === undefined || (m && m.x !== undefined && Math.abs(o.x - m.x) < 1 && Math.abs(o.y - m.y) < 1 && Math.abs(o.w - m.w) < 1 && Math.abs(o.h - m.h) < 1);
  const LAYOUTS = new Set(['title', 'obj', 'secHead', 'twoObj', 'twoTxTwoObj', 'titleOnly', 'blank', 'objTx', 'picTx', 'vertTx', 'vertTitleAndTx']);
  const masterOf = async (R, mp, n) => {
    const root = await readXml(R, mp);
    if (!root) throw new Error('master');
    const rels = await relsOf(R, mp);
    const tr = relOfType(rels, 'theme');
    const th = await themeOf(R, tr && tr.target);
    const cm = kid(root, 'clrMap');
    const g = (k, d) => at(cm, k) || d;
    const map = { bg1: g('bg1', 'lt1'), tx1: g('tx1', 'dk1'), bg2: g('bg2', 'lt2'), tx2: g('tx2', 'dk2') };
    // Doek heeft een vaste toewijzing (tekst 1 = dk1, achtergrond 1 = lt1): kleuren zo nodig omwisselen
    const colors = { dk1: th.raw[map.tx1] || th.raw.dk1, lt1: th.raw[map.bg1] || th.raw.lt1, dk2: th.raw[map.tx2] || th.raw.dk2, lt2: th.raw[map.bg2] || th.raw.lt2 };
    const slot = { tx1: 'tx1', bg1: 'bg1', tx2: 'tx2', bg2: 'bg2', hlink: 'hlink', folHlink: 'folHlink' };
    for (let i = 1; i <= 6; i++) { colors['accent' + i] = th.raw[g('accent' + i, 'accent' + i)] || th.raw['accent' + i]; slot['accent' + i] = 'accent' + i; }
    colors.hlink = th.raw[g('hlink', 'hlink')] || th.raw.hlink; colors.folHlink = th.raw[g('folHlink', 'folHlink')] || th.raw.folHlink;
    ['dk1', 'lt1', 'dk2', 'lt2'].forEach((s) => { slot[s] = map.tx1 === s ? 'dk1' : map.bg1 === s ? 'lt1' : map.tx2 === s ? 'dk2' : map.bg2 === s ? 'lt2' : th.raw[s]; });
    const theme = strip({ id: 'eigen', name: th.name, colors, fonts: { ...th.fonts }, colorSet: th.colorSet, fontSet: th.fontSet });
    const cSld = kid(root, 'cSld');
    const m = { id: App.uid('m'), name: (at(cSld, 'name') || th.name || 'Model ' + n).slice(0, 200), theme, objs: [], layouts: [] };
    const C = { R, path: mp, rels, theme, map: slot, fmt: th.fmt, kind: 'master', spid: new Map(), where: 'het diamodel', master: m };
    m.tx = txStylesOf(kid(root, 'txStyles'), C);
    m.tx.other = m.tx.other.map((l, i) => ({ ...(R.defOther[i] || {}), ...l }));
    R.masterCtx.set(m.id, { map: slot, fmt: th.fmt });
    m.bg = (await bgOf(kid(cSld, 'bg'), C)) || { type: 'solid', color: 'bg1' };
    m.objs = await treeOf(kid(cSld, 'spTree'), C);
    linkConns(m.objs, C);
    if (kid(root, 'timing')) note(R, 'Animaties op het diamodel zijn weggelaten.');
    for (const l of kids(kid(root, 'sldLayoutIdLst'), 'sldLayoutId')) {
      const rel = rels.get(rid(l, 'id'));
      if (!rel || rel.ext) continue;
      try { m.layouts.push(await layoutOf(R, rel.target, m, C)); } catch (e) { console.warn('indeling', e); note(R, 'Een indeling kon niet worden gelezen en is weggelaten.'); }
    }
    if (!m.layouts.length) { const l = App.buildMaster('kantoor').layouts.find((x) => x.type === 'obj'); m.layouts.push(l); }
    return m;
  };
  const layoutOf = async (R, lp, m, MC) => {
    const root = await readXml(R, lp);
    if (!root) throw new Error('layout');
    const C = { ...MC, path: lp, rels: await relsOf(R, lp), kind: 'layout', spid: new Map(), where: 'een indeling' };
    const cSld = kid(root, 'cSld'), t = at(root, 'type') || 'cust';
    const l = { id: App.uid('l'), name: (at(cSld, 'name') || App.LAYOUT_NAMES[t] || 'Indeling').slice(0, 200), type: LAYOUTS.has(t) ? t : 'cust', objs: [] };
    if (at(root, 'showMasterSp') === '0') l.hideMaster = true;
    const bg = await bgOf(kid(cSld, 'bg'), C); if (bg) l.bg = bg;
    l.objs = (await treeOf(kid(cSld, 'spTree'), C)).filter((o) => !(o.ph && /^(dt|ftr|sldNum)$/.test(o.ph.type) && sameBox(o, m.objs.find((x) => x.ph && x.ph.type === o.ph.type))));
    linkConns(l.objs, C);
    R.layoutByPath.set(lp.toLowerCase(), { layout: l, master: m });
    return l;
  };

  /* ---------- Notities en opmerkingen ---------- */
  const notesOf = async (R, np, C) => {
    const root = await readXml(R, np);
    const tree = path(root, 'cSld', 'spTree');
    const NC = { ...C, rels: await relsOf(R, np), path: np, spid: null };
    for (const sp of all(tree, 'sp')) {
      const ph = all(kid(sp, 'nvSpPr'), 'ph')[0];
      if (!ph || at(ph, 'type') !== 'body') continue;
      const b = bodyOf(kid(sp, 'txBody'), NC);
      if (b && b.paras.some((p) => p.runs.some((r) => r.t))) return { paras: b.paras };
    }
    return undefined;
  };
  const dateOf = (s) => { const t = Date.parse(s || ''); return Number.isFinite(t) ? t : Date.now(); };
  const commentsOf = async (R, rels) => {
    const out = [];
    for (const rel of rels.values()) {
      if (rel.ext || rel.type !== 'comments') continue;
      const root = await readXml(R, rel.target);
      if (!root) continue;
      if (/2018/.test(rel.full) || root.localName === 'cmLst' && kid(root, 'cm') && kid(kid(root, 'cm'), 'txBody')) {
        for (const cm of kids(root, 'cm')) {
          const c = { id: App.uid('c'), author: R.authors.get(at(cm, 'authorId')) || '', text: all(kid(cm, 'txBody'), 't').map(txt).join(''), t: dateOf(at(cm, 'created')), replies: [] };
          if (at(cm, 'status') === 'resolved') c.done = true;
          kids(kid(cm, 'replyLst'), 'reply').forEach((r) => c.replies.push({ id: App.uid('c'), author: R.authors.get(at(r, 'authorId')) || '', text: all(kid(r, 'txBody'), 't').map(txt).join(''), t: dateOf(at(r, 'created')) }));
          out.push(c);
        }
        continue;
      }
      const byKey = new Map(), list = [];
      for (const cm of kids(root, 'cm')) {
        const pos = kid(cm, 'pos');
        const c = strip({ id: App.uid('c'), author: R.authors.get(at(cm, 'authorId')) || '', text: txt(kid(cm, 'text')), t: dateOf(at(cm, 'dt')), x: pos ? r3(num(pos, 'x', 0) / 6) : undefined, y: pos ? r3(num(pos, 'y', 0) / 6) : undefined, replies: [] });
        byKey.set(at(cm, 'authorId') + ':' + at(cm, 'idx'), c);
        const par = all(cm, 'parentCm')[0];
        list.push({ c, parent: par ? at(par, 'authorId') + ':' + at(par, 'idx') : null });
      }
      list.forEach(({ c, parent }) => { const p = parent && byKey.get(parent); if (p && p !== c) p.replies.push({ id: c.id, author: c.author, text: c.text, t: c.t }); else out.push(c); });
    }
    return out;
  };

  /* ---------- Dia's ---------- */
  // Duur van media (voor p14:trim, waar het einde als 'afgeknipt vanaf het einde' staat)
  const mediaDur = (id) => new Promise((res) => {
    const m = App.media[id];
    if (!m) { res(0); return; }
    const el = document.createElement(/^audio/.test(m.mime) ? 'audio' : 'video');
    let done = false;
    const fin = (v) => { if (!done) { done = true; el.removeAttribute('src'); res(v); } };
    el.preload = 'metadata'; el.muted = true;
    el.onloadedmetadata = () => fin(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => fin(0);
    setTimeout(() => fin(0), 4000);
    el.src = m.url;
  });
  const slideOf = async (R, sp, no, sid) => {
    const root = await readXml(R, sp);
    if (!root) throw new Error('dia');
    const rels = await relsOf(R, sp);
    const lr = relOfType(rels, 'slideLayout');
    const L = (lr && R.layoutByPath.get(lr.target.toLowerCase())) || R.firstLayout;
    const mc = R.masterCtx.get(L.master.id);
    const C = { R, path: sp, rels, theme: L.master.theme, map: mc.map, fmt: mc.fmt, kind: 'slide', spid: new Map(), where: 'dia ' + no, master: L.master };
    const cSld = kid(root, 'cSld');
    const s = { id: sid, layout: L.layout.id, objs: [], anims: [] };
    const nm = at(cSld, 'name'); if (nm) s.name = nm.slice(0, 200);
    if (at(root, 'show') === '0' || at(root, 'show') === 'false') s.hidden = true;
    if (at(root, 'showMasterSp') === '0') s.hideMaster = true;
    const ov = path(root, 'clrMapOvr', 'overrideClrMapping');
    if (ov && ['bg1', 'tx1', 'bg2', 'tx2'].some((k) => at(ov, k) && at(ov, k) !== { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }[k])) note(R, 'Een afwijkende kleurtoewijzing per dia is vereenvoudigd.');
    const bg = await bgOf(kid(cSld, 'bg'), C); if (bg) s.bg = bg;
    s.objs = await treeOf(kid(cSld, 'spTree'), C);
    linkConns(s.objs, C);
    if (kid(cSld, 'controls')) note(R, 'ActiveX-besturingselementen zijn weggelaten.');
    // kop- en voetteksten: Doek heeft één instelling voor de hele presentatie (pres.hf)
    s.objs = s.objs.filter((o) => {
      if (!o.ph || !/^(dt|ftr|sldNum)$/.test(o.ph.type)) return true;
      const runs = o.text ? o.text.paras.flatMap((p) => p.runs) : [];
      R.hf.push({ type: o.ph.type, title: L.layout.type === 'title', text: runs.filter((r) => !r.fld).map((r) => r.t).join('').trim(), fld: (runs.find((r) => r.fld) || {}).fld });
      return false;
    });
    try { const tr = await transOf(root, C); if (tr) s.trans = tr; } catch (e) { console.warn('overgang', e); }
    const objs = new Map();
    App.walkObjs(s.objs, (o) => { objs.set(o.id, o); return true; });
    try {
      const tm = timingOf(kid(root, 'timing'), C, objs);
      s.anims = tm.anims.filter((a) => objs.has(a.obj));
      for (const o of objs.values()) {
        if (o.type !== 'video' && o.type !== 'audio') continue;
        Object.assign(o, tm.media[o.id] || {});
        if (o._trim) {
          const t = o._trim; delete o._trim;
          const dur = t.end ? await mediaDur(o.media) : 0;
          if (dur) o.dur = r3(dur);
          if (t.st || (t.end && dur)) o.trim = strip({ start: r3(t.st), end: t.end && dur ? r3(Math.max(t.st, dur - t.end)) : 0 });
        }
      }
    } catch (e) { console.warn('animaties', e); note(R, 'De animaties van dia {0} konden niet worden gelezen.', no); }
    const nr = relOfType(rels, 'notesSlide');
    if (nr && !nr.ext) { try { const n = await notesOf(R, nr.target, C); if (n) s.notes = n; } catch (e) { console.warn('notities', e); } }
    try { const cm = await commentsOf(R, rels); if (cm.length) s.comments = cm; } catch (e) { note(R, 'Opmerkingen konden niet worden gelezen.'); }
    return s;
  };

  /* ---------- Presentatie ---------- */
  const KIND = [['16:9', 16 / 9], ['4:3', 4 / 3], ['16:10', 1.6], ['A4', 1123 / 794], ['letter', 1056 / 816]];
  X._read = async (buf, title) => {
    if (!window.JSZip) throw new Error(App.t('Kan .pptx niet lezen: JSZip ontbreekt.'));
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8.length >= 4 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) throw new Error(App.t('Dit bestand is beveiligd met een wachtwoord of is een oud .ppt-bestand en kan niet worden geopend.'));
    let zip;
    try { zip = await window.JSZip.loadAsync(u8); } catch (e) { throw new Error(App.t('Dit is geen geldig PowerPoint-bestand (.pptx).')); }
    const R = mk(zip);
    let total = 0;
    Object.values(zip.files).forEach((f) => { total += sizeOf(f); });
    if (total > 4 * 1024 * 1024 * 1024) throw new Error(App.t('Het bestand is te groot om te openen.'));
    if ([...R.names.keys()].some((n) => /vbaproject\.bin$/.test(n))) note(R, 'Macro\'s zijn niet overgenomen.');
    if ([...R.names.keys()].some((n) => /^ppt\/activex\//.test(n))) note(R, 'ActiveX-besturingselementen zijn weggelaten.');
    const pkg = await relsOf(R, '');
    const docRel = [...pkg.values()].find((r) => r.type === 'officeDocument' && !r.ext);
    const pp = docRel ? docRel.target : 'ppt/presentation.xml';
    const pres = await readXml(R, pp);
    if (!pres || pres.localName !== 'presentation') throw new Error(App.t('Het bestand bevat geen presentatie.'));
    const prels = await relsOf(R, pp);
    // diaformaat
    const sz = kid(pres, 'sldSz');
    const W = px(num(sz, 'cx', 12192000)) || 1280, H = px(num(sz, 'cy', 6858000)) || 720;
    const kind = (KIND.find(([, r]) => Math.abs(W / H - r) < 0.01) || ['custom'])[0];
    if (kid(pres, 'embeddedFontLst')) note(R, 'Ingesloten lettertypen zijn niet overgenomen.');
    // dia-id's vooraf (voor koppelingen, secties, voorstellingen en zoom)
    const refs = [];
    for (const s of kids(kid(pres, 'sldIdLst'), 'sldId')) {
      const rel = prels.get(rid(s, 'id'));
      if (!rel || rel.ext || !fileOf(R, rel.target)) continue;
      if (refs.length >= X.MAX_SLIDES) { note(R, 'Het bestand heeft meer dan 5000 dia\'s; alleen de eerste 5000 zijn geopend.'); break; }
      const id = App.uid('s');
      refs.push({ path: rel.target, id, rid: rid(s, 'id') });
      R.slideByPath.set(rel.target.toLowerCase(), id);
      R.slideBySldId.set(at(s, 'id'), id);
      R.slideIds.push(id);
    }
    // aangepaste voorstellingen
    const shows = [];
    for (const cs of kids(kid(pres, 'custShowLst'), 'custShow')) {
      const id = App.uid('w');
      R.showIds.set(at(cs, 'id') || String(shows.length), id);
      shows.push({ id, name: (at(cs, 'name') || App.t('Aangepaste voorstelling')).slice(0, 200), slides: kids(kid(cs, 'sldLst'), 'sld').map((x) => { const r = prels.get(rid(x, 'id')); return r && R.slideByPath.get(r.target.toLowerCase()); }).filter(Boolean) });
    }
    // standaardtekststijl en schrijvers van opmerkingen
    const dts = kid(pres, 'defaultTextStyle');
    const DC = { R, rels: prels, theme: { colors: { ...App.COLOR_SETS[0].colors } }, map: { tx1: 'tx1', bg1: 'bg1', tx2: 'tx2', bg2: 'bg2', dk1: 'dk1', lt1: 'lt1', dk2: 'dk2', lt2: 'lt2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' } };
    if (dts) R.defOther = lvls(dts, DC, 9).map((l) => { const o = { ...l }; delete o.lang; return o; });
    const lang = at(path(dts, 'defPPr', 'defRPr'), 'lang') || at(path(dts, 'lvl1pPr', 'defRPr'), 'lang');
    for (const rel of prels.values()) {
      if (rel.ext) continue;
      if (rel.type === 'commentAuthors') kids(await readXml(R, rel.target), 'cmAuthor').forEach((a) => R.authors.set(at(a, 'id'), (at(a, 'name') || '').slice(0, 80)));
      if (rel.type === 'authors') kids(await readXml(R, rel.target), 'author').forEach((a) => R.authors.set(at(a, 'id'), (at(a, 'name') || '').slice(0, 80)));
    }
    // masters (met hun indelingen)
    const masters = [];
    let mi = 0;
    for (const m of kids(kid(pres, 'sldMasterIdLst'), 'sldMasterId')) {
      const rel = prels.get(rid(m, 'id'));
      if (!rel || rel.ext) continue;
      try { masters.push(await masterOf(R, rel.target, ++mi)); } catch (e) { console.warn('master', e); note(R, 'Een diamodel kon niet worden gelezen en is vervangen.'); }
    }
    if (!masters.length) { const m = App.buildMaster('kantoor', { size: { w: W, h: H } }); masters.push(m); R.masterCtx.set(m.id, { map: DC.map, fmt: null }); }
    const m0 = masters[0];
    R.firstLayout = { layout: m0.layouts.find((l) => l.type === 'obj') || m0.layouts[0], master: m0 };
    // dia's
    const slides = [];
    for (let i = 0; i < refs.length; i++) {
      try { slides.push(await slideOf(R, refs[i].path, i + 1, refs[i].id)); }
      catch (e) { console.warn('dia', i + 1, e); note(R, 'Dia {0} kon niet worden gelezen en is leeg gelaten.', i + 1); slides.push({ id: refs[i].id, layout: R.firstLayout.layout.id, objs: [], anims: [] }); }
    }
    // secties
    const sections = [];
    for (const e of kids(kid(pres, 'extLst'), 'ext')) {
      const u = (at(e, 'uri') || '').toUpperCase();
      if (u === X.EXT.sections) {
        for (const s of kids(kid(e, 'sectionLst'), 'section')) {
          const id = App.uid('q');
          sections.push({ id, name: (at(s, 'name') || App.t('Sectie zonder titel')).slice(0, 200) });
          kids(kid(s, 'sldIdLst'), 'sldId').forEach((x) => { const sid = R.slideBySldId.get(at(x, 'id')); const sl = slides.find((y) => y.id === sid); if (sl) sl.sec = id; });
        }
      }
    }
    if (sections.length) { let cur = sections[0].id; slides.forEach((s) => { if (s.sec) cur = s.sec; else s.sec = cur; }); }
    // hulplijnen (viewProps en p15:sldGuideLst)
    const guides = [];
    const addGuides = (list) => list.forEach((g) => { if (guides.length < 100) guides.push({ dir: at(g, 'orient') === 'horz' ? 'h' : 'v', pos: r3(num(g, 'pos', 0) / 6) }); });
    for (const e of kids(kid(pres, 'extLst'), 'ext')) if ((at(e, 'uri') || '').toUpperCase() === X.EXT.guides) addGuides(all(e, 'guide'));
    const vr = relOfType(prels, 'viewProps');
    if (!guides.length && vr) addGuides(all(path(await readXml(R, vr.target), 'slideViewPr', 'cSldViewPr', 'guideLst'), 'guide'));
    // voorstelling
    const show = {};
    const pr = relOfType(prels, 'presProps');
    const sp = pr ? kid(await readXml(R, pr.target), 'showPr') : null;
    if (sp) {
      show.type = kid(sp, 'kiosk') ? 'kiosk' : kid(sp, 'browse') ? 'window' : 'speaker';
      show.loop = bool(sp, 'loop', false);
      show.timings = bool(sp, 'useTimings', true);
      show.anims = bool(sp, 'showAnimation', true);
      if (!bool(sp, 'showNarration', true)) show.narration = false;
      const pc = colorOf(kid(sp, 'penClr'), DC); if (pc && pc.ref[0] === '#') show.pen = pc.ref;
    }
    // kop- en voetteksten
    const hf = { dt: false, dtAuto: true, dtFmt: 'short', dtText: '', sldNum: false, ftr: false, ftrText: '', notTitle: at(pres, 'showSpecialPlsOnTitleSld') === '0' };
    const has = (t, title) => R.hf.some((x) => x.type === t && (title === undefined || x.title === title));
    hf.sldNum = has('sldNum');
    const ft = R.hf.find((x) => x.type === 'ftr' && x.text); if (ft) { hf.ftr = true; hf.ftrText = ft.text.slice(0, 500); }
    const dt = R.hf.find((x) => x.type === 'dt');
    if (dt) { hf.dt = true; hf.dtAuto = !!dt.fld || !dt.text; hf.dtFmt = dt.fld && dt.fld.type !== 'datetime1' && dt.fld.type !== 'datetime' ? 'long' : 'short'; if (!hf.dtAuto) hf.dtText = dt.text.slice(0, 200); }
    if (!hf.notTitle) hf.notTitle = R.hf.length > 0 && !R.hf.some((x) => x.title) && slides.some((s) => (masters.flatMap((m) => m.layouts).find((l) => l.id === s.layout) || {}).type === 'title');
    const nonTitle = slides.filter((s) => (masters.flatMap((m) => m.layouts).find((l) => l.id === s.layout) || {}).type !== 'title').length;
    ['sldNum', 'ftr', 'dt'].forEach((t) => { const n = R.hf.filter((x) => x.type === t && !x.title).length; if (n && n < nonTitle) note(R, 'Kop- en voetteksten verschillen per dia; Doek gebruikt één instelling voor alle dia\'s.'); });
    // documenteigenschappen (geen auteur: geen persoonsgegevens)
    const props = { created: Date.now(), modified: Date.now() };
    const cr = [...pkg.values()].find((r) => r.type === 'core-properties' && !r.ext);
    const core = cr ? await readXml(R, cr.target) : null;
    if (core) {
      const c = (n) => txt(kid(core, n)).trim();
      if (c('subject')) props.subject = c('subject').slice(0, 500);
      if (c('keywords')) props.keywords = c('keywords').slice(0, 500);
      if (c('category')) props.category = c('category').slice(0, 200);
      if (c('created') && Number.isFinite(Date.parse(c('created')))) props.created = Date.parse(c('created'));
      if (c('modified') && Number.isFinite(Date.parse(c('modified')))) props.modified = Date.parse(c('modified'));
    }
    const docTitle = core ? txt(kid(core, 'title')).trim() : '';
    const raw = { format: 'doek', version: 1, id: App.uid('p'), title: (title || docTitle || App.t('Presentatie')).slice(0, 300), size: { w: W, h: H, kind }, masters, slides, sections, shows, hf, show, guides, lang: lang || (App.LANG === 'en' ? 'en-US' : 'nl-NL'), props };
    const P = App.deserializePres(raw, { media: false });
    P._importNotes = R.notes.slice();
    return P;
  };
})();
