/* =========================================================
   Inkt — Bestand: info, versies, wachtwoord, opties, sluiten, RTF; statusbalk
   ========================================================= */
'use strict';


/* ---------- Statusbalk aanpassen (rechtsklik, zoals Word) ---------- */
App.SB_ITEMS = [
  ['section', 'Sectie', true], ['page', 'Paginanummer', true], ['words', 'Aantal woorden', true], ['spell', 'Spelling- en grammaticacontrole', true],
  ['lang', 'Taal', true], ['a11y', 'Toegankelijkheidscontrole', true], ['track', 'Wijzigingen bijhouden', false],
  ['focus', 'Focus', true], ['views', 'Weergavesnelkoppelingen', true], ['zoomslider', 'Zoomschuifregelaar', true], ['zoom', 'Zoomen', true],
];
App.sbOn = (k) => { const s = App.settings.sb || {}; return k in s ? !!s[k] : App.SB_ITEMS.find((x) => x[0] === k)[2]; };
App.updateStatusbar = () => {
  App.SB_ITEMS.forEach(([k]) => $$(`#statusbar [data-sbi="${k}"]`).forEach((el) => {
    if (k === 'track') return;
    el.classList.toggle('sb-off', !App.sbOn(k));
  }));
  const tr = $('#sb-track');
  if (tr) {
    const always = App.sbOn('track');
    tr.hidden = !(always || App.state.track);
    tr.querySelector('.t').textContent = always ? `Wijzigingen bijhouden: ${App.state.track ? 'Aan' : 'Uit'}` : 'Wijzigingen bijhouden';
  }
  const sec = $('#sb-section');
  if (sec) { const r = App.getRange() || App.lastRange; sec.textContent = 'Sectie: ' + (r && App.inEditor(r.startContainer) && App.sectionOf ? App.sectionOf(r.startContainer) : 1); }
  const sp = $('#sb-spell');
  if (sp) { sp.classList.toggle('on', !!App.settings.spell); sp.title = App.settings.spell ? 'Spelling- en grammaticacontrole: aan (klik om uit te zetten)' : 'Spelling- en grammaticacontrole: uit (klik om aan te zetten)'; sp.querySelector('.i').textContent = App.settings.spell ? 'spellcheck' : 'text_fields'; }
  const fin = $('#sb-final'); if (fin) fin.hidden = !App.doc.meta.final;
};
App.on('selection', App.debounce(() => App.updateStatusbar(), 80));
App.updateA11yStatus = App.debounce(() => {
  const el = $('#sb-a11y'); if (!el || !App.sbOn('a11y') || !App.a11yCheck) return;
  const t = App.a11yStatus();
  el.querySelector('.t').textContent = t;
  el.querySelector('.i').textContent = /goed/.test(t) ? 'accessibility_new' : 'accessibility';
}, 2000);
App.on('change', () => App.updateA11yStatus());
document.getElementById('statusbar').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const html = '<div class="menu-title">Statusbalk aanpassen</div>' + App.SB_ITEMS.map(([k, label]) => {
    let val = '';
    if (k === 'section') val = $('#sb-section').textContent.replace('Sectie: ', '');
    if (k === 'page') val = (App.pages.current || 1) + ' van ' + App.pages.count;
    if (k === 'words') val = String(App.stats ? App.stats.words : 0);
    if (k === 'lang') val = $('#sb-lang').textContent;
    if (k === 'track') val = App.state.track ? 'Aan' : 'Uit';
    if (k === 'zoom') val = Math.round(App.state.zoom * 100) + '%';
    if (k === 'spell') val = App.settings.spell ? 'Aan' : 'Uit';
    return `<button data-sbtoggle="${k}"><span class="i">${App.sbOn(k) ? 'check' : ''}</span><span style="flex:1">${label}</span><span class="muted" style="margin-left:18px;font-size:11px">${App.esc(val)}</span></button>`;
  }).join('');
  const m = App.openPopup({ x: e.clientX, y: e.clientY }, html, 'ctx-menu sb-menu');
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sbtoggle]'); if (!b) return;
    ev.stopPropagation();
    const k = b.dataset.sbtoggle;
    App.settings.sb = { ...(App.settings.sb || {}), [k]: !App.sbOn(k) };
    App.saveSettings(); App.updateStatusbar(); App.updateA11yStatus();
    b.querySelector('.i').textContent = App.sbOn(k) ? 'check' : '';   // menu blijft open, zoals in Word
  });
});
setTimeout(() => { App.updateStatusbar(); App.updateA11yStatus(); }, 0);

/* ---------- Versiegeschiedenis ---------- */
// Automatisch een versie bewaren (standaard elke 10 minuten als er iets veranderd is, maximaal 20).
// Is de opslag van de browser vol, dan verdwijnen de oudste versies in plaats van dat opslaan mislukt.
App.verKey = (id) => 'ver.' + id;
App.versions = (id = App.doc.id) => App.store.get(App.verKey(id), []) || [];
App.storeVersions = (id, list) => {
  while (list.length) {
    if (App.store.set(App.verKey(id), list)) return true;
    list.shift();   // oudste weg en opnieuw proberen
  }
  App.store.del(App.verKey(id));
  return false;
};
App.pruneVersions = () => {
  let freed = false;
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('inkt.ver.')).forEach((k) => {
      const id = k.slice(9), list = App.versions(id);
      if (!list.length) return;
      const keep = list.slice(Math.ceil(list.length / 2));
      if (keep.length) App.store.set(App.verKey(id), keep); else App.store.del(App.verKey(id));
      freed = true;
    });
  } catch { /* niets */ }
  return freed;
};
App.saveVersion = (manual) => {
  const d = App.doc;
  const html = App.cleanHtml();
  const list = App.versions(d.id);
  const last = list[list.length - 1];
  if (last && last.html === html) { if (manual) App.toast('Er zijn geen wijzigingen sinds de laatste versie', 'info'); return false; }
  const meta = { ...d.meta, comments: (d.meta.comments || []).filter((c) => !c.draft) };
  list.push({ t: Date.now(), title: d.title, html, meta, author: App.settings.author, manual: !!manual, words: App.stats ? App.stats.words : 0 });
  const max = App.settings.versionMax || 20;
  while (list.length > max) list.shift();
  const ok = App.storeVersions(d.id, list);
  if (!ok && manual) App.toast('Er is niet genoeg ruimte in de browser om een versie te bewaren', 'error');
  return ok;
};
(() => {
  const orig = App.saveLocal;
  App.saveLocal = (auto) => {
    let ok = orig(auto);
    // het document zelf gaat vóór de versies: bij een volle opslag eerst oude versies opruimen en opnieuw proberen
    if (!ok && App.pruneVersions()) { App._quotaWarned = false; ok = orig(auto); }
    if (ok && App.settings.versions !== false && !document.body.classList.contains('second-window')) {
      const list = App.versions();
      const last = list[list.length - 1];
      const every = (App.settings.versionMinutes || 10) * 60000;
      if (!last || Date.now() - last.t >= every) App.saveVersion(false);
    }
    return ok;
  };
})();
App.def('saveVersionNow', () => { if (App.saveVersion(true)) { App.toast('Versie bewaard', 'history'); App.renderVersions(); } });
App.def('versionHistory', () => { App.closeBackstage(); App.taskPane('versions', 'Versiegeschiedenis'); App.renderVersions(); });
App.renderVersions = () => {
  if (!App.paneOpen('versions')) return;
  const body = App.taskPane('versions', 'Versiegeschiedenis');
  const list = App.versions().slice().reverse();
  const day = (t) => new Date(t).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  let lastDay = '';
  body.innerHTML = `<p class="muted" style="margin:6px 0 10px">Inkt bewaart automatisch elke ${App.settings.versionMinutes || 10} minuten een versie als het document is gewijzigd (maximaal ${App.settings.versionMax || 20}).</p>
    <div class="tp-actions" style="margin:0 0 8px"><button class="btn small" data-v="now"><span class="i">history</span> Nu een versie bewaren</button></div>`
    + (list.length ? list.map((v, i) => {
      const d = day(v.t), head = d !== lastDay ? `<h4>${d}</h4>` : ''; lastDay = d;
      return `${head}<div class="tp-item" style="flex-direction:column;gap:4px;cursor:default"><div><b>${new Date(v.t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</b> <span class="muted">· ${App.esc(v.author || '')}${v.manual ? ' · handmatig' : ''} · ${v.words || 0} woorden</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-v="restore" data-i="${i}">Herstellen</button><button class="btn small" data-v="copy" data-i="${i}">Openen als kopie</button><button class="btn small" data-v="cmp" data-i="${i}">Vergelijken</button></div></div>`;
    }).join('') : '<p class="muted">Er zijn nog geen eerdere versies van dit document.</p>');
  body.onclick = async (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'now') { App.exec('saveVersionNow'); return; }
    const v = list[+b.dataset.i]; if (!v) return;
    if (b.dataset.v === 'restore') {
      if (!(await App.confirm('Versie herstellen', `Het document terugzetten naar de versie van ${App.fmtDateTime(v.t)}? De huidige inhoud wordt eerst als versie bewaard.`, 'Herstellen'))) return;
      App.saveVersion(true);
      App.loadDoc({ id: App.doc.id, title: App.doc.title, html: v.html, meta: v.meta });
      App.markDirty(); App.saveLocal(true);
      App.toast('Versie hersteld', 'history');
      App.taskPane('versions', 'Versiegeschiedenis'); App.renderVersions();
    } else if (b.dataset.v === 'copy') {
      App.newDocFromHtml(v.html, `${v.title} (versie ${App.fmtDateTime(v.t)})`);
    } else if (b.dataset.v === 'cmp') {
      const toParas = (html) => { const div = document.createElement('div'); div.innerHTML = html; div.querySelectorAll('del.trk').forEach((x) => x.remove()); return $$('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote', div).filter((x) => !x.querySelector('p,li,td')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); };
      const res = App.compareTexts(toParas(v.html), toParas(App.cleanHtml()), 'Vergelijking');
      App.newDocFromHtml(res.html, `Vergelijking — versie ${App.fmtDateTime(v.t)} met huidige`);
      App.toast(`${res.changes} verschillen gevonden`, 'compare');
    }
  };
};

