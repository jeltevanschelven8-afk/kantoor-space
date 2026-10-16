/* =========================================================
   Inkt — Verzendlijsten: afdruk samenvoegen starten, regels, velden koppelen, controleren
   ========================================================= */
'use strict';


/* ---------- Regels (Word-velden voor afdruk samenvoegen) ---------- */
// <span class="mrule" data-rule="ask|fillin|if|mergerec|mergeseq|next|nextif|skipif|set" ...> ; <span class="mref" data-name> toont een bladwijzer
App.MR_OPS = { eq: 'Gelijk aan', ne: 'Niet gelijk aan', lt: 'Kleiner dan', gt: 'Groter dan', le: 'Kleiner dan of gelijk aan', ge: 'Groter dan of gelijk aan', empty: 'Is leeg', notempty: 'Is niet leeg' };
App.mrTest = (val, op, cmp) => {
  const a = String(val ?? '').trim(), b = String(cmp ?? '').trim();
  const na = App.parseNum(a), nb = App.parseNum(b), num = !isNaN(na) && !isNaN(nb) && /^-?[\d.,]+$/.test(a) && /^-?[\d.,]+$/.test(b);
  const c = num ? na - nb : a.localeCompare(b, 'nl', { sensitivity: 'base' });
  return { eq: c === 0, ne: c !== 0, lt: c < 0, gt: c > 0, le: c <= 0, ge: c >= 0, empty: !a, notempty: !!a }[op] ?? false;
};
App.mrLabel = (el) => {
  const d = el.dataset;
  switch (d.rule) {
    case 'ask': return '';
    case 'set': return '';
    case 'skipif': return '';
    case 'fillin': return d.default || '';
    case 'mergerec': return '«Samenvoegrecordnummer»';
    case 'mergeseq': return '«Samenvoegvolgnummer»';
    case 'next': return '«Volgende record»';
    case 'nextif': return '«Volgende record als»';
    case 'if': return d.else || '';
    default: return '';
  }
};
App.mrHtml = (d) => {
  const attrs = Object.entries(d).filter(([, v]) => v != null && v !== '').map(([k, v]) => ` data-${k}="${App.esc(v)}"`).join('');
  const el = document.createElement('span'); Object.assign(el.dataset, d);
  return `<span class="mrule" contenteditable="false"${attrs}>${App.esc(App.mrLabel(el))}</span>`;
};
App.fieldSelect = (id, cur) => `<select id="${id}">${App.mail().fields.map((f) => `<option ${f === cur ? 'selected' : ''}>${App.esc(f)}</option>`).join('')}</select>`;
App.opSelect = (id) => `<select id="${id}">${Object.entries(App.MR_OPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
App.ruleDialog = (rule) => {
  const m = App.mail();
  const needFields = ['if', 'nextif', 'skipif'].includes(rule);
  if (needFields && !m.fields.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  const titles = { ask: 'Vragen', fillin: 'Invullen', if: 'Als…Dan…Anders', nextif: 'Volgende record als', skipif: 'Record overslaan als', set: 'Bladwijzer instellen' };
  const cond = `<div class="fields-3"><label class="field"><span>Veldnaam</span>${App.fieldSelect('mr-f')}</label><label class="field"><span>Vergelijking</span>${App.opSelect('mr-op')}</label><label class="field"><span>Vergelijken met</span><input id="mr-v"></label></div>`;
  const body = {
    ask: `<div class="fields-2"><label class="field"><span>Bladwijzer</span><input id="mr-name" value="Antwoord1" autofocus></label><label class="field"><span>Standaardtekst bladwijzer</span><input id="mr-def"></label></div>
      <label class="field"><span>Vraag</span><input id="mr-prompt" value="Typ een tekst"></label><div class="checks"><label><input type="checkbox" id="mr-once"> Eenmaal vragen (niet per record)</label><label><input type="checkbox" id="mr-ref" checked> Verwijzing naar de bladwijzer hier invoegen</label></div>`,
    fillin: `<label class="field"><span>Vraag</span><input id="mr-prompt" value="Typ een tekst" autofocus></label><label class="field"><span>Standaardtekst invullen</span><input id="mr-def"></label><div class="checks"><label><input type="checkbox" id="mr-once"> Eenmaal vragen (niet per record)</label></div>`,
    if: `<p class="muted small" style="margin-top:0">Als</p>${cond}<label class="field"><span>Deze tekst invoegen</span><textarea id="mr-then" style="min-height:50px"></textarea></label><label class="field"><span>Anders deze tekst invoegen</span><textarea id="mr-else" style="min-height:50px"></textarea></label>`,
    nextif: `<p class="muted small" style="margin-top:0">Naar het volgende record gaan (in hetzelfde document) als:</p>${cond}`,
    skipif: `<p class="muted small" style="margin-top:0">Het huidige record niet samenvoegen als:</p>${cond}`,
    set: `<div class="fields-2"><label class="field"><span>Bladwijzer</span><input id="mr-name" value="Waarde1" autofocus></label><label class="field"><span>Waarde</span><input id="mr-def"></label></div><div class="checks"><label><input type="checkbox" id="mr-ref" checked> Verwijzing naar de bladwijzer hier invoegen</label></div>`,
  }[rule];
  App.restoreRange();
  App.dialog({
    title: 'Veld invoegen: ' + titles[rule], wide: rule === 'if',
    body,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const v = (id) => (d.$(id) ? (d.$(id).type === 'checkbox' ? (d.$(id).checked ? '1' : '') : d.$(id).value) : '');
      const x = { rule };
      if (rule === 'ask' || rule === 'set') { x.name = v('#mr-name').trim().replace(/\s+/g, '_') || 'Bladwijzer'; x.default = v('#mr-def'); }
      if (rule === 'ask' || rule === 'fillin') { x.prompt = v('#mr-prompt'); x.once = v('#mr-once'); if (rule === 'fillin') x.default = v('#mr-def'); }
      if (needFields) { x.field = v('#mr-f'); x.op = v('#mr-op'); x.value = v('#mr-v'); }
      if (rule === 'if') { x.then = v('#mr-then'); x.else = v('#mr-else'); }
      const ref = (rule === 'ask' || rule === 'set') && v('#mr-ref') ? `<span class="mref" contenteditable="false" data-name="${App.esc(x.name)}">${App.esc(x.default || '')}</span>` : '';
      App.run(() => App.insertHTML(App.mrHtml(x) + ref + '&#8203;'));
      App.renderMergePreview();
    } }],
  });
};
['ask', 'fillin', 'if', 'nextif', 'skipif', 'set'].forEach((r) => App.def('mergeRule_' + r, () => App.ruleDialog(r)));
['mergerec', 'mergeseq', 'next'].forEach((r) => App.defEdit('mergeRule_' + r, () => { App.insertHTML(App.mrHtml({ rule: r }) + '&#8203;'); App.renderMergePreview(); }));
App.menuBuilders['m-rules'] = () => [['ask', 'Vragen…'], ['fillin', 'Invullen…'], ['if', 'Als…Dan…Anders…'], ['mergerec', 'Samenvoegrecordnummer'], ['mergeseq', 'Samenvoegvolgnummer'], ['next', 'Volgende record'], ['nextif', 'Volgende record als…'], ['set', 'Bladwijzer instellen…'], ['skipif', 'Record overslaan als…']]
  .map(([k, l]) => `<button data-cmd="mergeRule_${k}">${l}</button>`).join('');
// Klikken op een regel: bewerken door opnieuw in te voegen is eenvoudiger; we tonen wat het veld doet
App.ed.addEventListener('click', (e) => {
  const r = e.target.closest && e.target.closest('.mrule');
  if (!r || !App.ed.contains(r)) return;
  const d = r.dataset;
  const what = { ask: `VRAGEN ${d.name}: "${d.prompt}"`, fillin: `INVULLEN "${d.prompt}"`, if: `ALS «${d.field}» ${(App.MR_OPS[d.op] || '').toLowerCase()} "${d.value}" DAN "${d.then}" ANDERS "${d.else}"`, nextif: `VOLGENDE RECORD ALS «${d.field}» ${(App.MR_OPS[d.op] || '').toLowerCase()} "${d.value}"`, skipif: `RECORD OVERSLAAN ALS «${d.field}» ${(App.MR_OPS[d.op] || '').toLowerCase()} "${d.value}"`, set: `BLADWIJZER ${d.name} = "${d.default}"`, mergerec: 'SAMENVOEGRECORDNUMMER', mergeseq: 'SAMENVOEGVOLGNUMMER', next: 'VOLGENDE RECORD' }[d.rule];
  App.toast('Veld: ' + what + ' — verwijderen met Backspace', 'data_object', { ms: 4000 });
});

/* ---------- Samenvoeg-engine met regels ---------- */
// Verwerkt één uitvoerdocument vanaf record `start`. live = in het document zelf (voorbeeld), anders in een kopie.
App.mergeOne = (root, start, seq, answers, live) => {
  const recs = App.mail().records;
  let i = start, skip = false;
  const bm = {};
  const put = (el, text) => { if (live) { if (el.textContent !== text) el.textContent = text; } else el.replaceWith(document.createTextNode(text)); };
  $$('.mf, .mrule, .mref', root).forEach((el) => {
    const rec = recs[i] || {};
    const d = el.dataset;
    if (el.classList.contains('mf')) { put(el, i < recs.length ? String(rec[d.field] ?? '') : ''); return; }
    if (el.classList.contains('mref')) { put(el, bm[d.name] ?? ''); return; }
    switch (d.rule) {
      case 'ask': bm[d.name] = answers ? answers(el, i) : (d.default || ''); put(el, ''); break;
      case 'set': bm[d.name] = d.default || ''; put(el, ''); break;
      case 'fillin': put(el, answers ? answers(el, i) : (d.default || '')); break;
      case 'if': put(el, App.mrTest(rec[d.field], d.op, d.value) ? (d.then || '') : (d.else || '')); break;
      case 'mergerec': put(el, String(i + 1)); break;
      case 'mergeseq': put(el, String(seq)); break;
      case 'next': i++; put(el, live ? '«Volgende record»' : ''); break;
      case 'nextif': if (App.mrTest(rec[d.field], d.op, d.value)) i++; put(el, ''); break;
      case 'skipif': if (App.mrTest(rec[d.field], d.op, d.value)) skip = true; put(el, ''); break;
      default: put(el, '');
    }
  });
  return { skip, next: Math.max(i + 1, start + 1) };
};
// Voorbeeld van resultaten: velden én regels tonen de waarden van het huidige record
(() => {
  const orig = App.renderMergePreview;
  App.renderMergePreview = () => {
    orig();
    const m = App.mail();
    const on = App.state.mergePreview && m.records.length;
    if (on) App.mergeOne(App.ed, App.state.mergeIndex, App.state.mergeIndex + 1, null, true);
    else {
      $$('.mrule', App.ed).forEach((el) => { const t = App.mrLabel(el); if (el.textContent !== t) el.textContent = t; });
      const defs = {}; $$('.mrule[data-rule="ask"], .mrule[data-rule="set"]', App.ed).forEach((el) => { defs[el.dataset.name] = el.dataset.default || ''; });
      $$('.mref', App.ed).forEach((el) => { const t = defs[el.dataset.name] ?? ''; if (el.textContent !== t) el.textContent = t; });
    }
  };
})();
// Alle documenten samenvoegen (async: Vragen/Invullen stellen hun vraag per record)
App.mergeAll = async (from = 0, to = Infinity) => {
  const m = App.mail(), recs = m.records;
  const base = App.cleanHtml(true);
  const docs = [];
  const onceCache = {};
  let idx = from, seq = 1;
  const last = Math.min(recs.length - 1, to);
  while (idx <= last) {
    const tmp = document.createElement('div');
    tmp.innerHTML = base;
    tmp.querySelectorAll('.footnotes, .endnotes').forEach((x) => x.remove());
    // vragen beantwoorden (in documentvolgorde)
    const answers = new Map();
    for (const el of $$('.mrule[data-rule="ask"], .mrule[data-rule="fillin"]', tmp)) {
      const key = el.dataset.rule + '|' + (el.dataset.name || '') + '|' + el.dataset.prompt;
      if (el.dataset.once && key in onceCache) { answers.set(el, onceCache[key]); continue; }
      const rec = recs[idx] || {};
      const who = App.addressOf ? App.addressOf(rec).split('\n').filter(Boolean)[0] || '' : '';
      const v = await App.prompt(el.dataset.rule === 'ask' ? 'Vragen' : 'Invullen', el.dataset.prompt || 'Typ een tekst', el.dataset.default || '', { hint: el.dataset.once ? 'Deze vraag wordt één keer gesteld.' : `Record ${idx + 1}${who ? ' — ' + App.esc(who) : ''}` });
      if (v == null) return null;   // geannuleerd
      answers.set(el, v);
      if (el.dataset.once) onceCache[key] = v;
    }
    const res = App.mergeOne(tmp, idx, seq, (el) => answers.get(el) ?? (el.dataset.default || ''), false);
    if (!res.skip) { docs.push(tmp.innerHTML); seq++; }
    idx = res.next;
  }
  return docs;
};
App.mergeJoin = (docs) => {
  const type = App.mail().type || 'letters';
  return docs.join(type === 'directory' ? '' : '<div class="page-break" contenteditable="false"></div>');
};
App.def('mergeToDoc', async (arg) => {
  const m = App.mail();
  if (!m.records.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  const go = async (from, to, print) => {
    const docs = await App.mergeAll(from, to);
    if (!docs) { App.toast('Samenvoegen geannuleerd', 'info'); return; }
    if (!docs.length) { App.toast('Er zijn geen records samengevoegd (alle records overgeslagen)', 'info'); return; }
    App.newDocFromHtml(App.mergeJoin(docs), App.doc.title + ' (samengevoegd)', { keepLook: true });
    App.toast(`${docs.length} ${m.type === 'directory' ? 'records' : 'documenten'} samengevoegd`, 'merge');
    if (print) setTimeout(() => App.exec('print'), 600);
  };
  App.dialog({
    title: arg === 'print' ? 'Samenvoegen met printer' : 'Samenvoegen in nieuw document',
    body: `<div class="field"><span>Records samenvoegen</span><div class="checks" style="flex-direction:column;gap:6px">
      <label><input type="radio" name="mg-r" value="all" checked> Alle</label>
      <label><input type="radio" name="mg-r" value="cur"> Huidige record (${App.state.mergeIndex + 1})</label>
      <label><input type="radio" name="mg-r" value="range"> Van: <input id="mg-from" class="inp" style="width:60px;height:24px" value="1"> Tot: <input id="mg-to" class="inp" style="width:60px;height:24px" value="${m.records.length}"></label></div></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const k = d.$('[name=mg-r]:checked').value;
      let from = 0, to = Infinity;
      if (k === 'cur') { from = to = App.state.mergeIndex; }
      if (k === 'range') { from = Math.max(0, (parseInt(d.$('#mg-from').value, 10) || 1) - 1); to = Math.max(from, (parseInt(d.$('#mg-to').value, 10) || m.records.length) - 1); }
      setTimeout(() => go(from, to, arg === 'print'), 30);
    } }],
  });
});
App.def('mergeToPrint', () => App.exec('mergeToDoc', 'print'));

