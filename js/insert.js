/* =========================================================
   Inkt — tabblad Invoegen (tekstelementen)
   ========================================================= */
'use strict';

/* ---------- Voorbladen ---------- */
App.COVERS = {
  strak: {
    name: 'Strak',
    html: (t) => `<div class="cover" data-cover="strak">
      <p style="margin-top:120pt;border-left:6px solid var(--doc-accent);padding-left:14pt" class="title">${t.title}</p>
      <p class="subtitle" style="padding-left:20pt">${t.sub}</p>
      <p style="margin-top:300pt;color:#555;padding-left:20pt"><b>${t.author}</b><br>${t.date}</p></div>`,
  },
  banner: {
    name: 'Banner',
    html: (t) => `<div class="cover" data-cover="banner">
      <p style="background:var(--doc-accent);color:#fff;padding:60pt 24pt 24pt;margin:0 0 0;font-size:34pt;line-height:1.1;font-family:var(--doc-head-font)">${t.title}</p>
      <p style="background:var(--doc-head-color);color:#fff;padding:10pt 24pt;margin:0 0 260pt;font-size:13pt">${t.sub}</p>
      <p style="text-align:right;color:#444">${t.author}<br>${t.date}</p></div>`,
  },
  klassiek: {
    name: 'Klassiek',
    html: (t) => `<div class="cover" data-cover="klassiek">
      <p style="text-align:center;margin-top:160pt;border-top:1px solid #333;border-bottom:1px solid #333;padding:18pt 0;font-family:Georgia,serif;font-size:30pt;letter-spacing:1px">${t.title}</p>
      <p style="text-align:center;font-family:Georgia,serif;font-style:italic;color:#555;font-size:14pt">${t.sub}</p>
      <p style="text-align:center;margin-top:260pt;font-family:Georgia,serif;color:#333">${t.author}<br>${t.date}</p></div>`,
  },
};
App.menuBuilders['m-cover'] = () => Object.entries(App.COVERS).map(([id, c]) => `
  <button class="cover-card" data-cmd="insertCover" data-arg="${id}">
    <div class="cv" style="position:relative;background:#fff">${{
      strak: '<i style="position:absolute;left:14px;top:40px;width:4px;height:22px;background:#156082"></i><i style="position:absolute;left:22px;top:42px;width:70px;height:8px;background:#333;border-radius:2px"></i><i style="position:absolute;left:22px;top:56px;width:50px;height:5px;background:#aaa;border-radius:2px"></i>',
      banner: '<i style="position:absolute;left:0;right:0;top:0;height:46px;background:#156082"></i><i style="position:absolute;left:0;right:0;top:46px;height:10px;background:#0e2841"></i>',
      klassiek: '<i style="position:absolute;left:20px;right:20px;top:44px;height:20px;border-top:1px solid #333;border-bottom:1px solid #333"></i><i style="position:absolute;left:36px;right:36px;top:52px;height:4px;background:#555"></i>',
    }[id]}</div><div class="cn">${c.name}</div>
  </button>`).join('') + `<button data-cmd="removeCover" style="grid-column:span 3"><span class="i">delete</span> Huidig voorblad verwijderen</button>`;
App.defEdit('insertCover', (id) => {
  const old = App.ed.querySelector(':scope > .cover');
  if (old) { const nb = old.nextElementSibling; if (nb && nb.classList.contains('page-break')) nb.remove(); old.remove(); }
  const t = { title: App.esc(App.doc.title !== 'Naamloos document' ? App.doc.title : 'Documenttitel'), sub: 'Ondertitel van het document', author: App.esc(App.settings.author), date: App.fmtDate(Date.now()) };
  const wrap = document.createElement('div');
  wrap.innerHTML = App.COVERS[id].html(t);
  const cover = wrap.firstElementChild;
  const pb = document.createElement('div'); pb.className = 'page-break'; pb.contentEditable = 'false';
  App.ed.prepend(pb); App.ed.prepend(cover);
  App.selectContents(cover.querySelector('p'));
});
App.defEdit('removeCover', () => {
  const old = App.ed.querySelector(':scope > .cover');
  if (!old) { App.toast('Er is geen voorblad', 'info'); return; }
  const nb = old.nextElementSibling; if (nb && nb.classList.contains('page-break')) nb.remove();
  old.remove();
});

