/* =========================================================
   Inkt — AutoCorrectie en AutoOpmaak tijdens typen (zoals Word)
   ========================================================= */
'use strict';

/* Standaardlijst: symbolen (vervangen zodra het laatste teken getypt is)
   en veelvoorkomende tikfouten (vervangen bij spatie, Enter of Tab). */
App.AC_DEFAULT_LIST = [
  ['(c)', '©'], ['(e)', '€'], ['(r)', '®'], ['(tm)', '™'], ['...', '…'],
  ['-->', '→'], ['<--', '←'], ['->', '→'], ['==>', '⇒'], ['<==', '⇐'], ['<=>', '⇔'],
  [':)', '☺'], [':-)', '☺'], [':(', '☹'], [':-(', '☹'],
  ['accomodatie', 'accommodatie'], ['acommodatie', 'accommodatie'], ['alsjeblief', 'alsjeblieft'], ['asjeblieft', 'alsjeblieft'],
  ['alstublief', 'alstublieft'], ['appart', 'apart'], ['beidde', 'beide'], ['bijvoorbeld', 'bijvoorbeeld'], ['cafe', 'café'],
  ['categorien', 'categorieën'], ['colega', 'collega'], ['kollega', 'collega'], ['definatief', 'definitief'], ['dta', 'dat'],
  ['efficient', 'efficiënt'], ['eigenljk', 'eigenlijk'], ['financiele', 'financiële'], ['geinteresseerd', 'geïnteresseerd'],
  ['hopenlijk', 'hopelijk'], ['hoplijk', 'hopelijk'], ['ideeen', 'ideeën'], ['interresant', 'interessant'], ['interresse', 'interesse'],
  ['mischien', 'misschien'], ['misschein', 'misschien'], ['missschien', 'misschien'], ['natuurljk', 'natuurlijk'], ['ofzo', 'of zo'],
  ['omdta', 'omdat'], ['onmiddelijk', 'onmiddellijk'], ['opzich', 'op zich'], ['paralel', 'parallel'], ['reele', 'reële'],
  ['sowiezo', 'sowieso'], ['zowiezo', 'sowieso'], ['zowieso', 'sowieso'], ['vanavodn', 'vanavond'], ['verassing', 'verrassing'],
  ['waarschijnljk', 'waarschijnlijk'], ['wnat', 'want'], ['zijm', 'zijn'], ['ziijn', 'zijn'], ['dei', 'die'],
];
App.AC_DEFAULT_OPTS = {
  bolt: true, twoCaps: true, capSentence: true, capCells: true, replace: true,
  quotes: true, fractions: true, dashes: true, links: true, bullets: true, numbers: true, borders: true,
};
// Afkortingen waarna geen nieuwe zin begint
App.AC_ABBR = new Set(['bijv', 'bv', 'enz', 'etc', 'ca', 'nl', 'vgl', 'zgn', 'evt', 'resp', 'jl', 'blz', 'nr', 'dhr', 'mevr', 'mr', 'dr', 'ir', 'ing', 'drs', 'prof', 'st', 'tel', 'pag', 'vs', 'incl', 'excl', 'max', 'min', 'gem', 'afd', 'adv', 'art', 'hfst', 'jr', 'sr', 'mln', 'mld']);

App.ac = {
  opts: { ...App.AC_DEFAULT_OPTS },
  list: null,
  load() {
    const s = App.store.get('autocorrect', null);
    if (s && s.opts) Object.assign(this.opts, s.opts);
    this.list = s && Array.isArray(s.list) ? s.list : App.AC_DEFAULT_LIST.map((x) => [...x]);
    this.index();
  },
  save() { App.store.set('autocorrect', { opts: this.opts, list: this.list }); this.index(); },
  index() {
    const wordEnd = (f) => /[\p{L}\p{N}]$/u.test(f);
    this.sym = this.list.filter(([f]) => f && !wordEnd(f)).sort((a, b) => b[0].length - a[0].length);
    this.words = new Map(this.list.filter(([f]) => f && wordEnd(f)).map(([f, t]) => [f.toLowerCase(), t]));
  },
};
App.ac.load();

