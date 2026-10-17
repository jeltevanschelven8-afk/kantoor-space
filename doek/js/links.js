/* =========================================================
   Doek (gemaakt door JJ van Schelven) — koppelingen (Ctrl+K), actie-instellingen
   (klikken en aanwijzen) en zoom (dia-, sectie- en overzichtszoom)
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const KINDS = [['next', 'Volgende dia'], ['prev', 'Vorige dia'], ['first', 'Eerste dia'], ['last', 'Laatste dia'], ['lastViewed', 'Laatst bekeken dia'], ['end', 'Voorstelling beëindigen']];
  const slideLabel = (s, i) => `${i + 1}. ${App.slideTitle ? App.slideTitle(s) : ''}`.trim();
  const normUrl = (u) => {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(u)) return 'mailto:' + u;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
    return /^(https?:|mailto:)/i.test(u) ? u : '';
  };

  /* ---------- Koppeling invoegen (Ctrl+K) ---------- */
  const curLink = () => {
    if (st.edit) { const rs = App.textEdit.selRuns ? App.textEdit.selRuns() : []; const r = (rs || []).find((x) => x.link); return r ? r.link : null; }
    const o = App.sel1(); return o ? o.link || null : null;
  };
  App.def('linkDialog', () => {
    const P = App.pres;
    const editing = !!st.edit;
    const objs = editing ? [] : App.selObjs();
    if (!editing && !objs.length) { App.toast(App.t('Selecteer eerst tekst of een object.'), 'info'); return; }
    const sel = editing ? App.textEdit.selectedText() : '';
    const L = curLink() || {};
    let tab = L.kind === 'url' && /^mailto:/i.test(L.url || '') ? 'mail' : L.kind && L.kind !== 'url' ? 'place' : 'url';
    const mail = /^mailto:([^?]*)(?:\?subject=(.*))?$/i.exec(L.url || '') || [];
    const body = `<div class="lk">
      <div class="lk-tabs"><button data-t="url"><span class="i">public</span>${App.t('Webpagina')}</button><button data-t="place"><span class="i">slideshow</span>${App.t('Plaats in dit document')}</button><button data-t="mail"><span class="i">mail</span>${App.t('E-mailadres')}</button></div>
      <div class="lk-main">
        ${editing ? `<label class="field"><span>${App.t('Weer te geven tekst')}</span><input id="lk-text" class="notranslate" value="${App.esc(sel)}" ${sel && /\n/.test(sel) ? 'disabled' : ''}></label>` : ''}
        <div data-p="url"><label class="field"><span>${App.t('Adres')}</span><input id="lk-url" class="notranslate" placeholder="https://" value="${App.esc(L.kind === 'url' && !/^mailto:/i.test(L.url) ? L.url : '')}"></label><p class="muted small" style="margin:0">${App.t('Alleen webadressen (http, https) en e-mail zijn toegestaan.')}</p></div>
        <div data-p="place"><div class="lk-list notranslate">${KINDS.map(([k, n]) => `<label><input type="radio" name="lk-pl" value="${k}" ${L.kind === k ? 'checked' : ''}> ${App.esc(App.t(n))}</label>`).join('')}<div class="lk-sep">${App.t('Diatitels')}</div>${P.slides.map((s, i) => `<label><input type="radio" name="lk-pl" value="slide:${s.id}" ${L.kind === 'slide' && L.slide === s.id ? 'checked' : ''}> ${App.esc(slideLabel(s, i))}</label>`).join('')}${P.shows.length ? `<div class="lk-sep">${App.t('Aangepaste voorstellingen')}</div>${P.shows.map((x) => `<label><input type="radio" name="lk-pl" value="show:${x.id}" ${L.kind === 'show' && L.show === x.id ? 'checked' : ''}> ${App.esc(x.name)}</label>`).join('')}` : ''}</div></div>
        <div data-p="mail"><label class="field"><span>${App.t('E-mailadres')}</span><input id="lk-mail" class="notranslate" placeholder="naam@voorbeeld.nl" value="${App.esc(decodeURIComponent(mail[1] || ''))}"></label><label class="field"><span>${App.t('Onderwerp')}</span><input id="lk-subj" class="notranslate" value="${App.esc(decodeURIComponent(mail[2] || ''))}"></label></div>
      </div></div>`;
    const read = (d) => {
      if (tab === 'url') { const u = normUrl(d.$('#lk-url').value); return u ? { kind: 'url', url: u } : null; }
      if (tab === 'mail') { const a = d.$('#lk-mail').value.trim(); if (!/^[^@\s]+@[^@\s]+$/.test(a)) return null; const s = d.$('#lk-subj').value.trim(); return { kind: 'url', url: 'mailto:' + encodeURIComponent(a).replace('%40', '@') + (s ? '?subject=' + encodeURIComponent(s) : '') }; }
      const r = d.$('input[name="lk-pl"]:checked'); if (!r) return null;
      const [k, id] = r.value.split(':');
      return k === 'slide' ? { kind: 'slide', slide: id } : k === 'show' ? { kind: 'show', show: id, ret: true } : { kind: k };
    };
    const apply = (link, d) => {
      if (editing) {
        const txt = d.$('#lk-text') && !d.$('#lk-text').disabled ? d.$('#lk-text').value : null;
        App.textEdit.focus && App.textEdit.focus();
        if (!sel && link && txt) { App.textEdit.insertText(txt, { link }); return; }
        if (sel && txt !== null && txt !== sel && txt) { App.textEdit.insertText(txt, { link }); return; }
        App.textEdit.applyRuns((r) => { if (link) r.link = App.clone(link); else delete r.link; }, { word: true });
        return;
      }
      App.run(() => objs.forEach((o) => { if (link) o.link = App.clone(link); else delete o.link; }));
    };
    App.dialog({
      title: App.t(L.kind ? 'Koppeling bewerken' : 'Koppeling invoegen'), body, wide: true,
      onOpen: (d) => {
        const show = () => { d.$$('.lk-tabs [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); d.$$('[data-p]').forEach((p) => { p.hidden = p.dataset.p !== tab; }); };
        d.$('.lk-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; show(); const f = d.$(`[data-p="${tab}"] input`); if (f) f.focus(); } };
        show();
        setTimeout(() => { const f = d.$(`[data-p="${tab}"] input`); if (f && tab !== 'place') f.focus(); }, 30);
      },
      buttons: (L.kind ? [{ label: 'Koppeling verwijderen', left: true, action: (d) => apply(null, d) }] : []).concat([{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const link = read(d);
        if (!link) { App.toast(App.t(tab === 'mail' ? 'Vul een geldig e-mailadres in.' : tab === 'url' ? 'Vul een geldig webadres in (http of https).' : 'Kies een plaats in de presentatie.'), 'info'); return false; }
        apply(link, d);
      } }]),
    });
  });
  App.def('removeLink', () => {
    if (st.edit) { App.textEdit.applyRuns((r) => { delete r.link; }, { word: true }); return; }
    App.run(() => App.selObjs().forEach((o) => { delete o.link; }));
  });

  /* ---------- Actie-instellingen (klikken en aanwijzen) ---------- */
  App.def('actionDialog', () => {
    const objs = App.selObjs();
    if (!objs.length) { App.toast(App.t('Selecteer eerst een object.'), 'info'); return; }
    const P = App.pres, o = objs[0];
    const opts = (l) => `<option value="">${App.t('Kies…')}</option>${KINDS.map(([k, n]) => `<option value="${k}" ${l && l.kind === k ? 'selected' : ''}>${App.esc(App.t(n))}</option>`).join('')}<optgroup label="${App.esc(App.t('Dia'))}">${P.slides.map((s, i) => `<option value="slide:${s.id}" ${l && l.kind === 'slide' && l.slide === s.id ? 'selected' : ''}>${App.esc(slideLabel(s, i))}</option>`).join('')}</optgroup>${P.shows.length ? `<optgroup label="${App.esc(App.t('Aangepaste voorstelling'))}">${P.shows.map((x) => `<option value="show:${x.id}" ${l && l.kind === 'show' && l.show === x.id ? 'selected' : ''}>${App.esc(x.name)}</option>`).join('')}</optgroup>` : ''}<option value="url" ${l && l.kind === 'url' ? 'selected' : ''}>${App.t('URL…')}</option>`;
    const pane = (k, l) => `<div class="ac-pane" data-ac="${k}" ${k === 'hover' ? 'hidden' : ''}>
      <div class="radio-list"><label><input type="radio" name="ac-${k}" value="none" ${!l ? 'checked' : ''}> ${App.t('Geen')}</label><label><input type="radio" name="ac-${k}" value="link" ${l ? 'checked' : ''}> ${App.t('Hyperlink naar:')}</label></div>
      <select class="ac-sel notranslate" data-k="${k}" style="width:100%;margin:6px 0">${opts(l)}</select>
      <input class="ac-url notranslate" data-k="${k}" placeholder="https://" value="${App.esc(l && l.kind === 'url' ? l.url : '')}" ${l && l.kind === 'url' ? '' : 'hidden'} style="width:100%">
    </div>`;
    App.dialog({
      title: App.t('Actie-instellingen'),
      body: `<div class="lk-tabs row"><button data-t="click" class="on">${App.t('Muisklik')}</button><button data-t="hover">${App.t('Muisaanwijzer')}</button></div>${pane('click', o.link)}${pane('hover', o.hover)}
        <p class="muted small" style="margin:10px 0 0;line-height:1.5">${App.t('De actie werkt tijdens de diavoorstelling. Programma\'s starten is om veiligheidsredenen niet mogelijk.')}</p>`,
      onOpen: (d) => {
        d.$('.lk-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; d.$$('.lk-tabs [data-t]').forEach((x) => x.classList.toggle('on', x === b)); d.$$('.ac-pane').forEach((p) => { p.hidden = p.dataset.ac !== b.dataset.t; }); };
        d.el.addEventListener('change', (e) => {
          const s = e.target.closest('.ac-sel'); if (!s) return;
          const k = s.dataset.k; d.$(`.ac-url[data-k="${k}"]`).hidden = s.value !== 'url';
          const r = d.$(`input[name="ac-${k}"][value="link"]`); if (r && s.value) r.checked = true;
        });
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const read = (k) => {
          if (d.$(`input[name="ac-${k}"]:checked`).value === 'none') return null;
          const v = d.$(`.ac-sel[data-k="${k}"]`).value; if (!v) return null;
          if (v === 'url') { const u = normUrl(d.$(`.ac-url[data-k="${k}"]`).value); return u ? { kind: 'url', url: u } : null; }
          const [a, id] = v.split(':');
          return a === 'slide' ? { kind: 'slide', slide: id } : a === 'show' ? { kind: 'show', show: id, ret: true } : { kind: a };
        };
        const click = read('click'), hover = read('hover');
        App.run(() => objs.forEach((x) => { if (click) x.link = click; else delete x.link; if (hover) x.hover = hover; else delete x.hover; }));
      } }],
    });
  });

  /* ---------- Zoom ---------- */
  const T = App.RENDER_TYPES;
  if (T) {
    T.zoom = (el, o, b, ctx, theme) => {
      const P = App.pres;
      const s = App.slideById(o.slide);
      const box = document.createElement('div');
      box.className = 'zoom-img';
      if (s && !(ctx.zoomDepth > 0)) {
        const th = App.renderSlide(s, { mode: ctx.mode === 'show' ? 'thumb' : 'thumb', scale: Math.min(b.w / P.size.w, b.h / P.size.h), zoomDepth: (ctx.zoomDepth || 0) + 1 });
        th.style.position = 'absolute';
        th.style.left = ((b.w - P.size.w * Math.min(b.w / P.size.w, b.h / P.size.h)) / 2) + 'px';
        th.style.top = ((b.h - P.size.h * Math.min(b.w / P.size.w, b.h / P.size.h)) / 2) + 'px';
        box.appendChild(th);
      } else {
        box.classList.add('missing');
        box.textContent = s ? App.t('Dia {0}').replace('{0}', App.slideIndex(s.id) + 1) : App.t('Dia niet gevonden');
      }
      if (o.line && o.line.type !== 'none') box.style.outline = `${App.num(o.line.w, 0.75) * 4 / 3}px solid ${App.color(o.line.color || 'tx1', theme)}`;
      else box.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)';
      if (ctx.mode === 'show') box.style.cursor = 'pointer';
      el.appendChild(box);
    };
  }
  App.def('zoomLink', (kind) => {
    const P = App.pres;
    if (st.view !== 'normal') { App.toast(App.t('Zoom invoegen kan in de normale weergave.'), 'info'); return; }
    const secs = P.sections || [];
    let mode = ['slide', 'section', 'summary'].includes(kind) ? kind : 'slide';
    const thumbs = () => (mode === 'section' ? secs.map((x) => { const first = P.slides.find((s) => s.sec === x.id); return first ? { id: x.id, slide: first, label: x.name } : null; }).filter(Boolean) : P.slides.map((s, i) => ({ id: s.id, slide: s, label: slideLabel(s, i) })));
    const body = document.createElement('div');
    body.className = 'zm';
    const render = () => {
      const list = thumbs();
      body.innerHTML = `<div class="lk-tabs row"><button data-m="summary">${App.t('Overzichtszoom')}</button><button data-m="section" ${secs.length ? '' : 'disabled'}>${App.t('Sectiezoom')}</button><button data-m="slide">${App.t('Diazoom')}</button></div>
        <p class="muted small" style="margin:6px 0 8px">${App.t({ summary: 'Maakt een nieuwe overzichtsdia met een zoom naar elke gekozen dia; na elke dia keert de voorstelling terug naar het overzicht.', section: 'Een zoom naar het begin van elke gekozen sectie; na de sectie terug naar deze dia.', slide: 'Een zoom naar elke gekozen dia op de huidige dia; na de dia terug naar deze dia.' }[mode])}</p>
        <div class="zm-grid">${list.map((x) => `<label class="zm-it"><input type="checkbox" value="${App.esc(x.id)}"><span class="zm-th" data-th="${App.esc(x.slide.id)}"></span><span class="zm-l notranslate">${App.esc(x.label)}</span></label>`).join('')}</div>`;
      body.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      body.querySelectorAll('[data-th]').forEach((t) => { const s = App.slideById(t.dataset.th); if (s) t.appendChild(App.slideThumb(s, 128)); });
    };
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b && !b.disabled) { mode = b.dataset.m; render(); } });
    render();
    App.dialog({
      title: App.t('Zoom invoegen'), body, xwide: true,
      buttons: [{ label: 'Annuleren' }, { label: 'Invoegen', primary: true, action: () => {
        const ids = Array.from(body.querySelectorAll('.zm-grid input:checked')).map((i) => i.value);
        if (!ids.length) { App.toast(App.t('Kies minstens één dia of sectie.'), 'info'); return false; }
        insertZooms(mode, ids);
      } }],
    });
  });
  const insertZooms = (mode, ids) => {
    const P = App.pres, W = P.size.w, H = P.size.h;
    const made = [];
    App.run(() => {
      let target = App.cur();
      if (mode === 'summary') {
        const firstIdx = Math.min(...ids.map((id) => App.slideIndex(id)).filter((i) => i >= 0));
        const lay = App.masterOf(target).layouts.find((l) => l.type === 'titleOnly') || App.masterOf(target).layouts[0];
        target = App.newSlide(lay, P);
        const t = target.objs.find((o) => o.ph && /title/.test(o.ph.type)); if (t) t.text = { paras: [{ runs: [{ t: App.t('Overzicht') }] }] };
        P.slides.splice(Math.max(0, firstIdx), 0, target);
        st.slide = P.slides.indexOf(target);
      }
      // raster: zo groot mogelijk binnen het vrije deel van de dia
      const n = ids.length, top = mode === 'summary' ? H * 0.28 : H * 0.3, area = { x: W * 0.06, y: top, w: W * 0.88, h: H - top - H * 0.08 };
      let best = { c: 1, w: 0 };
      for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c); const w = Math.min((area.w - (c - 1) * 16) / c, ((area.h - (r - 1) * 16) / r) * W / H); if (w > best.w) best = { c, w }; }
      const w = Math.min(best.w, W * 0.32), h = w * H / W, cols = best.c, rows = Math.ceil(n / cols);
      const x0 = area.x + (area.w - (cols * w + (cols - 1) * 16)) / 2, y0 = area.y + (area.h - (rows * h + (rows - 1) * 16)) / 2;
      ids.forEach((id, k) => {
        const sec = mode === 'section' ? id : undefined;
        const slide = mode === 'section' ? (P.slides.find((s) => s.sec === id) || {}).id : id;
        const o = App.newObj('zoom', { x: x0 + (k % cols) * (w + 16), y: y0 + Math.floor(k / cols) * (h + 16), w, h, slide, sec, zkind: mode, name: App.objName(App.t(mode === 'section' ? 'Sectiezoom' : mode === 'summary' ? 'Overzichtszoom' : 'Diazoom')), line: { type: 'none' } });
        target.objs.push(o); made.push(o.id);
      });
      st.sel = made.slice();
    }, { all: mode === 'summary' });
    if (mode === 'summary') { App.thumbs.refresh(true); App.gotoSlide(st.slide); }
    App.select(made);
  };
  // dubbelklikken op een zoom: doel en terugkeren aanpassen
  $('#stage').addEventListener('dblclick', (e) => {
    const ob = e.target.closest('.ob.zoom'); if (!ob) return;
    const o = App.obj(ob.dataset.id); if (!o) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const P = App.pres;
    App.dialog({
      title: App.t('Zoom bewerken'),
      body: `<label class="field"><span>${App.t('Doeldia')}</span><select id="zm-s" class="notranslate">${P.slides.map((s, i) => `<option value="${s.id}" ${s.id === o.slide ? 'selected' : ''}>${App.esc(slideLabel(s, i))}</option>`).join('')}</select></label>
        <label class="chk"><input type="checkbox" id="zm-ret" ${o.ret === false ? '' : 'checked'}> ${App.t('Terug naar zoom')}</label>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => { o.slide = d.$('#zm-s').value; delete o.sec; if (d.$('#zm-ret').checked) delete o.ret; else o.ret = false; }) }],
    });
  }, true);

  // zoomvoorbeelden bijwerken als een doeldia verandert
  App.on('change', App.debounce(() => {
    const P = App.pres; if (!P) return;
    const dirty = new Set(P.slides.filter((s) => s._dirty).map((s) => s.id));
    if (!dirty.size) return;
    P.slides.forEach((s) => { if (!s._dirty && s.objs.some((o) => o.type === 'zoom' && dirty.has(o.slide))) { s._dirty = true; } });
  }, 120));

  /* ---------- Opmaak ---------- */
  const css = document.createElement('style');
  css.id = 'pd-links-css';
  css.textContent = `.lk{display:flex;gap:14px}.lk-tabs{display:flex;flex-direction:column;gap:4px;min-width:170px}.lk-tabs.row{flex-direction:row;margin-bottom:10px}
.lk-tabs button{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:var(--panel);text-align:left}
.lk-tabs button.on{border-color:var(--brand);background:var(--hover);font-weight:600}.lk-tabs button[disabled]{opacity:.45}
.lk-main{flex:1;min-width:0}.lk-list{max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:4px;padding:6px 8px;display:flex;flex-direction:column;gap:3px}
.lk-sep{font-weight:600;margin-top:6px;color:var(--muted);font-size:12px}
.zoom-img{position:absolute;inset:0;overflow:hidden;background:#fff}.zoom-img.missing{display:flex;align-items:center;justify-content:center;background:var(--hover,#eee);color:#666;font-size:14px}
.zm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;max-height:50vh;overflow:auto;padding:2px}
.zm-it{display:flex;flex-direction:column;gap:4px;align-items:flex-start;cursor:pointer;position:relative}.zm-it input{position:absolute;left:6px;top:6px;z-index:2}
.zm-th{border:1px solid var(--line-strong);line-height:0}.zm-it input:checked + .zm-th{outline:3px solid var(--brand)}.zm-l{font-size:12px}`;
  document.head.appendChild(css);
})();