/* ---------- Afdruk samenvoegen starten ---------- */
App.MAIL_TYPES = { letters: 'Brieven', envelopes: 'Enveloppen', labels: 'Etiketten', directory: 'Lijst (directory)', normal: 'Normaal document' };
App.menuBuilders['m-startmerge'] = () => {
  const t = App.mail().type || 'normal';
  const it = (k, icon, extra = '') => `<button data-cmd="startMerge" data-arg="${k}"><span class="i">${t === k ? 'check' : icon}</span> ${App.MAIL_TYPES[k]}${extra}</button>`;
  return it('letters', 'description') + it('envelopes', 'mail', '…') + it('labels', 'label', '…') + it('directory', 'list') + it('normal', 'article')
    + '<hr><button data-cmd="mergeWizard"><span class="i">auto_fix_high</span> Wizard Afdruk samenvoegen stap voor stap…</button>';
};
App.def('startMerge', (type) => {
  const m = App.mail();
  if (type === 'normal') { m.type = 'normal'; App.state.mergePreview = false; App.renderMergePreview(); App.markDirty(); App.scheduleState(); App.toast('Dit is weer een normaal document (de adreslijst blijft bewaard)', 'ok'); return; }
  if (type === 'envelopes') { App.mergeEnvelopeSetup(); return; }
  if (type === 'labels') { App.mergeLabelsSetup(); return; }
  m.type = type; App.markDirty(); App.scheduleState();
  App.toast(type === 'directory' ? 'Lijst: alle records komen onder elkaar in één document' : 'Brieven: voeg samenvoegvelden in en kies Voltooien en samenvoegen', 'merge', { ms: 3500 });
});
// Enveloppen: dit document wordt een envelop met afzender en een adresvak
App.mergeEnvelopeSetup = () => {
  App.dialog({
    title: 'Envelopopties',
    body: `<label class="field"><span>Envelopformaat</span><select id="me-size"><option value="DL">DL (22 × 11 cm)</option><option value="C5">C5 (22,9 × 16,2 cm)</option><option value="C6">C6 (16,2 × 11,4 cm)</option></select></label>
      <label class="field"><span>Afzender</span><textarea id="me-from" style="min-height:70px">${App.esc(App.store.get('envelopeFrom', App.settings.author))}</textarea></label>
      <p class="muted small" style="margin:0">De inhoud van dit document wordt vervangen door een envelop. Voeg daarna in het adresvak een Adresblok in.</p>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const size = d.$('#me-size').value, from = d.$('#me-from').value;
      App.store.set('envelopeFrom', from);
      App.PAGE_SIZES.C5 = [229, 162]; App.PAGE_SIZES.C6 = [162, 114];
      App.run(() => {
        const m = App.mail(); m.type = 'envelopes';
        App.doc.meta.page = { size, orient: 'landscape', margins: { t: 1, r: 1.5, b: 1, l: 1.5 } };
        const left = { DL: 9.5, C5: 10, C6: 6.5 }[size], top = { DL: 2.2, C5: 4.5, C6: 2.5 }[size];
        App.ed.innerHTML = `<p class="nospace" style="font-size:9pt">${App.esc(from).replace(/\n/g, '<br>') || '<br>'}</p><p class="nospace env-addr" style="margin-left:${left}cm;margin-top:${top}cm;font-size:12pt"><br></p>`;
        App.placeCaret(App.ed.querySelector('.env-addr'), 0);
      });
      App.toast('Envelop klaar — voeg nu een Adresblok in', 'mail');
    } }],
  });
};
// Etiketten: tabel met etiketten; elk etiket na het eerste begint met «Volgende record»
App.mergeLabelsSetup = () => {
  App.dialog({
    title: 'Etiketopties',
    body: `<label class="field"><span>Etikettype</span><select id="ml-type">${Object.entries(App.LABELS).map(([k, l]) => `<option value="${k}">${l.name}</option>`).join('')}</select></label>
      <p class="muted small" style="margin:0">De inhoud van dit document wordt vervangen door een vel etiketten. Ontwerp het eerste etiket (bv. met Adresblok) en klik daarna op <b>Etiketten bijwerken</b>.</p>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const key = d.$('#ml-type').value, L = App.LABELS[key];
      App.run(() => {
        const m = App.mail(); m.type = 'labels';
        let html = `<table class="doc-table b-none merge-labels" data-label="${key}" style="table-layout:fixed;width:${L.cols * L.w + (L.cols - 1) * L.gap}mm;margin:0"><tbody>`;
        let n = 0;
        for (let r = 0; r < L.rows; r++) {
          html += '<tr>';
          for (let c = 0; c < L.cols; c++) {
            html += `<td class="lbl" style="width:${L.w}mm;height:${L.h}mm;vertical-align:middle;padding:0 4mm;font-size:${L.h < 25 ? 7 : 10}pt;line-height:1.25;overflow:hidden">${n++ ? App.mrHtml({ rule: 'next' }) : '<br>'}</td>`;
            if (c < L.cols - 1 && L.gap) html += `<td style="width:${L.gap}mm;padding:0"></td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        App.ed.innerHTML = html + '<p><br></p>';
        const ml = Math.max(0.4, L.ml || (21 - (L.cols * L.w + (L.cols - 1) * L.gap) / 10) / 2);
        App.doc.meta.page = { size: 'A4', orient: 'portrait', margins: { t: L.mt || (29.7 - L.rows * L.h / 10) / 2, b: 0.3, l: ml, r: 0.3 } };
        App.placeCaret(App.ed.querySelector('td.lbl'), 0);
      });
      App.toast('Etiketten klaar — ontwerp het eerste etiket en klik op Etiketten bijwerken', 'label', { ms: 4000 });
    } }],
  });
};
App.defEdit('updateLabels', () => {
  const t = App.ed.querySelector('table.merge-labels') || App.ed.querySelector('table');
  const cells = t ? $$('td.lbl', t) : [];
  if (cells.length < 2) { App.toast('Er is geen etikettendocument. Kies Afdruk samenvoegen starten › Etiketten.', 'info'); return; }
  const first = cells[0].cloneNode(true);
  first.querySelectorAll('.mrule[data-rule="next"]').forEach((x) => x.remove());
  const inner = first.innerHTML.replace(/^(\s|&nbsp;|​)+/, '');
  cells.slice(1).forEach((c) => { c.innerHTML = App.mrHtml({ rule: 'next' }) + inner; });
  App.renderMergePreview();
  App.toast('Etiketten bijgewerkt', 'ok');
});

/* ---------- Velden koppelen ---------- */
// Vaste adresvelden (zoals Word) gekoppeld aan kolommen van de adreslijst; gebruikt door Adresblok, Begroetingsregel en enveloppen
App.MATCH = [
  ['Aanhef', ['aanhef', 'titel', 'title']], ['Voornaam', ['voornaam', 'firstname']], ['Achternaam', ['achternaam', 'lastname', 'naam', 'name']],
  ['Bedrijf', ['bedrijf', 'company', 'organisatie']], ['Adres 1', ['adres', 'straat', 'address', 'street']], ['Adres 2', ['adres2', 'address2']],
  ['Postcode', ['postcode', 'zip', 'postal']], ['Plaats', ['plaats', 'woonplaats', 'stad', 'city']], ['Provincie', ['provincie', 'state']],
  ['Land of regio', ['land', 'country']], ['Telefoon', ['telefoon', 'phone', 'tel']], ['E-mailadres', ['email', 'mail']],
];
(() => {
  const orig = App.findField;
  App.findField = (...keys) => {
    const map = App.mail().map || {};
    for (const [name, ks] of App.MATCH) if (map[name] && ks.some((k) => keys.includes(k)) && App.mail().fields.includes(map[name])) return map[name];
    for (const [name, ks] of App.MATCH) if (map[name] === '' && ks.some((k) => keys.includes(k))) return undefined;   // bewust 'niet gekoppeld'
    // eerst exacte namen, dan begin, dan 'bevat' (anders wint "Voornaam" van "naam")
    const norm = (f) => f.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fs = App.mail().fields;
    for (const test of [(f, k) => norm(f) === k, (f, k) => norm(f).startsWith(k)]) {
      for (const k of keys) { const hit = fs.find((f) => test(f, k)); if (hit) return hit; }
    }
    return orig(...keys);
  };
})();
App.def('matchFields', () => {
  const m = App.mail();
  if (!m.fields.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  const map = m.map || {};
  const cur = (name, ks) => (name in map ? map[name] : (App.findField(...ks) || ''));
  App.dialog({
    title: 'Velden koppelen', wide: true,
    body: `<p class="muted small" style="margin-top:0">Koppel de vaste adresvelden aan de kolommen van je adreslijst. Adresblok, Begroetingsregel en enveloppen gebruiken deze koppeling.</p>
      <div class="props" style="grid-template-columns:160px 1fr;max-width:none">${App.MATCH.map(([name, ks]) => `<span class="k">${name}</span><select data-mf="${name}"><option value="">(niet gekoppeld)</option>${m.fields.map((f) => `<option ${f === cur(name, ks) ? 'selected' : ''}>${App.esc(f)}</option>`).join('')}</select>`).join('')}</div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const nm = {}; d.$$('[data-mf]').forEach((s) => { nm[s.dataset.mf] = s.value; });
      m.map = nm; App.markDirty(); App.toast('Velden gekoppeld', 'ok');
    } }],
  });
});