/* ---------- Hulpjes ---------- */
App.acTextBefore = (block, node, offset) => {
  const r = document.createRange();
  try { r.setStart(block, 0); r.setEnd(node, offset); } catch { return ''; }
  return r.toString().replace(/​/g, '');
};
App.acHost = (node) => {
  // Waar mag AutoCorrectie werken? Alleen in het document of in de kop/voettekst die bewerkt wordt.
  const el = node && (node.nodeType === 3 ? node.parentElement : node);
  if (!el) return null;
  const hf = App.state.hfEditing;
  if (hf && hf.el.contains(el)) return 'hf';
  if (!App.ed.contains(el)) return null;
  if (el.closest('pre, code, a, .eq, .fld, .mf, .toc, .cite, [contenteditable="false"]')) return null;
  return 'doc';
};
App.acSkip = () => App.state.track || App.state.protect || App.state.view === 'read';
App.acPrevChar = (node, idx) => {
  if (idx > 0) return node.data[idx - 1];
  const block = App.blockOf(node) || App.editRoot();
  const t = App.acTextBefore(block, node, idx);
  return t ? t[t.length - 1] : '';
};
App.acMatchCase = (orig, rep) => {
  if (orig.length > 1 && orig === orig.toUpperCase() && orig !== orig.toLowerCase()) return rep.toUpperCase();
  if (/^\p{Lu}/u.test(orig)) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
};
/* Eén correctie = één stap ongedaan maken: eerst de getypte tekst vastleggen, dan corrigeren.
   Ctrl+Z direct daarna zet dus alleen de correctie terug (zoals Word). */
