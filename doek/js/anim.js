/* =========================================================
   Doek (gemaakt door JJ van Schelven) — animatie-engine.
   Eigen tijdlijn-planner (klikstappen, Met vorige, Na vorige, vertraging, herhalen,
   per alinea/woord/letter, triggers) bovenop de Web Animations API: vast en voorspelbaar,
   pauzeerbaar en terug te spoelen. Effecten zijn vaste keyframes (geen AI).
   ========================================================= */
'use strict';

(() => {
  /* ---------- Effecten ---------- */
  // Elk effect geeft keyframes voor een element; ctx = { el, box (px in de dia), slide: { w, h }, dir, a (de animatie) }
  const clipPoly = (pts) => `polygon(${pts.map(([x, y]) => `${App.round(x, 2)}% ${App.round(y, 2)}%`).join(', ')})`;
  const stripes = (n, t, vert) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 100, b = a + (100 / n) * t;
      if (vert) pts.push([a, 0], [b, 0], [b, 100], [a, 100], [a, 0]);
      else pts.push([0, a], [100, a], [100, b], [0, b], [0, a]);
    }
    return clipPoly(pts);
  };
  const wedge = (t, spokes = 1) => {
    // taartpunt(en) vanuit het midden, rechtsom vanaf boven
    const pts = [];
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2;
      pts.push([50, 50]);
      const steps = 16;
      for (let k = 0; k <= steps; k++) { const a = a0 + (k / steps) * t * (Math.PI * 2 / spokes); pts.push([50 + Math.sin(a) * 75, 50 - Math.cos(a) * 75]); }
    }
    pts.push([50, 50]);
    return clipPoly(pts);
  };
  const offFor = (ctx, dir) => {
    // verschuiving waarmee een object net buiten de dia begint
    const { box, slide } = ctx;
    const map = { b: [0, slide.h - box.y + 4], t: [0, -(box.y + box.h) - 4], l: [-(box.x + box.w) - 4, 0], r: [slide.w - box.x + 4, 0] };
    const d = String(dir || 'b');
    let x = 0, y = 0;
    d.split('').forEach((c) => { const m = map[c]; if (m) { x += m[0]; y += m[1]; } });
    if (!x && !y) y = map.b[1];
    return [x, y];
  };
  const T = (x, y, extra = '') => `translate(${App.round(x, 2)}px, ${App.round(y, 2)}px) ${extra}`.trim();
  App.EFFECTS_ENTR = {
    appear: () => [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1, offset: 1 }],
    fade: () => [{ opacity: 0 }, { opacity: 1 }],
    fly: (ctx) => { const [x, y] = offFor(ctx, ctx.dir || 'b'); return [{ transform: T(x, y) }, { transform: T(0, 0) }]; },
    float: (ctx) => { const dy = ctx.slide.h * 0.1 * (ctx.dir === 'd' ? -1 : 1); return [{ opacity: 0, transform: T(0, dy) }, { opacity: 1, transform: T(0, 0) }]; },
    split: (ctx) => { const d = ctx.dir || 'vertIn'; const vert = /^vert/.test(d), out = /Out$/.test(d); const from = vert ? (out ? 'inset(0 50% 0 50%)' : 'inset(0 50% 0 50%)') : 'inset(50% 0 50% 0)'; return out ? [{ clipPath: vert ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }] : [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }]; },
    wipe: (ctx) => { const d = ctx.dir || 'b'; const from = { b: 'inset(100% 0 0 0)', t: 'inset(0 0 100% 0)', l: 'inset(0 100% 0 0)', r: 'inset(0 0 0 100%)' }[d] || 'inset(100% 0 0 0)'; return [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }]; },
    shape: (ctx) => { const s = ctx.dir || 'circle'; if (s === 'box' || s === 'boxOut') return [{ clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(0 0 0 0)' }]; if (s === 'diamond') return [{ clipPath: clipPoly([[50, 50], [50, 50], [50, 50], [50, 50]]) }, { clipPath: clipPoly([[50, -50], [150, 50], [50, 150], [-50, 50]]) }]; if (s === 'plus') return [{ clipPath: clipPoly([[50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50], [50, 50]]) }, { clipPath: clipPoly([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]].map(([x, y]) => [50 + (x - 50) * 1.6, 50 + (y - 50) * 1.6])) }]; return [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(72% at 50% 50%)' }]; },
    wheel: (ctx) => { const n = +(ctx.dir || 1) || 1; return Array.from({ length: 13 }, (_, i) => ({ clipPath: wedge(i / 12, n), offset: i / 12 })); },
    randomBars: (ctx) => { const v = ctx.dir === 'vert'; const n = 18; const order = Array.from({ length: n }, (_, i) => (i * 7 + 3) % n); return Array.from({ length: 10 }, (_, k) => { const t = k / 9; const shown = order.slice(0, Math.round(t * n)); const pts = []; shown.forEach((i) => { const a = (i / n) * 100, b = a + 100 / n; if (v) pts.push([a, 0], [b, 0], [b, 100], [a, 100], [a, 0]); else pts.push([0, a], [100, a], [100, b], [0, b], [0, a]); }); while (pts.length < n * 5) pts.push([0, 0]); return { clipPath: clipPoly(pts), offset: t, easing: 'steps(1)' }; }); },
    blinds: (ctx) => [0, 0.25, 0.5, 0.75, 1].map((t) => ({ clipPath: stripes(6, t, ctx.dir === 'vert'), offset: t })),
    checker: (ctx) => [0, 0.5, 1].map((t) => ({ clipPath: stripes(10, t, ctx.dir !== 'vert'), offset: t })),
    dissolve: () => [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 0.6, filter: 'blur(2px)', offset: 0.6 }, { opacity: 1, filter: 'blur(0px)' }],
    grow: () => [{ opacity: 0, transform: 'scale(0.1) rotate(-90deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }],
    zoom: (ctx) => (ctx.dir === 'out' ? [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }]),
    swivel: () => [{ opacity: 0, transform: 'perspective(800px) rotateY(90deg)' }, { opacity: 1, transform: 'perspective(800px) rotateY(0deg)' }],
    bounce: (ctx) => { const h = ctx.box.y + ctx.box.h + 10; return [{ transform: T(0, -h), offset: 0 }, { transform: T(0, 0), offset: 0.5, easing: 'ease-out' }, { transform: T(0, -h * 0.22), offset: 0.68, easing: 'ease-in' }, { transform: T(0, 0), offset: 0.82, easing: 'ease-out' }, { transform: T(0, -h * 0.06), offset: 0.91, easing: 'ease-in' }, { transform: T(0, 0), offset: 1 }]; },
    spin: () => [{ opacity: 0, transform: 'rotate(-360deg) scale(0.2)' }, { opacity: 1, transform: 'rotate(0deg) scale(1)' }],
    peek: (ctx) => { const d = ctx.dir || 'b'; const dy = d === 'b' ? ctx.box.h : d === 't' ? -ctx.box.h : 0, dx = d === 'r' ? ctx.box.w : d === 'l' ? -ctx.box.w : 0; return [{ transform: T(dx, dy), clipPath: { b: 'inset(0 0 100% 0)', t: 'inset(100% 0 0 0)', r: 'inset(0 100% 0 0)', l: 'inset(0 0 0 100%)' }[d] }, { transform: T(0, 0), clipPath: 'inset(0 0 0 0)' }]; },
  };
  // Uitgang: omgekeerde keyframes van de ingang
  App.EFFECTS_EXIT = {};
  Object.keys(App.EFFECTS_ENTR).forEach((k) => { App.EFFECTS_EXIT[k] = (ctx) => App.EFFECTS_ENTR[k](ctx).slice().reverse().map((f, i, arr) => ({ ...f, offset: f.offset !== undefined ? App.round(1 - f.offset, 4) : undefined, easing: undefined })).map((f) => { if (f.offset === undefined) delete f.offset; if (!f.easing) delete f.easing; return f; }); });
  App.EFFECTS_EXIT.appear = () => [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.999 }, { opacity: 0, offset: 1 }];
  App.EFFECTS_EMPH = {
    pulse: () => [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: 0.5 }, { transform: 'scale(1)' }],
    colorPulse: () => [{ filter: 'none' }, { filter: 'brightness(1.35) saturate(1.8) drop-shadow(0 0 6px rgba(255,200,0,.8))', offset: 0.5 }, { filter: 'none' }],
    teeter: () => [{ transform: 'rotate(0deg)' }, { transform: 'rotate(5deg)', offset: 0.2 }, { transform: 'rotate(-5deg)', offset: 0.4 }, { transform: 'rotate(3deg)', offset: 0.6 }, { transform: 'rotate(-2deg)', offset: 0.8 }, { transform: 'rotate(0deg)' }],
    spin: (ctx) => [{ transform: 'rotate(0deg)' }, { transform: `rotate(${(ctx.a.emph && ctx.a.emph.angle) || 360}deg)` }],
    grow: (ctx) => [{ transform: 'scale(1)' }, { transform: `scale(${(ctx.a.emph && ctx.a.emph.scale) || 1.5})` }],
    desaturate: () => [{ filter: 'grayscale(0)' }, { filter: 'grayscale(1)' }],
    darken: () => [{ filter: 'brightness(1)' }, { filter: 'brightness(0.55)' }],
    lighten: () => [{ filter: 'brightness(1)' }, { filter: 'brightness(1.45) saturate(.8)' }],
    transp: (ctx) => [{ opacity: 1 }, { opacity: (ctx.a.emph && ctx.a.emph.alpha !== undefined) ? ctx.a.emph.alpha : 0.5 }],
    bold: () => [{ fontWeight: 400 }, { fontWeight: 700 }],
    wave: () => [{ transform: 'translateY(0)' }, { transform: 'translateY(-12%)', offset: 0.5 }, { transform: 'translateY(0)' }],
    underline: () => [{ textDecorationLine: 'none' }, { textDecorationLine: 'underline' }],
    objColor: () => [{ filter: 'none' }, { filter: 'hue-rotate(160deg)' }],
    fillColor: () => [{ filter: 'none' }, { filter: 'hue-rotate(160deg)' }],
    lineColor: () => [{ filter: 'none' }, { filter: 'hue-rotate(160deg)' }],
    fontColor: () => [{ filter: 'none' }, { filter: 'hue-rotate(160deg)' }],
  };
  // Effecten die blijven staan na afloop (nadruk die de toestand wijzigt)
  const PERSIST = new Set(['grow', 'desaturate', 'darken', 'lighten', 'transp', 'bold', 'underline', 'objColor', 'fillColor', 'lineColor', 'fontColor', 'spin']);
  App.EFFECT_NAMES = {
    entr: { appear: 'Verschijnen', fade: 'Vervagen', fly: 'Invliegen', float: 'Zweven', split: 'Splitsen', wipe: 'Wissen', shape: 'Vorm', wheel: 'Wiel', randomBars: 'Willekeurige balken', grow: 'Groeien en draaien', zoom: 'Zoomen', swivel: 'Wervelen', bounce: 'Stuiteren', spin: 'Draaien', dissolve: 'Oplossen', blinds: 'Jaloezieën', checker: 'Dambord', peek: 'Gluren' },
    emph: { pulse: 'Pulseren', colorPulse: 'Kleurpuls', teeter: 'Wiebelen', spin: 'Draaien', grow: 'Vergroten/verkleinen', desaturate: 'Onverzadigd', darken: 'Donkerder', lighten: 'Lichter', transp: 'Transparantie', objColor: 'Objectkleur', fillColor: 'Opvulkleur', lineColor: 'Lijnkleur', fontColor: 'Tekstkleur', bold: 'Vet', wave: 'Golf', underline: 'Onderstrepen' },
    exit: { appear: 'Verdwijnen', fade: 'Vervagen', fly: 'Wegvliegen', float: 'Wegzweven', split: 'Splitsen', wipe: 'Wissen', shape: 'Vorm', wheel: 'Wiel', randomBars: 'Willekeurige balken', grow: 'Krimpen en draaien', zoom: 'Zoomen', swivel: 'Wervelen', bounce: 'Stuiteren', spin: 'Draaien', dissolve: 'Oplossen', blinds: 'Jaloezieën', checker: 'Dambord', peek: 'Gluren' },
    path: { path: 'Aangepast pad' },
  };
  App.EFFECT_ICONS = { appear: 'star', fade: 'blur_on', fly: 'flight', float: 'air', split: 'vertical_split', wipe: 'cleaning_services', shape: 'circle', wheel: 'donut_small', randomBars: 'view_week', grow: 'open_in_full', zoom: 'zoom_in', swivel: '3d_rotation', bounce: 'sports_volleyball', spin: 'rotate_right', dissolve: 'grain', blinds: 'blinds', checker: 'grid_on', peek: 'visibility', pulse: 'favorite', colorPulse: 'palette', teeter: 'vibration', desaturate: 'invert_colors_off', darken: 'brightness_4', lighten: 'brightness_7', transp: 'opacity', objColor: 'format_color_fill', fillColor: 'format_color_fill', lineColor: 'border_color', fontColor: 'format_color_text', bold: 'format_bold', wave: 'waves', underline: 'format_underlined', path: 'route' };
  // Standaard bewegingspaden (in fracties van de dia, vanaf het midden van het object)
  App.PATHS = {
    down: ['Lijnen: omlaag', 'M0 0 L0 0.25'], up: ['Lijnen: omhoog', 'M0 0 L0 -0.25'], left: ['Lijnen: links', 'M0 0 L-0.25 0'], right: ['Lijnen: rechts', 'M0 0 L0.25 0'],
    arcDown: ['Bogen: omlaag', 'M0 0 C0.08 0.18 0.25 0.18 0.33 0'], arcUp: ['Bogen: omhoog', 'M0 0 C0.08 -0.18 0.25 -0.18 0.33 0'],
    turnDown: ['Bochten: omlaag', 'M0 0 C0.15 0 0.2 0.05 0.2 0.25'], turnUp: ['Bochten: omhoog', 'M0 0 C0.15 0 0.2 -0.05 0.2 -0.25'],
    circle: ['Vormen: cirkel', 'M0 0 C0 -0.11 0.08 -0.19 0.17 -0.19 C0.26 -0.19 0.33 -0.11 0.33 0 C0.33 0.11 0.26 0.19 0.17 0.19 C0.08 0.19 0 0.11 0 0 Z'],
    square: ['Vormen: vierkant', 'M0 0 L0.2 0 L0.2 0.35 L0 0.35 Z'], diamond: ['Vormen: ruit', 'M0 0 L0.12 -0.18 L0.24 0 L0.12 0.18 Z'],
    heart: ['Vormen: hart', 'M0 0 C0 -0.08 -0.12 -0.1 -0.12 -0.02 C-0.12 0.06 0 0.12 0 0.17 C0 0.12 0.12 0.06 0.12 -0.02 C0.12 -0.1 0 -0.08 0 0 Z'],
    loop: ['Lussen: lus', 'M0 0 C0.1 -0.2 0.25 -0.1 0.15 0 C0.05 0.1 0.2 0.2 0.3 0'], wave: ['Golf', 'M0 0 C0.05 -0.12 0.1 -0.12 0.15 0 C0.2 0.12 0.25 0.12 0.3 0'],
    zigzag: ['Zigzag', 'M0 0 L0.06 -0.1 L0.12 0 L0.18 -0.1 L0.24 0 L0.3 -0.1'], bounce: ['Stuiteren', 'M0 0 C0.03 -0.15 0.08 -0.15 0.1 0 C0.12 -0.08 0.16 -0.08 0.18 0 C0.19 -0.04 0.21 -0.04 0.22 0'],
  };

  /* ---------- Tijdlijn ---------- */
  // Animaties van een dia → stappen (klikken) met per stap de effecten en hun begintijd
  App.Anim = {};
  const textParas = (o) => (o && o.text ? o.text.paras.map((p, i) => ({ i, empty: !p.runs.some((r) => r.t) })).filter((p) => !p.empty) : []);
  App.Anim.expand = (slide) => {
    const out = [];
    (slide.anims || []).forEach((a) => {
      const o = App.findObj(a.obj, slide.objs); if (!o) return;
      if (a.seq === 'para' && o.obj.text) {
        const ps = textParas(o.obj);
        if (ps.length) { ps.forEach((p, k) => out.push({ ...a, para: p.i, start: k === 0 ? a.start : (a.start === 'click' ? 'click' : 'after'), _sub: k > 0 })); return; }
      }
      out.push({ ...a });
    });
    return out;
  };
  App.Anim.build = (slide) => {
    const all = App.Anim.expand(slide);
    const main = all.filter((a) => !a.trig);
    const trig = {};
    all.filter((a) => a.trig).forEach((a) => { const k = a.trig.obj ? 'obj:' + a.trig.obj : 'mark:' + a.trig.media + ':' + a.trig.mark; (trig[k] = trig[k] || []).push(a); });
    const toSteps = (list, firstIsClick) => {
      const steps = [];
      let cur = null, prevStart = 0, prevEnd = 0;
      list.forEach((a, i) => {
        const reps = typeof a.rep === 'number' ? a.rep : 1;
        const dur = Math.max(0.01, a.dur || 0.5) * (a.rep === 'next' || a.rep === 'end' ? 1 : reps);
        const newStep = !cur || (a.start === 'click' && (i > 0 || firstIsClick));
        if (newStep) { cur = { items: [], auto: !(a.start === 'click') && steps.length === 0 && !firstIsClick }; steps.push(cur); prevStart = 0; prevEnd = 0; }
        let t0;
        if (a.start === 'with' && cur.items.length) t0 = prevStart + (a.delay || 0);
        else if (a.start === 'after' && cur.items.length) t0 = prevEnd + (a.delay || 0);
        else t0 = a.delay || 0;
        const item = { a, t0, dur };
        cur.items.push(item);
        prevStart = t0; prevEnd = Math.max(prevEnd, t0 + dur + textDelay(a, slide));
      });
      steps.forEach((s) => { s.end = Math.max(0, ...s.items.map((x) => x.t0 + x.dur + textDelay(x.a, slide))); });
      return steps;
    };
    const steps = toSteps(main, true);
    // de eerste stap speelt vanzelf als hij niet met een klik begint
    if (steps.length && main[0] && main[0].start !== 'click') steps[0].auto = true;
    const trigSteps = {};
    Object.keys(trig).forEach((k) => { trigSteps[k] = toSteps(trig[k], true); });
    // welke elementen beginnen onzichtbaar: alles met een ingang (vóór een eventuele uitgang)
    const hidden = new Set();
    const firstSeen = new Set();
    all.forEach((a) => {
      const key = a.obj + (a.para !== undefined ? ':' + a.para : '');
      const whole = a.obj;
      if (firstSeen.has(key)) return;
      firstSeen.add(key);
      if (a.cls === 'entr') hidden.add(key);
      void whole;
    });
    return { steps, trig: trigSteps, hidden, count: steps.length };
  };
  const textDelay = (a, slide) => {
    if (!a.by || a.by === 'all') return 0;
    const o = App.findObj(a.obj, slide.objs); if (!o || !o.obj.text) return 0;
    const n = App.plainText(o.obj.text, ' ').replace(/\s+/g, a.by === 'word' ? ' ' : '').split(a.by === 'word' ? ' ' : '').filter(Boolean).length;
    return Math.max(0, n - 1) * (a.byDelay !== undefined ? a.byDelay : 0.1) * Math.max(0.01, a.dur || 0.5);
  };
  App.Anim.stepCount = (slide) => App.Anim.build(slide).count;

  /* ---------- Afspelen ---------- */
  // Speler voor één getekende dia (DOM-element .sl); opts: { slide, onDone, rate }
  App.Anim.Player = class {
    constructor(slideEl, slide, opts = {}) {
      this.el = slideEl; this.slide = slide; this.opts = opts;
      this.tl = App.Anim.build(slide);
      this.step = 0;             // volgende stap die speelt
      this.running = [];         // lopende Animation-objecten
      this.history = [];         // per gespeelde stap: animaties (voor terug)
      this.hideNext = [];        // 'verbergen bij volgende klik'
      this.repNext = [];         // herhalen tot volgende klik
      this.trigDone = {};
      this.rate = opts.rate || 1;
      this.prepare();
    }
    targets(a) {
      const ob = this.el.querySelector(`.ob.ly-slide[data-id="${CSS.escape(a.obj)}"]`) || this.el.querySelector(`.ob[data-id="${CSS.escape(a.obj)}"]`);
      if (!ob) return [];
      let base = ob;
      if (a.para !== undefined) { const p = ob.querySelector(`.tx .pa[data-p="${a.para}"]`); if (p) base = p; }
      if (a.by === 'word' || a.by === 'letter') {
        const units = Array.from(base.querySelectorAll('.u'));
        if (units.length) return units;
      }
      return [base];
    }
    elBox(a) {
      const o = App.findObj(a.obj, this.slide.objs);
      if (!o) return { x: 0, y: 0, w: 100, h: 100 };
      return App.box(o.obj, this.slide);
    }
    hiddenKeyEls(key) {
      const [id, para] = key.split(':');
      const ob = this.el.querySelector(`.ob[data-id="${CSS.escape(id)}"]`); if (!ob) return [];
      if (para !== undefined) { const p = ob.querySelector(`.tx .pa[data-p="${para}"]`); return p ? [p] : []; }
      return [ob];
    }
    prepare() {
      this.tl.hidden.forEach((key) => this.hiddenKeyEls(key).forEach((e) => { e.style.visibility = 'hidden'; }));
    }
    // Eén effect starten; geeft de Animation-objecten terug
    run(item, baseDelay = 0) {
      const a = item.a;
      const els = this.targets(a);
      const box = this.elBox(a);
      const P = App.pres;
      const out = [];
      const by = a.by && a.by !== 'all' && els.length > 1;
      const per = by ? (a.byDelay !== undefined ? a.byDelay : 0.1) * Math.max(0.01, a.dur || 0.5) : 0;
      els.forEach((el, k) => {
        const ctx = { el, box, slide: { w: P.size.w, h: P.size.h }, dir: a.dir, a };
        let frames;
        if (a.cls === 'path') frames = pathFrames(a, box, P.size);
        else if (a.cls === 'emph') frames = (App.EFFECTS_EMPH[a.eff] || App.EFFECTS_EMPH.pulse)(ctx);
        else if (a.cls === 'exit') frames = (App.EFFECTS_EXIT[a.eff] || App.EFFECTS_EXIT.fade)(ctx);
        else frames = (App.EFFECTS_ENTR[a.eff] || App.EFFECTS_ENTR.fade)(ctx);
        // bestaande transformatie van het object (draaiing) behouden
        const baseT = el.classList.contains('ob') ? el.style.transform : '';
        if (baseT) frames = frames.map((f) => (f.transform ? { ...f, transform: f.transform + ' ' + baseT } : f));
        const iterations = a.rep === 'next' || a.rep === 'end' ? Infinity : Math.max(1, typeof a.rep === 'number' ? a.rep : 1);
        const delay = (baseDelay + item.t0 + k * per) * 1000 / this.rate;
        const keep = a.cls === 'exit' || a.cls === 'entr' || a.cls === 'path' || PERSIST.has(a.eff);
        const anim = el.animate(frames, { duration: Math.max(1, (a.dur || 0.5) * 1000 / this.rate), delay, iterations, direction: a.rew && a.cls !== 'entr' && a.cls !== 'exit' ? 'alternate' : 'normal', fill: a.rew ? 'backwards' : keep ? 'both' : 'backwards', easing: a.ease || (a.cls === 'path' ? 'ease-in-out' : 'ease-out') });
        anim._a = a; anim._el = el;
        if (a.cls === 'entr') {
          const show = () => { el.style.visibility = ''; };
          if (delay <= 0) show(); else { const t = setTimeout(show, delay); anim._timers = [t]; }
        }
        if (a.cls === 'exit' && !a.rew) anim.finished.then(() => { if (!anim._cancelled) { el.style.visibility = 'hidden'; } }).catch(() => {});
        if (a.after && a.after.type !== 'none' && a.cls !== 'exit') {
          anim.finished.then(() => {
            if (anim._cancelled) return;
            if (a.after.type === 'hide') el.style.visibility = 'hidden';
            else if (a.after.type === 'dim') { el.style.filter = 'grayscale(.6) opacity(.55)'; if (a.after.color) el.style.color = App.color(a.after.color); }
            else if (a.after.type === 'hideClick') this.hideNext.push(el);
          }).catch(() => {});
        }
        if (a.rep === 'next') this.repNext.push(anim);
        if (a.sound && App.playSound) setTimeout(() => App.playSound(a.sound), delay);
        out.push(anim);
      });
      return out;
    }
    playStep(step, baseDelay = 0) {
      // eerst: 'verbergen bij volgende klik' en 'herhalen tot volgende klik' afronden
      this.hideNext.forEach((e) => { e.style.visibility = 'hidden'; }); this.hideNext = [];
      this.repNext.forEach((a) => { try { a.cancel(); } catch { /* al klaar */ } }); this.repNext = [];
      const anims = [];
      step.items.forEach((it) => anims.push(...this.run(it, baseDelay)));
      this.running.push(...anims);
      return anims;
    }
    // volgende stap; geeft false als er geen stappen meer zijn
    next() {
      if (this.busy()) { this.finishRunning(); return true; }
      const step = this.tl.steps[this.step];
      if (!step) return false;
      const anims = this.playStep(step);
      this.history.push(anims);
      this.step++;
      return true;
    }
    // automatisch spelende eerste stap (Met vorige / Na vorige zonder klik)
    autoStart() {
      const st0 = this.tl.steps[0];
      if (st0 && st0.auto && this.step === 0) { this.history.push(this.playStep(st0)); this.step = 1; }
      // stappen die direct 'na vorige' volgen zonder klik zijn al in dezelfde stap opgenomen
    }
    busy() { return this.running.some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity); }
    finishRunning() { this.running.forEach((a) => { try { if (a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch { /* niets */ } }); }
    prev() {
      if (!this.step) return false;
      this.step--;
      const anims = this.history.pop() || [];
      anims.forEach((a) => { a._cancelled = true; (a._timers || []).forEach(clearTimeout); try { a.cancel(); } catch { /* niets */ } const e = a._el; if (a._a.cls === 'entr') e.style.visibility = 'hidden'; if (a._a.cls === 'exit') e.style.visibility = ''; e.style.filter = ''; });
      return true;
    }
    trigger(key) {
      const steps = this.tl.trig[key]; if (!steps) return false;
      const i = this.trigDone[key] || 0;
      const step = steps[i % steps.length];
      this.running.push(...this.playStep(step));
      this.trigDone[key] = i + 1;
      return true;
    }
    hasTrigger(objId) { return !!this.tl.trig['obj:' + objId]; }
    remaining() { return this.tl.steps.length - this.step; }
    // alles in de eindtoestand zetten (bijv. terug naar een dia die al was afgespeeld)
    finishAll() {
      while (this.step < this.tl.steps.length) { const anims = this.playStep(this.tl.steps[this.step]); anims.forEach((a) => { try { if (a.effect.getComputedTiming().iterations === Infinity) a.cancel(); else a.finish(); } catch { /* niets */ } }); this.history.push(anims); this.step++; }
    }
    stop() { this.running.forEach((a) => { a._cancelled = true; (a._timers || []).forEach(clearTimeout); try { a.cancel(); } catch { /* niets */ } }); this.running = []; }
    pause() { this.running.forEach((a) => { try { a.pause(); } catch { /* niets */ } }); }
    resume() { this.running.forEach((a) => { try { a.play(); } catch { /* niets */ } }); }
  };
  // Bewegingspad → keyframes met verschuivingen (gesampled langs het pad)
  const pathFrames = (a, box, size) => {
    const svg = App.svgEl('path', { d: scalePath(a.path || 'M0 0 L0.25 0', size) });
    const host = App.svgEl('svg'); host.appendChild(svg);
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(host);
    let len = 0;
    try { len = svg.getTotalLength(); } catch { len = 0; }
    const N = Math.max(2, Math.min(80, Math.round(len / 6)));
    const frames = [];
    let p0 = null;
    for (let i = 0; i <= N; i++) {
      const p = len ? svg.getPointAtLength((i / N) * len) : { x: 0, y: 0 };
      if (!p0) p0 = p;
      const f = { transform: `translate(${App.round(p.x - p0.x, 2)}px, ${App.round(p.y - p0.y, 2)}px)`, offset: i / N };
      if (a.pathRot && len) { const q = svg.getPointAtLength(Math.min(len, (i / N) * len + 1)); const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI; f.transform += ` rotate(${App.round(ang, 1)}deg)`; }
      frames.push(f);
    }
    host.remove();
    void box;
    return frames;
  };
  const scalePath = (d, size) => {
    let i = 0;
    return String(d).replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (m) => { const v = parseFloat(m) * (i++ % 2 === 0 ? size.w : size.h); return App.round(v, 2); });
  };
  App.Anim.scalePath = scalePath;
})();