/* ---------- Versleutelen met wachtwoord (.inkt, AES-GCM) ---------- */
// Het wachtwoord staat alleen in het geheugen, nooit in het document of in de browseropslag.
App.docPassword = null;
App.b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
App.unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
App.deriveKey = async (pw, salt) => {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
App.encryptText = async (text, pw) => {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await App.deriveKey(pw, salt), new TextEncoder().encode(text));
  return JSON.stringify({ format: 'inkt-versleuteld', version: 1, kdf: 'PBKDF2-SHA256-250000', cipher: 'AES-GCM-256', salt: App.b64(salt), iv: App.b64(iv), data: App.b64(data) });
};
App.decryptText = async (obj, pw) => {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: App.unb64(obj.iv) }, await App.deriveKey(pw, App.unb64(obj.salt)), App.unb64(obj.data));
  return new TextDecoder().decode(plain);
};
App.passwordPrompt = (title, msg) => new Promise((res) => {
  let v = null;
  App.dialog({ title, body: `<p style="margin-top:0">${msg}</p><label class="field"><span>Wachtwoord</span><input id="pp-pw" type="password" autofocus></label>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { v = d.$('#pp-pw').value; } }], onClose: () => res(v), keepFocus: true });
});
App.def('encryptDoc', () => {
  const has = !!App.docPassword;
  App.dialog({
    title: 'Document versleutelen',
    body: `<p style="margin-top:0;line-height:1.5">De inhoud van dit bestand versleutelen. Het wachtwoord is nodig om het Inkt-bestand (.inkt) te openen.</p>
      <label class="field"><span>Wachtwoord${has ? ' (leeg laten = versleuteling verwijderen)' : ''}</span><input id="enc-a" type="password" autofocus></label>
      <label class="field"><span>Wachtwoord opnieuw invoeren</span><input id="enc-b" type="password"></label>
      <div style="background:#fff4ce;color:#3b2e00;border:1px solid #f0d77a;border-radius:4px;padding:8px 10px;font-size:12px;line-height:1.5"><b>Let op:</b> als je het wachtwoord kwijtraakt of vergeet, kan het <b>niet</b> worden hersteld. Bewaar wachtwoorden en de bijbehorende documentnamen op een veilige plaats. (Wachtwoorden zijn hoofdlettergevoelig.)<br>
      Alleen het opgeslagen .inkt-bestand wordt versleuteld (AES-GCM, 256 bits). De kopie op deze computer en een export naar .docx/.pdf zijn niet versleuteld.</div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const a = d.$('#enc-a').value, b = d.$('#enc-b').value;
      if (a !== b) { App.toast('De wachtwoorden komen niet overeen', 'error'); return false; }
      if (!a) { App.docPassword = null; delete App.doc.meta.encrypted; App.markDirty(); App.toast('Versleuteling verwijderd', 'lock_open'); return; }
      App.docPassword = a; App.doc.meta.encrypted = true; App.markDirty();
      App.toast('Het document wordt versleuteld opgeslagen als .inkt. Kies Opslaan als › Inkt-document.', 'lock', { ms: 4500 });
    } }],
  });
});
(() => {
  const origBlob = App.buildBlob;
  App.buildBlob = async (kind) => {
    if (kind === 'rtf') return new Blob([App.buildRtf()], { type: 'application/rtf' });
    if (kind === 'odt') return App.buildOdt();
    const blob = await origBlob(kind);
    if (kind === 'inkt' && App.docPassword) return new Blob([await App.encryptText(await blob.text(), App.docPassword)], { type: 'application/json' });
    return blob;
  };
  const origRead = App.fileToDoc;
  App.fileToDoc = async (file) => {
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext === 'inkt' || ext === 'json') {
      const text = await App.readFile(file);
      let obj = null; try { obj = JSON.parse(text); } catch { /* geen JSON */ }
      if (obj && obj.format === 'inkt-versleuteld') {
        for (let tries = 0; tries < 5; tries++) {
          const pw = await App.passwordPrompt('Wachtwoord', `“${App.esc(file.name)}” is beveiligd met een wachtwoord. Voer het wachtwoord in om het te openen.`);
          if (pw == null) throw new Error('Openen geannuleerd');
          try {
            const d = JSON.parse(await App.decryptText(obj, pw));
            App._openPw = pw;
            return { html: d.html, title: d.title || file.name.replace(/\.[^.]+$/, ''), meta: { ...(d.meta || {}), encrypted: true } };
          } catch { App.toast('Het wachtwoord is onjuist. Probeer het opnieuw.', 'error', { ms: 3500 }); }
        }
        throw new Error('Te vaak een onjuist wachtwoord');
      }
    }
    return origRead(file);
  };
  const origLoad = App.loadDoc;
  App.loadDoc = (data) => {
    origLoad(data);
    App.docPassword = App.doc.meta.encrypted ? (App._openPw || null) : null;
    if (App.doc.meta.encrypted && !App.docPassword) delete App.doc.meta.encrypted;   // uit de browser geopend: wachtwoord onbekend
    App._openPw = null;
    App.applyFinal();
    if (App.updateStatusbar) App.updateStatusbar();
  };
})();

