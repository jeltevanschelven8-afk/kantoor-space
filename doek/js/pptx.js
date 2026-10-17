/* =========================================================
   Doek (gemaakt door JJ van Schelven) — PowerPoint-bestanden (.pptx/.potx): gedeelde onderdelen
   voor lezen en schrijven: naamruimten, eenheden, XML-hulpjes en de vertaaltabellen voor
   animaties, overgangen, tabelstijlen en vormen. Lezen staat in pptx-read.js, schrijven in
   pptx-write.js; die worden pas geladen als ze nodig zijn (of vooraf via een script-tag).
   ========================================================= */
'use strict';

(() => {
  const X = App.Pptx = App.Pptx || {};

  /* ---------- Naamruimten en relatietypen ---------- */
  X.NS = {
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
    mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
    p15: 'http://schemas.microsoft.com/office/powerpoint/2012/main',
    p159: 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
    a16: 'http://schemas.microsoft.com/office/drawing/2014/main',
    adec: 'http://schemas.microsoft.com/office/drawing/2017/decorative',
    asvg: 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
    rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
    ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
    cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
    dc: 'http://purl.org/dc/elements/1.1/',
    dcterms: 'http://purl.org/dc/terms/',
    dcmitype: 'http://purl.org/dc/dcmitype/',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
    ep: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
    vt: 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
    pd: 'urn:kantoor-space:doek:2026',   // eigen uitbreiding (wordt door andere programma's genegeerd)
  };
  X.R_STRICT = 'http://purl.oclc.org/ooxml/officeDocument/relationships';
  const RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  X.REL = {
    doc: RT + 'officeDocument', core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', app: RT + 'extended-properties',
    slide: RT + 'slide', master: RT + 'slideMaster', layout: RT + 'slideLayout', theme: RT + 'theme', notesMaster: RT + 'notesMaster', notesSlide: RT + 'notesSlide',
    presProps: RT + 'presProps', viewProps: RT + 'viewProps', tableStyles: RT + 'tableStyles', image: RT + 'image', video: RT + 'video', audio: RT + 'audio',
    media: 'http://schemas.microsoft.com/office/2007/relationships/media', chart: RT + 'chart', hyperlink: RT + 'hyperlink', comments: RT + 'comments', commentAuthors: RT + 'commentAuthors',
  };
  const CTP = 'application/vnd.openxmlformats-officedocument.';
  X.CT = {
    pres: CTP + 'presentationml.presentation.main+xml', potx: CTP + 'presentationml.template.main+xml', slide: CTP + 'presentationml.slide+xml',
    layout: CTP + 'presentationml.slideLayout+xml', master: CTP + 'presentationml.slideMaster+xml', notesMaster: CTP + 'presentationml.notesMaster+xml',
    notesSlide: CTP + 'presentationml.notesSlide+xml', theme: CTP + 'theme+xml', presProps: CTP + 'presentationml.presProps+xml', viewProps: CTP + 'presentationml.viewProps+xml',
    tableStyles: CTP + 'presentationml.tableStyles+xml', core: 'application/vnd.openxmlformats-package.core-properties+xml', app: CTP + 'extended-properties+xml',
    chart: CTP + 'drawingml.chart+xml', comments: CTP + 'presentationml.comments+xml', commentAuthors: CTP + 'presentationml.commentAuthors+xml',
    rels: 'application/vnd.openxmlformats-package.relationships+xml', xml: 'application/xml',
  };
  X.MIME = { pptx: CTP + 'presentationml.presentation', potx: CTP + 'presentationml.template' };
  // extensie → MIME-type van media
  X.EXT_MIME = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg' };
  X.MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };
  // vaste GUID's van uitbreidingen
  X.EXT = {
    sections: '{521415D9-36F7-43E2-AB2F-B90AF26B5E84}', guides: '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}', media: '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}',
    decorative: '{C183D7F6-B498-43B3-948B-1728B52AA6E4}', svg: '{96DAC541-7B7A-43D3-8B79-37D633B846F1}', thread: '{C676402C-5697-4E1C-873F-D02D1690AC5C}',
    doek: '{5D0A1F7E-6B3C-4C2D-9E51-0D1A5C0D1A26}',
  };
  X.MAX_SLIDES = 5000;
  X.MAX_MEDIA = 300 * 1024 * 1024;

  /* ---------- Eenheden ---------- */
  const E = 9525;
  X.emu = (px) => Math.round((Number(px) || 0) * E);                    // px → EMU
  X.px = (emu) => Math.round((Number(emu) || 0) / E * 1000) / 1000;     // EMU → px
  X.lnE = (pt) => Math.round((Number(pt) || 0) * 12700);                // pt → EMU (lijndikte)
  X.lnPt = (e) => Math.round((Number(e) || 0) / 12700 * 1000) / 1000;
  X.ang = (deg) => Math.round(((((Number(deg) || 0) % 360) + 360) % 360) * 60000) % 21600000;   // graden → 60000sten, 0..360
  X.deg = (v) => Math.round((Number(v) || 0) / 60000 * 1000) / 1000;
  X.pct = (f) => Math.round((Number(f) || 0) * 100000);                 // 0..1 → 100000sten
  X.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- XML schrijven ---------- */
  // Tekens die niet in XML 1.0 mogen (ook losse surrogaten) weghalen en speciale tekens omzetten
  const BAD = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
  X.clean = (s) => String(s ?? '').replace(BAD, '');
  X.x = (s) => X.clean(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  X.attrs = (o) => {
    let s = '';
    if (o) for (const k of Object.keys(o)) { const v = o[k]; if (v === undefined || v === null || v === false) continue; s += ` ${k}="${X.x(v === true ? 1 : v)}"`; }
    return s;
  };
  // tag('a:off', { x: 1 }) → <a:off x="1"/>; met inhoud: <naam …>inhoud</naam>
  X.tag = (name, a, inner) => (inner === undefined || inner === null || inner === '' ? `<${name}${X.attrs(a)}/>` : `<${name}${X.attrs(a)}>${inner}</${name}>`);
  X.decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  X.guid = () => {
    const h = (n) => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
    return `{${h(8)}-${h(4)}-4${h(3)}-${'89AB'[Math.floor(Math.random() * 4)]}${h(3)}-${h(12)}}`;
  };

  /* ---------- Vertaaltabel: animatie-effecten ----------
     PowerPoint-presetID ↔ Doek-effect (zie anim.js). Per klasse (entr = ingang, exit = uitgang, emph = nadruk, path = pad).
     sub = hoe presetSubtype de richting geeft:
       side   1 boven, 2 rechts, 4 onder, 8 links (opgeteld voor schuin)  → dir 't' 'r' 'b' 'l' 'tr' 'br' 'tl' 'bl'
       hv     10 horizontaal, 5 verticaal                                → dir undefined | 'vert'
       inout  16 in, 32 uit (vorm: dir = 'circle' 'box' 'boxOut' 'diamond' 'plus')
       split  21 verticaal in, 26 horizontaal in, 37 verticaal uit, 42 horizontaal uit → 'vertIn' 'horzIn' 'vertOut' 'horzOut'
       spokes aantal spaken (1, 2, 3, 4, 8)                              → dir '1' … '8'
       zoom   16 in, 32 uit                                              → dir undefined | 'out'
     dir = vaste richting van dit preset; approx = alleen bij inlezen: Doek heeft geen gelijk effect (wordt gemeld). */
  const ef = (cls, id, eff, o) => Object.assign({ cls, id, eff }, o || {});
  const SIDE = { sub: 'side' }, HV = { sub: 'hv' }, AP = { approx: true }, APS = { sub: 'side', approx: true };
  const ENTR_EXIT = [
    [1, 'appear'], [2, 'fly', SIDE], [3, 'blinds', HV], [4, 'shape', { sub: 'inout', dir: 'box' }], [5, 'checker', HV], [6, 'shape', { sub: 'inout', dir: 'circle' }],
    [7, 'fly', APS], [8, 'shape', { sub: 'inout', dir: 'diamond' }], [9, 'dissolve'], [10, 'fade'], [11, 'appear', AP], [12, 'peek', SIDE],
    [13, 'shape', { sub: 'inout', dir: 'plus' }], [14, 'randomBars', HV], [15, 'zoom', AP], [16, 'split', { sub: 'split' }], [17, 'zoom', AP], [18, 'wipe', APS],
    [19, 'swivel'], [20, 'wheel', AP], [21, 'wheel', { sub: 'spokes' }], [22, 'wipe', SIDE], [23, 'zoom', { sub: 'zoom' }], [24, 'fade', AP], [25, 'spin', AP],
    [26, 'bounce'], [27, 'fade', AP], [28, 'fade', AP], [29, 'float', AP], [30, 'float', AP], [31, 'grow'], [34, 'fly', APS], [35, 'spin', AP], [37, 'float', AP],
    [38, 'fly', APS], [39, 'zoom', AP], [40, 'zoom', AP], [41, 'fly', APS], [42, 'float'], [43, 'spin', AP], [45, 'swivel', AP], [47, 'float', { dir: 'd' }],
    [48, 'fly', APS], [49, 'spin'], [50, 'zoom', AP], [51, 'zoom', AP], [52, 'float', AP], [53, 'zoom'], [54, 'fly', APS], [55, 'zoom', AP], [56, 'swivel', AP], [58, 'swivel', AP],
  ];
  const EMPH = [
    [26, 'pulse'], [27, 'colorPulse'], [32, 'teeter'], [8, 'spin'], [6, 'grow'], [25, 'desaturate'], [24, 'darken'], [30, 'lighten'], [9, 'transp'],
    [19, 'objColor'], [1, 'fillColor'], [7, 'lineColor'], [3, 'fontColor'], [15, 'bold'], [34, 'wave'], [18, 'underline'],
    [2, 'bold', AP], [4, 'grow', AP], [5, 'bold', AP], [10, 'bold', AP], [14, 'grow', AP], [16, 'fontColor', AP], [20, 'fontColor', AP], [21, 'objColor', AP],
    [22, 'objColor', AP], [23, 'objColor', AP], [28, 'grow', AP], [29, 'pulse', AP], [31, 'bold', AP], [33, 'fontColor', AP], [35, 'colorPulse', AP], [36, 'pulse', AP],
  ];
  X.EFFECTS = [
    ...ENTR_EXIT.map(([id, eff, o]) => ef('entr', id, eff, o)),
    ...ENTR_EXIT.map(([id, eff, o]) => ef('exit', id, eff, o)),
    ...EMPH.map(([id, eff, o]) => ef('emph', id, eff, o)),
    ef('path', 0, 'path'),
  ];
  const EFF_BY = {};
  X.EFFECTS.forEach((e) => { EFF_BY[e.cls + ':' + e.id] = e; });
  const SIDE_DIR = { 1: 't', 2: 'r', 4: 'b', 8: 'l', 3: 'tr', 6: 'br', 9: 'tl', 12: 'bl' };
  const SPLIT_DIR = { 21: 'vertIn', 26: 'horzIn', 37: 'vertOut', 42: 'horzOut' };
  // presetID + presetSubtype → { eff, dir, approx, unknown }
  X.effIn = (cls, id, subtype) => {
    if (cls === 'path') return { eff: 'path' };
    const e = EFF_BY[cls + ':' + id];
    if (!e) return { eff: cls === 'emph' ? 'pulse' : 'fade', unknown: true };
    const out = { eff: e.eff, approx: !!e.approx };
    const s = Number(subtype) || 0;
    if (e.sub === 'side') out.dir = SIDE_DIR[s] || 'b';
    else if (e.sub === 'hv') out.dir = s === 5 ? 'vert' : undefined;
    else if (e.sub === 'inout') out.dir = e.dir === 'box' && s === 32 ? 'boxOut' : e.dir;
    else if (e.sub === 'split') out.dir = SPLIT_DIR[s] || 'vertIn';
    else if (e.sub === 'spokes') out.dir = s >= 1 && s <= 8 ? String(s) : '1';
    else if (e.sub === 'zoom') out.dir = s === 32 ? 'out' : undefined;
    else if (e.dir) out.dir = e.dir;
    if (out.dir === undefined) delete out.dir;
    return out;
  };
  // Doek-effect → { id, subtype } (onbekend: vervagen/pulseren, unknown = true)
  X.effOut = (cls, eff, dir) => {
    if (cls === 'path') return { id: 0, subtype: 0 };
    const list = X.EFFECTS.filter((e) => e.cls === cls && e.eff === eff && !e.approx);
    let e = list[0];
    if (eff === 'shape') e = list.find((x) => String(dir || 'circle').startsWith(x.dir)) || list.find((x) => x.dir === 'circle');
    if (eff === 'float') e = list.find((x) => (dir === 'd' ? x.dir === 'd' : !x.dir));
    if (eff === 'zoom') e = list.find((x) => (dir === 'out' ? x.sub === 'zoom' : !x.sub));
    if (!e) { const f = X.effOut(cls, cls === 'emph' ? 'pulse' : 'fade'); return { ...f, unknown: true }; }
    let subtype = 0;
    if (e.sub === 'side') subtype = String(dir || 'b').split('').reduce((n, c) => n + ({ t: 1, r: 2, b: 4, l: 8 }[c] || 0), 0) || 4;
    else if (e.sub === 'hv') subtype = dir === 'vert' ? 5 : 10;
    else if (e.sub === 'inout') subtype = /Out$/.test(dir || '') ? 32 : 16;
    else if (e.sub === 'split') subtype = { vertIn: 21, horzIn: 26, vertOut: 37, horzOut: 42 }[dir] || 21;
    else if (e.sub === 'spokes') subtype = X.clamp(parseInt(dir, 10) || 1, 1, 8);
    else if (e.sub === 'zoom') subtype = dir === 'out' ? 32 : 16;
    else if (e.id === 53 && cls !== 'emph') subtype = 16;
    return { id: e.id, subtype };
  };
  /* ---------- Vertaaltabel: overgangen ----------
     [Doek-type (transitions.js), OOXML-element, richting]. Richting 'inv': in OOXML is dir de bewegingsrichting
     (dir="u" = 'van onder'), Doek bewaart 'Vanaf …' (dir 'd') — omgekeerd. 'same' = gelijk. p14/p15/p159-overgangen
     worden geschreven in mc:AlternateContent met Vervagen als terugval. */
  X.TRANSITIONS = [
    ['none', '(geen element)'], ['morph', 'p159:morph option=byObject|byWord|byChar', 'obj|word|char'], ['fade', 'p:fade', 'black = thruBlk'],
    ['push', 'p:push', 'inv'], ['wipe', 'p:wipe (l r u d) / p:strips (schuin)', 'inv'], ['split', 'p:split orient dir', 'vertOut|vertIn|horzOut|horzIn'],
    ['reveal', 'p14:reveal', 'l|r|blackL|blackR'], ['cut', 'p:cut', 'black = thruBlk'], ['randomBars', 'p:randomBar', 'same (horz|vert)'],
    ['shape', 'p:circle | p:diamond | p:plus | p:zoom (in|out)', 'circle|diamond|plus|in|out'], ['uncover', 'p:pull', 'inv'], ['cover', 'p:cover', 'inv'],
    ['flash', 'p14:flash'], ['fall', 'p15:prstTrans prst=fallOver', 'r = invX'], ['curtains', 'p15:prstTrans prst=curtains'], ['wind', 'p15:prstTrans prst=wind', 'l = invX'],
    ['curl', 'p15:prstTrans prst=pageCurlSingle', 'r = invX'], ['dissolve', 'p:dissolve'], ['checker', 'p:checker', 'l = horz, u = vert'], ['blinds', 'p:blinds', 'same'],
    ['clock', 'p:wheel spokes=1 | p14:wheelReverse | p:wedge', 'cw|ccw|wedge'], ['ripple', 'p14:ripple'], ['switch', 'p14:switch', 'same'], ['flip', 'p14:flip', 'same'],
    ['gallery', 'p14:gallery', 'inv'], ['cube', 'p14:prism', 'inv'], ['doors', 'p14:doors', 'same'], ['box', 'p14:prism isInverted=1', 'inv'], ['comb', 'p:comb', 'same'],
    ['zoom', 'p14:warp (in|out) | p:newsflash (inRound)', 'in|out|inRound'], ['random', 'p:random'], ['pan', 'p14:pan', 'inv'], ['rotate', 'p14:prism isContent=1', 'same'],
    ['window', 'p14:window', 'same'], ['orbit', 'p14:prism isContent=1 isInverted=1', 'same'], ['flyThrough', 'p14:flythrough', 'in|out'],
  ];
  // Alleen bij inlezen: benaderingen (met melding) — de rest wordt Vervagen met een melding
  X.TRANS_APPROX = { strips: 'wipe', randomBar: 'randomBars', newsflash: 'zoom', conveyor: 'pan', ferris: 'rotate', glitter: 'dissolve', honeycomb: 'dissolve', shred: 'dissolve', vortex: 'ripple', drape: 'curtains', peelOff: 'curl', pageCurlDouble: 'curl', fracture: 'dissolve', crush: 'dissolve', prestige: 'fade', airplane: 'fade', origami: 'fade' };
  const INV = { l: 'r', r: 'l', u: 'd', d: 'u', lu: 'rd', rd: 'lu', ru: 'ld', ld: 'ru' };
  const inv = (d, def) => INV[d] || INV[def];
  const lr = (d, def) => (d === 'l' || d === 'r' ? d : def);
  // Doek-overgang → { ns: 'p'|'p14'|'p15'|'p159', name, a: attributen } of null (geen effect)
  X.transOut = (t) => {
    const d = t && t.dir;
    switch (t && t.type) {
      case 'none': case undefined: case null: return null;
      case 'morph': return { ns: 'p159', name: 'morph', a: { option: { word: 'byWord', char: 'byChar' }[t.morphBy || d] || 'byObject' } };
      case 'fade': return { ns: 'p', name: 'fade', a: { thruBlk: d === 'black' ? 1 : undefined } };
      case 'push': return { ns: 'p', name: 'push', a: { dir: inv(d, 'd') } };
      case 'wipe': return /^(lu|ru|ld|rd)$/.test(d || '') ? { ns: 'p', name: 'strips', a: { dir: inv(d) } } : { ns: 'p', name: 'wipe', a: { dir: inv(d, 'r') } };
      case 'split': { const s = d || 'vertOut'; return { ns: 'p', name: 'split', a: { orient: /^vert/.test(s) ? 'vert' : 'horz', dir: /In$/.test(s) ? 'in' : 'out' } }; }
      case 'reveal': return { ns: 'p14', name: 'reveal', a: { thruBlk: /^black/.test(d || '') ? 1 : undefined, dir: /R$|^r$/.test(d || '') ? 'r' : 'l' } };
      case 'cut': return { ns: 'p', name: 'cut', a: { thruBlk: d === 'black' ? 1 : undefined } };
      case 'randomBars': return { ns: 'p', name: 'randomBar', a: { dir: d === 'vert' ? 'vert' : 'horz' } };
      case 'shape': return d === 'in' || d === 'out' ? { ns: 'p', name: 'zoom', a: { dir: d } } : { ns: 'p', name: d === 'diamond' || d === 'plus' ? d : 'circle', a: {} };
      case 'uncover': return { ns: 'p', name: 'pull', a: { dir: inv(d, 'l') } };
      case 'cover': return { ns: 'p', name: 'cover', a: { dir: inv(d, 'l') } };
      case 'flash': return { ns: 'p14', name: 'flash', a: {} };
      case 'fall': return { ns: 'p15', name: 'prstTrans', a: { prst: 'fallOver', invX: d === 'r' ? 1 : undefined } };
      case 'curtains': return { ns: 'p15', name: 'prstTrans', a: { prst: 'curtains' } };
      case 'wind': return { ns: 'p15', name: 'prstTrans', a: { prst: 'wind', invX: d === 'l' ? 1 : undefined } };
      case 'curl': return { ns: 'p15', name: 'prstTrans', a: { prst: 'pageCurlSingle', invX: d === 'r' ? 1 : undefined } };
      case 'dissolve': return { ns: 'p', name: 'dissolve', a: {} };
      case 'checker': return { ns: 'p', name: 'checker', a: { dir: d === 'u' ? 'vert' : 'horz' } };
      case 'blinds': return { ns: 'p', name: 'blinds', a: { dir: d === 'horz' ? 'horz' : 'vert' } };
      case 'clock': return d === 'wedge' ? { ns: 'p', name: 'wedge', a: {} } : d === 'ccw' ? { ns: 'p14', name: 'wheelReverse', a: { spokes: 1 } } : { ns: 'p', name: 'wheel', a: { spokes: 1 } };
      case 'ripple': return { ns: 'p14', name: 'ripple', a: {} };
      case 'switch': return { ns: 'p14', name: 'switch', a: { dir: lr(d, 'r') } };
      case 'flip': return { ns: 'p14', name: 'flip', a: { dir: lr(d, 'r') } };
      case 'gallery': return { ns: 'p14', name: 'gallery', a: { dir: inv(lr(d, 'r')) } };
      case 'cube': return { ns: 'p14', name: 'prism', a: { dir: inv(d, 'l') } };
      case 'box': return { ns: 'p14', name: 'prism', a: { dir: inv(d, 'l'), isInverted: 1 } };
      case 'doors': return { ns: 'p14', name: 'doors', a: { dir: d === 'horz' ? 'horz' : 'vert' } };
      case 'comb': return { ns: 'p', name: 'comb', a: { dir: d === 'vert' ? 'vert' : 'horz' } };
      case 'zoom': return d === 'inRound' ? { ns: 'p', name: 'newsflash', a: {} } : { ns: 'p14', name: 'warp', a: { dir: d === 'out' ? 'out' : 'in' } };
      case 'random': return { ns: 'p', name: 'random', a: {} };
      case 'pan': return { ns: 'p14', name: 'pan', a: { dir: inv(d, 'u') } };
      case 'rotate': return { ns: 'p14', name: 'prism', a: { dir: lr(d, 'r'), isContent: 1 } };
      case 'window': return { ns: 'p14', name: 'window', a: { dir: d === 'horz' ? 'horz' : 'vert' } };
      case 'orbit': return { ns: 'p14', name: 'prism', a: { dir: lr(d, 'r'), isContent: 1, isInverted: 1 } };
      case 'flyThrough': return { ns: 'p14', name: 'flythrough', a: { dir: d === 'out' ? 'out' : 'in' } };
      default: return { ns: 'p', name: 'fade', a: {}, unknown: true };
    }
  };
  // OOXML-overgang (lokale naam + attributen) → { type, dir, approx, unknown }
  X.transIn = (name, g) => {
    const dir = g('dir'), tb = g('thruBlk') === '1' || g('thruBlk') === 'true';
    const r = (type, d, o) => Object.assign({ type }, d === undefined ? {} : { dir: d }, o || {});
    switch (name) {
      case 'fade': return r('fade', tb ? 'black' : undefined);
      case 'push': return r('push', inv(dir, 'l'));
      case 'wipe': return r('wipe', inv(dir, 'l'));
      case 'strips': return r('wipe', inv(dir, 'lu'));
      case 'split': return r('split', (g('orient') === 'vert' ? 'vert' : 'horz') + (dir === 'in' ? 'In' : 'Out'));
      case 'reveal': return r('reveal', (tb ? 'black' : '') + (tb ? (dir === 'r' ? 'R' : 'L') : (dir === 'r' ? 'r' : 'l')));
      case 'cut': return r('cut', tb ? 'black' : undefined);
      case 'randomBar': return r('randomBars', dir === 'vert' ? 'vert' : 'horz');
      case 'circle': case 'diamond': case 'plus': return r('shape', name);
      case 'zoom': return r('shape', dir === 'in' ? 'in' : 'out');
      case 'pull': return r('uncover', inv(dir, 'l'));
      case 'cover': return r('cover', inv(dir, 'l'));
      case 'flash': return r('flash');
      case 'prstTrans': {
        const p = g('prst') || 'fallOver', ix = g('invX') === '1' || g('invX') === 'true';
        if (p === 'fallOver') return r('fall', ix ? 'r' : 'l');
        if (p === 'curtains') return r('curtains');
        if (p === 'wind') return r('wind', ix ? 'l' : 'r');
        if (p === 'pageCurlSingle') return r('curl', ix ? 'r' : 'l');
        const a = X.TRANS_APPROX[p];
        return a ? r(a, a === 'curl' ? (ix ? 'r' : 'l') : undefined, { approx: true, from: p }) : r('fade', undefined, { unknown: true, from: p });
      }
      case 'dissolve': return r('dissolve');
      case 'checker': return r('checker', dir === 'vert' ? 'u' : 'l');
      case 'blinds': return r('blinds', dir === 'vert' ? 'vert' : 'horz');
      case 'wheel': return r('clock', 'cw', +(g('spokes') || 4) > 1 ? { approx: true, from: 'wheel' } : undefined);
      case 'wheelReverse': return r('clock', 'ccw');
      case 'wedge': return r('clock', 'wedge');
      case 'ripple': return r('ripple');
      case 'switch': return r('switch', lr(dir, 'r'));
      case 'flip': return r('flip', lr(dir, 'r'));
      case 'gallery': return r('gallery', inv(lr(dir, 'l')));
      case 'prism': {
        const content = g('isContent') === '1' || g('isContent') === 'true', inverted = g('isInverted') === '1' || g('isInverted') === 'true';
        if (content) return r(inverted ? 'orbit' : 'rotate', lr(dir, 'r'));
        return r(inverted ? 'box' : 'cube', inv(dir, 'l'));
      }
      case 'doors': return r('doors', dir === 'horz' ? 'horz' : 'vert');
      case 'window': return r('window', dir === 'horz' ? 'horz' : 'vert');
      case 'comb': return r('comb', dir === 'vert' ? 'vert' : 'horz');
      case 'warp': return r('zoom', dir === 'out' ? 'out' : 'in');
      case 'newsflash': return r('zoom', 'inRound');
      case 'random': return r('random');
      case 'pan': return r('pan', inv(dir, 'd'));
      case 'flythrough': return r('flyThrough', dir === 'out' ? 'out' : 'in');
      case 'morph': { const o = g('option'); const by = o === 'byWord' ? 'word' : o === 'byChar' ? 'char' : 'obj'; return r('morph', by, { morphBy: by }); }
      case 'conveyor': return r('pan', inv(lr(dir, 'l')), { approx: true, from: name });
      case 'ferris': return r('rotate', lr(dir, 'r'), { approx: true, from: name });
      default: { const a = X.TRANS_APPROX[name]; return a ? r(a, undefined, { approx: true, from: name }) : r('fade', undefined, { unknown: true, from: name }); }
    }
  };
  X.SPEED = { slow: 1, med: 0.75, fast: 0.5 };

  /* ---------- Vertaaltabel: tabelstijlen (GUID's van de ingebouwde stijlen) ----------
     Doek-id = familie:kleur zoals in tables.js; tx1 = de stijl zonder accentkleur. Families die tables.js niet kent,
     worden bij inlezen de dichtstbijzijnde (themed2 → themed1, medium3 → medium2, dark2 → dark1). */
  X.TABLE_STYLES = {
    '{2D5ABB26-0587-4C30-8999-92F81FD0307C}': 'none', '{5940675A-B579-460E-94D1-54222C63F5DA}': 'grid',
    '{3C2FFA5D-87B4-456A-9821-1D502468CF0F}': 'themed1:accent1', '{284E427A-3D55-4303-BF80-6455036E1DE7}': 'themed1:accent2', '{69C7853C-536D-4A76-A0AE-DD22124D55A5}': 'themed1:accent3',
    '{775DCB02-9BB8-47FD-8907-85C794F793BA}': 'themed1:accent4', '{35758FB7-9AC5-4552-8A53-C91805E547FA}': 'themed1:accent5', '{08FB837D-C827-4EFA-A057-4D05807E0F7C}': 'themed1:accent6',
    '{D113A9D2-9D6B-4929-AA2D-F23B5EE8CBE7}': 'themed2:accent1', '{18603FDC-E32A-4AB5-989C-0864C3EAD2B8}': 'themed2:accent2', '{306799F8-075E-4A3A-A7F6-7FBC6576F1A4}': 'themed2:accent3',
    '{E269D01E-BC32-4049-B463-5C60D7B0CCD2}': 'themed2:accent4', '{327F97BB-C833-4FB7-BDE5-3F7075034690}': 'themed2:accent5', '{638B1855-1B75-4FBE-930C-398BA8C253C6}': 'themed2:accent6',
    '{9D7B26C5-4107-4FEC-AEDC-1716B250EE53}': 'light1:tx1', '{3B4B98B0-60AC-42C2-AFA5-B58CD77FA1E5}': 'light1:accent1', '{0E3FDE45-AF77-4B5C-9715-49D594BDF05E}': 'light1:accent2',
    '{C083E6E3-FA7D-4D7B-A595-EF9225AFEA82}': 'light1:accent3', '{D27102A9-8310-4765-A935-A1911B00CA55}': 'light1:accent4', '{5FD0F851-EC5A-4D38-B0AD-8093EC10F338}': 'light1:accent5',
    '{68D230F3-CF80-4859-8CE7-A43EE81993B5}': 'light1:accent6', '{7E9639D4-E3E2-4D34-9284-5A2195B3D0D7}': 'light2:tx1', '{69012ECD-51FC-41F1-AA8D-1B2483CD663E}': 'light2:accent1',
    '{72833802-FEF1-4C79-8D5D-14CF1EAF98D9}': 'light2:accent2', '{F2DE63D5-997A-4646-A377-4702673A728D}': 'light2:accent3', '{17292A2E-F333-43FB-9621-5CBBE7FDCDCB}': 'light2:accent4',
    '{5A111915-BE36-4E01-A7E5-04B1672EAD39}': 'light2:accent5', '{912C8C85-51F0-491E-9774-3900AFEF0FD7}': 'light2:accent6', '{616DA210-FB5B-4158-B5E0-FEB733F419BA}': 'light3:tx1',
    '{BC89EF96-8CEA-46FF-86C4-4CE0E7609802}': 'light3:accent1', '{5DA37D80-6434-44C2-A8B9-2575D60D3ADB}': 'light3:accent2', '{8799B23B-EC83-4686-B30A-512413B5E67A}': 'light3:accent3',
    '{ED083AE6-46FA-4A59-8FB0-9F97EB10719F}': 'light3:accent4', '{BDBED569-4797-4DF1-A0F4-6AAB3CD982D8}': 'light3:accent5', '{E8B1032C-EA38-4F05-BA0D-38AFFFC7BED3}': 'light3:accent6',
    '{793D81CF-94F2-401A-BA57-92F5A7B2D0C5}': 'medium1:tx1', '{B301B821-A1FF-4177-AEE7-76D212191A09}': 'medium1:accent1', '{9DCAF9ED-07DC-4A11-8D7F-57B35C25682E}': 'medium1:accent2',
    '{1FECB4D8-DB02-4DC6-A0A2-4F2EBAE1DC90}': 'medium1:accent3', '{1E171933-4619-4E11-9A3F-F7608DF75F80}': 'medium1:accent4', '{FABFCF23-3B69-468F-B69F-88F6DE6A72F2}': 'medium1:accent5',
    '{10A1B5D5-9B99-4C35-A422-299274C87663}': 'medium1:accent6', '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'medium2:tx1', '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'medium2:accent1',
    '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'medium2:accent2', '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'medium2:accent3', '{00A15C55-8517-42AA-B614-E9B94910E393}': 'medium2:accent4',
    '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'medium2:accent5', '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'medium2:accent6', '{8EC20E35-A176-4012-BC5E-935CFFF8708E}': 'medium3:tx1',
    '{6E25E649-3F16-4E02-A733-19D2CDBF48F0}': 'medium3:accent1', '{85BE263C-DBD7-4A20-BB59-AAB30ACAA65A}': 'medium3:accent2', '{EB344D84-9AFB-497E-A393-DC336BA19D2E}': 'medium3:accent3',
    '{EB9631B5-78F2-41C9-869B-9F39066F8104}': 'medium3:accent4', '{74C1A8A3-306A-4EB7-A6B1-4F7E0EB9C5D6}': 'medium3:accent5', '{2A488322-F2BA-4B5B-9748-0D474271808F}': 'medium3:accent6',
    '{D7AC3CCA-C797-4891-BE02-D94E43425B78}': 'medium4:tx1', '{69CF1AB2-1976-4502-BF36-3FF5EA218861}': 'medium4:accent1', '{8A107856-5554-42FB-B03E-39F5DBC370BA}': 'medium4:accent2',
    '{0505E3EF-67EA-436B-97B2-0124C06EBD24}': 'medium4:accent3', '{C4B1156A-380E-4F78-BDF5-A606A8083BF9}': 'medium4:accent4', '{22838BEF-8BB2-4498-84A7-C5851F593DF1}': 'medium4:accent5',
    '{16D9F66E-5EB9-4882-86FB-DCBF35E3C3E4}': 'medium4:accent6', '{E8034E78-7F5D-4C2E-B375-FC64B27BC917}': 'dark1:tx1', '{125E5076-3810-47DD-B79F-674D7AD40C01}': 'dark1:accent1',
    '{37CE84F3-28C3-443E-9E96-99CF82512B78}': 'dark1:accent2', '{D03447BB-5D67-496B-8E87-E561075AD55C}': 'dark1:accent3', '{E929F9F4-4A8F-4326-A1B4-22849713DDAB}': 'dark1:accent4',
    '{8FD4443E-F989-4FC4-A0C8-D5A2AF1F390B}': 'dark1:accent5', '{AF606853-7671-496A-8E4F-DF71F8EC918B}': 'dark1:accent6', '{5202B0CA-FC54-4496-8BCA-5EF66A818D29}': 'dark2:tx1',
    '{0660B408-B3CF-4A94-85FC-2B1E0A45F4A2}': 'dark2:accent1', '{91EBBBCC-DAD2-459C-BE2E-F6DE35CF9A28}': 'dark2:accent3', '{46F890A9-2807-4EBB-B81D-B2AA78EC7F39}': 'dark2:accent5',
  };
  X.TABLE_DEFAULT = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';
  X.TABLE_GUID = {};
  Object.keys(X.TABLE_STYLES).forEach((g) => { X.TABLE_GUID[X.TABLE_STYLES[g]] = g; });
  const FAM_NEAR = { themed2: 'themed1', medium3: 'medium2', dark2: 'dark1' };
  X.tableStyleIn = (guid) => {
    const id = X.TABLE_STYLES[String(guid || '').trim().toUpperCase()];
    if (!id) return 'medium2:accent1';
    const [f, c] = id.split(':');
    return FAM_NEAR[f] ? FAM_NEAR[f] + ':' + c : id;
  };
  X.tableStyleOut = (id) => X.TABLE_GUID[id] || X.TABLE_GUID[String(id || '') + ':accent1'] || X.TABLE_DEFAULT;

  /* ---------- Vormen: alle 187 OOXML-presets (ST_ShapeType) ---------- */
  X.PRESETS = new Set(('line lineInv triangle rtTriangle rect diamond parallelogram trapezoid nonIsoscelesTrapezoid pentagon hexagon heptagon octagon decagon dodecagon '
    + 'star4 star5 star6 star7 star8 star10 star12 star16 star24 star32 roundRect round1Rect round2SameRect round2DiagRect snipRoundRect snip1Rect snip2SameRect '
    + 'snip2DiagRect plaque ellipse teardrop homePlate chevron pieWedge pie blockArc donut noSmoking rightArrow leftArrow upArrow downArrow stripedRightArrow '
    + 'notchedRightArrow bentUpArrow leftRightArrow upDownArrow leftUpArrow leftRightUpArrow quadArrow leftArrowCallout rightArrowCallout upArrowCallout '
    + 'downArrowCallout leftRightArrowCallout upDownArrowCallout quadArrowCallout bentArrow uturnArrow circularArrow leftCircularArrow leftRightCircularArrow '
    + 'curvedRightArrow curvedLeftArrow curvedUpArrow curvedDownArrow swooshArrow cube can lightningBolt heart sun moon smileyFace irregularSeal1 irregularSeal2 '
    + 'foldedCorner bevel frame halfFrame corner diagStripe chord arc leftBracket rightBracket leftBrace rightBrace bracketPair bracePair straightConnector1 '
    + 'bentConnector2 bentConnector3 bentConnector4 bentConnector5 curvedConnector2 curvedConnector3 curvedConnector4 curvedConnector5 callout1 callout2 callout3 '
    + 'accentCallout1 accentCallout2 accentCallout3 borderCallout1 borderCallout2 borderCallout3 accentBorderCallout1 accentBorderCallout2 accentBorderCallout3 '
    + 'wedgeRectCallout wedgeRoundRectCallout wedgeEllipseCallout cloudCallout cloud ribbon ribbon2 ellipseRibbon ellipseRibbon2 leftRightRibbon verticalScroll '
    + 'horizontalScroll wave doubleWave plus flowChartProcess flowChartDecision flowChartInputOutput flowChartPredefinedProcess flowChartInternalStorage '
    + 'flowChartDocument flowChartMultidocument flowChartTerminator flowChartPreparation flowChartManualInput flowChartManualOperation flowChartConnector '
    + 'flowChartPunchedCard flowChartPunchedTape flowChartSummingJunction flowChartOr flowChartCollate flowChartSort flowChartExtract flowChartMerge '
    + 'flowChartOfflineStorage flowChartOnlineStorage flowChartMagneticTape flowChartMagneticDisk flowChartMagneticDrum flowChartDisplay flowChartDelay '
    + 'flowChartAlternateProcess flowChartOffpageConnector actionButtonBlank actionButtonHome actionButtonHelp actionButtonInformation actionButtonForwardNext '
    + 'actionButtonBackPrevious actionButtonEnd actionButtonBeginning actionButtonReturn actionButtonDocument actionButtonSound actionButtonMovie gear6 gear9 '
    + 'funnel mathPlus mathMinus mathMultiply mathDivide mathEqual mathNotEqual cornerTabs squareTabs plaqueTabs chartX chartStar chartPlus').split(' '));
  X.LINE_GEOMS = /^(line|lineInv|straightConnector1|bentConnector[2-5]|curvedConnector[2-5])$/;

  /* ---------- Benoemde kleuren (a:prstClr) via de browser ---------- */
  let cctx = null;
  X.namedColor = (name) => {
    try {
      if (!cctx) cctx = document.createElement('canvas').getContext('2d');
      const css = String(name || '').replace(/^dk/, 'dark').replace(/^lt/, 'light').replace(/^med/, 'medium').toLowerCase();
      cctx.fillStyle = '#000000'; cctx.fillStyle = css;
      const v = cctx.fillStyle;
      return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '#000000';
    } catch { return '#000000'; }
  };

  /* ---------- Laden van lezen/schrijven en de openbare functies ---------- */
  const need = async (fn, file) => {
    if (!X[fn]) await App.loadScript('js/' + file);
    if (!X[fn]) throw new Error(App.t('Onderdeel ontbreekt: {0}').replace('{0}', file));
    return X[fn];
  };
  // App.Pptx.read(arrayBuffer, titel) → Promise<presentatie> (na App.deserializePres), meldingen in P._importNotes
  X.read = async (buf, title) => (await need('_read', 'pptx-read.js'))(buf, title);
  // App.Pptx.build(presentatie, { template }) → Promise<Blob>; meldingen over vereenvoudigingen in blob.notes
  X.build = async (pres, opts = {}) => (await need('_build', 'pptx-write.js'))(pres, opts);
})();
