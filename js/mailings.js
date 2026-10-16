/* =========================================================
   Inkt — Verzendlijsten: afdruk samenvoegen, enveloppen, etiketten
   ========================================================= */
'use strict';

App.mail = () => App.doc.meta.mail || (App.doc.meta.mail = { fields: [], records: [] });
App.parseCsv = (text) => {
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim()));
  const fields = (clean.shift() || []).map((f, i) => f.trim() || `Veld${i + 1}`);
  const records = clean.map((r) => Object.fromEntries(fields.map((f, i) => [f, (r[i] || '').trim()])));
  return { fields, records };
};
App.setMailData = (data) => {
  App.doc.meta.mail = data;
  App.state.mergeIndex = 0;
  App.markDirty();
  App.updateMergeInfo();
};
App.updateMergeInfo = () => {
  const m = App.mail();
  $('#merge-info').textContent = m.records.length ? `${m.records.length} adressen · ${m.fields.length} velden` : 'Geen adreslijst';
  $('#merge-rec').value = m.records.length ? App.state.mergeIndex + 1 : '';
};
App.def('recipientsSample', () => {
  App.setMailData({
    fields: ['Voornaam', 'Achternaam', 'Adres', 'Postcode', 'Plaats', 'E-mail'],
    records: [
      { Voornaam: 'Sanne', Achternaam: 'de Vries', Adres: 'Lindelaan 12', Postcode: '3512 AB', Plaats: 'Utrecht', 'E-mail': 'sanne@voorbeeld.nl' },
      { Voornaam: 'Daan', Achternaam: 'Jansen', Adres: 'Kerkstraat 4', Postcode: '1017 GC', Plaats: 'Amsterdam', 'E-mail': 'daan@voorbeeld.nl' },
      { Voornaam: 'Fatima', Achternaam: 'El Amrani', Adres: 'Molenweg 88', Postcode: '5611 KL', Plaats: 'Eindhoven', 'E-mail': 'fatima@voorbeeld.nl' },
      { Voornaam: 'Lucas', Achternaam: 'Bakker', Adres: 'Havenkade 3', Postcode: '9711 BE', Plaats: 'Groningen', 'E-mail': 'lucas@voorbeeld.nl' },
    ],
  });
  App.toast('Voorbeeldlijst met 4 adressen geladen', 'ok');
});
App.def('recipientsCsv', async () => {
  const f = await App.pickFile('.csv,.txt,.tsv');
  if (!f) return;
  const data = App.parseCsv(await App.readFile(f));
  if (!data.fields.length) { App.toast('Het bestand bevat geen gegevens', 'error'); return; }
  App.setMailData(data);
  App.toast(`${data.records.length} adressen geladen uit ${f.name}`, 'ok');
});
App.def('recipientsNew', () => {
  const m = App.mail();
  if (!m.fields.length) App.setMailData({ fields: ['Voornaam', 'Achternaam', 'Adres', 'Postcode', 'Plaats'], records: [{}] });
  App.exec('editRecipients');
});
App.def('editRecipients', () => {
  const m = App.mail();
  if (!m.fields.length) { App.exec('recipientsNew'); return; }
  const data = { fields: [...m.fields], records: m.records.map((r) => ({ ...r })) };
  const d = App.dialog({
    title: 'Adreslijst bewerken', xwide: true,
    body: `<div style="overflow:auto;max-height:55vh;border:1px solid var(--line);border-radius:10px"><table class="data-table" id="rl-t"></table></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn small" id="rl-addr"><span class="i">add</span> Rij</button><button class="btn small" id="rl-addc"><span class="i">add</span> Kolom</button><button class="btn small" id="rl-csv"><span class="i">upload_file</span> CSV importeren</button><button class="btn small" id="rl-exp"><span class="i">download</span> Als CSV opslaan</button></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'Opslaan', primary: true, action: () => { read(); App.setMailData({ fields: data.fields, records: data.records.filter((r) => Object.values(r).some((v) => v)) }); App.renderMergePreview(); } }],
  });
  const read = () => {
    const t = d.$('#rl-t');
    const heads = $$('thead input', t).map((i) => i.value.trim() || 'Veld');
    const rows = $$('tbody tr', t).map((tr) => Object.fromEntries($$('input', tr).map((i, k) => [heads[k], i.value])));
    data.fields = heads; data.records = rows;
  };
  const render = () => {
    d.$('#rl-t').innerHTML = `<thead><tr>${data.fields.map((f, i) => `<th><input value="${App.esc(f)}" data-c="${i}"></th>`).join('')}<th style="width:34px"></th></tr></thead>
      <tbody>${data.records.map((r, ri) => `<tr>${data.fields.map((f) => `<td><input value="${App.esc(r[f] || '')}"></td>`).join('')}<td><button class="qb" data-delrow="${ri}" title="Rij verwijderen"><span class="i">close</span></button></td></tr>`).join('')}</tbody>`;
  };
  render();
  d.$('#rl-addr').onclick = () => { read(); data.records.push({}); render(); const ins = $$('tbody tr:last-child input', d.el); if (ins[0]) ins[0].focus(); };
  d.$('#rl-addc').onclick = () => { read(); data.fields.push('Veld' + (data.fields.length + 1)); render(); };
  d.$('#rl-csv').onclick = async () => { const f = await App.pickFile('.csv,.txt,.tsv'); if (!f) return; const p = App.parseCsv(await App.readFile(f)); data.fields = p.fields; data.records = p.records; render(); };
  d.$('#rl-exp').onclick = () => {
    read();
    const q = (v) => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
    const csv = [data.fields.map(q).join(';'), ...data.records.map((r) => data.fields.map((f) => q(r[f] || '')).join(';'))].join('\r\n');
    App.download(new Blob(['﻿' + csv], { type: 'text/csv' }), 'adreslijst.csv');
  };
  d.$('#rl-t').addEventListener('click', (e) => { const b = e.target.closest('[data-delrow]'); if (b) { read(); data.records.splice(+b.dataset.delrow, 1); render(); } });
});
App.menuBuilders['m-mergefield'] = () => {
  const m = App.mail();
  if (!m.fields.length) return '<div class="menu-empty">Selecteer eerst een adreslijst via <b>Adressen</b>.</div><button data-cmd="recipientsSample"><span class="i">science</span> Voorbeeldlijst gebruiken</button>';
  return '<div class="menu-title">Samenvoegveld invoegen</div>' + m.fields.map((f) => `<button data-cmd="insertMergeField" data-arg="${App.esc(f)}"><span class="i">data_object</span> ${App.esc(f)}</button>`).join('');
};
App.mfHtml = (f) => `<span class="mf" contenteditable="false" data-field="${App.esc(f)}">«${App.esc(f)}»</span>`;
App.defEdit('insertMergeField', (f) => { App.insertHTML(App.mfHtml(f) + '&#8203;'); App.renderMergePreview(); });
App.findField = (...keys) => App.mail().fields.find((f) => keys.some((k) => f.toLowerCase().replace(/[^a-z]/g, '').includes(k)));
App.defEdit('addressBlock', () => {
  if (!App.mail().fields.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  const F = App.findField;
  const first = F('voornaam', 'firstname'), last = F('achternaam', 'lastname', 'naam', 'name'), addr = F('adres', 'straat', 'address', 'street');
  const zip = F('postcode', 'zip', 'postal'), city = F('plaats', 'woonplaats', 'stad', 'city'), company = F('bedrijf', 'company', 'organisatie');
  const parts = [];
  if (company) parts.push(App.mfHtml(company));
  parts.push([first, last].filter(Boolean).map(App.mfHtml).join(' '));
  if (addr) parts.push(App.mfHtml(addr));
  if (zip || city) parts.push([zip, city].filter(Boolean).map(App.mfHtml).join('&nbsp;&nbsp;'));
  App.insertHTML(`<p class="nospace">${parts.filter(Boolean).join('<br>')}</p><p><br></p>`);
  App.renderMergePreview();
});
App.defEdit('greetingLine', () => {
  if (!App.mail().fields.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  const first = App.findField('voornaam', 'firstname', 'naam', 'name') || App.mail().fields[0];
  App.insertHTML(`Beste ${App.mfHtml(first)},&#8203;`);
  App.renderMergePreview();
});
App.def('mergeHighlight', () => { App.state.mergeHL = !App.state.mergeHL; App.ed.classList.toggle('merge-hl', App.state.mergeHL); App.scheduleState(); });
App.stateFns.mergeHL = () => App.state.mergeHL;
App.renderMergePreview = () => {
  const m = App.mail();
  const on = App.state.mergePreview && m.records.length;
  App.ed.classList.toggle('merge-preview', !!on);
  const rec = m.records[App.state.mergeIndex] || {};
  $$('.mf', App.ed).forEach((f) => {
    const t = on ? (rec[f.dataset.field] ?? '') : `«${f.dataset.field}»`;
    if (f.textContent !== t) f.textContent = t;
  });
  App.updateMergeInfo();
};
App.def('mergePreview', () => {
  if (!App.mail().records.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  App.state.mergePreview = !App.state.mergePreview;
  App.renderMergePreview(); App.scheduleState(); App.layout();
});
App.stateFns.mergePreview = () => App.state.mergePreview;
App.mergeGo = (i) => {
  const n = App.mail().records.length; if (!n) return;
  App.state.mergeIndex = App.clamp(i, 0, n - 1);
  if (!App.state.mergePreview) App.state.mergePreview = true;
  App.renderMergePreview(); App.scheduleState(); App.layout();
};
App.def('mergeFirst', () => App.mergeGo(0));
App.def('mergePrev', () => App.mergeGo(App.state.mergeIndex - 1));
App.def('mergeNext', () => App.mergeGo(App.state.mergeIndex + 1));
App.def('mergeLast', () => App.mergeGo(App.mail().records.length - 1));
App.def('mergeGoto', (v) => App.mergeGo((parseInt(v, 10) || 1) - 1));
App.mergedHtml = () => {
  const m = App.mail();
  const base = App.cleanHtml(true);
  const tmp = document.createElement('div');
  return m.records.map((rec, i) => {
    tmp.innerHTML = base;
    tmp.querySelectorAll('.mf').forEach((f) => f.replaceWith(document.createTextNode(rec[f.dataset.field] ?? '')));
    tmp.querySelectorAll('.footnotes').forEach((x) => x.remove());
    return tmp.innerHTML + (i < m.records.length - 1 ? '<div class="page-break" contenteditable="false"></div>' : '');
  }).join('');
};
App.def('mergeToDoc', async () => {
  const m = App.mail();
  if (!m.records.length) { App.toast('Selecteer eerst een adreslijst', 'group'); return; }
  if (!App.ed.querySelector('.mf')) { if (!(await App.confirm('Geen samenvoegvelden', 'Dit document bevat nog geen samenvoegvelden. Toch samenvoegen?', 'Samenvoegen'))) return; }
  const html = App.mergedHtml();
  App.newDocFromHtml(html, App.doc.title + ' (samengevoegd)', { keepLook: true });
  App.toast(`${m.records.length} documenten samengevoegd`, 'merge');
});
App.def('mergeToPrint', () => { App.exec('mergeToDoc'); setTimeout(() => App.exec('print'), 600); });

/* Enveloppen */
App.addressOf = (rec) => {
  const F = App.findField;
  const g = (...k) => { const f = F(...k); return f ? rec[f] || '' : ''; };
  return [g('bedrijf', 'company'), [g('voornaam', 'firstname'), g('achternaam', 'lastname', 'naam')].filter(Boolean).join(' '), g('adres', 'straat', 'address'), [g('postcode', 'zip'), g('plaats', 'stad', 'city')].filter(Boolean).join('  ')].filter(Boolean).join('\n');
};
App.def('envelope', () => {
  const m = App.mail();
  const r = App.getRange() || App.lastRange;
  const selAddr = r && !r.collapsed ? r.toString() : '';
  App.dialog({
    title: 'Enveloppen', wide: true,
    body: `<div class="fields-2">
      <label class="field"><span>Afzender</span><textarea id="ev-from" style="min-height:90px">${App.esc(App.store.get('envelopeFrom', App.settings.author))}</textarea></label>
      <label class="field"><span>Geadresseerde</span><textarea id="ev-to" style="min-height:90px">${App.esc(selAddr || (m.records[0] ? App.addressOf(m.records[0]) : ''))}</textarea></label></div>
      <div class="fields-2"><label class="field"><span>Formaat</span><select id="ev-size"><option value="DL">DL (22 × 11 cm)</option><option value="C5">C5 (22,9 × 16,2 cm)</option></select></label>
      <div class="checks" style="align-items:flex-end">${m.records.length ? `<label><input type="checkbox" id="ev-all"> Eén envelop per adres in de lijst (${m.records.length})</label>` : ''}</div></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Envelop maken', primary: true, action: (d) => {
        const from = d.$('#ev-from').value, to = d.$('#ev-to').value;
        App.store.set('envelopeFrom', from);
        const size = d.$('#ev-size').value;
        if (size === 'C5') App.PAGE_SIZES.C5 = [229, 162];
        const all = d.$('#ev-all') && d.$('#ev-all').checked;
        const addrs = all ? m.records.map(App.addressOf) : [to];
        const nl = (s) => App.esc(s).replace(/\n/g, '<br>');
        const html = addrs.map((a, i) => `<p class="nospace" style="font-size:9pt;color:#444">${nl(from)}</p><p class="nospace" style="margin:${size === 'C5' ? '150px' : '70px'} 0 0 ${size === 'C5' ? '340px' : '320px'};font-size:12pt">${nl(a)}</p>${i < addrs.length - 1 ? '<div class="page-break" contenteditable="false"></div>' : ''}`).join('');
        App.newDocFromHtml(html, 'Envelop', { page: { size, orient: 'landscape', margins: { t: 1, r: 1.5, b: 1, l: 1.5 } } });
      },
    }],
  });
});

/* Etiketten */
App.LABELS = {
  L7160: { name: 'Avery L7160 — 3 × 7 (63,5 × 38,1 mm)', cols: 3, rows: 7, w: 63.5, h: 38.1, mt: 1.51, ml: 0.72, gap: 2.5 },
  L7163: { name: 'Avery L7163 — 2 × 7 (99,1 × 38,1 mm)', cols: 2, rows: 7, w: 99.1, h: 38.1, mt: 1.51, ml: 0.47, gap: 2.5 },
  L7651: { name: 'Avery L7651 — 5 × 13 (38,1 × 21,2 mm)', cols: 5, rows: 13, w: 38.1, h: 21.2, mt: 1.07, ml: 0.47, gap: 2.5 },
  '3x8': { name: 'Algemeen — 3 × 8 (70 × 37 mm)', cols: 3, rows: 8, w: 70, h: 37, mt: 0, ml: 0, gap: 0 },
};
App.def('labels', () => {
  const m = App.mail();
  App.dialog({
    title: 'Etiketten', wide: true,
    body: `<label class="field"><span>Etikettype</span><select id="lb-type">${Object.entries(App.LABELS).map(([k, l]) => `<option value="${k}">${l.name}</option>`).join('')}</select></label>
      <div class="seg" id="lb-mode"><button data-m="same" class="${m.records.length ? '' : 'on'}">Hetzelfde adres op elk etiket</button>${m.records.length ? `<button data-m="list" class="on">Uit adreslijst (${m.records.length})</button>` : ''}</div>
      <label class="field" id="lb-text-f"><span>Adres</span><textarea id="lb-text">${App.esc(m.records[0] ? App.addressOf(m.records[0]) : '')}</textarea></label>`,
    onOpen: (d) => {
      const mode = d.$('#lb-mode');
      const sync = () => { d.$('#lb-text-f').hidden = mode.querySelector('.on').dataset.m === 'list'; };
      mode.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; $$('button', mode).forEach((x) => x.classList.toggle('on', x === b)); sync(); });
      sync();
    },
    buttons: [{ label: 'Annuleren' }, {
      label: 'Etiketten maken', primary: true, action: (d) => {
        const L = App.LABELS[d.$('#lb-type').value];
        const list = d.$('#lb-mode .on').dataset.m === 'list';
        const items = list ? m.records.map(App.addressOf) : Array(L.cols * L.rows).fill(d.$('#lb-text').value);
        const per = L.cols * L.rows;
        const pages = Math.max(1, Math.ceil(items.length / per));
        let html = '';
        for (let p = 0; p < pages; p++) {
          html += `<table class="doc-table b-none" style="table-layout:fixed;width:${L.cols * L.w + (L.cols - 1) * L.gap}mm;margin:0">`;
          for (let r = 0; r < L.rows; r++) {
            html += '<tr>';
            for (let c = 0; c < L.cols; c++) {
              const it = items[p * per + r * L.cols + c] || '';
              html += `<td style="width:${L.w}mm;height:${L.h}mm;vertical-align:middle;padding:0 4mm;font-size:${L.h < 25 ? 7 : 10}pt;line-height:1.25;overflow:hidden">${App.esc(it).replace(/\n/g, '<br>') || '<br>'}</td>`;
              if (c < L.cols - 1 && L.gap) html += `<td style="width:${L.gap}mm;padding:0"></td>`;
            }
            html += '</tr>';
          }
          html += '</table>' + (p < pages - 1 ? '<div class="page-break" contenteditable="false"></div>' : '');
        }
        const ml = Math.max(0.4, L.ml || (21 - (L.cols * L.w + (L.cols - 1) * L.gap) / 10) / 2);
        App.newDocFromHtml(html, 'Etiketten', { page: { size: 'A4', orient: 'portrait', margins: { t: L.mt || (29.7 - L.rows * L.h / 10) / 2, b: 0.3, l: ml, r: 0.3 } } });
      },
    }],
  });
});
App.on('change', () => { if (App.state.mergePreview) App.renderMergePreview(); });
