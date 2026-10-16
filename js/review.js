/* =========================================================
   Inkt — Controleren: opmerkingen, wijzigingen, spelling, voorlezen
   ========================================================= */
'use strict';

App.AUTHOR_COLORS = ['#b4236b', '#1c7ed6', '#2f9e44', '#e8590c', '#7048e8', '#0ca678', '#c2255c', '#5c7cfa'];
App.authorColor = (name) => {
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return App.AUTHOR_COLORS[h % App.AUTHOR_COLORS.length];
};
App.initialsOf = (n) => String(n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
App.timeAgo = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'zojuist';
  if (s < 3600) return Math.floor(s / 60) + ' min geleden';
  if (s < 86400) return Math.floor(s / 3600) + ' uur geleden';
  return App.fmtDateTime(t);
};

/* =================== OPMERKINGEN =================== */
App.activeComment = null;
App.anchorsOf = (id) => $$(`.cmt[data-cid="${id}"]`, App.ed);
App.def('newComment', () => {
  if (App.state.protect) { App.toast('Het document is beveiligd', 'lock'); return; }
  App.restoreRange();
  const offs = App.getSelOffsets();
  if (App.discardDrafts()) App.setSelOffsets(offs);
  let r = App.getRange();
  if (!r) return;
  if (r.collapsed) {
    const wr = App.wordRangeAt(r);
    if (!wr) {
      const b = App.blockOf(r.startContainer);
      if (!b || !b.textContent.trim()) { App.toast('Selecteer de tekst waarop je wilt reageren', 'add_comment'); return; }
      r = document.createRange(); r.selectNodeContents(b);
    } else r = wr;
  }
  App.history.flush();
  const id = App.uid('c');
  const ws = App.wrapRange(r, () => { const s = document.createElement('span'); s.className = 'cmt'; s.dataset.cid = id; return s; }, (n) => !!App.closest(n, '.toc,.footnotes,.bibliography', App.ed));
  if (!ws.length) { App.toast('Hier kan geen opmerking worden geplaatst', 'info'); return; }
  App.doc.meta.comments.push({ id, author: App.settings.author, text: '', date: Date.now(), replies: [], resolved: false, draft: true });
  document.body.classList.add('comments-on');
  App.scheduleState();
  App.changed({ immediate: true });
  App.activeComment = id;
  App.layout();
  App.renderComments();
  setTimeout(() => { const ta = $(`#comment-pane .c-card[data-id="${id}"] textarea`); if (ta) ta.focus(); }, 60);
});
App.renderComments = () => {
  const pane = $('#comment-pane');
  const m = App.doc.meta;
  const typing = {};
  $$('textarea, input[data-act="reply"]', pane).forEach((el) => {
    const card = el.closest('.c-card'); if (!card || (!el.value && document.activeElement !== el)) return;
    typing[card.dataset.id + '|' + (el.tagName === 'INPUT' ? 'r' : 't')] = { value: el.value, focus: document.activeElement === el, s: el.selectionStart, e: el.selectionEnd };
  });
  // Opmerkingen waarvan de tekst verdwenen is opruimen, en markeringen zonder opmerking (bv. na ongedaan maken)
  m.comments = m.comments.filter((c) => App.anchorsOf(c.id).length || c.draft);
  const known = new Set(m.comments.map((c) => c.id));
  $$('.cmt', App.ed).forEach((a) => { if (!known.has(a.dataset.cid)) App.unwrap(a); });
  const order = $$('.cmt', App.ed).map((a) => a.dataset.cid).filter((v, i, a) => a.indexOf(v) === i);
  const list = m.comments.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  pane.innerHTML = list.map((c) => {
    const col = App.authorColor(c.author);
    const editing = c.draft || c.editing;
    return `<div class="c-card ${c.id === App.activeComment ? 'active' : ''} ${c.resolved ? 'resolved' : ''}" data-id="${c.id}">
      <div class="c-head"><span class="c-av" style="background:${col}">${App.initialsOf(c.author)}</span>
        <div><div class="c-who">${App.esc(c.author)}</div><div class="c-when">${App.timeAgo(c.date)}${c.resolved ? ' · opgelost' : ''}</div></div>
        ${editing ? '' : `<button class="qb" data-act="resolve" title="${c.resolved ? 'Opnieuw openen' : 'Oplossen'}"><span class="i">${c.resolved ? 'replay' : 'check'}</span></button>
        <button class="qb" data-act="delete" title="Verwijderen"><span class="i">delete</span></button>`}
      </div>
      ${editing ? `<textarea placeholder="Typ je opmerking… (Ctrl+Enter om te plaatsen)">${App.esc(c.text)}</textarea>
        <div class="c-actions"><button class="btn small" data-act="cancel">Annuleren</button><button class="btn small primary" data-act="post">Plaatsen</button></div>`
        : `<div class="c-text" data-act="edit" title="Klik om te bewerken">${App.esc(c.text)}</div>`}
      ${c.replies.map((r) => `<div class="c-reply"><div class="c-head"><span class="c-av" style="background:${App.authorColor(r.author)};width:20px;height:20px;font-size:9px">${App.initialsOf(r.author)}</span><div><div class="c-who">${App.esc(r.author)}</div><div class="c-when">${App.timeAgo(r.date)}</div></div></div><div class="c-text">${App.esc(r.text)}</div></div>`).join('')}
      ${!editing && !c.resolved ? `<div class="c-replybox"><input placeholder="Beantwoorden…" data-act="reply"></div>` : ''}
    </div>`;
  }).join('');
  App.anchorsOf(App.activeComment).forEach((a) => a.classList.add('active'));
  $$('.cmt.active', App.ed).forEach((a) => { if (a.dataset.cid !== App.activeComment) a.classList.remove('active'); });
  m.comments.forEach((c) => App.anchorsOf(c.id).forEach((a) => a.classList.toggle('resolved', !!c.resolved)));
  // wat al getypt was (en de cursor daarin) terugzetten
  Object.entries(typing).forEach(([key, t]) => {
    const [id, kind] = key.split('|');
    const el = $(`#comment-pane .c-card[data-id="${id}"] ${kind === 'r' ? 'input[data-act="reply"]' : 'textarea'}`);
    if (!el) return;
    el.value = t.value;
    if (t.focus) { el.focus({ preventScroll: true }); try { el.setSelectionRange(t.s, t.e); } catch { /* niets */ } }
  });
  App.layoutComments();
};
App.layoutComments = () => {
  if (!document.body.classList.contains('comments-on')) return;
  const pane = $('#comment-pane'), sizer = $('#zoom-sizer');
  pane.style.left = 'calc(100% + 16px)';
  const sr = sizer.getBoundingClientRect();
  let last = 0;
  $$('.c-card', pane).forEach((card) => {
    const a = App.anchorsOf(card.dataset.id)[0];
    const want = a ? a.getBoundingClientRect().top - sr.top - 6 : last;
    const top = Math.max(want, last);
    card.style.top = top + 'px';
    last = top + card.offsetHeight + 8;
  });
};
App.setActiveComment = (id, scroll) => {
  App.activeComment = id;
  $$('.c-card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
  $$('.cmt', App.ed).forEach((a) => a.classList.toggle('active', a.dataset.cid === id));
  if (scroll) { const a = App.anchorsOf(id)[0]; if (a) App.scrollToEl(a); }
};
/* Niet-geplaatste (lege) opmerkingen verdwijnen, zoals in Word. Een concept waarin al getypt is blijft staan. */
App.isEmptyDraft = (c) => {
  if (!c.draft) return false;
  const ta = $(`#comment-pane .c-card[data-id="${c.id}"] textarea`);
  return !(ta ? ta.value : c.text || '').trim();
};
App.discardDrafts = (keepId) => {
  const drafts = App.doc.meta.comments.filter((c) => c.id !== keepId && App.isEmptyDraft(c));
  if (!drafts.length) return false;
  drafts.forEach((c) => App.anchorsOf(c.id).forEach((a) => App.unwrap(a)));
  const ids = new Set(drafts.map((c) => c.id));
  App.doc.meta.comments = App.doc.meta.comments.filter((c) => !ids.has(c.id));
  if (ids.has(App.activeComment)) App.activeComment = null;
  if (!App.doc.meta.comments.length) document.body.classList.remove('comments-on');
  App.changed({ immediate: true });
  App.renderComments();
  return true;
};
// Wegklikken naar het document zonder te plaatsen: lege opmerking weg
App.ed.addEventListener('mousedown', () => { if (App.doc.meta.comments.some((c) => c.draft)) App.discardDrafts(); });
App.removeComment = (id) => {
  App.history.flush();
  App.anchorsOf(id).forEach((a) => App.unwrap(a));
  App.doc.meta.comments = App.doc.meta.comments.filter((c) => c.id !== id);
  if (App.activeComment === id) App.activeComment = null;
  App.changed({ immediate: true });
  App.renderComments();
};
$('#comment-pane').addEventListener('click', (e) => {
  const card = e.target.closest('.c-card'); if (!card) return;
  const id = card.dataset.id;
  const c = App.doc.meta.comments.find((x) => x.id === id);
  if (!c) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (App.activeComment !== id) App.setActiveComment(id);
  if (act === 'post') {
    const t = card.querySelector('textarea').value.trim();
    if (!t) { if (c.draft) App.removeComment(id); else { c.editing = false; App.renderComments(); } return; }
    c.text = t; c.draft = false; c.editing = false; c.date = c.date || Date.now();
    App.markDirty(); App.history.push(); App.renderComments();
  } else if (act === 'cancel') {
    if (c.draft) App.removeComment(id); else { c.editing = false; App.renderComments(); }
  } else if (act === 'resolve') {
    c.resolved = !c.resolved; App.markDirty(); App.history.push(); App.renderComments();
  } else if (act === 'delete') {
    App.removeComment(id);
  } else if (act === 'edit' && c.author === App.settings.author) {
    c.editing = true; App.renderComments();
    const ta = card.isConnected ? null : $(`#comment-pane .c-card[data-id="${id}"] textarea`);
    if (ta) ta.focus();
  }
});
$('#comment-pane').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey && e.target.tagName === 'TEXTAREA') { e.preventDefault(); e.target.closest('.c-card').querySelector('[data-act="post"]').click(); }
  if (e.key === 'Enter' && e.target.dataset.act === 'reply' && e.target.value.trim()) {
    const id = e.target.closest('.c-card').dataset.id;
    const c = App.doc.meta.comments.find((x) => x.id === id);
    c.replies.push({ author: App.settings.author, text: e.target.value.trim(), date: Date.now() }); e.target.value = '';
    App.markDirty(); App.history.push(); App.renderComments();
  }
  e.stopPropagation();
});
App.ed.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('.cmt');
  if (a && document.body.classList.contains('comments-on')) App.setActiveComment(a.dataset.cid);
});
App.on('layout', () => App.layoutComments());
App.on('change', App.debounce(() => { if (App.doc.meta.comments.length || $('#comment-pane').children.length) App.renderComments(); }, 400));
App.commentAtCaret = () => App.activeComment || App.selClosest('.cmt')?.dataset.cid;
App.def('deleteComment', () => { const id = App.commentAtCaret(); if (id) App.removeComment(id); else App.toast('Selecteer eerst een opmerking', 'info'); });
App.def('deleteAllComments', async () => {
  if (!App.doc.meta.comments.length) return;
  if (!(await App.confirm('Alle opmerkingen verwijderen', 'Weet je zeker dat je alle opmerkingen in dit document wilt verwijderen?', 'Verwijderen', true))) return;
  App.history.flush();
  $$('.cmt', App.ed).forEach((a) => App.unwrap(a));
  App.doc.meta.comments = [];
  App.changed({ immediate: true }); App.renderComments();
});
App.def('deleteResolved', () => {
  App.doc.meta.comments.filter((c) => c.resolved).forEach((c) => App.removeComment(c.id));
});
App.navComment = (dir) => {
  const ids = $$('.cmt', App.ed).map((a) => a.dataset.cid).filter((v, i, a) => a.indexOf(v) === i);
  if (!ids.length) { App.toast('Er zijn geen opmerkingen', 'info'); return; }
  document.body.classList.add('comments-on');
  const i = ids.indexOf(App.activeComment);
  const next = ids[(i + dir + ids.length) % ids.length];
  App.layout(); App.renderComments();
  App.setActiveComment(next, true);
};
App.def('nextComment', () => App.navComment(1));
App.def('prevComment', () => App.navComment(-1));
App.def('toggleComments', () => {
  document.body.classList.toggle('comments-on');
  App.layout(); App.renderComments(); App.scheduleState();
});
App.stateFns.comments = () => document.body.classList.contains('comments-on');