/* ---------- Koppelingen & bladwijzers ---------- */
App.def('link', () => {
  App.restoreRange();
  const r = App.getRange();
  const a = App.selClosest('a[href]');
  const text = a ? a.textContent : (r ? r.toString() : '');
  const targets = [
    ...$$('h1,h2,h3', App.ed).filter((h) => h.textContent.trim() && !h.closest('.toc')).map((h) => ({ id: h.id, label: '§ ' + h.textContent.trim(), el: h })),
    ...$$('[data-bm]', App.ed).map((b) => ({ id: b.id, label: '🔖 ' + b.dataset.bm, el: b })),
  ];
  const href = a ? a.getAttribute('href') : '';
  App.dialog({
    title: a ? 'Koppeling bewerken' : 'Koppeling invoegen',
    body: `
      <label class="field"><span>Weer te geven tekst</span><input id="ln-text" value="${App.esc(text)}" ${r && !r.collapsed && !a && r.cloneContents().querySelector('img,table') ? 'disabled' : ''}></label>
      <label class="field"><span>Adres (webadres of e-mail)</span><input id="ln-href" value="${App.esc(href && !href.startsWith('#') ? href : '')}" placeholder="https://… of naam@voorbeeld.nl" autofocus></label>
      ${targets.length ? `<label class="field"><span>Of: plaats in dit document</span><select id="ln-target"><option value="">—</option>${targets.map((t, i) => `<option value="${i}" ${href === '#' + t.id ? 'selected' : ''}>${App.esc(t.label)}</option>`).join('')}</select></label>` : ''}
      <div class="checks"><label><input type="checkbox" id="ln-new" ${!a || a.target === '_blank' ? 'checked' : ''}> Openen in nieuw tabblad</label></div>
      <p class="muted small">Ctrl + klik op een koppeling opent hem.</p>`,
    buttons: [
      ...(a ? [{ label: 'Verwijderen', left: true, danger: true, action: () => App.exec('unlink') }] : []),
      { label: 'Annuleren' },
      {
        label: 'OK', primary: true, action: (d) => {
          let url = d.$('#ln-href').value.trim();
          const ti = d.$('#ln-target') ? d.$('#ln-target').value : '';
          if (ti !== '') { const t = targets[+ti]; if (!t.el.id) t.el.id = App.uid('h-'); url = '#' + t.el.id; }
          if (!url) { App.toast('Vul een adres in', 'error'); return false; }
          if (!/^(https?:|mailto:|tel:|#|\/|file:)/i.test(url)) url = /@/.test(url) && !/\//.test(url) ? 'mailto:' + url : 'https://' + url;
          const txt = d.$('#ln-text').value;
          const nt = d.$('#ln-new').checked;
          App.run(() => {
            if (a) {
              a.href = url; if (txt && txt !== a.textContent) a.textContent = txt;
              if (nt) a.target = '_blank'; else a.removeAttribute('target');
              return;
            }
            const rr = App.getRange();
            if (!rr || rr.collapsed || (txt && txt !== rr.toString() && !d.$('#ln-text').disabled)) {
              App.insertHTML(`<a href="${App.esc(url)}"${nt ? ' target="_blank"' : ''}>${App.esc(txt || url)}</a>&nbsp;`);
            } else {
              App.ex('createLink', url);
              const sel = App.getRange();
              $$('a[href]', App.ed).forEach((x) => { if (sel && sel.intersectsNode(x) && x.getAttribute('href') === url) { if (nt) x.target = '_blank'; } });
            }
          });
        },
      },
    ],
  });
});
App.defEdit('unlink', () => {
  const a = App.selClosest('a[href]');
  if (a) App.unwrap(a); else App.ex('unlink');
});
App.ed.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || !App.ed.contains(a)) return;
  const inToc = a.closest('.toc');
  if (e.ctrlKey || e.metaKey || inToc || App.state.view === 'read') {
    e.preventDefault();
    const h = a.getAttribute('href');
    if (h.startsWith('#')) { const t = document.getElementById(h.slice(1)); if (t) App.scrollToEl(t); }
    else App.openLink(a.href);
  }
});
App.ed.addEventListener('mouseover', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (a && !a.closest('.toc') && !a.title) a.title = a.getAttribute('href') + '\nCtrl + klik om te openen';
});