/* ---------- Markeren als definitief ---------- */
App.applyFinal = () => {
  const on = !!App.doc.meta.final;
  let bar = $('#final-bar');
  if (on && !bar) {
    bar = document.createElement('div'); bar.id = 'final-bar';
    bar.innerHTML = '<span class="i">verified</span><b>ALS DEFINITIEF GEMARKEERD</b><span>Een auteur heeft dit document als definitief gemarkeerd om bewerken te voorkomen.</span><button class="btn small" data-final-edit>Toch bewerken</button>';
    $('#workspace').before(bar);
    bar.querySelector('[data-final-edit]').onclick = () => App.exec('markFinal', 'off');
  }
  if (!on && bar) bar.remove();
  if (on) App.setProtect(true);
  const s = $('#sb-final'); if (s) s.hidden = !on;
};
App.def('markFinal', async (arg) => {
  const m = App.doc.meta;
  if (m.final || arg === 'off') { m.final = false; App.setProtect(false); App.applyFinal(); App.markDirty(); App.toast('Het document kan weer worden bewerkt', 'edit'); return; }
  if (!(await App.confirm('Markeren als definitief', 'Dit document wordt als definitief gemarkeerd en daarna alleen-lezen. Iedereen kan dit ongedaan maken met “Toch bewerken”.', 'OK'))) return;
  m.final = true; App.applyFinal(); App.markDirty(); App.saveLocal(true);
  App.toast('Dit document is als definitief gemarkeerd', 'verified');
});