App.acCommit = (host, fn) => {
  if (host === 'doc') { App.history.push(); App.history.mark(); }
  let res;
  try { res = fn(); } catch (e) { console.error(e); }
  if (host === 'doc') App.changed({ immediate: true }); else App.markDirty();
  return res;
};
App.acApply = (host, node, start, len, text, caret, info) => {
  const from = node.data.substr(start, len);
  App.acCommit(host, () => {
    node.replaceData(start, len, text);
    App.placeCaret(node, Math.max(0, caret + text.length - len));
  });
  App.acBolt(node, start, text.length, { from, to: text, host, ...info });
  return true;
};
App.acSentenceStart = (beforeText, node) => {
  const o = App.ac.opts;
  if (!beforeText.trim()) return App.closest(node, 'td,th') ? o.capCells : o.capSentence;
  if (!o.capSentence) return false;
  const m = beforeText.match(/(\S+)\s+$/);
  if (!m || !/[.!?]["'”’)\]]*$/.test(m[1])) return false;
  const p = m[1].replace(/["'”’)\]]+$/, '');
  if (/^\p{L}(\.\p{L})*\.$/u.test(p) || /^\d+\.$/.test(p) || p.endsWith('..')) return false;
  return !App.AC_ABBR.has(p.slice(0, -1).toLowerCase());
};

/* Woordgrens (spatie, Enter, Tab): tikfouten, hoofdletters, streepjes, breuken, koppelingen.
   end = einde van het woord in node, caret = huidige cursorpositie in node. */
App.acBoundary = (node, end, caret, host) => {
  const o = App.ac.opts;
  const m = node.data.slice(0, end).match(/(\S+)$/);
  if (!m) return false;
  const tok = m[1], tStart = end - tok.length;
  const block = App.blockOf(node) || App.editRoot();
  const before = App.acTextBefore(block, node, tStart);
  if (tStart === 0 && /\S$/.test(before)) return false;   // woord loopt over een opmaakgrens heen
  if (o.dashes) {
    if (tok === '--' && /\S\s$/.test(before)) return App.acApply(host, node, tStart, 2, '–', caret, { opt: 'dashes', label: 'streepjes' });
    const dm = tok.match(/^([\p{L}\p{N}]+)--([\p{L}\p{N}]+)$/u);
    if (dm) return App.acApply(host, node, tStart + dm[1].length, 2, '—', caret, { opt: 'dashes', label: 'streepjes' });
  }
  const lead = tok.match(/^[(\[{‘“"']*/)[0].length;
  const trail = tok.slice(lead).match(/[.,;:!?)\]}’”"']*$/)[0].length;
  const core = tok.slice(lead, tok.length - trail), cStart = tStart + lead;
  if (!core) return false;
  const FR = { '1/2': '½', '1/4': '¼', '3/4': '¾' };
  if (o.fractions && FR[core]) return App.acApply(host, node, cStart, core.length, FR[core], caret, { opt: 'fractions', label: 'breuken' });
  if (host !== 'doc') return false;   // in kop/voettekst alleen de veilige vervangingen
  if (o.links) {
    const lt = tok.slice(lead).replace(/[.,;:!?)\]}’”"']+$/, '');
    if (/^(https?:\/\/|www\.)[^\s]+\.[^\s]+/i.test(lt) || /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(lt)) return App.acLink(node, cStart, lt, caret);
  }
  if (!/^\p{L}[\p{L}'’-]*$/u.test(core)) return false;
  let w = core, opt = null;
  if (o.replace) { const rep = App.ac.words.get(w.toLowerCase()); if (rep) { w = App.acMatchCase(w, rep); opt = 'entry'; } }
  if (o.twoCaps && /^\p{Lu}\p{Lu}\p{Ll}+$/u.test(w)) { w = w[0] + w[1].toLowerCase() + w.slice(2); opt = opt || 'twoCaps'; }
  if (/^\p{Ll}/u.test(w) && !/\p{Lu}/u.test(w) && App.acSentenceStart(before + tok.slice(0, lead), node)) {
    w = w[0].toUpperCase() + w.slice(1);
    opt = opt || (App.closest(node, 'td,th') && !(before + tok.slice(0, lead)).trim() ? 'capCells' : 'capSentence');
  }
  if (w === core) return false;
  return App.acApply(host, node, cStart, core.length, w, caret, { opt });
};
App.acLink = (node, start, text, caret) => {
  let a = null;
  App.acCommit('doc', () => {
    const r = document.createRange();
    r.setStart(node, start); r.setEnd(node, start + text.length);
    a = document.createElement('a');
    a.href = /@/.test(text) && !/^https?:/i.test(text) ? 'mailto:' + text : /^www\./i.test(text) ? 'http://' + text : text;
    r.surroundContents(a);
    const rest = caret - (start + text.length);
    const after = a.nextSibling;
    if (after && after.nodeType === 3 && after.length >= rest) App.placeCaret(after, rest);
    else { const nr = document.createRange(); nr.setStartAfter(a); nr.collapse(true); App.setRange(nr); }
  });
  if (a) App.acBoltEl(a, { kind: 'format', opt: 'links', undoLabel: 'Koppeling ongedaan maken', stopLabel: 'Stoppen met het automatisch maken van koppelingen' });
  return true;
};

/* ---------- AutoOpmaak: lijsten en randlijnen ---------- */
App.acListFormat = (node, off) => {
  const o = App.ac.opts;
  const block = App.blockOf(node);
  if (!block || block.tagName !== 'P' || block.closest('li')) return false;
  const txt = App.acTextBefore(block, node, off).replace(/ /g, ' ');
  let tag = null, cls = '', type = '', start = 1, m;
  if (o.bullets && /^[-*•>] $/.test(txt)) { tag = 'ul'; cls = { '-': 'lst-dash', '>': 'lst-arrow' }[txt[0]] || ''; }
  else if (o.numbers && (m = txt.match(/^(\d{1,3}|[aAiI])([.)]) $/))) {
    tag = 'ol';
    if (/\d/.test(m[1])) { start = +m[1]; if (m[2] === ')') cls = 'lst-paren'; }
    else type = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }[m[1]];
  } else return false;
  App.history.push();
  let li = null;
  App.run(() => {
    const r = document.createRange();
    r.setStart(block, 0); r.setEnd(node, off); r.deleteContents();
    if (!block.textContent && !block.querySelector('img')) block.innerHTML = '<br>';
    const t = document.createTreeWalker(block, NodeFilter.SHOW_TEXT).nextNode();
    if (t) App.placeCaret(t, 0); else App.placeCaret(block, 0);
    App.toggleList(tag);
    li = App.selClosest('li');
    const list = li && li.parentNode;
    if (!list) return;
    if (cls) list.classList.add(cls);
    if (type) list.style.listStyleType = type;
    if (start !== 1) { list.start = start; list.style.setProperty('--start', start - 1); }
  });
  if (li) {
    App.acBoltEl(li, tag === 'ol'
      ? { kind: 'format', opt: 'numbers', undoLabel: 'Automatische nummering ongedaan maken', stopLabel: 'Stoppen met het automatisch maken van genummerde lijsten' }
      : { kind: 'format', opt: 'bullets', undoLabel: 'Automatische opsommingstekens ongedaan maken', stopLabel: 'Stoppen met het automatisch maken van lijsten met opsommingstekens' });
  }
  return true;
};
App.AC_LINES = { '---': '1px solid #000', '___': '3px solid #000', '===': '4px double #000', '***': '3px dotted #000', '~~~': '3px dashed #000', '###': '6px double #000' };
App.acBorderLine = (node) => {
  const block = App.blockOf(node);
  if (!App.ac.opts.borders || !block || block.tagName !== 'P' || block.parentNode !== App.ed) return false;
  const line = App.AC_LINES[block.textContent.replace(/​/g, '').trim()];
  if (!line) return false;
  App.history.push();
  let hr = null;
  App.run(() => {
    hr = document.createElement('hr');
    hr.style.borderTop = line;
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    block.replaceWith(hr);
    hr.after(p);
    App.placeCaret(p, 0);
  });
  if (hr) App.acBoltEl(hr, { kind: 'format', opt: 'borders', undoLabel: 'Randlijn ongedaan maken', stopLabel: 'Stoppen met het automatisch maken van randlijnen' });
  return true;
};

/* ---------- Gebeurtenissen ---------- */
document.addEventListener('input', (e) => {
  if (e.inputType !== 'insertText' || e.isComposing || !e.data || App.acSkip()) return;
  const r = App.getRange();
  if (!r || !r.collapsed || r.startContainer.nodeType !== 3) return;
  const node = r.startContainer, off = r.startOffset;
  const host = App.acHost(node);
  if (!host || off < 1) return;
  const ch = e.data[e.data.length - 1], got = node.data[off - 1];
  const o = App.ac.opts;
  if (/\s/.test(ch)) {
    if (!/\s/.test(got)) return;
    if (host === 'doc' && App.acListFormat(node, off)) return;
    App.acBoundary(node, off - 1, off, host);
    return;
  }
  if (got !== ch) return;
  if ((ch === '"' || ch === "'") && o.quotes) {
    const prev = App.acPrevChar(node, off - 1);
    const open = !prev || /[\s(\[{‘“–—\-/]/.test(prev);
    const q = ch === '"' ? (open ? '“' : '”') : (open ? '‘' : '’');
    App.acCommit(host, () => { node.replaceData(off - 1, 1, q); App.placeCaret(node, off); });
    return;
  }
  if (!o.replace) return;
  const before = node.data.slice(0, off);
  const hit = App.ac.sym.find(([f]) => before.endsWith(f));
  if (hit) App.acApply(host, node, off - hit[0].length, hit[0].length, hit[1], off, { opt: 'entry' });
});
document.addEventListener('keydown', (e) => {
  if ((e.key !== 'Enter' && e.key !== 'Tab') || e.ctrlKey || e.altKey || e.metaKey || e.isComposing || App.acSkip()) return;
  const r = App.getRange();
  if (!r || !r.collapsed) return;
  const node = r.startContainer;
  const host = App.acHost(node);
  if (!host) return;
  if (e.key === 'Enter' && !e.shiftKey && host === 'doc' && App.acBorderLine(node)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (node.nodeType === 3) App.acBoundary(node, r.startOffset, r.startOffset, host);
}, true);

/* ---------- Knop "AutoCorrectie-opties" (bliksemschicht onder de correctie) ---------- */
App.acBolt = (node, start, len, info) => {
  if (info.opt == null) return;
  try {
    const r = document.createRange();
    r.setStart(node, start); r.setEnd(node, Math.min(node.length, start + len));
    App.acShowBolt(r.getBoundingClientRect(), { kind: 'replace', ...info });
  } catch { /* niets */ }
};
App.acBoltEl = (el, info) => App.acShowBolt(el.getBoundingClientRect(), info);
App.acShowBolt = (rect, info) => {
  App.acHideBolt();
  if (!App.ac.opts.bolt || !rect || (!rect.width && !rect.height)) return;
  App.acLast = info;
  const b = document.createElement('button');
  b.id = 'ac-bolt';
  b.title = info.kind === 'format' ? 'AutoOpmaak-opties' : 'AutoCorrectie-opties';
  b.innerHTML = '<span class="i">bolt</span><span class="i caret">arrow_drop_down</span>';
  b.style.left = Math.max(4, rect.left) + 'px';
  b.style.top = (rect.bottom + 2) + 'px';
  b.dataset.t = Date.now();
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => { e.stopPropagation(); App.acBoltMenu(b); });
  document.body.appendChild(b);
};
App.acHideBolt = () => { const b = $('#ac-bolt'); if (b) b.remove(); };
App.AC_STOP = {
  twoCaps: 'Automatisch corrigeren van TWee HOofdletters stoppen',
  capSentence: 'Automatisch hoofdletters aan het begin van zinnen stoppen',
  capCells: 'Automatisch hoofdletters aan het begin van tabelcellen stoppen',
  dashes: 'Koppeltekens niet meer automatisch door streepjes vervangen',
  fractions: 'Breuken niet meer automatisch door breuktekens vervangen',
};
App.acBoltMenu = (anchor) => {
  const i = App.acLast;
  if (!i) return;
  const esc = App.esc;
  const undo = i.kind === 'format' ? i.undoLabel : `Terugzetten naar “${esc(i.from)}”`;
  const stop = i.kind === 'format' ? i.stopLabel : i.opt === 'entry' ? `Automatisch corrigeren van “${esc(i.from)}” stoppen` : (App.AC_STOP[i.opt] || 'Deze correctie niet meer uitvoeren');
  App.openPopup(anchor, `<button data-cmd="acUndo"><span class="i">undo</span> ${undo}</button>
    <button data-cmd="acStop"><span class="i">block</span> ${stop}</button><hr>
    <button data-cmd="autoCorrectOptions" data-arg="${i.kind === 'format' ? 'format' : 'ac'}"><span class="i">spellcheck</span> ${i.kind === 'format' ? 'AutoOpmaak-opties beheren…' : 'AutoCorrectie-opties beheren…'}</button>`);
};
App.def('acUndo', () => { App.acHideBolt(); App.history.undo(); });
App.def('acStop', () => {
  const i = App.acLast;
  App.acHideBolt();
  if (!i) return;
  if (i.opt === 'entry') {
    const f = String(i.from).toLowerCase();
    App.ac.list = App.ac.list.filter(([k]) => k.toLowerCase() !== f);
  } else if (i.opt) App.ac.opts[i.opt] = false;
  App.ac.save();
  App.history.undo();
  App.toast('AutoCorrectie aangepast. Je kunt dit terugdraaien via AutoCorrectie-opties.', 'spellcheck');
});
document.addEventListener('keydown', (e) => {
  const b = $('#ac-bolt');
  if (b && Date.now() - b.dataset.t > 40 && !/^(Shift|Control|Alt|Meta)$/.test(e.key)) App.acHideBolt();
}, true);
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#ac-bolt, .menu')) App.acHideBolt(); }, true);
document.getElementById('canvas-scroll').addEventListener('scroll', () => App.acHideBolt());

/* ---------- Venster AutoCorrectie-opties ---------- */
App.autoCorrectDialog = (tab = 'ac') => {
  App.acHideBolt();
  const opts = { ...App.ac.opts };
  let list = App.ac.list.map((x) => [...x]);
  const chk = (k, label) => `<label><input type="checkbox" data-opt="${k}" ${opts[k] ? 'checked' : ''}> ${label}</label>`;
  const d = App.dialog({
    title: 'AutoCorrectie', wide: true,
    body: `<div class="seg" id="acd-tabs"><button data-t="ac">AutoCorrectie</button><button data-t="format">AutoOpmaak tijdens typen</button></div>
      <div data-pane="ac">
        <div class="checks acd-checks">
          ${chk('bolt', 'Knoppen voor AutoCorrectie-opties weergeven')}
          ${chk('twoCaps', 'TWee HOofdletters aan het begin van een woord corrigeren')}
          ${chk('capSentence', 'Eerste letter van een zin met een hoofdletter')}
          ${chk('capCells', 'Eerste letter van tabelcellen met een hoofdletter')}
          ${chk('replace', 'Tekst vervangen tijdens typen')}
        </div>
        <div class="fields-2 acd-pair">
          <label class="field"><span>Vervangen:</span><input id="acd-from" autocomplete="off" spellcheck="false"></label>
          <label class="field"><span>Door:</span><input id="acd-to" autocomplete="off" spellcheck="false"></label>
        </div>
        <div class="acd-list list-rows" id="acd-list"></div>
        <div class="acd-btns">
          <button class="btn small" id="acd-add">Toevoegen</button>
          <button class="btn small" id="acd-del">Verwijderen</button>
          <span style="flex:1"></span>
          <button class="btn small" id="acd-reset">Standaardlijst herstellen</button>
        </div>
      </div>
      <div data-pane="format" hidden>
        <div class="acd-h">Vervangen tijdens typen</div>
        <div class="checks acd-checks">
          ${chk('quotes', 'Rechte aanhalingstekens door typografische')}
          ${chk('fractions', 'Breuken (1/2) door breukteken (½)')}
          ${chk('dashes', 'Koppeltekens (--) door streepje (–)')}
          ${chk('links', 'Internet- en netwerkpaden door hyperlinks')}
        </div>
        <div class="acd-h">Toepassen tijdens typen</div>
        <div class="checks acd-checks">
          ${chk('bullets', 'Automatische lijsten met opsommingstekens')}
          ${chk('numbers', 'Automatische genummerde lijsten')}
          ${chk('borders', 'Randlijnen (---, ___, ===, ***, ~~~, ### en Enter)')}
        </div>
      </div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (dd) => {
        dd.$$('[data-opt]').forEach((c) => { opts[c.dataset.opt] = c.checked; });
        App.ac.opts = opts; App.ac.list = list; App.ac.save();
        App.toast('AutoCorrectie-opties opgeslagen', 'ok');
      },
    }],
    noEnter: true,
  });
  const from = d.$('#acd-from'), to = d.$('#acd-to'), box = d.$('#acd-list');
  const showTab = (t) => {
    d.$$('#acd-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    d.$$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  };
  const render = () => {
    const q = from.value.toLowerCase();
    const sorted = [...list].sort((a, b) => a[0].localeCompare(b[0], 'nl'));
    box.innerHTML = sorted.map(([f, t]) => `<div class="list-row${f.toLowerCase() === q ? ' sel' : ''}" data-f="${App.esc(f)}"><span class="acd-f">${App.esc(f)}</span><span class="grow">${App.esc(t)}</span></div>`).join('');
    const sel = box.querySelector('.sel') || (q && Array.from(box.children).find((r) => r.dataset.f.toLowerCase().startsWith(q)));
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    const exists = list.some(([f]) => f.toLowerCase() === q);
    d.$('#acd-add').textContent = exists ? 'Vervangen' : 'Toevoegen';
    d.$('#acd-del').disabled = !exists;
  };
  d.$('#acd-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); });
  box.addEventListener('click', (e) => {
    const r = e.target.closest('[data-f]'); if (!r) return;
    const it = list.find(([f]) => f === r.dataset.f);
    if (it) { from.value = it[0]; to.value = it[1]; render(); }
  });
  from.addEventListener('input', render);
  d.$('#acd-add').addEventListener('click', () => {
    const f = from.value.trim(), t = to.value;
    if (!f || !t) return;
    list = list.filter(([k]) => k.toLowerCase() !== f.toLowerCase());
    list.push([f, t]);
    render();
  });
  d.$('#acd-del').addEventListener('click', () => {
    const f = from.value.trim().toLowerCase();
    list = list.filter(([k]) => k.toLowerCase() !== f);
    from.value = ''; to.value = ''; render();
  });
  d.$('#acd-reset').addEventListener('click', () => { list = App.AC_DEFAULT_LIST.map((x) => [...x]); render(); });
  showTab(tab === 'format' ? 'format' : 'ac');
  render();
  return d;
};
App.def('autoCorrectOptions', (tab) => App.autoCorrectDialog(typeof tab === 'string' ? tab : 'ac'));