App.def('bookmark', () => {
  App.restoreRange();
  const list = () => $$('[data-bm]', App.ed);
  const d = App.dialog({
    title: 'Bladwijzer',
    body: `<label class="field"><span>Naam van bladwijzer</span><input id="bm-name" placeholder="bv. Inleiding"></label>
      <div class="field"><span>Bestaande bladwijzers</span><div class="list-rows" id="bm-list"></div></div>`,
    buttons: [{ label: 'Sluiten' }, {
      label: 'Toevoegen', primary: true, action: (dd) => {
        const name = dd.$('#bm-name').value.trim();
        if (!name) return false;
        const id = 'bm-' + name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-');
        App.run(() => {
          const b = App.getSelectedBlocks()[0];
          if (!b) return;
          b.id = id; b.dataset.bm = name;
        });
        App.toast(`Bladwijzer “${name}” toegevoegd`, 'bookmark');
      },
    }],
  });
  const render = () => {
    const l = list();
    d.$('#bm-list').innerHTML = l.length ? l.map((b, i) => `<div class="list-row"><span class="i">bookmark</span><span class="grow">${App.esc(b.dataset.bm)}</span>
      <button class="btn small" data-go="${i}">Ga naar</button><button class="btn small danger" data-del="${i}">Verwijderen</button></div>`).join('') : '<div class="list-row muted">Nog geen bladwijzers</div>';
  };
  render();
  d.$('#bm-list').addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'), x = e.target.closest('[data-del]');
    if (g) { const b = list()[+g.dataset.go]; d.close(); App.scrollToEl(b); App.caretAtEnd(b); }
    if (x) { const b = list()[+x.dataset.del]; App.history.flush(); delete b.dataset.bm; b.removeAttribute('id'); App.changed({ immediate: true }); render(); }
  });
});

/* ---------- Symbolen ---------- */
App.SYMBOLS = {
  'Veelgebruikt': '€ £ $ ¥ © ® ™ § ¶ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ … – — • · ‰ ½ ¼ ¾ ² ³ µ ‘ ’ “ ” „ « » ‹ › † ‡',
  'Wiskunde': '+ − × ÷ = ≠ ≈ ≡ ≤ ≥ < > ± ∓ √ ∛ ∜ ∑ ∏ ∫ ∬ ∮ ∂ ∇ ∆ ∞ ∝ ∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∅ ∀ ∃ ¬ ∧ ∨ ⊕ ⊗ ⊥ ∥ ∠ ∡ ° ′ ″ π ℮ ℕ ℤ ℚ ℝ ℂ',
  'Grieks': 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω',
  'Pijlen': '← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⇔ ⇕ ➔ ➜ ➤ ➡ ⬅ ⬆ ⬇ ↩ ↪ ↺ ↻ ⟵ ⟶ ⟷',
  'Valuta': '€ $ £ ¥ ¢ ₹ ₽ ₩ ₪ ₺ ₫ ₴ ₦ ₱ ฿ ₿ ƒ ¤',
  'Tekens': '✓ ✔ ✗ ✘ ☐ ☑ ☒ ★ ☆ ✦ ✧ ♠ ♣ ♥ ♦ ♪ ♫ ☀ ☁ ☂ ☎ ✉ ✂ ✎ ✏ ⌘ ⌚ ⌛ ⚠ ⚡ ♻ ⚑ ⚐ ☺ ☹ ♀ ♂ ⚤',
  'Vormen': '■ □ ▪ ▫ ▲ △ ▶ ▷ ▼ ▽ ◀ ◁ ◆ ◇ ○ ● ◎ ◐ ◑ ◯ ◻ ◼ ⬛ ⬜ ⬤ ▬ ▭ ▮ ▯',
  'Emoji': '😀 😃 😄 😁 😊 😉 😍 🤔 😎 😢 😮 👍 👎 👏 🙏 💪 👉 👀 ❤️ 💡 🔥 ⭐ ✅ ❌ ⚠️ 📌 📎 📅 📈 📉 📝 📚 💼 🏠 🚀 🎉 🎯 ☕ 🌍',
  'Letters': 'À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý ß à á â ã ä å æ ç è é ê ë ì í î ï ñ ò ó ô õ ö ø ù ú û ü ý ÿ Ĳ ĳ Œ œ',
};
App.def('symbol', () => {
  App.restoreRange();
  const cats = Object.keys(App.SYMBOLS);
  const recent = App.store.get('recentSymbols', []);
  let cat = recent.length ? 'Recent' : cats[0];
  const d = App.dialog({
    title: 'Symbool', wide: true,
    body: `<div class="seg" id="sy-cats">${(recent.length ? ['Recent'] : []).concat(cats).map((c) => `<button data-c="${c}">${c}</button>`).join('')}</div>
      <div class="sym-grid" id="sy-grid"></div>
      <p class="muted small" id="sy-info" style="margin-top:10px">Klik op een symbool om het in te voegen. Je kunt meerdere symbolen achter elkaar invoegen.</p>`,
    buttons: [{ label: 'Sluiten', primary: true }],
  });
  const render = () => {
    $$('#sy-cats button', d.el).forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
    const list = cat === 'Recent' ? App.store.get('recentSymbols', []) : App.SYMBOLS[cat].split(' ');
    d.$('#sy-grid').innerHTML = list.map((s) => `<button title="U+${s.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}">${s}</button>`).join('');
  };
  render();
  d.$('#sy-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; render(); } });
  d.$('#sy-grid').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = b.textContent;
    App.run(() => App.ex('insertText', s));
    App.saveRange();
    const rec = [s, ...App.store.get('recentSymbols', []).filter((x) => x !== s)].slice(0, 30);
    App.store.set('recentSymbols', rec);
    d.$('#sy-info').textContent = `“${s}” ingevoegd (U+${s.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`;
  });
});

