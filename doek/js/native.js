/* =========================================================
   Doek (gemaakt door JJ van Schelven) — brug naar Windows, dezelfde als in Inkt en Cel.
   Alleen beschikbaar in het programma (Doek.exe, zie programma/Brug.cs).
   App.native.call('share' | 'pdf' | 'pickFolder' | 'folders' | 'list' | 'read' | 'write' | 'stat' | 'reveal', {...})
   ========================================================= */
'use strict';

(() => {
  const wv = window.chrome && window.chrome.webview;
  const pending = new Map();
  let seq = 0;
  App.native = {
    ok: !!(wv && window.InktNative),
    call(cmd, args = {}) {
      if (!App.native.ok) return Promise.reject(new Error(App.t('Alleen beschikbaar in het programma')));
      // PDF altijd via App.native.pdf, zodat de afdrukopmaak (dia's, hand-outs) eerst wordt klaargezet
      if (cmd === 'pdf' && !args._klaar) return App.native.pdf(args.name, args.share === '1' || args.share === true, args.path);
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        wv.postMessage({ ...args, id, cmd });
      });
    },
    // Blob -> base64 (zonder 'data:...;base64,')
    async toBase64(blob) {
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      return String(url).split(',')[1] || '';
    },
    fromBase64(b64, type = 'application/octet-stream') {
      const bin = atob(b64); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Blob([u], { type });
    },
    // Een kopie van een bestand via het Windows-deelvenster versturen
    async shareBlob(blob, name, title) {
      return App.native.call('share', { name, title: title || name, data: await App.native.toBase64(blob) });
    },
    // Echte PDF van de presentatie (met de afdrukinstellingen van Bestand › Afdrukken)
    async pdf(name, share, path) {
      if (App.state.edit) App.textEdit.stop();
      if (document.activeElement) document.activeElement.blur();
      const sel = window.getSelection(); sel.removeAllRanges();
      if (App.preparePrint) await App.preparePrint();
      try { return await App.native.call('pdf', { name, path, share: share ? '1' : '', _klaar: true }); }
      finally { if (App.afterPrint) App.afterPrint(); App.focusStage && App.focusStage(); }
    },
  };
  if (wv) {
    wv.addEventListener('message', (e) => {
      const m = e.data;
      if (!m || !pending.has(m.id)) return;
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error || App.t('Mislukt')));
    });
    // InktNative wordt door het programma vóór het laden gezet; als het later komt, toch herkennen
    if (!App.native.ok) setTimeout(() => { App.native.ok = !!window.InktNative; }, 0);
  }
})();