/* ---------- Ontvanger zoeken ---------- */
App.def('findRecipient', () => {
  const m = App.mail();
  if (!m.records.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  let from = App.state.mergeIndex;
  App.dialog({
    title: 'Item zoeken',
    body: `<label class="field"><span>Zoeken naar</span><input id="fr-q" autofocus></label>
      <div class="field"><span>Zoeken in</span><div class="checks"><label><input type="radio" name="fr-in" value="all" checked> Alle velden</label>
      <label><input type="radio" name="fr-in" value="one"> Dit veld: ${App.fieldSelect('fr-f')}</label></div></div><p class="small muted" id="fr-msg" style="margin:0;min-height:16px"></p>`,
    buttons: [{ label: 'Annuleren' }, { label: 'Volgende zoeken', primary: true, action: (d) => {
      const q = d.$('#fr-q').value.trim().toLowerCase();
      if (!q) return false;
      const one = d.$('[name=fr-in]:checked').value === 'one' ? d.$('#fr-f').value : null;
      const n = m.records.length;
      for (let k = 1; k <= n; k++) {
        const i = (from + k) % n, r = m.records[i];
        const vals = one ? [r[one]] : Object.values(r);
        if (vals.some((v) => String(v ?? '').toLowerCase().includes(q))) {
          from = i; App.mergeGo(i);
          d.$('#fr-msg').textContent = `Gevonden in record ${i + 1}.`;
          return false;
        }
      }
      d.$('#fr-msg').textContent = 'Er zijn geen (andere) records gevonden.';
      return false;
    } }],
  });
});

/* ---------- Controleren op fouten ---------- */
App.mergeErrors = () => {
  const m = App.mail(), errs = [], warn = [];
  const has = (f) => m.fields.includes(f);
  $$('.mf', App.ed).forEach((f) => { if (!has(f.dataset.field)) errs.push(`Samenvoegveld «${f.dataset.field}» bestaat niet in de adreslijst.`); });
  $$('.mrule[data-field]', App.ed).forEach((r) => { if (!has(r.dataset.field)) errs.push(`Regel gebruikt veld «${r.dataset.field}», dat niet in de adreslijst staat.`); });
  const used = [...new Set($$('.mf', App.ed).map((f) => f.dataset.field).filter(has))];
  m.records.forEach((r, i) => { const empty = used.filter((f) => !String(r[f] ?? '').trim()); if (empty.length) warn.push(`Record ${i + 1}: leeg veld ${empty.map((f) => '«' + f + '»').join(', ')}.`); });
  if (!$$('.mf, .mrule', App.ed).length) warn.push('Het document bevat geen samenvoegvelden.');
  return { errs: [...new Set(errs)], warn };
};
App.def('checkMergeErrors', () => {
  const m = App.mail();
  if (!m.records.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  App.dialog({
    title: 'Fouten controleren en melden',
    body: `<div class="checks" style="flex-direction:column;gap:6px">
      <label><input type="radio" name="ce" value="sim" checked> Het samenvoegen simuleren en fouten in een nieuw document melden</label>
      <label><input type="radio" name="ce" value="stop"> Het samenvoegen voltooien en pauzeren om elke fout te melden</label>
      <label><input type="radio" name="ce" value="go"> Het samenvoegen voltooien zonder te pauzeren; fouten melden in een nieuw document</label></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const mode = d.$('[name=ce]:checked').value;
      const { errs, warn } = App.mergeErrors();
      const report = () => App.dialog({ title: 'Resultaat van de controle', wide: true,
        body: errs.length || warn.length ? `${errs.length ? `<h4 style="margin:0 0 6px">Fouten (${errs.length})</h4><ul>${errs.map((e) => `<li>${App.esc(e)}</li>`).join('')}</ul>` : ''}${warn.length ? `<h4 style="margin:8px 0 6px">Waarschuwingen (${warn.length})</h4><ul style="max-height:240px;overflow:auto">${warn.map((e) => `<li>${App.esc(e)}</li>`).join('')}</ul>` : ''}`
          : '<p>Er zijn geen samenvoegfouten gevonden.</p>' });
      if (mode === 'sim') setTimeout(report, 30);
      else if (mode === 'stop' && errs.length) setTimeout(report, 30);
      else { setTimeout(() => App.exec('mergeToDoc'), 30); if (errs.length || warn.length) setTimeout(report, 60); }
    } }],
  });
});

/* ---------- Wizard Afdruk samenvoegen (deelvenster, 6 stappen zoals Word) ---------- */
App.wizStep = 1;
App.def('mergeWizard', () => { App.wizStep = 1; App.renderWizard(); });
App.renderWizard = () => {
  const body = App.taskPane('mergewiz', 'Afdruk samenvoegen');
  const m = App.mail(), s = App.wizStep, type = m.type && m.type !== 'normal' ? m.type : 'letters';
  const radio = (name, v, label, on, sub = '') => `<label class="tp-item" style="cursor:pointer"><input type="radio" name="${name}" value="${v}" ${on ? 'checked' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  const act = (cmd, icon, label, arg = '') => `<button class="tp-item" data-cmd="${cmd}" ${arg ? `data-arg="${arg}"` : ''}><span class="i">${icon}</span><span>${label}</span></button>`;
  let html = '';
  if (s === 1) {
    html = `<h4>Documenttype selecteren</h4><p class="muted">Aan welk type document werkt u?</p>
      ${radio('wz-type', 'letters', 'Brieven', type === 'letters', 'Brieven naar een groep personen sturen; elke brief kan persoonlijk worden gemaakt.')}
      ${radio('wz-type', 'envelopes', 'Enveloppen', type === 'envelopes', 'Geadresseerde enveloppen afdrukken.')}
      ${radio('wz-type', 'labels', 'Etiketten', type === 'labels', 'Adresetiketten afdrukken voor een groep personen.')}
      ${radio('wz-type', 'directory', 'Lijst (directory)', type === 'directory', 'Eén document met een catalogus of afgedrukte lijst met adressen.')}`;
  } else if (s === 2) {
    html = `<h4>Begindocument selecteren</h4><p class="muted">Hoe wil je de brieven instellen?</p>
      ${radio('wz-start', 'current', 'Het huidige document gebruiken', true, 'Begin met het hier getoonde document en voeg ontvangergegevens toe.')}
      ${radio('wz-start', 'new', 'Met een nieuw leeg document beginnen', false, 'Het huidige document wordt eerst opgeslagen op deze computer.')}`;
  } else if (s === 3) {
    html = `<h4>Ontvangers selecteren</h4>
      ${act('recipientsCsv', 'upload_file', 'Een bestaande lijst gebruiken (CSV)…')}${act('recipientsNew', 'edit', 'Een nieuwe lijst typen…')}${act('recipientsSample', 'list_alt', 'Voorbeeldlijst gebruiken')}
      <p class="muted" style="margin-top:10px">${m.records.length ? `Huidige lijst: <b>${m.records.length}</b> ontvangers, ${m.fields.length} velden.` : 'Er is nog geen adreslijst geselecteerd.'}</p>
      ${m.records.length ? act('editRecipients', 'contacts', 'Adreslijst bewerken…') : ''}`;
  } else if (s === 4) {
    html = `<h4>${type === 'labels' ? 'Etiketten schikken' : type === 'envelopes' ? 'Envelop schikken' : 'Brief schrijven'}</h4><p class="muted">Klik in het document waar de gegevens moeten komen en kies een item:</p>
      ${act('addressBlock', 'home', 'Adresblok…')}${act('greetingLine', 'short_text', 'Begroetingsregel…')}
      <button class="tp-item" data-menu="m-mergefield"><span class="i">data_object</span><span>Meer items…</span></button>
      ${type === 'labels' ? act('updateLabels', 'sync', 'Alle etiketten bijwerken') : ''}`;
  } else if (s === 5) {
    const n = m.records.length;
    html = `<h4>Voorbeeld van ${type === 'labels' ? 'etiketten' : type === 'envelopes' ? 'enveloppen' : 'brieven'}</h4>
      <div style="display:flex;align-items:center;gap:6px;margin:8px 0"><button class="qb" data-cmd="mergePrev" title="Vorige"><span class="i">chevron_left</span></button><span>Ontvanger: <b>${n ? App.state.mergeIndex + 1 : 0}</b> van ${n}</span><button class="qb" data-cmd="mergeNext" title="Volgende"><span class="i">chevron_right</span></button></div>
      ${act('findRecipient', 'person_search', 'Een ontvanger zoeken…')}${act('editRecipients', 'contacts', 'Ontvangerslijst bewerken…')}${act('checkMergeErrors', 'rule', 'Controleren op fouten…')}`;
  } else {
    html = `<h4>Samenvoeging voltooien</h4><p class="muted">Je kunt nu samenvoegen.</p>
      ${act('mergeToPrint', 'print', 'Afdrukken…')}${act('mergeToDoc', 'description', 'Afzonderlijke brieven bewerken…')}`;
  }
  html += `<div class="tp-actions" style="border-top:1px solid var(--line);padding-top:10px;margin-top:14px"><span class="muted" style="flex:1">Stap ${s} van 6</span>
    ${s > 1 ? '<button class="btn small" data-wz="-1">Vorige</button>' : ''}${s < 6 ? '<button class="btn small primary" data-wz="1">Volgende</button>' : '<button class="btn small" data-wz="close">Sluiten</button>'}</div>`;
  body.innerHTML = html;
  body.onclick = (e) => {
    const b = e.target.closest('[data-wz]'); if (!b) return;
    if (b.dataset.wz === 'close') { App.closeTaskPane('mergewiz'); return; }
    const dir = +b.dataset.wz;
    if (s === 1 && dir > 0) {
      const t = body.querySelector('[name=wz-type]:checked').value;
      if (t !== type || (t === 'envelopes' || t === 'labels')) { App.wizStep = 2; App.exec('startMerge', t); App.renderWizard(); return; }
      m.type = t;
    }
    if (s === 2 && dir > 0 && body.querySelector('[name=wz-start]:checked').value === 'new') {
      const keep = JSON.parse(JSON.stringify(m)); App.newDoc('blank'); App.doc.meta.mail = keep; App.updateMergeInfo();
    }
    if (s === 3 && dir > 0 && !App.mail().records.length) { App.toast('Selecteer eerst ontvangers', 'group'); return; }
    if (s === 4 && dir > 0 && App.mail().records.length) App.mergeGo(App.state.mergeIndex);
    App.wizStep = App.clamp(s + dir, 1, 6);
    App.renderWizard();
  };
};
// Wizard bijwerken als de adreslijst of het record verandert
(() => {
  const orig = App.updateMergeInfo;
  App.updateMergeInfo = () => { orig(); if (App.paneOpen && App.paneOpen('mergewiz') && (App.wizStep === 3 || App.wizStep === 5)) App.renderWizard(); };
})();