/* ---------- Vergelijkingen (KaTeX) ---------- */
App.KATEX = 'vendor/katex/';
App.loadKatex = async () => {
  App.loadCss(App.KATEX + 'katex.min.css');
  await App.loadScript(App.KATEX + 'katex.min.js');
  return window.katex;
};
App.renderTex = (tex, display) => {
  if (!window.katex) return `<code>${App.esc(tex)}</code>`;
  try { return katex.renderToString(tex, { throwOnError: false, displayMode: !!display, output: 'html' }); } catch (e) { return `<code>${App.esc(tex)}</code>`; }
};
App.EQ_TEMPLATES = [
  ['x²', 'x^{2}'], ['xₙ', 'x_{n}'], ['a/b', '\\frac{a}{b}'], ['√x', '\\sqrt{x}'], ['ⁿ√x', '\\sqrt[n]{x}'], ['∑', '\\sum_{i=1}^{n} x_i'],
  ['∫', '\\int_{a}^{b} f(x)\\,dx'], ['lim', '\\lim_{x \\to \\infty}'], ['( )', '\\left( x \\right)'], ['matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['α', '\\alpha'], ['β', '\\beta'], ['π', '\\pi'], ['θ', '\\theta'], ['Δ', '\\Delta'], ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\neq'], ['±', '\\pm'], ['→', '\\rightarrow'], ['∞', '\\infty'], ['·', '\\cdot'],
];
App.EQ_PRESETS = [
  ['Stelling van Pythagoras', 'a^2 + b^2 = c^2'], ['ABC-formule', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'], ['Oppervlakte cirkel', 'A = \\pi r^2'],
  ['Binomium van Newton', '(x + a)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k a^{n-k}'], ['Reeks van Taylor', 'e^x = 1 + \\frac{x}{1!} + \\frac{x^2}{2!} + \\cdots'], ['E = mc²', 'E = mc^2'],
];
App.def('equation', async (existing) => {
  App.restoreRange();
  const el = existing instanceof Element ? existing : null;
  let ok = true;
  try { await App.loadKatex(); } catch { ok = false; }
  const d = App.dialog({
    title: el ? 'Vergelijking bewerken' : 'Vergelijking invoegen', wide: true,
    body: `
      <div class="eq-tools">${App.EQ_TEMPLATES.map(([l, t], i) => `<button data-t="${i}" title="${App.esc(t)}">${l}</button>`).join('')}</div>
      <label class="field"><span>Vergelijking (LaTeX-notatie)</span><textarea id="eq-tex" style="font-family:Consolas,monospace;min-height:70px">${App.esc(el ? el.dataset.tex : '')}</textarea></label>
      <div class="field"><span>Voorbeeld</span><div class="preview-box" id="eq-prev" style="min-height:80px;font-size:18px"></div></div>
      <div class="fields-2">
        <label class="field"><span>Ingebouwde vergelijkingen</span><select id="eq-preset"><option value="">Kies…</option>${App.EQ_PRESETS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
        <div class="checks" style="align-items:flex-end"><label><input type="checkbox" id="eq-block" ${el && el.classList.contains('block') ? 'checked' : ''}> Op een eigen regel (gecentreerd)</label></div>
      </div>
      ${ok ? '' : '<p class="small" style="color:#c33">De vergelijkingsweergave kon niet worden geladen (geen internet?). De vergelijking wordt als tekst ingevoegd.</p>'}`,
    buttons: [{ label: 'Annuleren' }, {
      label: el ? 'Bijwerken' : 'Invoegen', primary: true, action: (dd) => {
        const tex = dd.$('#eq-tex').value.trim();
        if (!tex) return false;
        const block = dd.$('#eq-block').checked;
        const html = `<span class="eq${block ? ' block' : ''}" contenteditable="false" data-tex="${App.esc(tex)}">${App.renderTex(tex, block)}</span>`;
        App.run(() => {
          if (el && el.isConnected) { el.outerHTML = html; } else App.insertHTML(html + '&nbsp;');
        });
      },
    }],
  });
  const ta = d.$('#eq-tex');
  const prev = () => { d.$('#eq-prev').innerHTML = ta.value.trim() ? App.renderTex(ta.value, d.$('#eq-block').checked) : '<span class="muted">Typ een vergelijking of kies een sjabloon</span>'; };
  ta.addEventListener('input', prev); d.$('#eq-block').addEventListener('change', prev);
  d.$('#eq-preset').addEventListener('change', (e) => { if (e.target.value !== '') { ta.value = App.EQ_PRESETS[+e.target.value][1]; prev(); } });
  d.el.querySelector('.eq-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = App.EQ_TEMPLATES[+b.dataset.t][1];
    const s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + t + ta.value.slice(en);
    ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; prev();
  });
  prev();
});
App.ed.addEventListener('dblclick', (e) => {
  const eq = e.target.closest('.eq');
  if (eq && App.ed.contains(eq)) { e.preventDefault(); App.exec('equation', eq); }
});

