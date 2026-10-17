/* =========================================================
   Doek (gemaakt door JJ van Schelven) — overgangen tussen dia's, ook Morph.
   Vaste keyframes via de Web Animations API; Morph koppelt objecten met vaste
   regels (naam met !!, dezelfde naam en soort, dezelfde tekst, dezelfde afbeelding)
   en laat positie, grootte, draaiing en kleur overvloeien.
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  App.Trans = {};
  const D8 = [['l', 'Vanaf links'], ['r', 'Vanaf rechts'], ['u', 'Vanaf boven'], ['d', 'Vanaf onder'], ['lu', 'Vanaf linksboven'], ['ru', 'Vanaf rechtsboven'], ['ld', 'Vanaf linksonder'], ['rd', 'Vanaf rechtsonder']];
  const D4 = D8.slice(0, 4);
  const HV = [['horz', 'Horizontaal'], ['vert', 'Verticaal']];
  App.Trans.TYPES = [
    { id: 'none', name: 'Geen', icon: 'block', cat: 'subtle' },
    { id: 'morph', name: 'Morph', icon: 'auto_fix_high', cat: 'subtle', dur: 2, dirs: [['obj', 'Objecten'], ['word', 'Woorden'], ['char', 'Tekens']] },
    { id: 'fade', name: 'Vervagen', icon: 'gradient', cat: 'subtle', dur: 0.7, dirs: [['smooth', 'Vloeiend'], ['black', 'Via zwart']] },
    { id: 'push', name: 'Duwen', icon: 'swipe_left', cat: 'subtle', dur: 1, dirs: D4.map(([v, l]) => [v, l]) },
    { id: 'wipe', name: 'Wissen', icon: 'cleaning_services', cat: 'subtle', dur: 1, dirs: D8 },
    { id: 'split', name: 'Splitsen', icon: 'vertical_split', cat: 'subtle', dur: 1.5, dirs: [['vertOut', 'Verticaal naar buiten'], ['vertIn', 'Verticaal naar binnen'], ['horzOut', 'Horizontaal naar buiten'], ['horzIn', 'Horizontaal naar binnen']] },
    { id: 'reveal', name: 'Onthullen', icon: 'flip_to_front', cat: 'subtle', dur: 1.6, dirs: [['l', 'Vloeiend van rechts'], ['r', 'Vloeiend van links'], ['blackL', 'Via zwart van rechts'], ['blackR', 'Via zwart van links']] },
    { id: 'cut', name: 'Knippen', icon: 'content_cut', cat: 'subtle', dur: 0.01, dirs: [['plain', 'Gewoon'], ['black', 'Via zwart']] },
    { id: 'randomBars', name: 'Willekeurige balken', icon: 'view_week', cat: 'subtle', dur: 1, dirs: HV },
    { id: 'shape', name: 'Vorm', icon: 'circle', cat: 'subtle', dur: 1.5, dirs: [['circle', 'Cirkel'], ['diamond', 'Ruit'], ['plus', 'Plus'], ['in', 'Naar binnen'], ['out', 'Naar buiten']] },
    { id: 'uncover', name: 'Ontdekken', icon: 'open_with', cat: 'subtle', dur: 1, dirs: D8 },
    { id: 'cover', name: 'Bedekken', icon: 'layers', cat: 'subtle', dur: 1, dirs: D8 },
    { id: 'flash', name: 'Flitsen', icon: 'flash_on', cat: 'subtle', dur: 0.8 },
    { id: 'fall', name: 'Vallen', icon: 'south', cat: 'exciting', dur: 2, dirs: [['l', 'Links'], ['r', 'Rechts']] },
    { id: 'curtains', name: 'Gordijnen', icon: 'curtains', cat: 'exciting', dur: 2.2 },
    { id: 'wind', name: 'Wind', icon: 'air', cat: 'exciting', dur: 2, dirs: [['r', 'Rechts'], ['l', 'Links']] },
    { id: 'curl', name: 'Pagina omslaan', icon: 'auto_stories', cat: 'exciting', dur: 1.8, dirs: [['l', 'Enkel naar links'], ['r', 'Enkel naar rechts']] },
    { id: 'dissolve', name: 'Oplossen', icon: 'grain', cat: 'exciting', dur: 1.2 },
    { id: 'checker', name: 'Dambord', icon: 'grid_on', cat: 'exciting', dur: 1.4, dirs: [['l', 'Vanaf links'], ['u', 'Vanaf boven']] },
    { id: 'blinds', name: 'Jaloezieën', icon: 'blinds', cat: 'exciting', dur: 1.4, dirs: [['vert', 'Verticaal'], ['horz', 'Horizontaal']] },
    { id: 'clock', name: 'Klok', icon: 'schedule', cat: 'exciting', dur: 1.5, dirs: [['cw', 'Rechtsom'], ['ccw', 'Linksom'], ['wedge', 'Wig']] },
    { id: 'ripple', name: 'Rimpeling', icon: 'water', cat: 'exciting', dur: 1.4 },
    { id: 'switch', name: 'Wisselen', icon: 'swap_horiz', cat: 'exciting', dur: 1.25, dirs: [['r', 'Rechts'], ['l', 'Links']] },
    { id: 'flip', name: 'Spiegelen', icon: 'flip', cat: 'exciting', dur: 1, dirs: [['r', 'Rechts'], ['l', 'Links']] },
    { id: 'gallery', name: 'Galerie', icon: 'view_carousel', cat: 'exciting', dur: 1.6, dirs: [['r', 'Van rechts'], ['l', 'Van links']] },
    { id: 'cube', name: 'Kubus', icon: 'deployed_code', cat: 'exciting', dur: 1.4, dirs: D4 },
    { id: 'doors', name: 'Deuren', icon: 'door_open', cat: 'exciting', dur: 1.4, dirs: HV },
    { id: 'box', name: 'Kader', icon: 'check_box_outline_blank', cat: 'exciting', dur: 1.4, dirs: D4 },
    { id: 'comb', name: 'Kam', icon: 'reorder', cat: 'exciting', dur: 1, dirs: HV },
    { id: 'zoom', name: 'Zoomen', icon: 'zoom_in', cat: 'exciting', dur: 1, dirs: [['in', 'In'], ['out', 'Uit'], ['inRound', 'In en draaien']] },
    { id: 'random', name: 'Willekeurig', icon: 'shuffle', cat: 'exciting', dur: 1 },
    { id: 'pan', name: 'Schuiven', icon: 'pan_tool', cat: 'dynamic', dur: 1.6, dirs: D4 },
    { id: 'rotate', name: 'Draaien', icon: 'rotate_right', cat: 'dynamic', dur: 1.6, dirs: [['r', 'Rechts'], ['l', 'Links']] },
    { id: 'window', name: 'Venster', icon: 'web_asset', cat: 'dynamic', dur: 1.4, dirs: HV },
    { id: 'orbit', name: 'Baan', icon: 'public', cat: 'dynamic', dur: 1.6, dirs: [['r', 'Rechts'], ['l', 'Links']] },
    { id: 'flyThrough', name: 'Doorvliegen', icon: 'flight_takeoff', cat: 'dynamic', dur: 1, dirs: [['in', 'In'], ['out', 'Uit']] },
  ];
  App.Trans.byId = (id) => App.Trans.TYPES.find((t) => t.id === id) || null;
  const CATS = [['subtle', 'Subtiel'], ['exciting', 'Spannend'], ['dynamic', 'Dynamische inhoud']];

  /* ---------- Afspelen ---------- */
  const vec = (dir, w, h) => ({ l: [-w, 0], r: [w, 0], u: [0, -h], d: [0, h], lu: [-w, -h], ru: [w, -h], ld: [-w, h], rd: [w, h] }[dir] || [-w, 0]);
  const T = (x, y) => `translate(${App.round(x, 1)}px, ${App.round(y, 1)}px)`;
  const poly = (pts) => `polygon(${pts.map(([x, y]) => `${App.round(x, 2)}% ${App.round(y, 2)}%`).join(', ')})`;
  const bars = (n, t, vert, seed) => { const order = Array.from({ length: n }, (_, i) => (i * (seed || 7) + 3) % n); const shown = new Set(order.slice(0, Math.round(t * n))); const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * 100, b = a + 100 / n; if (shown.has(i)) { if (vert) pts.push([a, 0], [b, 0], [b, 100], [a, 100], [a, 0]); else pts.push([0, a], [100, a], [100, b], [0, b], [0, a]); } else pts.push([0, 0], [0, 0], [0, 0], [0, 0], [0, 0]); } return poly(pts); };
  const stripes = (n, t, vert) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * 100, b = a + (100 / n) * t; if (vert) pts.push([a, 0], [b, 0], [b, 100], [a, 100], [a, 0]); else pts.push([0, a], [100, a], [100, b], [0, b], [0, a]); } return poly(pts); };
  const sweep = (t, ccw, wedge) => { const pts = [[50, 50]]; const steps = 24; for (let k = 0; k <= steps; k++) { const f = k / steps; let a; if (wedge) a = (f - 0.5) * t * Math.PI * 2; else a = (ccw ? -1 : 1) * f * t * Math.PI * 2; pts.push([50 + Math.sin(a) * 80, 50 - Math.cos(a) * 80]); } return poly(pts); };
  // geeft { old: keyframes|null, nw: keyframes|null, oldOpts, newOpts, under: true (nieuwe onder oude) }
  const recipe = (type, dir, W, H) => {
    switch (type) {
      case 'cut': return dir === 'black' ? { old: [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], nw: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], minDur: 0.3, black: true } : { old: null, nw: null, instant: true };
      case 'fade': return dir === 'black' ? { old: [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], nw: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], black: true } : { nw: [{ opacity: 0 }, { opacity: 1 }] };
      case 'push': { const [x, y] = vec(dir || 'd', W, H); return { old: [{ transform: T(0, 0) }, { transform: T(-x, -y) }], nw: [{ transform: T(x, y) }, { transform: T(0, 0) }] }; }
      case 'wipe': { const m = { l: 'inset(0 100% 0 0)', r: 'inset(0 0 0 100%)', u: 'inset(0 0 100% 0)', d: 'inset(100% 0 0 0)', lu: 'polygon(0 0, 0 0, 0 0)', ru: 'polygon(100% 0, 100% 0, 100% 0)', ld: 'polygon(0 100%, 0 100%, 0 100%)', rd: 'polygon(100% 100%, 100% 100%, 100% 100%)' }; const f = { lu: 'polygon(0 0, 200% 0, 0 200%)', ru: 'polygon(100% 0, 100% 200%, -100% 0)', ld: 'polygon(0 100%, 0 -100%, 200% 100%)', rd: 'polygon(100% 100%, -100% 100%, 100% -100%)' }; const d = dir || 'r'; return { nw: [{ clipPath: m[d] }, { clipPath: f[d] || 'inset(0 0 0 0)' }] }; }
      case 'split': { const d = dir || 'vertOut'; const v = /^vert/.test(d), out = /Out$/.test(d); if (out) return { nw: [{ clipPath: v ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }] }; return { nw: [{ clipPath: v ? poly([[0, 0], [0, 0], [0, 100], [0, 100], [100, 100], [100, 100], [100, 0], [100, 0]]) : poly([[0, 0], [100, 0], [100, 0], [0, 0], [0, 100], [100, 100], [100, 100], [0, 100]]) }, { clipPath: v ? poly([[0, 0], [50, 0], [50, 100], [0, 100], [100, 100], [50, 100], [50, 0], [100, 0]]) : poly([[0, 0], [100, 0], [100, 50], [0, 50], [0, 100], [100, 100], [100, 50], [0, 50]]) }] }; }
      case 'reveal': { const toLeft = !/R$/.test(dir || 'l') && dir !== 'r'; const black = /^black/.test(dir || ''); return { under: true, old: [{ transform: T(0, 0), opacity: 1 }, { transform: T((toLeft ? -1 : 1) * W * 0.45, 0), opacity: 0 }], nw: [{ opacity: black ? 0 : 0.2 }, { opacity: black ? 0 : 0.6, offset: 0.5 }, { opacity: 1 }], black }; }
      case 'randomBars': return { nw: Array.from({ length: 11 }, (_, k) => ({ clipPath: bars(24, k / 10, dir === 'vert', 11), offset: k / 10, easing: 'steps(1, end)' })) };
      case 'shape': { if (dir === 'diamond') return { nw: [{ clipPath: poly([[50, 50], [50, 50], [50, 50], [50, 50]]) }, { clipPath: poly([[50, -60], [160, 50], [50, 160], [-60, 50]]) }] }; if (dir === 'plus') return { nw: [{ clipPath: poly(Array.from({ length: 12 }, () => [50, 50])) }, { clipPath: poly([[30, -40], [70, -40], [70, 30], [140, 30], [140, 70], [70, 70], [70, 140], [30, 140], [30, 70], [-40, 70], [-40, 30], [30, 30]]) }] }; if (dir === 'in') return { under: true, old: [{ clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(50% 50% 50% 50%)' }] }; if (dir === 'out') return { nw: [{ clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }] }; return { nw: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }] }; }
      case 'uncover': { const [x, y] = vec(dir || 'l', W, H); return { under: true, old: [{ transform: T(0, 0) }, { transform: T(x, y) }] }; }
      case 'cover': { const [x, y] = vec(dir || 'l', W, H); return { nw: [{ transform: T(-x, -y) }, { transform: T(0, 0) }] }; }
      case 'flash': return { nw: [{ opacity: 0, filter: 'brightness(4)' }, { opacity: 1, filter: 'brightness(3)', offset: 0.3 }, { opacity: 1, filter: 'brightness(1)' }], old: [{ filter: 'brightness(1)' }, { filter: 'brightness(4)', offset: 0.3 }, { filter: 'brightness(4)' }] };
      case 'fall': return { under: true, old: [{ transform: 'perspective(1500px) rotateX(0deg)', transformOrigin: '50% 100%' }, { transform: `perspective(1500px) rotateX(${dir === 'r' ? 90 : 90}deg) translateY(${H * 0.2}px)`, transformOrigin: '50% 100%', opacity: 0.2 }], oldOpts: { easing: 'ease-in' } };
      case 'curtains': return { under: true, old: [{ clipPath: 'inset(0 0 0 0)', transform: 'scaleY(1)' }, { clipPath: 'inset(0 50% 0 50%)', transform: 'scaleY(1.04)', offset: 1 }], nw: [{ opacity: 0.5 }, { opacity: 1 }] };
      case 'wind': { const s = dir === 'l' ? -1 : 1; return { under: true, old: [{ transform: 'translate(0,0) skewX(0deg)', opacity: 1 }, { transform: `translate(${s * W}px, ${-H * 0.15}px) skewX(${s * -25}deg)`, opacity: 0 }], oldOpts: { easing: 'ease-in' } }; }
      case 'curl': { const l = dir !== 'r'; return { under: true, old: [{ transform: 'perspective(1800px) rotateY(0deg)', transformOrigin: l ? '0% 50%' : '100% 50%' }, { transform: `perspective(1800px) rotateY(${l ? -110 : 110}deg) skewY(${l ? -6 : 6}deg)`, transformOrigin: l ? '0% 50%' : '100% 50%', opacity: 0.4 }], oldOpts: { easing: 'ease-in-out' } }; }
      case 'dissolve': return { nw: [0, 0.2, 0.4, 0.6, 0.8, 1].map((o, i) => ({ opacity: o, filter: `blur(${(1 - o) * 6}px) contrast(${1 + (1 - o)})`, offset: i / 5 })) };
      case 'checker': return { nw: [0, 0.5, 1].map((t) => ({ clipPath: stripes(12, t, dir !== 'u'), offset: t })) };
      case 'blinds': return { nw: [0, 0.5, 1].map((t) => ({ clipPath: stripes(8, t, dir !== 'horz'), offset: t })) };
      case 'clock': return { nw: Array.from({ length: 13 }, (_, k) => ({ clipPath: sweep(k / 12, dir === 'ccw', dir === 'wedge'), offset: k / 12 })) };
      case 'ripple': return { nw: [{ clipPath: 'circle(0% at 50% 50%)', transform: 'scale(1.06)' }, { clipPath: 'circle(40% at 50% 50%)', transform: 'scale(1.03)', offset: 0.5 }, { clipPath: 'circle(80% at 50% 50%)', transform: 'scale(1)' }] };
      case 'switch': { const s = dir === 'l' ? -1 : 1; return { old: [{ transform: 'perspective(1600px) translateX(0) rotateY(0deg)', offset: 0 }, { transform: `perspective(1600px) translateX(${s * W * 0.35}px) rotateY(${s * 35}deg)`, offset: 0.5, opacity: 0.6 }, { transform: 'perspective(1600px) translateX(0) rotateY(0deg) scale(0.8)', opacity: 0 }], nw: [{ transform: `perspective(1600px) translateX(${-s * W * 0.35}px) rotateY(${-s * 35}deg) scale(0.8)`, opacity: 0, offset: 0 }, { transform: `perspective(1600px) translateX(${-s * W * 0.2}px) rotateY(${-s * 20}deg)`, opacity: 0.4, offset: 0.5 }, { transform: 'perspective(1600px) translateX(0) rotateY(0deg)', opacity: 1 }] }; }
      case 'flip': { const s = dir === 'l' ? -1 : 1; return { old: [{ transform: 'perspective(1600px) rotateY(0deg)', backfaceVisibility: 'hidden' }, { transform: `perspective(1600px) rotateY(${s * 180}deg)`, backfaceVisibility: 'hidden' }], nw: [{ transform: `perspective(1600px) rotateY(${-s * 180}deg)`, backfaceVisibility: 'hidden' }, { transform: 'perspective(1600px) rotateY(0deg)', backfaceVisibility: 'hidden' }] }; }
      case 'gallery': { const s = dir === 'l' ? -1 : 1; return { old: [{ transform: 'perspective(1600px) translateX(0) rotateY(0deg) scale(1)' }, { transform: `perspective(1600px) translateX(${-s * W}px) rotateY(${s * 35}deg) scale(0.8)` }], nw: [{ transform: `perspective(1600px) translateX(${s * W}px) rotateY(${-s * 35}deg) scale(0.8)` }, { transform: 'perspective(1600px) translateX(0) rotateY(0deg) scale(1)' }] }; }
      case 'cube': case 'box': { const d = dir || 'l'; const horiz = d === 'l' || d === 'r'; const s = d === 'r' || d === 'd' ? -1 : 1; const ax = horiz ? 'Y' : 'X'; const half = (horiz ? W : H) / 2; const sgn = horiz ? 1 : -1; const depth = type === 'box' ? 0.6 : 1; return { old: [{ transform: `perspective(${(horiz ? W : H) * 2}px) translateZ(-${half * depth}px) rotate${ax}(0deg) translateZ(${half * depth}px)` }, { transform: `perspective(${(horiz ? W : H) * 2}px) translateZ(-${half * depth}px) rotate${ax}(${sgn * s * -90}deg) translateZ(${half * depth}px)` }], nw: [{ transform: `perspective(${(horiz ? W : H) * 2}px) translateZ(-${half * depth}px) rotate${ax}(${sgn * s * 90}deg) translateZ(${half * depth}px)` }, { transform: `perspective(${(horiz ? W : H) * 2}px) translateZ(-${half * depth}px) rotate${ax}(0deg) translateZ(${half * depth}px)` }], oldOpts: { easing: 'ease-in-out' }, newOpts: { easing: 'ease-in-out' } }; }
      case 'doors': return { doors: dir || 'vert', nw: [{ transform: 'scale(0.85)', opacity: 0.5 }, { transform: 'scale(1)', opacity: 1 }] };
      case 'comb': return { nw: Array.from({ length: 6 }, (_, k) => { const t = k / 5; const pts = []; const n = 10; for (let i = 0; i < n; i++) { const a = (i / n) * 100, b = a + 100 / n; const shift = (i % 2 ? -1 : 1) * (1 - t) * 100; if (dir === 'vert') pts.push([a, shift], [b, shift], [b, 100 + shift], [a, 100 + shift], [a, shift]); else pts.push([shift, a], [100 + shift, a], [100 + shift, b], [shift, b], [shift, a]); } return { clipPath: poly(pts), offset: t }; }) };
      case 'zoom': return dir === 'out' ? { under: true, old: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2)', opacity: 0 }], nw: [{ transform: 'scale(1.3)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }] } : dir === 'inRound' ? { nw: [{ transform: 'scale(0) rotate(-180deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }] } : { nw: [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], old: [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', opacity: 0.3 }] };
      case 'pan': { const [x, y] = vec(dir || 'u', W, H); return { old: [{ transform: T(0, 0) }, { transform: T(-x, -y) }], nw: [{ transform: T(x, y) }, { transform: T(0, 0) }], oldOpts: { easing: 'cubic-bezier(.6,0,.3,1)' }, newOpts: { easing: 'cubic-bezier(.6,0,.3,1)' } }; }
      case 'rotate': { const s = dir === 'l' ? -1 : 1; return { old: [{ transform: 'perspective(1600px) rotateY(0deg) scale(1)' }, { transform: `perspective(1600px) rotateY(${s * 90}deg) scale(0.7)`, opacity: 0, offset: 0.5 }, { transform: `perspective(1600px) rotateY(${s * 90}deg) scale(0.7)`, opacity: 0 }], nw: [{ transform: `perspective(1600px) rotateY(${-s * 90}deg) scale(0.7)`, opacity: 0 }, { transform: `perspective(1600px) rotateY(${-s * 90}deg) scale(0.7)`, opacity: 0, offset: 0.5 }, { transform: 'perspective(1600px) rotateY(0deg) scale(1)', opacity: 1 }] }; }
      case 'window': return { doors: dir === 'horz' ? 'horz' : 'vert', perspective: true, nw: [{ transform: 'perspective(1400px) translateZ(-260px)', opacity: 0.4 }, { transform: 'perspective(1400px) translateZ(0)', opacity: 1 }] };
      case 'orbit': { const s = dir === 'l' ? -1 : 1; return { old: [{ transform: 'perspective(1600px) translateZ(0) rotateY(0deg)', opacity: 1 }, { transform: `perspective(1600px) translateX(${-s * W * 0.6}px) translateZ(-600px) rotateY(${s * 50}deg)`, opacity: 0 }], nw: [{ transform: `perspective(1600px) translateX(${s * W * 0.6}px) translateZ(-600px) rotateY(${-s * 50}deg)`, opacity: 0 }, { transform: 'perspective(1600px) translateZ(0) rotateY(0deg)', opacity: 1 }] }; }
      case 'flyThrough': return dir === 'out' ? { old: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.4)', opacity: 0 }], nw: [{ transform: 'scale(2.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] } : { old: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.5)', opacity: 0 }], nw: [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] };
      default: return { nw: [{ opacity: 0 }, { opacity: 1 }] };
    }
  };
  // container: element waarin oldEl en newEl op dezelfde plek liggen (zelfde grootte). Geeft een Promise.
  App.Trans.play = (container, oldEl, newEl, trans, opts = {}) => {
    let type = trans && trans.type ? trans.type : 'none';
    if (type === 'random') { const pool = App.Trans.TYPES.filter((t) => !/none|random|morph|cut/.test(t.id)); type = pool[(opts.index || 0) * 7 % pool.length].id; }
    const def = App.Trans.byId(type);
    const dur = Math.max(10, ((trans && trans.dur) || (def && def.dur) || 0.7) * 1000 / (opts.rate || 1));
    if (!oldEl || type === 'none') { if (oldEl) oldEl.remove(); return Promise.resolve(); }
    if (type === 'morph' && opts.oldSlide && opts.newSlide) return morph(container, oldEl, newEl, opts.oldSlide, opts.newSlide, dur);
    const P = App.pres;
    const r = recipe(type, trans.dir, P.size.w, P.size.h);
    if (r.instant) { oldEl.remove(); return Promise.resolve(); }
    container.style.perspective = 'none';
    if (r.black) container.style.background = '#000';
    if (r.under) { container.insertBefore(newEl, oldEl); } else container.appendChild(newEl);
    const anims = [];
    const total = r.minDur ? Math.max(dur, r.minDur * 1000) : dur;
    if (r.doors) {
      // de oude dia splitst in twee deuren die opengaan
      const vert = r.doors === 'vert';
      const halves = [0, 1].map((k) => { const c = oldEl.cloneNode(true); c.style.clipPath = vert ? (k ? 'inset(0 0 0 50%)' : 'inset(0 50% 0 0)') : (k ? 'inset(50% 0 0 0)' : 'inset(0 0 50% 0)'); container.appendChild(c); return c; });
      oldEl.style.visibility = 'hidden';
      halves.forEach((c, k) => { const s = k ? 1 : -1; const origin = vert ? (k ? '100% 50%' : '0% 50%') : (k ? '50% 100%' : '50% 0%'); c.style.transformOrigin = origin; anims.push(c.animate([{ transform: `perspective(1400px) rotate${vert ? 'Y' : 'X'}(0deg)` }, { transform: `perspective(1400px) rotate${vert ? 'Y' : 'X'}(${(vert ? -s : s) * 95}deg)`, opacity: 0.2 }], { duration: total, easing: 'ease-in', fill: 'both' })); });
      container.insertBefore(newEl, halves[0]);
      anims.push(newEl.animate(r.nw, { duration: total, easing: 'ease-out', fill: 'both' }));
      return Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => { halves.forEach((c) => c.remove()); oldEl.remove(); anims.forEach((a) => { try { a.cancel(); } catch { /* niets */ } }); container.style.background = ''; });
    }
    if (r.old) anims.push(oldEl.animate(r.old, { duration: total, easing: 'ease-in-out', fill: 'both', ...(r.oldOpts || {}) }));
    if (r.nw) anims.push(newEl.animate(r.nw, { duration: total, easing: 'ease-in-out', fill: 'both', ...(r.newOpts || {}) }));
    opts.onAnims && opts.onAnims(anims);
    return Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => { oldEl.remove(); anims.forEach((a) => { try { a.cancel(); } catch { /* niets */ } }); container.style.background = ''; });
  };

  /* ---------- Morph ---------- */
  const isDefaultName = (n) => /^(Tijdelijke aanduiding|Titel|Ondertitel|Vorm|Tekstvak|Afbeelding|Rechthoek|Ovaal)\b/.test(n || '');
  App.Trans.match = (a, b) => {
    // a = objecten op de oude dia, b = op de nieuwe; geeft paren [oud, nieuw]
    const used = new Set(), pairs = [];
    const take = (pred) => b.forEach((nb) => {
      if (pairs.some((p) => p[1] === nb)) return;
      const hit = a.find((oa) => !used.has(oa) && pred(oa, nb));
      if (hit) { used.add(hit); pairs.push([hit, nb]); }
    });
    take((oa, nb) => oa.name && oa.name.startsWith('!!') && oa.name === nb.name);
    take((oa, nb) => oa.type === nb.type && oa.name && oa.name === nb.name && !(isDefaultName(oa.name) && App.objText(oa) !== App.objText(nb) && !oa.ph));
    take((oa, nb) => oa.type === nb.type && App.objText(oa).trim() && App.objText(oa) === App.objText(nb));
    take((oa, nb) => oa.type === 'image' && nb.type === 'image' && oa.media === nb.media);
    take((oa, nb) => oa.ph && nb.ph && App.phFamily(oa.ph.type) === App.phFamily(nb.ph.type));
    take((oa, nb) => oa.type === 'shape' && nb.type === 'shape' && (oa.geom || 'rect') === (nb.geom || 'rect') && !oa.txbox === !nb.txbox && JSON.stringify(oa.fill) === JSON.stringify(nb.fill));
    return pairs;
  };
  const morph = (container, oldEl, newEl, oldSlide, newSlide, dur) => {
    container.appendChild(newEl);
    const pairs = App.Trans.match(oldSlide.objs, newSlide.objs);
    const anims = [];
    const opt = { duration: dur, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' };
    const matchedNew = new Set(pairs.map((p) => p[1].id)), matchedOld = new Set(pairs.map((p) => p[0].id));
    // achtergrond en decoraties van de nieuwe dia laten invloeien
    Array.from(newEl.children).forEach((c) => {
      const id = c.dataset && c.dataset.id;
      if (c.classList.contains('ly-slide') && id && matchedNew.has(id)) return;
      anims.push(c.animate(c.classList.contains('ly-slide') ? [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], opt));
    });
    Array.from(oldEl.children).forEach((c) => {
      const id = c.dataset && c.dataset.id;
      if (c.classList.contains('ly-slide') && id && matchedOld.has(id)) return;
      if (c.classList.contains('ly-slide')) anims.push(c.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], opt));
    });
    pairs.forEach(([oa, nb]) => {
      const ob = App.box(oa, oldSlide), nbx = App.box(nb, newSlide);
      const ne = newEl.querySelector(`.ob.ly-slide[data-id="${CSS.escape(nb.id)}"]`);
      const oe = oldEl.querySelector(`.ob.ly-slide[data-id="${CSS.escape(oa.id)}"]`);
      if (!ne || !oe) return;
      const dx = (ob.x + ob.w / 2) - (nbx.x + nbx.w / 2), dy = (ob.y + ob.h / 2) - (nbx.y + nbx.h / 2);
      const sx = ob.w / Math.max(1, nbx.w), sy = ob.h / Math.max(1, nbx.h);
      const rotN = nbx.rot || 0, rotO = ob.rot || 0;
      anims.push(ne.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${rotO}deg) scale(${sx}, ${sy})`, opacity: 0.25 }, { transform: `translate(0px, 0px) rotate(${rotN}deg) scale(1, 1)`, opacity: 1 }], opt));
      const ix = -dx, iy = -dy;
      anims.push(oe.animate([{ transform: `translate(0px, 0px) rotate(${rotO}deg) scale(1, 1)`, opacity: 1 }, { transform: `translate(${ix}px, ${iy}px) rotate(${rotN}deg) scale(${1 / sx}, ${1 / sy})`, opacity: 0 }], opt));
      oe.style.zIndex = 5; container.appendChild(oldEl);
    });
    // de oude dia boven de nieuwe zodat gekoppelde objecten vloeiend overgaan
    container.appendChild(oldEl);
    oldEl.style.background = 'transparent';
    const bg = oldEl.querySelector('.sl-bg');
    if (bg) anims.push(bg.animate([{ opacity: 1 }, { opacity: 0 }], opt));
    return Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => { oldEl.remove(); anims.forEach((a) => { try { a.cancel(); } catch { /* niets */ } }); });
  };

  /* ---------- Lint: galerij en opties ---------- */
  const chip = (t, on) => `<button class="fx-chip trans${on ? ' on' : ''}" data-cmd="transApply" data-arg="${t.id}" title="${App.esc(App.t(t.name))}"><span class="i">${t.icon}</span><span>${App.esc(App.t(t.name))}</span></button>`;
  App.fillTransGallery = () => {
    const g = $('#g-trans'); if (!g || !App.pres) return;
    const cur = (App.cur().trans || {}).type || 'none';
    g.innerHTML = App.Trans.TYPES.filter((t) => t.cat === 'subtle').map((t) => chip(t, t.id === cur)).join('');
    updateTransUi();
  };
  App.menuBuilders['m-trans'] = () => { const cur = (App.cur().trans || {}).type || 'none'; return CATS.map(([c, n]) => `<div class="menu-title">${App.esc(App.t(n))}</div><div class="fx-grid">${App.Trans.TYPES.filter((t) => t.cat === c).map((t) => chip(t, t.id === cur)).join('')}</div>`).join(''); };
  App.menuBuilders['m-trans'].cls = 'fx-menu';
  App.menuBuilders['m-transopts'] = () => {
    const tr = App.cur().trans; const def = tr && App.Trans.byId(tr.type);
    if (!def || !def.dirs) return `<div class="menu-empty">${App.t('Deze overgang heeft geen effectopties.')}</div>`;
    return def.dirs.map(([v, l]) => `<button data-cmd="transDir" data-arg="${v}"><span class="i">${(tr.dir || def.dirs[0][0]) === v ? 'radio_button_checked' : 'radio_button_unchecked'}</span> ${App.esc(App.t(l))}</button>`).join('');
  };
  const selSlides = () => (App.selSlides ? App.selSlides() : [App.cur()]);
  const updateTransUi = () => {
    const tr = App.cur() && App.cur().trans; const def = tr && App.Trans.byId(tr.type);
    const dur = $('#trans-dur'), click = $('#trans-click'), on = $('#trans-after-on'), after = $('#trans-after'), snd = $('#trans-sound');
    if (dur && document.activeElement !== dur) dur.value = tr && tr.type !== 'none' ? App.round(tr.dur || (def && def.dur) || 0.7, 2) : '';
    if (click) click.checked = !tr || tr.click !== false;
    if (on) on.checked = !!(tr && tr.after !== undefined && tr.after !== null);
    if (after && document.activeElement !== after) after.value = tr && tr.after !== undefined && tr.after !== null ? App.round(tr.after, 2) : '';
    if (snd) {
      const opts = [['', App.t('[Geen geluid]')], ['stop', App.t('[Vorig geluid stoppen]')], ...Object.keys(App.media).filter((k) => /^audio\//.test(App.media[k].mime)).map((k) => [k, App.media[k].name || k]), ['file', App.t('Ander geluid…')]];
      snd.innerHTML = opts.map(([v, l]) => `<option value="${App.esc(v)}">${App.esc(l)}</option>`).join('');
      snd.value = tr && tr.sound ? tr.sound : '';
    }
  };
  App.on('slide', () => { if (App.activeTab === 'transitions') App.fillTransGallery(); });
  App.on('tab', (t) => { if (t === 'transitions') App.fillTransGallery(); });
  App.on('change', () => { if (App.activeTab === 'transitions') App.fillTransGallery(); });
  const setTrans = (fn) => { App.run(() => selSlides().forEach((s) => { s.trans = { type: 'fade', dur: 0.7, ...(s.trans || {}) }; fn(s.trans, s); if (s.trans.type === 'none') delete s.trans; App.touch(s); }), { noTouch: true }); App.thumbs && App.thumbs.refresh(true); };
  App.def('transApply', (id) => {
    const def = App.Trans.byId(id);
    setTrans((t) => { const keep = { click: t.click, after: t.after, sound: t.sound }; Object.keys(t).forEach((k) => delete t[k]); Object.assign(t, { type: id, dur: def && def.dur ? def.dur : 1 }, keep); if (def && def.dirs) t.dir = def.dirs[0][0]; Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; }); });
    if (id !== 'none') setTimeout(() => App.exec('previewTransition'), 30);
  });
  App.def('transDir', (v) => { setTrans((t) => { t.dir = v; }); setTimeout(() => App.exec('previewTransition'), 30); });
  App.def('transDur', (v) => { const n = App.parseNum(v); if (!(n > 0)) return; setTrans((t) => { t.dur = App.clamp(n, 0.01, 59); }); });
  App.def('transClick', (v) => setTrans((t) => { t.click = !!v; }));
  App.def('transAfterOn', (v) => setTrans((t) => { if (v) t.after = t.after || 0; else delete t.after; }));
  App.def('transAfter', (v) => { const n = App.parseNum(v); if (!(n >= 0)) return; setTrans((t) => { t.after = n; }); });
  App.def('transSound', async (v) => {
    if (v === 'file') {
      const f = await App.pickFile('audio/*'); if (!f) { updateTransUi(); return; }
      const id = App.addMedia(await App.readFile(f, 'dataurl'), f.type, f.name);
      setTrans((t) => { t.sound = id; }); updateTransUi(); return;
    }
    setTrans((t) => { if (v) t.sound = v; else delete t.sound; });
  });
  App.def('transAll', () => {
    const tr = App.clone(App.cur().trans || null);
    App.run(() => App.pres.slides.forEach((s) => { if (tr) s.trans = App.clone(tr); else delete s.trans; App.touch(s); }), { noTouch: true });
    App.thumbs.refresh(true);
    App.toast(App.t('Overgang toegepast op alle dia\'s'), 'ok');
  });
  // Voorbeeld op het werkvlak: van de vorige dia (of zwart) naar de huidige
  App.def('previewTransition', () => {
    const s = App.cur(); if (!s || !s.trans || s.trans.type === 'none') return;
    if (App.state.edit) App.textEdit.stop();
    const host = $('#stage-slide');
    const prev = App.pres.slides[App.state.slide - 1];
    const box = document.createElement('div');
    box.className = 'preview-layer';
    const z = App.zoom();
    box.style.cssText = `position:absolute;left:0;top:0;width:${App.pres.size.w}px;height:${App.pres.size.h}px;transform:scale(${z});transform-origin:0 0;z-index:6;overflow:hidden;background:#000`;
    const mk = (sl) => { const e = App.renderSlide(sl, { mode: 'preview' }); e.style.position = 'absolute'; e.style.left = '0'; e.style.top = '0'; return e; };
    const oldEl = prev ? mk(prev) : (() => { const e = document.createElement('div'); e.className = 'sl'; e.style.cssText = `position:absolute;left:0;top:0;width:${App.pres.size.w}px;height:${App.pres.size.h}px;background:#000`; return e; })();
    const newEl = mk(s);
    box.appendChild(oldEl);
    host.appendChild(box);
    App.Trans.play(box, oldEl, newEl, s.trans, { oldSlide: prev || { objs: [] }, newSlide: s, index: App.state.slide }).then(() => setTimeout(() => box.remove(), 150));
  });
})();