/* ---------- Document inspecteren ---------- */
App.INSPECT = [
  { k: 'review', label: 'Opmerkingen, revisies en versies', desc: 'Opmerkingen, bijgehouden wijzigingen en bewaarde versies.',
    find: () => { const c = App.doc.meta.comments.filter((x) => !x.draft).length, r = App.allChanges().length, v = App.versions().length; return [c && `${c} opmerkingen`, r && `${r} bijgehouden wijzigingen`, v && `${v} bewaarde versies`].filter(Boolean); },
    fix: () => { $$('.cmt', App.ed).forEach((a) => App.unwrap(a)); App.doc.meta.comments = []; App.allChanges().forEach((c) => App.resolveChange(c, true)); App.store.del(App.verKey(App.doc.id)); App.renderComments(); } },
  { k: 'props', label: 'Documenteigenschappen en persoonlijke gegevens', desc: 'Auteur, namen bij opmerkingen en wijzigingen, adreslijst en afzender.',
    find: () => { const m = App.doc.meta, out = []; if (m.author) out.push(`Auteur: ${m.author}`); const names = new Set([...App.allChanges().map((e) => e.dataset.author), ...m.comments.map((c) => c.author)].filter(Boolean)); if (names.size) out.push(`Namen van revisoren: ${[...names].join(', ')}`); if ((m.mail || {}).records && m.mail.records.length) out.push(`Adreslijst met ${m.mail.records.length} adressen`); return out; },
    fix: () => { const m = App.doc.meta; m.author = ''; App.allChanges().forEach((e) => { e.dataset.author = 'Auteur'; e.title = ''; }); m.comments.forEach((c) => { c.author = 'Auteur'; (c.replies || []).forEach((r) => { r.author = 'Auteur'; }); }); m.mail = { fields: [], records: [] }; App.updateMergeInfo && App.updateMergeInfo(); } },
  { k: 'hf', label: 'Kopteksten, voetteksten en watermerken', desc: 'Inhoud van kop- en voetteksten en watermerken.',
    find: () => { const m = App.doc.meta, out = []; if (m.header || m.headerFirst) out.push('Kopteksten'); if (m.footer || m.footerFirst) out.push('Voetteksten'); if (m.watermark) out.push(`Watermerk “${m.watermark}”`); return out; },
    fix: () => { Object.assign(App.doc.meta, { header: '', footer: '', headerFirst: '', footerFirst: '', watermark: '' }); App._forceSheets = true; } },
  { k: 'hidden', label: 'Verborgen tekst', desc: 'Tekst die als verborgen is opgemaakt, zoals index- en citaatmarkeringen.',
    find: () => { const n = $$('.xe, .ta', App.ed).length + $$('[style*="display: none"], [style*="display:none"]', App.ed).length; return n ? [`${n} stukken verborgen tekst`] : []; },
    fix: () => { $$('.xe, .ta, [style*="display: none"], [style*="display:none"]', App.ed).forEach((x) => x.remove()); } },
  { k: 'invisible', label: 'Onzichtbare inhoud', desc: 'Objecten achter de tekst of buiten de pagina, en witte tekst op een witte achtergrond.',
    find: () => { const n = $$('img.wrap-behind', App.ed).length; const w = $$('[style*="color"]', App.ed).filter((el) => /^(#fff(fff)?|white|rgb\(255, 255, 255\))$/i.test(el.style.color.trim()) && !App.doc.meta.pageColor).length; return [n && `${n} objecten achter de tekst`, w && `${w} stukken witte tekst`].filter(Boolean); },
    fix: () => { $$('img.wrap-behind', App.ed).forEach((x) => x.remove()); $$('[style*="color"]', App.ed).forEach((el) => { if (/^(#fff(fff)?|white|rgb\(255, 255, 255\))$/i.test(el.style.color.trim())) el.remove(); }); } },
];
App.def('inspectDoc', () => {
  App.closeBackstage();
  const d = App.dialog({
    title: 'Documentcontrole', wide: true,
    body: `<p style="margin-top:0">Selecteer de inhoud die je wilt controleren en klik op Inspecteren.</p><div id="ins-list">${App.INSPECT.map((it) => `<label class="list-row" style="align-items:flex-start;border:0;padding:6px 0"><input type="checkbox" data-k="${it.k}" checked><span><b>${it.label}</b><div class="muted small">${it.desc}</div></span></label>`).join('')}</div>`,
    buttons: [{ label: 'Sluiten' }, { label: 'Inspecteren', primary: true, action: () => { inspect(); return false; } }],
  });
  const inspect = () => {
    const chosen = d.$$('#ins-list [data-k]').filter((c) => c.checked).map((c) => c.dataset.k);
    const rows = App.INSPECT.filter((it) => chosen.includes(it.k)).map((it) => {
      const found = it.find();
      return `<div class="list-row" style="align-items:flex-start;padding:10px 4px"><span class="i" style="color:${found.length ? '#bc4b09' : '#107c10'}">${found.length ? 'error' : 'check_circle'}</span>
        <div class="grow"><b>${it.label}</b><div class="small muted">${found.length ? found.map(App.esc).join('<br>') : 'Er is niets gevonden.'}</div></div>
        ${found.length ? `<button class="btn small" data-fix="${it.k}">Alles verwijderen</button>` : ''}</div>`;
    }).join('');
    d.body.innerHTML = `<p style="margin-top:0">Controleer de resultaten.</p><div class="list-rows" style="max-height:none">${rows}</div><p class="muted small">Let op: sommige wijzigingen kunnen niet ongedaan worden gemaakt (bewaarde versies).</p>`;
    d.body.onclick = (e) => {
      const b = e.target.closest('[data-fix]'); if (!b) return;
      const it = App.INSPECT.find((x) => x.k === b.dataset.fix);
      App.run(() => it.fix());
      App.markDirty(); App.toast('Verwijderd: ' + it.label.toLowerCase(), 'ok');
      inspect();
    };
    d.primary.textContent = 'Opnieuw inspecteren';
  };
});

/* ---------- Bestand-scherm: Info, Exporteren, Sluiten, Opties ---------- */
App.optCat = 'general';
(() => {
  const orig = App.renderBackstage;
  App.renderBackstage = (sec) => {
    const bs = $('#backstage');
    const nav = bs && bs.querySelector('.bs-nav');
    if (nav && !nav.querySelector('[data-bs="exportfmt"]')) {
      const pr = nav.querySelector('[data-bs="print"]');
      pr.insertAdjacentHTML('afterend', '<button data-bs="exportfmt">Exporteren</button><button data-bs="close">Sluiten</button>');
    }
    if (sec === 'close') { App.closeDocument(); return; }
    if (sec === 'exportfmt' || sec === 'options') {
      App.bsSection = sec;
      $$('.bs-nav [data-bs]', bs).forEach((b) => b.classList.toggle('on', b.dataset.bs === sec));
      const main = bs.querySelector('.bs-main');
      main.onclick = null; main.onchange = null;
      if (sec === 'exportfmt') App.renderExportPage(main); else App.renderOptions(main);
      return;
    }
    orig(sec);
    if (sec === 'info') App.extendInfo(bs.querySelector('.bs-main'));
  };
})();
App.extendInfo = (main) => {
  const m = App.doc.meta, vers = App.versions();
  const card = (act, icon, title, sub, on) => `<button class="bs-card" data-act="${act}"${on ? ' style="border-color:#f0d77a;background:#fffbea"' : ''}><span class="i">${icon}</span><div><b>${title}</b><small>${sub}</small></div></button>`;
  main.insertAdjacentHTML('beforeend', `<h3>Document beveiligen</h3><div class="bs-cards">
      ${card('markFinal', 'verified', m.final ? 'Markering als definitief opheffen' : 'Markeren als definitief', m.final ? 'Dit document is als definitief gemarkeerd en is alleen-lezen.' : 'Laat lezers weten dat het document definitief is en maak het alleen-lezen.', m.final)}
      ${card('encryptDoc', 'key', App.docPassword ? 'Wachtwoord wijzigen of verwijderen' : 'Versleutelen met wachtwoord', App.docPassword ? 'Er is een wachtwoord vereist om het .inkt-bestand te openen.' : 'Een wachtwoord vereisen om het opgeslagen .inkt-bestand te openen.', !!App.docPassword)}
    </div>
    <h3>Document inspecteren</h3><div class="bs-cards">${card('inspectDoc', 'policy', 'Controleren op problemen', 'Verborgen gegevens, opmerkingen en persoonlijke gegevens zoeken en verwijderen voordat je het document deelt.')}
      ${card('accessibilityCheck', 'accessibility_new', 'Toegankelijkheid controleren', 'Controleren of mensen met een handicap het document goed kunnen lezen.')}</div>
    <h3>Versiegeschiedenis</h3><div class="bs-cards">${card('versionHistory', 'history', 'Versiegeschiedenis', vers.length ? `${vers.length} automatisch bewaarde versies; laatste ${App.fmtDateTime(vers[vers.length - 1].t)}.` : 'Er zijn nog geen eerdere versies. Inkt bewaart automatisch versies terwijl je werkt.')}</div>`);
};
App.closeDocument = async () => {
  if (App.doc.dirty && !App.settings.autosave) {
    const choice = await new Promise((res) => {
      let v = 'cancel';
      App.dialog({ title: 'Inkt', body: `<p style="margin-top:0">Wil je de wijzigingen in “${App.esc(App.doc.title)}” opslaan?</p>`,
        buttons: [{ label: 'Opslaan', primary: true, action: () => { v = 'save'; } }, { label: 'Niet opslaan', action: () => { v = 'discard'; } }, { label: 'Annuleren' }], onClose: () => res(v) });
    });
    if (choice === 'cancel') return;
    if (choice === 'save') App.saveLocal(false);
  } else if (App.doc.dirty) App.saveLocal(true);
  App.doc.dirty = false;
  App.closeBackstage();
  App.newDoc('blank');
  App.toast('Document gesloten', 'close');
};
App.def('closeDocument', () => App.closeDocument());
// Exporteren (zoals Word: PDF, andere bestandstypen)
App.EXPORTS.rtf = { label: 'Rich Text-indeling', ext: '.rtf', mime: 'application/rtf', icon: 'text_snippet', desc: 'Oud maar breed ondersteund formaat met opmaak, tabellen, afbeeldingen en voetnoten. Opent in vrijwel elke tekstverwerker.' };
App.EXPORTS.odt = { label: 'OpenDocument-tekst', ext: '.odt', mime: 'application/vnd.oasis.opendocument.text', icon: 'description', desc: 'Voor LibreOffice en OpenOffice. Basisopmaak: koppen, vet/cursief/onderstreept, lijsten, tabellen en afbeeldingen.' };
App.renderExportPage = (main) => {
  const rows = [['pdf', 'picture_as_pdf', 'PDF-document maken', 'Indeling en opmaak blijven behouden; het document kan niet eenvoudig worden gewijzigd.'], ['docx', 'description', 'Document (.docx)', 'Het gangbare documentformaat, te openen in vrijwel elke tekstverwerker.'], ['rtf', 'text_snippet', 'Rich Text-indeling (.rtf)', App.EXPORTS.rtf.desc], ['odt', 'article', 'OpenDocument-tekst (.odt)', App.EXPORTS.odt.desc], ['html', 'language', 'Webpagina (.html)', App.EXPORTS.html.desc], ['md', 'markdown', 'Markdown (.md)', App.EXPORTS.md.desc], ['txt', 'text_snippet', 'Platte tekst (.txt)', App.EXPORTS.txt.desc]];
  main.innerHTML = `<h1>Exporteren</h1><div class="bs-cards">${rows.map(([k, i, t, d]) => `<button class="bs-card" data-exp="${k}"><span class="i">${i}</span><div><b>${t}</b><small>${d}</small></div></button>`).join('')}</div>`;
  main.onclick = (e) => { const b = e.target.closest('[data-exp]'); if (b) App.exportAs(b.dataset.exp); };
};

/* ---------- Opties (categorieën zoals Word) ---------- */
App.OPT_CATS = [['general', 'Algemeen'], ['display', 'Weergave'], ['proofing', 'Controle'], ['save', 'Opslaan'], ['advanced', 'Geavanceerd']];
App.renderOptions = (main) => {
  const s = App.settings, c = App.optCat;
  const chk = (id, on, label) => `<label class="chk opt-row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  const row = (label, ctl) => `<div class="opt-line"><span>${label}</span>${ctl}</div>`;
  let body = '';
  if (c === 'general') {
    body = `<h3>Opties voor gebruikersinterface</h3>
      ${chk('o-minibar', s.minibar !== false, 'Mini-werkbalk weergeven bij selecteren')}
      ${row('Kleurthema', `<select id="o-theme"><option value="light" ${!s.dark ? 'selected' : ''}>Kleurrijk (licht)</option><option value="dark" ${s.dark ? 'selected' : ''}>Zwart (donker)</option></select>`)}
      <h3>Inkt aan je persoonlijke voorkeur aanpassen</h3>
      ${row('Gebruikersnaam', `<input id="o-author" value="${App.esc(s.author)}">`)}
      ${row('Initialen', `<input id="o-initials" value="${App.esc(s.initials || App.initialsOf(s.author))}" style="width:80px">`)}
      <p class="muted small">De naam en initialen worden gebruikt bij opmerkingen en bijgehouden wijzigingen.</p>
      <h3>Opstartopties</h3>${chk('o-startbs', s.startBackstage !== false, 'Het startscherm weergeven bij het starten van Inkt')}`;
  } else if (c === 'display') {
    body = `<h3>Opties voor paginaweergave</h3>
      ${chk('o-ruler', s.ruler, 'Liniaal weergeven')}
      <h3>Deze opmaaktekens altijd op het scherm weergeven</h3>
      ${chk('o-marks', !!App.state.marks, 'Alle opmaaktekens weergeven')}
      ${chk('o-hidden', !!s.showHidden, 'Verborgen tekst (index- en citaatmarkeringen)')}
      <h3>Afdrukopties</h3>
      ${chk('o-printbg', s.printBg !== false, 'Achtergrondkleuren en afbeeldingen afdrukken')}
      ${chk('o-printupd', s.printUpdate !== false, 'Velden (inhoudsopgave, index, lijsten) bijwerken voor het afdrukken')}`;
  } else if (c === 'proofing') {
    body = `<h3>AutoCorrectie-opties</h3><p class="muted small" style="margin-top:0">Wijzigen hoe Inkt tekst tijdens het typen verbetert en opmaakt.</p>
      <button class="btn small" data-cmd="autoCorrectOptions">AutoCorrectie-opties…</button>
      <h3>Bij het corrigeren van spelling en grammatica in Inkt</h3>
      ${chk('o-spell', s.spell, 'Spelling controleren tijdens typen')}
      <p class="muted small">De spellingcontrole gebruikt het woordenboek van Windows/de browser voor de documenttaal (${App.esc(App.LANGS[App.doc.meta.lang] || App.doc.meta.lang)}).</p>
      <h3>Toegankelijkheid</h3>
      ${chk('o-a11ylive', s.a11yLive !== false, 'Toegankelijkheidscontrole blijven uitvoeren terwijl ik werk')}
      ${chk('o-a11ysb', App.sbOn('a11y'), 'Toegankelijkheidsstatus in de statusbalk weergeven')}`;
  } else if (c === 'save') {
    body = `<h3>Documenten opslaan</h3>
      ${chk('o-auto', s.autosave, 'Automatisch opslaan op deze computer')}
      ${chk('o-versions', s.versions !== false, 'Automatisch versies bewaren (versiegeschiedenis)')}
      ${row('Elke … minuten een versie bewaren', `<input id="o-vmin" type="number" min="1" max="120" value="${s.versionMinutes || 10}" style="width:80px">`)}
      ${row('Maximaal aantal versies per document', `<input id="o-vmax" type="number" min="1" max="100" value="${s.versionMax || 20}" style="width:80px">`)}
      <p class="muted small">Als de opslag van de browser vol raakt, worden eerst de oudste versies verwijderd zodat het document zelf altijd kan worden opgeslagen.</p>`;
  } else {
    const fonts = (App.FONTS || []).map(([n]) => `<option ${n === (s.defaultFont || 'Aptos') ? 'selected' : ''}>${App.esc(n)}</option>`).join('');
    body = `<h3>Bewerkingsopties</h3>
      ${chk('o-dragdrop', s.dragDrop !== false, 'Slepen en neerzetten van tekst toestaan')}
      ${chk('o-ctrlclick', s.ctrlClick !== false, 'Ctrl+klik gebruiken om koppelingen te volgen')}
      <h3>Standaardlettertype (voor nieuwe documenten)</h3>
      ${row('Lettertype', `<select id="o-font">${fonts}</select>`)}
      ${row('Tekengrootte (pt)', `<input id="o-size" type="number" min="6" max="72" step="0.5" value="${s.defaultSize || 12}" style="width:80px">`)}
      <h3>Weergeven</h3>
      ${row('Dit aantal recente documenten weergeven', `<input id="o-recent" type="number" min="0" max="50" value="${s.recentCount ?? 8}" style="width:80px">`)}
      ${row('Maten weergeven in eenheden van', `<select id="o-unit"><option value="cm" ${(s.unit || 'cm') === 'cm' ? 'selected' : ''}>Centimeters</option><option value="inch" ${s.unit === 'inch' ? 'selected' : ''}>Inches</option></select>`)}
      <p class="muted small">De maateenheid geldt voor de liniaal en het venster Tabs.</p>`;
  }
  main.innerHTML = `<h1>Opties</h1><div class="opt-wrap"><nav class="opt-nav">${App.OPT_CATS.map(([k, l]) => `<button data-opt="${k}" class="${k === c ? 'on' : ''}">${l}</button>`).join('')}</nav><div class="opt-body">${body}</div></div>
    <h3>Gegevens</h3><div class="bs-cards"><button class="bs-card" data-act="wipe"><span class="i">delete_forever</span><div><b>Alle documenten op deze computer wissen</b><small>Verwijdert alle opgeslagen Inkt-documenten van deze computer. Dit kan niet ongedaan worden gemaakt.</small></div></button></div>`;
  main.onclick = async (e) => {
    const o = e.target.closest('[data-opt]'); if (o) { App.optCat = o.dataset.opt; App.renderOptions(main); return; }
    const w = e.target.closest('[data-act="wipe"]');
    if (w) {
      if (!(await App.confirm('Alles wissen', 'Alle Inkt-documenten op deze computer worden verwijderd. Weet je het zeker?', 'Alles wissen', true))) return;
      (App.store.get('index', []) || []).forEach((d) => { App.store.del('doc.' + d.id); App.store.del(App.verKey(d.id)); if (App.bigStore) App.bigStore.del(d.id); });
      App.store.set('index', []); App.doc.dirty = true; App.toast('Alle documenten zijn gewist', 'ok');
    }
  };
  main.onchange = (e) => App.optionChanged(e.target);
};
App.optionChanged = (t) => {
  const s = App.settings, num = (v, d) => { const n = App.parseNum(v); return isNaN(n) ? d : n; };
  switch (t.id) {
    case 'o-minibar': s.minibar = t.checked; break;
    case 'o-theme': if ((t.value === 'dark') !== !!s.dark) App.exec('toggleDark'); break;
    case 'o-author': s.author = t.value.trim() || 'Ik'; s.initials = App.initialsOf(s.author); { const i = $('#o-initials'); if (i) i.value = s.initials; } break;
    case 'o-initials': s.initials = t.value.trim().toUpperCase().slice(0, 4) || App.initialsOf(s.author); break;
    case 'o-startbs': s.startBackstage = t.checked; break;
    case 'o-ruler': App.exec('toggleRuler', t.checked); break;
    case 'o-marks': if (t.checked !== !!App.state.marks) App.exec('toggleMarks'); break;
    case 'o-hidden': s.showHidden = t.checked; App.ed.classList.toggle('show-hidden', t.checked); App.scheduleLayout(); break;
    case 'o-printbg': s.printBg = t.checked; break;
    case 'o-printupd': s.printUpdate = t.checked; break;
    case 'o-spell': if (t.checked !== !!s.spell) App.exec('toggleSpell'); break;
    case 'o-a11ylive': s.a11yLive = t.checked; break;
    case 'o-a11ysb': s.sb = { ...(s.sb || {}), a11y: t.checked }; App.updateStatusbar(); App.updateA11yStatus(); break;
    case 'o-auto': s.autosave = t.checked; if (t.checked) App.saveLocal(true); break;
    case 'o-versions': s.versions = t.checked; break;
    case 'o-vmin': s.versionMinutes = App.clamp(Math.round(num(t.value, 10)), 1, 120); break;
    case 'o-vmax': s.versionMax = App.clamp(Math.round(num(t.value, 20)), 1, 100); break;
    case 'o-dragdrop': s.dragDrop = t.checked; break;
    case 'o-ctrlclick': s.ctrlClick = t.checked; break;
    case 'o-font': s.defaultFont = t.value; break;
    case 'o-size': s.defaultSize = App.clamp(num(t.value, 12), 6, 72); break;
    case 'o-recent': s.recentCount = App.clamp(Math.round(num(t.value, 8)), 0, 50); break;
    case 'o-unit': s.unit = t.value; App.drawRuler(); break;
    default: return;
  }
  App.saveSettings();
};
// Effecten van de opties
(() => {
  const show = App.minibar.show.bind(App.minibar);
  App.minibar.show = () => { if (App.settings.minibar === false) return App.minibar.hide(); return show(); };
  App.ed.addEventListener('dragstart', (e) => { if (App.settings.dragDrop === false && e.target.tagName !== 'IMG') e.preventDefault(); });
  // Ctrl+klik volgt een koppeling (of gewone klik, als de optie uit staat)
  App.ed.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !App.ed.contains(a) || a.closest('.toc, .tof')) return;
    if ((App.settings.ctrlClick !== false) === (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (/^#/.test(a.getAttribute('href'))) { const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) App.scrollToEl(t); } else App.openLink(a.href); }
  });
  const origRecent = App.recentRows;
  App.recentRows = (limit, del) => origRecent(limit === 8 ? (App.settings.recentCount ?? 8) : limit, del);
  window.addEventListener('beforeprint', () => {
    let st = $('#print-opt-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-opt-style'; document.head.appendChild(st); }
    st.textContent = App.settings.printBg === false ? '@media print { html, body, * { -webkit-print-color-adjust: economy !important; print-color-adjust: economy !important; } html { background: none !important; } }' : '';
  });
  // Standaardlettertype en -grootte gelden voor nieuwe documenten
  const origNew = App.newDoc;
  App.newDoc = (tpl) => {
    origNew(tpl);
    const s = App.settings, m = App.doc.meta;
    if ((tpl || 'blank') === 'blank' && ((s.defaultFont && s.defaultFont !== 'Aptos') || (s.defaultSize && +s.defaultSize !== 12))) {
      const th = App.THEMES[m.theme] || App.THEMES.inkt;
      if (s.defaultFont && s.defaultFont !== 'Aptos') m.themeFonts = { body: s.defaultFont, head: (m.themeFonts || {}).head || th.head };
      if (s.defaultSize) m.fontSize = +s.defaultSize;
      App.applyDocLook(); App.layout(); App.history.reset();
    }
  };
  const origLook = App.applyDocLook;
  App.applyDocLook = () => { origLook(); App.ed.style.setProperty('--doc-size', (App.doc.meta.fontSize || 12) + 'pt'); };
  if (App.settings.showHidden) App.ed.classList.add('show-hidden');
  setTimeout(() => { if (App.settings.startBackstage !== false && !location.hash) App.exec('openBackstage', 'home'); }, 50);
})();
if (!App.history.LOOK.includes('fontSize')) App.history.LOOK.push('fontSize');

/* ---------- Exporteren als RTF (eenvoudige RTF-schrijver) ---------- */
App.buildRtf = () => {
  const root = document.createElement('div');
  root.innerHTML = App.cleanHtml(true);
  root.querySelectorAll('.footnotes, .endnotes, .xe, .ta').forEach((x) => x.remove());
  const m = App.doc.meta, g = App.geom();
  const tw = (px) => Math.round(px * 15);
  const cmT = (cm) => Math.round(cm / 2.54 * 1440);
  const colors = ['#000000'];
  const colorIdx = (css) => {
    if (!css) return 0;
    const d = document.createElement('i'); d.style.color = css; document.body.appendChild(d);
    const rgb = App.parseRgb ? App.parseRgb(getComputedStyle(d).color) : null; d.remove();
    if (!rgb) return 0;
    const hex = '#' + rgb.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
    let i = colors.indexOf(hex); if (i < 0) { colors.push(hex); i = colors.length - 1; }
    return i + 1;
  };
  const esc = (s) => s.replace(/[\\{}]/g, (c) => '\\' + c).replace(/\t/g, '\\tab ').replace(/[\r\n]+/g, ' ')
    .replace(/[^\x00-\x7f]/g, (c) => { const n = c.charCodeAt(0); return `\\u${n > 32767 ? n - 65536 : n}?`; });
  const notes = { fn: 0 };
  const pict = (img) => {
    const src = img.getAttribute('src') || '';
    const mt = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
    if (!mt) return '';
    const bin = atob(mt[2]);
    let hex = ''; for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    const w = parseFloat(img.style.width) || img.naturalWidth || 200, h = img.naturalWidth ? w * img.naturalHeight / img.naturalWidth : (parseFloat(img.style.height) || w * 0.75);
    return `{\\pict${mt[1] === 'png' ? '\\pngblip' : '\\jpegblip'}\\picwgoal${tw(w)}\\pichgoal${tw(h)} ${hex.replace(/(.{128})/g, '$1\n')}}`;
  };
  const inline = (node) => {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { out += esc(c.data.replace(/\u200B/g, '')); return; }
      if (c.nodeType !== 1) return;
      const t = c.tagName, st = c.style || {};
      if (t === 'BR') { out += '\\line '; return; }
      if (t === 'IMG') { out += pict(c); return; }
      if (c.classList.contains('fn-ref') || c.classList.contains('en-ref')) {
        out += `{\\super\\chftn}{\\footnote${c.classList.contains('en-ref') ? '\\ftnalt' : ''}\\pard\\plain\\fs20{\\super\\chftn} ${esc(c.dataset.note || '')}}`; return;
      }
      if (c.matches('del.trk')) { out += `{\\strike\\cf${colorIdx('#c00000')} ${inline(c)}}`; return; }
      let f = '';
      if (t === 'B' || t === 'STRONG' || +st.fontWeight >= 600 || st.fontWeight === 'bold') f += '\\b';
      if (t === 'I' || t === 'EM' || st.fontStyle === 'italic') f += '\\i';
      if (t === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '') || t === 'INS') f += '\\ul';
      if (t === 'S' || t === 'STRIKE' || /line-through/.test(st.textDecoration || st.textDecorationLine || '')) f += '\\strike';
      if (t === 'SUP') f += '\\super'; if (t === 'SUB') f += '\\sub';
      if (st.color) f += '\\cf' + colorIdx(st.color);
      if (t === 'FONT' && c.getAttribute('color')) f += '\\cf' + colorIdx(c.getAttribute('color'));
      if (st.backgroundColor) f += '\\highlight' + colorIdx(st.backgroundColor);
      if (st.fontSize && /pt|px/.test(st.fontSize)) f += '\\fs' + Math.round(parseFloat(st.fontSize) * (/px/.test(st.fontSize) ? 0.75 : 1) * 2);
      if (t === 'CODE') f += '\\f2';
      if (t === 'A' && c.getAttribute('href') && !/^#/.test(c.getAttribute('href'))) { out += `{\\field{\\*\\fldinst HYPERLINK "${esc(c.getAttribute('href'))}"}{\\fldrslt{\\ul\\cf${colorIdx('#0563c1')} ${inline(c)}}}}`; return; }
      out += f ? `{${f} ${inline(c)}}` : inline(c);
    });
    return out;
  };
  const para = (el, extra = '') => {
    const st = el.style || {}, cs = getComputedStyle(App.ed);
    let p = '\\pard\\plain\\f0\\fs' + Math.round((parseFloat(cs.fontSize) || 16) * 1.5);
    const tag = el.tagName;
    const hs = { H1: [1, 40], H2: [2, 32], H3: [3, 28], H4: [4, 24], H5: [5, 22], H6: [6, 22] }[tag];
    if (hs) p += `\\s${hs[0]}\\outlinelevel${hs[0] - 1}\\keepn\\sb240\\sa60\\f1\\fs${hs[1]}\\cf${colorIdx(cs.getPropertyValue('--doc-head-color'))}`;
    else if (el.classList.contains('title')) p += '\\f1\\fs56\\sa120';
    else if (tag === 'PRE') p += '\\f2\\fs19';
    else if (tag === 'BLOCKQUOTE') p += '\\li567\\i';
    const a = st.textAlign; if (a === 'center') p += '\\qc'; else if (a === 'right') p += '\\qr'; else if (a === 'justify') p += '\\qj';
    const ml = parseFloat(st.marginLeft) || 0, ti = parseFloat(st.textIndent) || 0, pl = parseFloat(st.paddingLeft) || 0;
    if (ml || pl) p += '\\li' + tw(ml + pl); if (ti) p += '\\fi' + tw(ti);
    if (!hs) p += '\\sa' + Math.round((parseFloat(cs.getPropertyValue('--doc-after')) || 8) * 20);
    if (el.dataset && el.dataset.tabs && App.getTabs) App.getTabs(el).forEach((t) => { p += ({ c: '\\tqc', r: '\\tqr', d: '\\tqdec', l: '' }[t.align] || '') + ({ dot: '\\tldot', dash: '\\tlhyph', line: '\\tlul' }[t.leader] || '') + '\\tx' + cmT(t.pos); });
    return `${p}${extra} ${inline(el)}\\par\n`;
  };
  const blocks = (container, lvl = 0) => {
    let out = '';
    Array.from(container.children).forEach((el) => {
      const t = el.tagName, c = el.classList;
      if (/^(P|H[1-6]|PRE|BLOCKQUOTE)$/.test(t) && !el.querySelector('p,ul,ol,table')) out += para(el);
      else if (t === 'UL' || t === 'OL') {
        let n = parseInt(el.getAttribute('start'), 10) || 1;
        Array.from(el.children).forEach((li) => {
          const clone = li.cloneNode(true); clone.querySelectorAll('ul,ol').forEach((x) => x.remove());
          const mark = t === 'OL' ? `${n++}.` : '\\u8226?';
          out += `\\pard\\plain\\f0\\fs${Math.round((parseFloat(getComputedStyle(App.ed).fontSize) || 16) * 1.5)}\\li${720 + lvl * 360}\\fi-360\\sa60 ${mark}\\tab ${inline(clone)}\\par\n`;
          li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => { const w = document.createElement('div'); w.appendChild(sub.cloneNode(true)); out += blocks(w, lvl + 1); });
        });
      } else if (t === 'TABLE') {
        const rows = Array.from(el.rows); const W = tw(g.W - g.ml - g.mr);
        rows.forEach((r) => {
          const cells = Array.from(r.cells); const cw = Math.round(W / Math.max(1, cells.length));
          out += '\\trowd\\trgaph108' + cells.map((cell, i) => `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${cw * (i + 1)}`).join('') + '\n';
          cells.forEach((cell) => { out += `\\pard\\intbl\\plain\\f0\\fs22${cell.tagName === 'TH' ? '\\b' : ''} ${inline(cell)}\\cell\n`; });
          out += '\\row\n';
        });
        out += '\\pard\\par\n';
      } else if (c.contains('toc') || c.contains('tof')) {
        el.querySelectorAll('.toc-title, .tof-title').forEach((ti) => { out += `\\pard\\plain\\f1\\fs32\\sa120 ${inline(ti)}\\par\n`; });
        el.querySelectorAll('a.toc-entry').forEach((en) => {
          const lv = +((en.className.match(/lvl(\d)/) || [])[1] || 1);
          out += `\\pard\\plain\\f0\\fs22\\li${(lv - 1) * 280}\\tqr\\tldot\\tx${tw(g.W - g.ml - g.mr)} ${esc((en.querySelector('.t') || en).textContent)}\\tab ${esc((en.querySelector('.pg') || {}).textContent || '')}\\par\n`;
        });
      } else if (c.contains('section-break')) out += c.contains('page-break') ? '\\sect\\sbkpage\n' : '\\sect\\sbknone\n';
      else if (c.contains('page-break')) out += '\\page\n';
      else if (t === 'HR') out += '\\pard\\brdrb\\brdrs\\brdrw10\\par\n';
      else if (t === 'IMG') out += `\\pard ${pict(el)}\\par\n`;
      else out += blocks(el, lvl);
    });
    return out;
  };
  const hf = (html, kind) => { if (!html) return ''; const d = document.createElement('div'); d.innerHTML = html; d.querySelectorAll('.fld').forEach((f) => f.replaceWith(document.createTextNode(f.dataset.fld === 'page' ? 'QQPAGEQQ' : f.dataset.fld === 'pages' ? 'QQPAGESQQ' : ''))); return `{\\${kind}${blocks(d).replace(/QQPAGEQQ/g, '{\\field{\\*\\fldinst PAGE}{\\fldrslt 1}}').replace(/QQPAGESQQ/g, '{\\field{\\*\\fldinst NUMPAGES}{\\fldrslt 1}}')}}`; };
  const body = blocks(root);
  const font = (v) => (getComputedStyle(App.ed).getPropertyValue(v).split(',')[0] || 'Calibri').replace(/["']/g, '').trim();
  const lnm = m.lineNumbers && m.lineNumbers.mode && m.lineNumbers.mode !== 'none' ? `\\linemod${m.lineNumbers.countBy || 1}${m.lineNumbers.mode === 'page' ? '\\lineppage' : m.lineNumbers.mode === 'section' ? '\\linerestart' : '\\linecont'}` : '';
  const head = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\fswiss ${esc(font('--doc-font'))};}{\\f1\\fswiss ${esc(font('--doc-head-font'))};}{\\f2\\fmodern Consolas;}}`
    + `{\\colortbl;${colors.map((h) => `\\red${parseInt(h.slice(1, 3), 16)}\\green${parseInt(h.slice(3, 5), 16)}\\blue${parseInt(h.slice(5, 7), 16)};`).join('')}}`
    + '{\\stylesheet{\\s0 Normal;}' + [1, 2, 3, 4, 5, 6].map((n) => `{\\s${n}\\outlinelevel${n - 1} heading ${n};}`).join('') + '}'
    + `{\\info{\\title ${esc(App.doc.title)}}{\\author ${esc(m.author || App.settings.author)}}}`
    + `\\paperw${tw(g.W)}\\paperh${tw(g.H)}\\margl${cmT(m.page.margins.l)}\\margr${cmT(m.page.margins.r)}\\margt${cmT(m.page.margins.t)}\\margb${cmT(m.page.margins.b)}${g.W > g.H ? '\\landscape' : ''}\\fet2\\deftab${cmT(m.defaultTab || 1.25)}\\aenddoc\\aftnnrlc\\viewkind1\n`
    + `\\sectd${lnm}${m.firstDiff ? '\\titlepg' : ''}${hf(m.header, 'header')}${hf(m.footer, 'footer')}${m.firstDiff ? hf(m.headerFirst, 'headerf') + hf(m.footerFirst, 'footerf') : ''}\n`;
  void notes;
  return head + body + '}';
};

/* ---------- Exporteren als OpenDocument-tekst (.odt, basisopmaak) ---------- */
App.buildOdt = async () => {
  const JSZip = window.JSZip || (await App.loadScript(App.JSZIP), window.JSZip);
  const root = document.createElement('div');
  root.innerHTML = App.cleanHtml(true);
  root.querySelectorAll('.footnotes, .endnotes, .xe, .ta, del.trk').forEach((x) => x.remove());
  const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const m = App.doc.meta, g = App.geom(), cs = getComputedStyle(App.ed);
  const auto = new Map(), autoXml = [];
  const tstyle = (props) => { const k = JSON.stringify(props); if (!auto.has(k)) { const n = 'T' + (auto.size + 1); auto.set(k, n); autoXml.push(`<style:style style:name="${n}" style:family="text"><style:text-properties ${props.join(' ')}/></style:style>`); } return auto.get(k); };
  const pAuto = new Map();
  const pstyle = (parent, props) => { const k = parent + JSON.stringify(props); if (!pAuto.has(k)) { const n = 'P' + (pAuto.size + 1); pAuto.set(k, n); autoXml.push(`<style:style style:name="${n}" style:family="paragraph" style:parent-style-name="${parent}"><style:paragraph-properties ${props.join(' ')}/></style:style>`); } return pAuto.get(k); };
  const media = []; let notes = 0, breakNext = false;
  const inline = (node) => {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { out += X(c.data.replace(/​/g, '')).replace(/\t/g, '<text:tab/>').replace(/ {2,}/g, (s) => ' ' + `<text:s text:c="${s.length - 1}"/>`); return; }
      if (c.nodeType !== 1) return;
      const t = c.tagName, st = c.style || {};
      if (t === 'BR') { out += '<text:line-break/>'; return; }
      if (t === 'IMG') {
        const mt = (c.getAttribute('src') || '').match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/);
        if (!mt) return;
        const name = `Pictures/img${media.length + 1}.${mt[1] === 'jpeg' ? 'jpg' : mt[1]}`;
        media.push({ name, data: mt[2], type: 'image/' + mt[1] });
        const w = parseFloat(c.style.width) || c.naturalWidth || 200, h = c.naturalWidth ? w * c.naturalHeight / c.naturalWidth : w * 0.75;
        out += `<draw:frame draw:name="Afbeelding${media.length}" text:anchor-type="as-char" svg:width="${(w / 96 * 2.54).toFixed(2)}cm" svg:height="${(h / 96 * 2.54).toFixed(2)}cm"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
        return;
      }
      if (c.classList.contains('fn-ref') || c.classList.contains('en-ref')) {
        notes++; const en = c.classList.contains('en-ref');
        out += `<text:note text:id="n${notes}" text:note-class="${en ? 'endnote' : 'footnote'}"><text:note-citation>${notes}</text:note-citation><text:note-body><text:p text:style-name="${en ? 'Endnote' : 'Footnote'}">${X(c.dataset.note || '')}</text:p></text:note-body></text:note>`;
        return;
      }
      const props = [];
      if (t === 'B' || t === 'STRONG' || +st.fontWeight >= 600 || st.fontWeight === 'bold') props.push('fo:font-weight="bold"');
      if (t === 'I' || t === 'EM' || st.fontStyle === 'italic') props.push('fo:font-style="italic"');
      if (t === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) props.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
      if (t === 'S' || t === 'STRIKE' || /line-through/.test(st.textDecoration || st.textDecorationLine || '')) props.push('style:text-line-through-style="solid"');
      if (t === 'SUP') props.push('style:text-position="super 58%"'); if (t === 'SUB') props.push('style:text-position="sub 58%"');
      if (st.color) { const d = document.createElement('i'); d.style.color = st.color; document.body.appendChild(d); const rgb = App.parseRgb(getComputedStyle(d).color); d.remove(); if (rgb) props.push(`fo:color="#${rgb.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('')}"`); }
      if (st.fontSize && /pt|px/.test(st.fontSize)) props.push(`fo:font-size="${(parseFloat(st.fontSize) * (/px/.test(st.fontSize) ? 0.75 : 1)).toFixed(1)}pt"`);
      const inner = inline(c);
      if (t === 'A' && c.getAttribute('href') && !/^#/.test(c.getAttribute('href'))) { out += `<text:a xlink:type="simple" xlink:href="${X(c.getAttribute('href'))}">${inner}</text:a>`; return; }
      out += props.length ? `<text:span text:style-name="${tstyle(props)}">${inner}</text:span>` : inner;
    });
    return out;
  };
  const para = (el) => {
    const props = [], a = (el.style || {}).textAlign;
    if (a === 'center' || a === 'right' || a === 'justify') props.push(`fo:text-align="${a === 'right' ? 'end' : a}"`);
    const ml = parseFloat(el.style.marginLeft) || 0; if (ml) props.push(`fo:margin-left="${(ml / 96 * 2.54).toFixed(2)}cm"`);
    if (breakNext) { props.push('fo:break-before="page"'); breakNext = false; }
    const h = el.tagName.match(/^H([1-6])$/);
    const parent = h ? 'Heading_20_' + h[1] : el.classList.contains('title') ? 'Title' : el.tagName === 'PRE' ? 'Preformatted_20_Text' : el.tagName === 'BLOCKQUOTE' ? 'Quotations' : 'Standard';
    const sn = props.length ? pstyle(parent, props) : parent;
    return h ? `<text:h text:style-name="${sn}" text:outline-level="${h[1]}">${inline(el)}</text:h>` : `<text:p text:style-name="${sn}">${inline(el)}</text:p>`;
  };
  const blocks = (container) => {
    let out = '';
    Array.from(container.children).forEach((el) => {
      const t = el.tagName, c = el.classList;
      if (/^(P|H[1-6]|PRE|BLOCKQUOTE)$/.test(t) && !el.querySelector('p,ul,ol,table')) out += para(el);
      else if (t === 'UL' || t === 'OL') out += `<text:list text:style-name="${t === 'OL' ? 'LNum' : 'LBul'}">${Array.from(el.children).map((li) => { const cl = li.cloneNode(true); const subs = $$(':scope > ul, :scope > ol', cl); subs.forEach((x) => x.remove()); const w = document.createElement('div'); subs.forEach((x) => w.appendChild(x)); return `<text:list-item><text:p text:style-name="Standard">${inline(cl)}</text:p>${blocks(w)}</text:list-item>`; }).join('')}</text:list>`;
      else if (t === 'TABLE') {
        const rows = Array.from(el.rows), n = Math.max(...rows.map((r) => r.cells.length), 1);
        out += `<table:table table:name="Tabel${out.length}" table:style-name="Tbl"><table:table-column table:number-columns-repeated="${n}"/>${rows.map((r) => `<table:table-row>${Array.from(r.cells).map((cell) => `<table:table-cell table:style-name="Cell" office:value-type="string"><text:p text:style-name="${cell.tagName === 'TH' ? 'Table_20_Heading' : 'Standard'}">${inline(cell)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('')}</table:table>`;
      } else if (c.contains('page-break')) breakNext = true;
      else if (t === 'IMG') out += `<text:p text:style-name="Standard">${inline({ childNodes: [el] })}</text:p>`;
      else if (c.contains('toc') || c.contains('tof')) out += $$('.toc-title, .tof-title, a.toc-entry', el).map((x) => `<text:p text:style-name="Standard">${X(x.classList.contains('toc-entry') ? `${(x.querySelector('.t') || x).textContent}\t${(x.querySelector('.pg') || {}).textContent || ''}` : x.textContent).replace(/\t/g, '<text:tab/>')}</text:p>`).join('');
      else out += blocks(el);
    });
    return out;
  };
  const body = blocks(root) || '<text:p/>';
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
  const font = (v) => (cs.getPropertyValue(v).split(',')[0] || 'Calibri').replace(/["']/g, '').trim();
  const lst = '<text:list-style style:name="LBul">' + [1, 2, 3, 4, 5].map((l) => `<text:list-level-style-bullet text:level="${l}" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(l * 1.27).toFixed(2)}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('') + '</text:list-style>'
    + '<text:list-style style:name="LNum">' + [1, 2, 3, 4, 5].map((l) => `<text:list-level-style-number text:level="${l}" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(l * 1.27).toFixed(2)}cm"/></style:list-level-properties></text:list-level-style-number>`).join('') + '</text:list-style>';
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.2"><office:automatic-styles><style:style style:name="Tbl" style:family="table"><style:table-properties style:width="${((g.W - g.ml - g.mr) / 96 * 2.54).toFixed(2)}cm" table:align="left"/></style:style><style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #000000"/></style:style>${autoXml.join('')}${lst}</office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  const hs = [1, 2, 3, 4, 5, 6].map((n) => `<style:style style:name="Heading_20_${n}" style:display-name="Heading ${n}" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="${n}"><style:paragraph-properties fo:margin-top="${[0, 0.42, 0.25, 0.2, 0.15, 0.1, 0.1][n]}cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/><style:text-properties style:font-name="Kop" fo:font-size="${[0, 20, 16, 14, 12, 11, 11][n]}pt" fo:color="#0f4761"/></style:style>`).join('');
  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.2"><office:font-face-decls><style:font-face style:name="Tekst" svg:font-family="'${X(font('--doc-font'))}'"/><style:font-face style:name="Kop" svg:font-family="'${X(font('--doc-head-font'))}'"/></office:font-face-decls>
<office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.28cm" fo:line-height="115%"/><style:text-properties style:font-name="Tekst" fo:font-size="${((parseFloat(cs.fontSize) || 16) * 0.75).toFixed(1)}pt" fo:language="nl" fo:country="NL"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>${hs}
<style:style style:name="Title" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties style:font-name="Kop" fo:font-size="28pt"/></style:style>
<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm"/><style:text-properties fo:font-style="italic"/></style:style>
<style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-family="Consolas" fo:font-size="9.5pt"/></style:style>
<style:style style:name="Table_20_Heading" style:display-name="Table Heading" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="Footnote" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="10pt"/></style:style><style:style style:name="Endnote" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="10pt"/></style:style>
<text:notes-configuration text:note-class="endnote" style:num-format="i" text:start-value="0"/></office:styles>
<office:automatic-styles><style:page-layout style:name="PL"><style:page-layout-properties fo:page-width="${(g.wmm / 10).toFixed(2)}cm" fo:page-height="${(g.hmm / 10).toFixed(2)}cm" style:print-orientation="${g.W > g.H ? 'landscape' : 'portrait'}" fo:margin-top="${m.page.margins.t}cm" fo:margin-bottom="${m.page.margins.b}cm" fo:margin-left="${m.page.margins.l}cm" fo:margin-right="${m.page.margins.r}cm"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="PL"/></office:master-styles></office:document-styles>`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS} office:version="1.2"><office:meta><dc:title>${X(App.doc.title)}</dc:title><meta:generator>Inkt</meta:generator></office:meta></office:document-meta>`);
  media.forEach((md) => zip.file(md.name, md.data, { base64: true }));
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${media.map((md) => `<manifest:file-entry manifest:full-path="${md.name}" manifest:media-type="${md.type}"/>`).join('')}</manifest:manifest>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
};