/* =================== WIJZIGINGEN BIJHOUDEN =================== */
App.def('toggleTrack', () => {
  App.state.track = !App.state.track;
  App.doc.meta.track = App.state.track;
  $('#sb-track').hidden = !App.state.track;
  App.toast(App.state.track ? 'Wijzigingen bijhouden staat aan' : 'Wijzigingen bijhouden staat uit', 'track_changes');
  App.markDirty(); App.scheduleState();
});
App.stateFns.track = () => App.state.track;
App.makeTrk = (tag) => {
  const el = document.createElement(tag);
  el.className = 'trk';
  el.dataset.author = App.settings.author;
  el.dataset.time = Date.now();
  el.style.setProperty('--trk', App.authorColor(App.settings.author));
  el.title = `${tag === 'ins' ? 'Ingevoegd' : 'Verwijderd'} door ${App.settings.author}, ${App.fmtDateTime(Date.now())}`;
  return el;
};
App.trackInsert = (text) => {
  if (!text) return;
  App.history.flush();
  let r = App.getRange(); if (!r) return;
  if (!r.collapsed) { App.trackDeleteRange(r, false); r = App.getRange(); }
  const del = App.closest(r.startContainer, 'del.trk', App.ed);
  if (del) { r = document.createRange(); r.setStartAfter(del); r.collapse(true); }
  const ins = App.closest(r.startContainer, 'ins.trk', App.ed);
  if (ins && ins.dataset.author === App.settings.author) {
    if (r.startContainer.nodeType === 3) {
      r.startContainer.insertData(r.startOffset, text);
      App.placeCaret(r.startContainer, r.startOffset + text.length);
    } else {
      const tn = document.createTextNode(text); r.insertNode(tn); App.placeCaret(tn, tn.length);
    }
  } else {
    const el = App.makeTrk('ins');
    el.textContent = text;
    r.insertNode(el);
    App.placeCaret(el.firstChild, text.length);
  }
  App.changed();
};
// Geplakte of ingevoegde HTML als bijgehouden invoeging (per alinea een <ins>)
App.trackInsertHtml = (html) => {
  App.history.flush();
  const r = App.getRange(); if (!r) return;
  if (!r.collapsed) App.trackDeleteRange(r, false);
  const d = document.createElement('div'); d.innerHTML = html;
  const wrapIn = (host) => { if (!host.childNodes.length) return; const ins = App.makeTrk('ins'); while (host.firstChild) ins.appendChild(host.firstChild); host.appendChild(ins); };
  const blocks = $$('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre', d).filter((b) => !b.querySelector('p,li,td,th'));
  if (!blocks.length) wrapIn(d); else blocks.forEach(wrapIn);
  App.insertHTML(d.innerHTML);
  App.changed();
};
App.trackDeleteRange = (r, backward) => {
  const root = App.ed;
  const s = App.textOffset(r.startContainer, r.startOffset, root);
  const len = r.toString().length;
  const sr = App.splitRangeText(r);
  const nodes = App.textNodesIn(sr).filter((n) => {
    const nr = document.createRange(); nr.selectNodeContents(n);
    return sr.compareBoundaryPoints(Range.START_TO_END, nr) > 0 && sr.compareBoundaryPoints(Range.END_TO_START, nr) < 0;
  });
  let removed = 0;
  nodes.forEach((n) => {
    if (App.closest(n, '[contenteditable="false"]', root)) return;
    const ins = App.closest(n, 'ins.trk', root);
    if (ins) { removed += n.length; n.remove(); if (!ins.textContent) ins.remove(); return; }
    if (App.closest(n, 'del.trk', root)) return;
    const d = App.makeTrk('del');
    n.before(d); d.appendChild(n);
  });
  // aangrenzende verwijderingen samenvoegen
  $$('del.trk', root).forEach((d) => {
    const nx = d.nextSibling;
    if (nx && nx.nodeType === 1 && nx.matches('del.trk') && nx.dataset.author === d.dataset.author) { while (nx.firstChild) d.appendChild(nx.firstChild); nx.remove(); }
  });
  const pos = backward ? s : s + len - removed;
  const p = App.pointAt(pos, root, false);
  App.placeCaret(p.node, p.offset);
};
App.trackDelete = (type) => {
  const sel = window.getSelection();
  let r = App.getRange(); if (!r) return;
  const back = /Backward/.test(type);
  if (r.collapsed) {
    const unit = /Word/.test(type) ? 'word' : /Line|Soft|Hard/.test(type) ? 'lineboundary' : 'character';
    sel.modify('extend', back ? 'backward' : 'forward', unit);
    r = App.getRange();
    if (!r || r.collapsed) return;
  }
  if (!r.toString()) { document.execCommand('delete'); return; }
  App.history.flush();
  App.trackDeleteRange(r, back);
  App.changed();
};
App.ed.addEventListener('beforeinput', (e) => {
  if (App.state.protect) { e.preventDefault(); return; }
  if (e.inputType === 'historyUndo') { e.preventDefault(); App.history.undo(); return; }
  if (e.inputType === 'historyRedo') { e.preventDefault(); App.history.redo(); return; }
  if (!App.state.track || App.state.hfEditing) return;
  const t = e.inputType;
  if (t === 'insertText' || t === 'insertReplacementText') {
    e.preventDefault();
    App.trackInsert(e.data ?? (e.dataTransfer && e.dataTransfer.getData('text/plain')));
  } else if (t.startsWith('delete') && t !== 'deleteByDrag') {
    e.preventDefault();
    App.trackDelete(t);
  }
});
App.allChanges = () => $$('ins.trk, del.trk', App.ed);
App.changeAtCaret = (forward = true) => {
  const here = App.selClosest('ins.trk, del.trk');
  if (here) return here;
  const r = App.lastRange;
  const all = App.allChanges();
  if (!r) return all[0];
  return forward ? all.find((c) => r.comparePoint(c, 0) >= 0) || all[0] : [...all].reverse().find((c) => r.comparePoint(c, 0) < 0) || all[all.length - 1];
};
App.selectChange = (c) => {
  if (!c) { App.toast('Geen (andere) wijzigingen gevonden', 'info'); return; }
  App.scrollToEl(c); App.ed.focus({ preventScroll: true }); App.selectContents(c);
};
App.resolveChange = (c, accept) => {
  if (!c) return null;
  const nextAll = App.allChanges();
  const idx = nextAll.indexOf(c);
  const isIns = c.tagName === 'INS';
  if (accept === isIns) App.unwrap(c); else c.remove();
  return App.allChanges()[idx] || null;
};
App.defEdit('acceptChange', () => {
  const c = App.changeAtCaret();
  if (!c) { App.toast('Er zijn geen wijzigingen', 'info'); return; }
  const n = App.resolveChange(c, true);
  if (n) App.selectContents(n);
});
App.defEdit('rejectChange', () => {
  const c = App.changeAtCaret();
  if (!c) { App.toast('Er zijn geen wijzigingen', 'info'); return; }
  const n = App.resolveChange(c, false);
  if (n) App.selectContents(n);
});
App.defEdit('acceptAll', () => { const n = App.allChanges().length; App.allChanges().forEach((c) => App.resolveChange(c, true)); App.toast(`${n} wijzigingen geaccepteerd`, 'ok'); });
App.defEdit('rejectAll', () => { const n = App.allChanges().length; App.allChanges().forEach((c) => App.resolveChange(c, false)); App.toast(`${n} wijzigingen geweigerd`, 'ok'); });
App.def('acceptAllStop', () => { App.exec('acceptAll'); if (App.state.track) App.exec('toggleTrack'); });
App.def('nextChange', () => { const all = App.allChanges(); const r = App.lastRange; App.selectChange((r && all.find((c) => r.comparePoint(c, 0) > 0 && !c.contains(r.startContainer))) || all[0]); });
App.def('prevChange', () => { const all = App.allChanges(); const r = App.lastRange; App.selectChange((r && [...all].reverse().find((c) => r.comparePoint(c, 0) < 0 && !c.contains(r.startContainer))) || all[all.length - 1]); });
App.def('markupMode', (v) => {
  App.state.markup = v;
  App.ed.classList.remove('mk-simple', 'mk-none', 'mk-original');
  if (v !== 'all') App.ed.classList.add('mk-' + v);
  App.layout();
});