/* ---------- Datum & tijd ---------- */
App.DATE_FORMATS = [
  { day: 'numeric', month: 'numeric', year: 'numeric' }, { day: 'numeric', month: 'long', year: 'numeric' },
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, { day: '2-digit', month: '2-digit', year: '2-digit' },
  { month: 'long', year: 'numeric' }, { hour: '2-digit', minute: '2-digit' }, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }, 'iso',
];
App.formatDateIdx = (i, d = new Date()) => {
  const f = App.DATE_FORMATS[i];
  if (f === 'iso') return d.toISOString().slice(0, 10);
  return d.toLocaleString(App.doc.meta.lang || 'nl-NL', f);
};
App.def('dateTime', () => {
  App.restoreRange();
  let sel = 1;
  const d = App.dialog({
    title: 'Datum en tijd',
    body: `<div class="list-rows" id="dt-list">${App.DATE_FORMATS.map((_, i) => `<div class="list-row ${i === sel ? 'sel' : ''}" data-i="${i}" style="cursor:pointer">${App.esc(App.formatDateIdx(i))}</div>`).join('')}</div>
      <div class="checks" style="margin-top:12px"><label><input type="checkbox" id="dt-auto"> Automatisch bijwerken (bij openen)</label></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Invoegen', primary: true, action: (dd) => {
        const txt = App.formatDateIdx(sel);
        App.run(() => {
          if (dd.$('#dt-auto').checked) App.insertHTML(`<span class="fld" data-fld="date" data-fmt="${sel}" contenteditable="false">${App.esc(txt)}</span>&nbsp;`);
          else App.ex('insertText', txt);
        });
      },
    }],
  });
  d.$('#dt-list').addEventListener('click', (e) => {
    const r = e.target.closest('[data-i]'); if (!r) return;
    sel = +r.dataset.i;
    $$('.list-row', d.el).forEach((x) => x.classList.toggle('sel', x === r));
  });
  d.$('#dt-list').addEventListener('dblclick', () => d.primary.click());
});
App.updateDateFields = () => {
  $$('.fld[data-fld="date"][data-fmt]', App.ed).forEach((f) => { f.textContent = App.formatDateIdx(+f.dataset.fmt); });
};

/* ---------- Tekstvak, sierletters, initiaal, handtekening ---------- */
App.def('textBox', () => {
  App.restoreRange();
  const opts = [['float-right', 'Zijbalk rechts', 'Zwevend kader rechts, tekst loopt eromheen'], ['float-left', 'Zijbalk links', 'Zwevend kader links'], ['', 'Eenvoudig kader', 'Kader over de volle breedte'], ['accent', 'Accentkader', 'Gekleurd kader voor tips of citaten']];
  const d = App.dialog({
    title: 'Tekstvak invoegen',
    body: `<div class="bs-cards" style="grid-template-columns:1fr 1fr">${opts.map(([c, t, s], i) => `<button class="bs-card" data-i="${i}"><span class="i">${['view_sidebar', 'view_sidebar', 'crop_square', 'lightbulb'][i]}</span><div><b>${t}</b><small>${s}</small></div></button>`).join('')}</div>`,
    buttons: [{ label: 'Annuleren' }],
  });
  d.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const [cls] = opts[+b.dataset.i];
    d.close();
    App.run(() => {
      const tb = document.createElement('div');
      tb.className = 'textbox ' + cls;
      tb.innerHTML = '<p>Typ hier de tekst van het tekstvak.</p>';
      const r = App.restoreRange();
      const top = App.topBlock(r.startContainer);
      if (top && cls.startsWith('float')) top.before(tb);
      else App.insertBlockAtCaret(tb, { keepEmpty: true });
      App.selectContents(tb.querySelector('p'));
    });
  });
});
App.menuBuilders['m-wordart'] = () => Array.from({ length: 9 }, (_, i) => `<button data-cmd="wordArt" data-arg="${i + 1}" class="doc" style="font-family:inherit"><span class="wa wa-${i + 1}" style="font-size:22px">Inkt</span></button>`).join('');
App.defEdit('wordArt', (n) => {
  const r = App.restoreRange();
  if (r && !r.collapsed) {
    const spans = App.applyInline({ fontWeight: '700' });
    spans.forEach((s) => { s.className = 'wa wa-' + n; });
  } else {
    App.insertHTML(`<span class="wa wa-${n}">Je tekst hier</span>&nbsp;`);
    const w = $$('.wa', App.ed).find((x) => x.textContent === 'Je tekst hier');
    if (w) App.selectContents(w);
  }
});
App.defEdit('dropCap', () => {
  const b = App.getSelectedBlocks()[0];
  if (!b || b.tagName !== 'P') { App.toast('Plaats de cursor in een gewone alinea', 'info'); return; }
  b.classList.toggle('dropcap');
});
App.stateFns.dropcap = () => !!App.selClosest('p.dropcap');
App.def('signatureLine', () => {
  App.restoreRange();
  App.dialog({
    title: 'Handtekeningregel',
    body: `<label class="field"><span>Naam ondertekenaar</span><input id="sg-n" value="${App.esc(App.settings.author)}"></label>
      <label class="field"><span>Functie</span><input id="sg-f" placeholder="bv. Directeur"></label>
      <label class="field"><span>E-mail</span><input id="sg-e"></label>
      <div class="checks"><label><input type="checkbox" id="sg-d" checked> Datumregel toevoegen</label></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (d) => App.run(() => {
        const g = (id) => App.esc(d.$(id).value.trim());
        const el = document.createElement('div');
        el.className = 'sigline';
        el.innerHTML = `<div class="sl-x">✕</div><div class="sl-line">${g('#sg-n') || 'Naam'}</div>${g('#sg-f') ? `<div class="sl-sub">${g('#sg-f')}</div>` : ''}${g('#sg-e') ? `<div class="sl-sub">${g('#sg-e')}</div>` : ''}${d.$('#sg-d').checked ? '<div class="sl-sub">Datum: ____________________</div>' : ''}`;
        App.insertBlockAtCaret(el, { keepEmpty: true });
      }),
    }],
  });
});
App.defEdit('insertHr', () => {
  const r = App.restoreRange();
  const top = App.topBlock(r.startContainer);
  const hr = document.createElement('hr');
  if (top) top.after(hr); else App.ed.appendChild(hr);
  let next = hr.nextElementSibling;
  if (!next) { next = document.createElement('p'); next.innerHTML = '<br>'; hr.after(next); }
  App.placeCaret(next, 0);
});
App.def('insertFile', async () => {
  App.saveRange();
  const f = await App.pickFile('.docx,.txt,.html,.htm,.md,.inkt');
  if (!f) return;
  try {
    const { html } = await App.fileToDoc(f);
    App.run(() => App.insertHTML(App.sanitize(html)));
    App.toast(`Inhoud van “${f.name}” ingevoegd`, 'ok');
  } catch (e) { App.toast('Kon het bestand niet lezen: ' + e.message, 'error'); }
});