/* =================== VERGELIJKEN =================== */
App.diffTokens = (a, b) => {
  const n = a.length, m = b.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]);
    else out.push(['+', b[j++]]);
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
};
App.compareTexts = (oldParas, newParas, author) => {
  const e = App.esc;
  const ins = (t) => `<ins class="trk" data-author="${e(author)}" style="--trk:#1c7ed6">${e(t)}</ins>`;
  const del = (t) => `<del class="trk" data-author="${e(author)}" style="--trk:#c2255c">${e(t)}</del>`;
  const pd = App.diffTokens(oldParas, newParas) || [...oldParas.map((p) => ['-', p]), ...newParas.map((p) => ['+', p])];
  const html = [];
  let changes = 0;
  for (let k = 0; k < pd.length; k++) {
    const [op, text] = pd[k];
    if (op === '=') { html.push(`<p>${e(text)}</p>`); continue; }
    if (op === '-' && pd[k + 1] && pd[k + 1][0] === '+') {
      const a = text.split(/(\s+)/), b = pd[k + 1][1].split(/(\s+)/);
      const wd = App.diffTokens(a, b);
      if (wd) {
        let line = '';
        let buf = { op: '=', s: '' };
        const flush = () => { if (!buf.s) return; line += buf.op === '=' ? e(buf.s) : buf.op === '+' ? ins(buf.s) : del(buf.s); if (buf.op !== '=') changes++; buf = { op: '=', s: '' }; };
        wd.forEach(([o, t]) => { if (o !== buf.op) { flush(); buf.op = o; } buf.s += t; });
        flush();
        html.push(`<p>${line}</p>`);
        k++; continue;
      }
    }
    changes++;
    html.push(`<p>${op === '+' ? ins(text) : del(text)}</p>`);
  }
  return { html: html.join(''), changes };
};
App.def('compareDocs', () => {
  const docs = (App.store.get('index', []) || []).filter((d) => d.id !== App.doc.id);
  const d = App.dialog({
    title: 'Documenten vergelijken', wide: true,
    body: `<p style="margin-top:0;line-height:1.5">Vergelijk het huidige document (<b>${App.esc(App.doc.title)}</b>) met een eerdere versie. Het resultaat opent als nieuw document met de verschillen als bijgehouden wijzigingen.</p>
      <div class="field"><span>Kies het originele document</span>
      <div class="list-rows" id="cmp-list">${docs.map((x) => `<div class="list-row" data-id="${x.id}" style="cursor:pointer"><span class="i">description</span><span class="grow">${App.esc(x.title)}</span><span class="muted small">${App.fmtDateTime(x.modified)}</span></div>`).join('') || '<div class="list-row muted">Geen andere documenten op deze computer</div>'}</div></div>`,
    buttons: [{ label: 'Bestand kiezen…', left: true, action: () => { pickFile(); return false; } }, { label: 'Annuleren' }],
  });
  const run = (oldHtml, title) => {
    const toParas = (html) => { const div = document.createElement('div'); div.innerHTML = html; div.querySelectorAll('del.trk').forEach((x) => x.remove()); return $$('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote', div).filter((b) => !b.querySelector('p,li,td')).map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); };
    const res = App.compareTexts(toParas(oldHtml), toParas(App.cleanHtml()), 'Vergelijking');
    d.close();
    App.newDocFromHtml(res.html, `Vergelijking — ${title} met ${App.doc.title}`);
    document.body.classList.remove('comments-on');
    App.toast(`${res.changes} verschillen gevonden`, 'compare');
  };
  const pickFile = async () => {
    const f = await App.pickFile('.docx,.txt,.html,.htm,.md,.inkt');
    if (!f) return;
    try { const r = await App.fileToDoc(f); run(r.html, f.name); } catch (e) { App.toast('Kon het bestand niet lezen', 'error'); }
  };
  d.$('#cmp-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const data = App.store.get('doc.' + row.dataset.id);
    if (data) run(data.html, data.title);
  });
});

/* =================== CONTROLE & SPRAAK =================== */
App.def('toggleSpell', () => {
  App.settings.spell = !App.settings.spell;
  App.ed.spellcheck = App.settings.spell;
  App.saveSettings();
  App.toast(App.settings.spell ? 'Spellingcontrole aan — rode kronkels tonen mogelijke fouten (Ctrl + rechtsklik voor suggesties)' : 'Spellingcontrole uit', 'spellcheck', { ms: 3200 });
  App.scheduleState();
  // forceer herbeoordeling
  const html = App.ed.innerHTML; App.ed.innerHTML = html;
});
App.stateFns.spell = () => App.settings.spell;
App.LANGS = { 'nl-NL': 'Nederlands', 'en-GB': 'Engels (VK)', 'en-US': 'Engels (VS)', 'de-DE': 'Duits', 'fr-FR': 'Frans', 'es-ES': 'Spaans' };
App.def('setLang', (code) => {
  App.doc.meta.lang = code;
  App.ed.lang = code;
  $('#sb-lang').textContent = App.LANGS[code] || code;
  App.markDirty();
  App.toast(`Taal ingesteld op ${App.LANGS[code]}`, 'translate');
});
App.def('wordCount', () => {
  const text = App.ed.innerText;
  const r = App.getRange() || App.lastRange;
  const selText = r && !r.collapsed ? r.toString() : '';
  const paras = $$('p,h1,h2,h3,h4,li,blockquote,pre', App.ed).filter((b) => b.textContent.trim()).length;
  let lines = 0;
  $$('p,h1,h2,h3,h4,li,blockquote,pre,td', App.ed).forEach((b) => { if (b.querySelector('p,li')) return; const lh = parseFloat(getComputedStyle(b).lineHeight) || 16; lines += Math.max(1, Math.round(b.getBoundingClientRect().height / App.state.zoom / lh)); });
  const row = (k, v, s) => `<span class="k">${k}</span><span>${v.toLocaleString('nl-NL')}${s != null ? ` <span class="muted small">(selectie: ${s.toLocaleString('nl-NL')})</span>` : ''}</span>`;
  const sel = (fn) => (selText ? fn(selText) : null);
  const noSp = (t) => t.replace(/\s/g, '').length;
  App.dialog({
    title: 'Woorden tellen',
    body: `<div class="props" style="grid-template-columns:200px 1fr">
      ${row("Pagina's", App.pages.count)}
      ${row('Woorden', App.countText(text), sel(App.countText))}
      ${row('Tekens (zonder spaties)', noSp(text), sel(noSp))}
      ${row('Tekens (met spaties)', text.replace(/\n/g, '').length, sel((t) => t.replace(/\n/g, '').length))}
      ${row("Alinea's", paras)}
      ${row('Regels', lines)}
      ${row('Leestijd (min.)', Math.max(1, Math.round(App.countText(text) / 220)))}
    </div>`,
  });
});
App.def('readAloud', () => {
  if (!('speechSynthesis' in window)) { App.toast('Voorlezen wordt niet ondersteund op deze computer', 'error'); return; }
  if (App.state.speaking) { speechSynthesis.cancel(); App.state.speaking = false; App.scheduleState(); return; }
  const r = App.getRange() || App.lastRange;
  let text = r && !r.collapsed ? r.toString() : '';
  if (!text) {
    const range = document.createRange(); range.selectNodeContents(App.ed);
    if (r && App.inEditor(r.startContainer)) range.setStart(r.startContainer, r.startOffset);
    text = range.toString();
  }
  if (!text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = App.doc.meta.lang || 'nl-NL';
  const v = speechSynthesis.getVoices().find((x) => x.lang.replace('_', '-').startsWith(u.lang.slice(0, 2)));
  if (v) u.voice = v;
  u.rate = 1;
  u.onend = u.onerror = () => { App.state.speaking = false; App.scheduleState(); };
  App.state.speaking = true; App.scheduleState();
  speechSynthesis.speak(u);
});
App.stateFns.speaking = () => App.state.speaking;
App.def('toggleProtect', () => {
  App.setProtect(!App.state.protect);
  App.toast(App.state.protect ? 'Document beveiligd: alleen lezen' : 'Beveiliging opgeheven', 'lock');
  App.markDirty();
});
App.setProtect = (on) => {
  App.state.protect = !!on;
  App.doc.meta.protect = !!on;
  App.ed.contentEditable = on || App.state.view === 'read' ? 'false' : 'true';
  App.ed.classList.toggle('read-only', !!on);
  $('#sb-protect').hidden = !on;
  App.scheduleState();
};
App.stateFns.protect = () => App.state.protect;
