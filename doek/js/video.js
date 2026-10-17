/* =========================================================
   Doek (gemaakt door JJ van Schelven) — video maken: beelden coderen met WebCodecs en zelf verpakken als WebM of MP4
   ========================================================= */
'use strict';

(() => {
  const HAS_V = typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';
  const HAS_A = typeof AudioEncoder === 'function' && typeof AudioData === 'function';
  const TE = new TextEncoder();

  /* ---------- Hulpjes ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const even = (n) => Math.floor(n / 2) * 2;
  const u8 = (a) => Uint8Array.from(a);
  const len = (parts) => { let n = 0; for (const p of parts) n += p.length; return n; };
  const copy = (b) => (ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b)).slice();
  const isSup = async (Enc, cfg) => { try { return !!(await Enc.isConfigSupported(cfg)).supported; } catch { return false; } };
  const autoRate = (w, h, fps) => Math.round(clamp(w * h * fps * 0.1, 3e5, 4e7));
  const aborted = () => new DOMException('Video maken is geannuleerd', 'AbortError');

  // Tegendruk: wachten zolang de encoder te veel werk in de wachtrij heeft
  const drain = async (enc, max) => {
    while (enc.state === 'configured' && enc.encodeQueueSize > max) {
      await new Promise((r) => { const t = setTimeout(r, 25); if (enc.addEventListener) enc.addEventListener('dequeue', () => { clearTimeout(t); r(); }, { once: true }); });
    }
  };

  // Bytes schrijven (big-endian; le16/le32 voor OpusHead)
  const W = () => {
    const a = [];
    const w = {
      u8: (...v) => { for (const x of v) a.push(x & 255); return w; },
      u16: (v) => w.u8(v >> 8, v),
      u24: (v) => w.u8(v >> 16, v >> 8, v),
      u32: (v) => w.u8(v >>> 24, v >>> 16, v >>> 8, v),
      u64: (v) => w.u32(Math.floor(v / 4294967296)).u32(v >>> 0),
      le16: (v) => w.u8(v, v >> 8),
      le32: (v) => w.u8(v, v >> 8, v >> 16, v >>> 24),
      str: (s) => { for (let k = 0; k < s.length; k++) a.push(s.charCodeAt(k) & 255); return w; },
      zero: (n) => { while (n-- > 0) a.push(0); return w; },
      get: () => Uint8Array.from(a),
    };
    return w;
  };

  // Kleine stukjes samenvoegen; grote (beelddata) blijven losse Blob-delen, zonder kopie
  const pack = (parts) => {
    const out = [];
    let run = [], n = 0;
    const flush = () => {
      if (run.length === 1) out.push(run[0]);
      else if (run.length) { const b = new Uint8Array(n); let o = 0; for (const p of run) { b.set(p, o); o += p.length; } out.push(b); }
      run = []; n = 0;
    };
    for (const p of parts) {
      if (p.length >= 4096) { flush(); out.push(p); } else { run.push(p); n += p.length; if (n >= 65536) flush(); }
    }
    flush();
    return out;
  };

  /* ---------- Codec kiezen ---------- */
  const KINDS = { webm: ['vp9', 'vp8', 'av1'], mp4: ['h264'] };
  // H.264: [niveau, max. macroblokken per beeld, max. macroblokken per seconde]
  const AVC = [[10, 99, 1485], [11, 396, 3000], [12, 396, 6000], [13, 396, 11880], [20, 396, 11880], [21, 792, 19800], [22, 1620, 20250],
    [30, 1620, 40500], [31, 3600, 108000], [32, 5120, 216000], [40, 8192, 245760], [41, 8192, 245760], [42, 8704, 522240], [50, 22080, 589824],
    [51, 36864, 983040], [52, 36864, 2073600], [60, 139264, 4177920], [61, 139264, 8355840], [62, 139264, 16711680]];
  // VP9: [niveau, max. beeldpunten, max. beeldpunten per seconde, max. zijde]
  const VP9 = [[10, 36864, 829440, 512], [11, 73728, 2764800, 768], [20, 122880, 4608000, 960], [21, 245760, 9216000, 1344],
    [30, 552960, 20736000, 2048], [31, 983040, 36864000, 2752], [40, 2228224, 83558400, 4160], [41, 2228224, 160432128, 4160],
    [50, 8912896, 311951360, 8384], [51, 8912896, 588251136, 8384], [52, 8912896, 1176502272, 8384], [60, 35651584, 1176502272, 16832],
    [61, 35651584, 2353004544, 16832], [62, 35651584, 4706009088, 16832]];
  // AV1: [seq_level_idx, max. beeldpunten, max. breedte, max. hoogte, max. beeldpunten per seconde]
  const AV1 = [[0, 147456, 2048, 1152, 4423680], [1, 278784, 2816, 1584, 8363520], [4, 665856, 4352, 2448, 19975680], [5, 1065024, 5504, 3096, 31950720],
    [8, 2359296, 6144, 3456, 70778880], [9, 2359296, 6144, 3456, 141557760], [12, 8912896, 8192, 4352, 267386880], [13, 8912896, 8192, 4352, 534773760],
    [14, 8912896, 8192, 4352, 1069547520], [16, 35651584, 16384, 8704, 1069547520], [17, 35651584, 16384, 8704, 2139095040], [18, 35651584, 16384, 8704, 4278190080]];
  const codecsFor = (kind, w, h, fps) => {
    const px = w * h, rate = px * fps;
    if (kind === 'vp8') return ['vp8'];
    if (kind === 'vp9') { const l = VP9.find((x) => px <= x[1] && rate <= x[2] && Math.max(w, h) <= x[3]); return l ? ['vp09.00.' + l[0] + '.08'] : []; }
    if (kind === 'av1') { const l = AV1.find((x) => px <= x[1] && w <= x[2] && h <= x[3] && rate <= x[4]); return l ? ['av01.0.' + String(l[0]).padStart(2, '0') + 'M.08'] : []; }
    // H.264: high → main → baseline, met het laagste niveau waar maat en beeldsnelheid in passen
    const mw = Math.ceil(w / 16), mh = Math.ceil(h / 16), fs = mw * mh;
    const l = AVC.find((x) => fs <= x[1] && fs * fps <= x[2] && Math.max(mw, mh) <= Math.sqrt(8 * x[1]));
    return l ? ['64', '4D', '42'].map((p) => 'avc1.' + p + '00' + l[0].toString(16).toUpperCase().padStart(2, '0')) : [];
  };
  const candidates = (format, w, h, fps, pref) => {
    pref = String(pref || '').toLowerCase().replace(/^(avc1?|h\.?264)$/, 'h264');
    return KINDS[format].slice().sort((a, b) => (b === pref) - (a === pref)).flatMap((k) => codecsFor(k, w, h, fps));
  };
  const vConfig = (codec, w, h, fps, bitrate) => Object.assign({ codec, width: w, height: h, framerate: fps, bitrate, latencyMode: 'quality' },
    codec.startsWith('avc1') ? { avc: { format: 'avc' } } : {});
  const aConfig = (format, sampleRate, ch) => (format === 'webm'
    ? { codec: 'opus', sampleRate, numberOfChannels: ch, bitrate: ch * 64000 }
    : { codec: 'mp4a.40.2', sampleRate, numberOfChannels: ch, bitrate: ch * 80000, aac: { format: 'aac' } });

  // WebCodecs-kleurruimte → codepunten (ISO/IEC 23091-2) voor de container
  const CP = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };
  const TC = { bt709: 1, smpte170m: 6, linear: 8, 'iec61966-2-1': 13, pq: 16, hlg: 18 };
  const MC = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
  const colors = (cs) => cs && { p: CP[cs.primaries], t: TC[cs.transfer], m: MC[cs.matrix], full: cs.fullRange };

  /* ---------- EBML / WebM ---------- */
  // Elk element is een lijst Uint8Array-delen; beelddata wordt zo nooit gekopieerd
  const idB = (id) => { const b = []; for (; id > 0; id = Math.floor(id / 256)) b.unshift(id % 256); return b; };
  const numB = (n, l) => { const b = new Array(l); for (let k = l - 1; k >= 0; k--) { b[k] = n % 256; n = Math.floor(n / 256); } return b; };
  const vint = (n, l) => { if (!l) { l = 1; while (n >= 2 ** (7 * l) - 1) l++; } const b = numB(n, l); b[0] |= 0x80 >> (l - 1); return b; };
  const head = (id, size, l) => u8([...idB(id), ...vint(size, l)]);
  const E = (id, kids, l) => { const p = kids.flat(); return [head(id, len(p), l), ...p]; };
  const EB = (id, b) => [head(id, b.length), b];
  const EU = (id, n, l) => { if (!l) { l = 1; while (n >= 2 ** (8 * l)) l++; } return EB(id, u8(numB(n, l))); };
  const EI = (id, n) => { let l = 1; while (n < -(2 ** (8 * l - 1)) || n >= 2 ** (8 * l - 1)) l++; return EU(id, n < 0 ? n + 2 ** (8 * l) : n, l); };
  const ES = (id, s) => EB(id, TE.encode(s));
  const EF = (id, x) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, x); return EB(id, b); };
  // (Simple)Block: spoornummer, tijd t.o.v. het cluster (int16), vlaggen, data
  const BL = (id, track, rel, flags, data) => [head(id, 4 + data.length), u8([0x80 | track, (rel >> 8) & 255, rel & 255, flags]), data];

  // AV1CodecConfigurationRecord: kop + sequence header uit het eerste sleutelbeeld (WebCodecs levert er geen)
  const av1C = (codec, data) => {
    const f = codec.split('.'), depth = +f[3] || 8;
    let prof = +f[1] || 0, level = parseInt(f[2], 10) || 0, tier = /H$/.test(f[2]) ? 1 : 0, seq = [];
    for (let i = 0; i < data.length;) {
      const h = data[i];
      let j = i + 1 + ((h >> 2) & 1), size = data.length - j;
      if (h & 2) { size = 0; for (let s = 0, b = 128; b & 128; s += 7) { b = data[j++]; size += (b & 127) * 2 ** s; } }
      if (((h >> 3) & 15) === 1) {   // OBU_SEQUENCE_HEADER: profiel en niveau van werkpunt 0
        seq = data.subarray(i, j + size);
        let pos = j * 8;
        const rd = (n) => { let v = 0; while (n--) { v = v * 2 + ((data[pos >> 3] >> (7 - (pos & 7))) & 1); pos++; } return v; };
        prof = rd(3); rd(1);
        if (rd(1)) { level = rd(5); tier = 0; } else if (!rd(1)) { rd(1); rd(5); rd(12); level = rd(5); tier = level > 7 ? rd(1) : 0; }
        break;
      }
      i = j + size;
    }
    return u8([0x81, (prof << 5) | level, (tier << 7) | (depth > 8 ? 64 : 0) | (depth === 12 ? 32 : 0) | 12, 0, ...seq]);
  };
  // OpusHead (RFC 7845): van de encoder, anders zelf opbouwen
  const opusHead = (d, ch, sr) => (d && d.length >= 19 && String.fromCharCode(...d.subarray(0, 8)) === 'OpusHead' ? d
    : W().str('OpusHead').u8(1, ch).le16(312).le32(sr).le16(0).u8(0).get());

  const muxWebm = (r) => {
    const { V, A } = r, defDur = 1e6 / r.fps, col = colors(r.color);
    const vId = r.codec === 'vp8' ? 'V_VP8' : r.codec.startsWith('vp09') ? 'V_VP9' : 'V_AV1';
    const vPriv = r.vDesc || (vId === 'V_AV1' ? av1C(r.codec, V[0].data) : null);
    const colour = col ? E(0x55B0, [col.m != null ? EU(0x55B1, col.m) : [], col.full != null ? EU(0x55B9, col.full ? 2 : 1) : [],
      col.t != null ? EU(0x55BA, col.t) : [], col.p != null ? EU(0x55BB, col.p) : []]) : [];
    const tracks = [E(0xAE, [EU(0xD7, 1), EU(0x73C5, 1), EU(0x83, 1), EU(0x9C, 0), ES(0x22B59C, 'und'), ES(0x86, vId),
      vPriv ? EB(0x63A2, vPriv) : [], EU(0x23E383, Math.round(defDur * 1000)), E(0xE0, [EU(0xB0, r.w), EU(0xBA, r.h), colour])])];
    if (A.length) {
      const ch = r.aCfg.numberOfChannels, oh = opusHead(r.aDesc, ch, r.aCfg.sampleRate);
      tracks.push(E(0xAE, [EU(0xD7, 2), EU(0x73C5, 2), EU(0x83, 2), EU(0x9C, 0), ES(0x22B59C, 'und'), ES(0x86, 'A_OPUS'), EB(0x63A2, oh),
        EU(0x56AA, Math.round((oh[10] | (oh[11] << 8)) / 48000 * 1e9)), EU(0x56BB, 80000000), E(0xE1, [EF(0xB5, 48000), EU(0x9F, ch)])]));
    }
    // Blokken van beide sporen op tijd samenvoegen; nieuw cluster bij elk sleutelbeeld en minstens elke 5 s
    const clusters = [], lastV = V[V.length - 1];
    let cl = null, vi = 0, ai = 0, prevMs = 0;
    while (vi < V.length || ai < A.length) {
      const isV = ai >= A.length || (vi < V.length && V[vi].ts <= A[ai].ts);
      const c = isV ? V[vi++] : A[ai++], ms = Math.max(0, Math.round(c.ts / 1000));
      if (!cl || (isV && c.key) || ms - cl.ms >= 5000 || ms - cl.ms < -30000) { cl = { ms, cue: isV && c.key, kids: [EU(0xE7, ms)] }; clusters.push(cl); }
      const rel = ms - cl.ms;
      // laatste beeld met afwijkende duur (stilstaande dia): BlockGroup met BlockDuration
      if (c === lastV && Math.abs(c.dur - defDur) > 500) cl.kids.push(E(0xA0, [BL(0xA1, 1, rel, 0, c.data), EU(0x9B, Math.round(c.dur / 1000)), c.key ? [] : EI(0xFB, prevMs - ms)]));
      else cl.kids.push(BL(0xA3, isV ? 1 : 2, rel, isV && !c.key ? 0 : 0x80, c.data));
      if (isV) prevMs = ms;
    }
    const end = (S) => S.reduce((m, c) => Math.max(m, c.ts + c.dur), 0);
    const info = E(0x1549A966, [EU(0x2AD7B1, 1000000), EF(0x4489, Math.max(end(V), end(A)) / 1000), ES(0x4D80, 'Doek'), ES(0x5741, 'Doek')]);
    const trk = E(0x1654AE6B, tracks);
    const cued = clusters.filter((c) => c.cue);
    // SeekHead met vaste breedte (8 bytes) zodat zijn lengte vastligt voordat de posities bekend zijn
    const ids = [0x1549A966, 0x1654AE6B].concat(cued.length ? [0x1C53BB6B] : []);
    const seek = (pos) => E(0x114D9B74, ids.map((id, k) => E(0x4DBB, [EB(0x53AB, u8(idB(id))), EU(0x53AC, pos[k] || 0, 8)])));
    const seekLen = len(seek([])), cls = clusters.map((c) => E(0x1F43B675, c.kids));
    let pos = seekLen + len(info) + len(trk);
    clusters.forEach((c, k) => { c.pos = pos; pos += len(cls[k]); });
    const cues = cued.length ? E(0x1C53BB6B, cued.map((c) => E(0xBB, [EU(0xB3, c.ms), E(0xB7, [EU(0xF7, 1), EU(0xF1, c.pos, 8)])]))) : [];
    const body = [seek([seekLen, seekLen + len(info), pos]), info, trk, ...cls, cues].flat();
    const ebml = E(0x1A45DFA3, [EU(0x4286, 1), EU(0x42F7, 1), EU(0x42F2, 4), EU(0x42F3, 8), ES(0x4282, 'webm'), EU(0x4287, 4), EU(0x4285, 2)]);
    return new Blob(pack([...ebml, head(0x18538067, len(body), 8), ...body]), { type: 'video/webm' });
  };

  /* ---------- MP4 (ISO BMFF, moov vóór mdat) ---------- */
  const MATRIX = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
  const box = (type, kids = []) => { const p = kids.flat(); return [W().u32(8 + len(p)).str(type).get(), ...p]; };
  const fbox = (type, v, flags, kids = []) => box(type, [W().u8(v).u24(flags).get(), ...kids]);
  const bin = (f) => { const w = W(); f(w); return w.get(); };
  const runs = (vals) => { const r = []; for (const v of vals) { const l = r[r.length - 1]; if (l && l[1] === v) l[0]++; else r.push([1, v]); } return r; };
  // MPEG-4-descriptor met lengte in 7-bitsgroepen
  const desc = (tag, body) => { const s = []; for (let v = body.length; ; v >>= 7) { s.unshift((v & 127) | (s.length ? 128 : 0)); if (v < 128) break; } return [tag, ...s, ...body]; };
  const be32 = (v) => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const SR = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  // Tijden van een spoor in zijn eigen tijdschaal: decodeertijd, compositieverschuiving, duur per monster
  const timing = (S, scale) => {
    const n = S.length, pts = S.map((s) => Math.round(s.ts * scale / 1e6)), sorted = pts.slice().sort((a, b) => a - b), p0 = sorted[0];
    let shift = 0;
    for (let k = 0; k < n; k++) shift = Math.max(shift, sorted[k] - pts[k]);   // alleen bij B-beelden
    const dts = sorted.map((v) => v - p0);
    for (let k = 1; k < n; k++) if (dts[k] <= dts[k - 1]) dts[k] = dts[k - 1] + 1;
    const dur = dts.map((v, k) => (k < n - 1 ? dts[k + 1] - v : Math.max(1, Math.round(S[k].dur * scale / 1e6))));
    const cto = pts.map((v, k) => Math.max(0, v - p0 + shift - dts[k]));
    let presEnd = 0;
    for (let k = 0; k < n; k++) presEnd = Math.max(presEnd, dts[k] + cto[k] + dur[k]);
    const t = { S, n, scale, dts, dur, cto, mediaDur: dts[n - 1] + dur[n - 1], time: (k) => (dts[k] + p0) / scale };
    // Bewerkingslijst: lege bewerking als het spoor later begint, en/of beginpunt bij compositieverschuiving
    const ms = (v) => Math.round(v / scale * 1000), lead = Math.max(0, -p0);
    t.edits = p0 || shift ? [...(p0 > 0 ? [[ms(p0), -1]] : []), [ms(presEnd - shift - lead), shift + lead]] : [];
    t.tkDur = t.edits.length ? t.edits.reduce((s, e) => s + e[0], 0) : ms(t.mediaDur);
    return t;
  };

  const muxMp4 = (r) => {
    if (!r.vDesc) throw new Error('De H.264-encoder leverde geen configuratie (avcC)');
    const vt = Object.assign(timing(r.V, 90000), { id: 1, video: true }), tracks = [vt];
    if (r.A.length) tracks.push(Object.assign(timing(r.A, r.aCfg.sampleRate), { id: 2 }));
    // Stukken (chunks) per halve seconde, sporen om en om
    const chunks = tracks.map(() => []), order = [], next = tracks.map(() => 0);
    for (;;) {
      let t0 = Infinity;
      tracks.forEach((t, i) => { if (next[i] < t.n) t0 = Math.min(t0, t.time(next[i])); });
      if (!(t0 < Infinity)) break;
      tracks.forEach((t, i) => {
        const first = next[i];
        let bytes = 0;
        while (next[i] < t.n && t.time(next[i]) < t0 + 0.5) bytes += t.S[next[i]++].data.length;
        if (next[i] > first) { const c = { t: i, first, count: next[i] - first, bytes }; chunks[i].push(c); order.push(c); }
      });
    }
    let payload = 0;
    for (const c of order) { c.off = payload; payload += c.bytes; }
    // Sample entries
    const col = colors(r.color);
    const avc1 = box('avc1', [W().zero(6).u16(1).zero(16).u16(r.w).u16(r.h).u32(0x480000).u32(0x480000).u32(0).u16(1).zero(32).u16(0x18).u16(0xFFFF).get(),
      box('avcC', [r.vDesc]), col ? box('colr', [W().str('nclx').u16(col.p ?? 2).u16(col.t ?? 2).u16(col.m ?? 2).u8(col.full ? 0x80 : 0).get()]) : []]);
    const entries = [avc1];
    if (tracks[1]) {
      const at = tracks[1], sr = r.aCfg.sampleRate, ch = r.aCfg.numberOfChannels, si = SR.indexOf(sr);
      const asc = r.aDesc || u8([16 | (si >> 1), ((si & 1) << 7) | (ch << 3)]);
      let total = 0, maxSize = 0;
      for (const s of at.S) { total += s.data.length; maxSize = Math.max(maxSize, s.data.length); }
      const rate = Math.round(total * 8 / Math.max(1e-3, at.mediaDur / sr));
      const es = desc(3, [0, 2, 0, ...desc(4, [0x40, 0x15, maxSize >> 16 & 255, maxSize >> 8 & 255, maxSize & 255, ...be32(rate), ...be32(rate), ...desc(5, [...asc])]), ...desc(6, [2])]);
      entries.push(box('mp4a', [W().zero(6).u16(1).zero(8).u16(ch).u16(16).u32(0).u32((sr > 65535 ? 0 : sr) * 65536).get(), fbox('esds', 0, 0, [u8(es)])]));
    }
    const stbl = (t, i, base, big) => {
      const cl = chunks[i], st = runs(t.dur), sc = [];
      cl.forEach((c, k) => { if (!sc.length || sc[sc.length - 1][1] !== c.count) sc.push([k + 1, c.count]); });
      const kids = [fbox('stsd', 0, 0, [W().u32(1).get(), entries[i]]),
        fbox('stts', 0, 0, [bin((w) => { w.u32(st.length); for (const [c, d] of st) w.u32(c).u32(d); })])];
      if (t.video) kids.push(fbox('stss', 0, 0, [bin((w) => { const k = []; t.S.forEach((s, j) => { if (s.key) k.push(j + 1); }); w.u32(k.length); k.forEach((x) => w.u32(x)); })]));
      if (t.cto.some((v) => v)) { const ct = runs(t.cto); kids.push(fbox('ctts', 0, 0, [bin((w) => { w.u32(ct.length); for (const [c, o] of ct) w.u32(c).u32(o); })])); }
      kids.push(fbox('stsc', 0, 0, [bin((w) => { w.u32(sc.length); for (const [f, c] of sc) w.u32(f).u32(c).u32(1); })]),
        fbox('stsz', 0, 0, [bin((w) => { w.u32(0).u32(t.n); for (const s of t.S) w.u32(s.data.length); })]),
        fbox(big ? 'co64' : 'stco', 0, 0, [bin((w) => { w.u32(cl.length); for (const c of cl) { if (big) w.u64(base + c.off); else w.u32(base + c.off); } })]));
      return box('stbl', kids);
    };
    const v1 = (x) => (x > 0xFFFFFFFF ? 1 : 0);
    const elst = (edits) => {
      const v = edits.some((e) => v1(e[0]) || e[1] > 0x7FFFFFFF) ? 1 : 0;
      return box('edts', [fbox('elst', v, 0, [bin((w) => { w.u32(edits.length); for (const [d, m] of edits) { if (v) w.u64(d).u64(m); else w.u32(d).u32(m); w.u16(1).u16(0); } })])]);
    };
    const trak = (t, i, base, big) => box('trak', [
      fbox('tkhd', v1(t.tkDur), 3, [bin((w) => {
        if (v1(t.tkDur)) w.u64(0).u64(0).u32(t.id).u32(0).u64(t.tkDur); else w.u32(0).u32(0).u32(t.id).u32(0).u32(t.tkDur);
        w.zero(8).u16(0).u16(0).u16(t.video ? 0 : 0x100).u16(0); MATRIX.forEach((m) => w.u32(m)); w.u32(t.video ? r.w * 65536 : 0).u32(t.video ? r.h * 65536 : 0);
      })]),
      t.edits.length ? elst(t.edits) : [],
      box('mdia', [
        fbox('mdhd', v1(t.mediaDur), 0, [bin((w) => { if (v1(t.mediaDur)) w.u64(0).u64(0).u32(t.scale).u64(t.mediaDur); else w.u32(0).u32(0).u32(t.scale).u32(t.mediaDur); w.u16(0x55C4).u16(0); })]),
        fbox('hdlr', 0, 0, [W().u32(0).str(t.video ? 'vide' : 'soun').zero(12).str(t.video ? 'VideoHandler' : 'SoundHandler').u8(0).get()]),
        box('minf', [t.video ? fbox('vmhd', 0, 1, [new Uint8Array(8)]) : fbox('smhd', 0, 0, [new Uint8Array(4)]),
          box('dinf', [fbox('dref', 0, 0, [W().u32(1).get(), fbox('url ', 0, 1)])]), stbl(t, i, base, big)])])]);
    const dur = Math.max(...tracks.map((t) => t.tkDur));
    const moov = (base, big) => box('moov', [fbox('mvhd', v1(dur), 0, [bin((w) => {
      if (v1(dur)) w.u64(0).u64(0).u32(1000).u64(dur); else w.u32(0).u32(0).u32(1000).u32(dur);
      w.u32(0x10000).u16(0x100).zero(10); MATRIX.forEach((m) => w.u32(m)); w.zero(24).u32(tracks.length + 1);
    })]), ...tracks.map((t, i) => trak(t, i, base, big))]);
    const ftyp = box('ftyp', [W().str('isom').u32(0x200).str('isomiso2avc1mp41').get()]);
    // Eerst de grootte van moov bepalen (hangt alleen af van stco/co64), dan de echte stukposities invullen
    let big = false, size = len(moov(0, false));
    if (len(ftyp) + size + 8 + payload > 0xFFFFFFFF) { big = true; size = len(moov(0, true)); }
    const mdat = big ? W().u32(1).str('mdat').u64(16 + payload).get() : W().u32(8 + payload).str('mdat').get();
    const parts = [...ftyp, ...moov(len(ftyp) + size + mdat.length, big), mdat];
    for (const c of order) { const S = tracks[c.t].S; for (let k = c.first; k < c.first + c.count; k++) parts.push(S[k].data); }
    return new Blob(pack(parts), { type: 'video/mp4' });
  };

  /* ---------- Ondersteuning ---------- */
  const support = async (o = {}) => {
    const r = { webm: { vp9: false, vp8: false, av1: false }, mp4: { h264: false }, opus: false, aac: false };
    const w = even(+o.width || 1280), h = even(+o.height || 720), fps = +o.fps || 30, br = autoRate(w, h, fps);
    if (HAS_V) {
      const any = async (kind) => { for (const c of codecsFor(kind, w, h, fps)) if (await isSup(VideoEncoder, vConfig(c, w, h, fps, br))) return true; return false; };
      for (const k of KINDS.webm) r.webm[k] = await any(k);
      r.mp4.h264 = await any('h264');
    }
    if (HAS_A) { r.opus = await isSup(AudioEncoder, aConfig('webm', 48000, 2)); r.aac = await isSup(AudioEncoder, aConfig('mp4', 48000, 2)); }
    return r;
  };

  /* ---------- Opname ---------- */
  const create = async (o = {}) => {
    if (!HAS_V) throw new Error('Video maken wordt niet ondersteund door deze browser');
    const format = o.format == null ? 'webm' : String(o.format).toLowerCase();
    if (!KINDS[format]) throw new Error('Onbekend videoformaat: ' + o.format);
    const fps = clamp(+o.fps || 30, 1, 240);
    const w = even(+o.width), h = even(+o.height);   // even maten: vereist voor H.264, en veilig voor elke speler
    if (!(w >= 2 && h >= 2 && w <= 16384 && h <= 16384)) throw new Error('Ongeldige afmetingen voor de video');
    const bitrate = Math.round(+o.bitrate > 0 ? +o.bitrate : autoRate(w, h, fps));
    const keyEvery = +o.keyEvery > 0 ? +o.keyEvery : 2;
    let cfg = null;
    for (const codec of candidates(format, w, h, fps, o.codec)) {
      const c = vConfig(codec, w, h, fps, bitrate);
      if (await isSup(VideoEncoder, c)) { cfg = c; break; }
    }
    if (!cfg) throw new Error(format === 'mp4' ? 'MP4-video (H.264) maken wordt niet ondersteund door deze browser' : 'WebM-video maken wordt niet ondersteund door deze browser');
    let aCfg = null, audioSkipped = false;
    if (o.audio) {
      const ac = aConfig(format, Math.round(+o.audio.sampleRate || 48000), clamp(Math.round(+o.audio.channels || 2), 1, 2));
      if (HAS_A && await isSup(AudioEncoder, ac)) aCfg = ac; else audioSkipped = true;
    }

    const V = [], A = [], durs = new Map();
    let vDesc = null, color = null, aDesc = null, err = null, closed = false, cancelled = false;
    let nFrames = 0, bytes = 0, lastTs = -1, lastEnd = 0, lastKey = -Infinity, aPos = 0, tmp = null, tctx = null;
    const fail = (e) => { if (!err) err = e instanceof Error ? e : new Error(String((e && e.message) || e)); };
    const check = () => {
      if (cancelled) throw aborted();
      if (err) throw err;
      if (closed) throw new Error('De video is al afgerond');
    };
    const shut = () => { for (const e of [venc, aenc]) if (e && e.state !== 'closed') { try { e.close(); } catch { /* al gesloten */ } } };

    const venc = new VideoEncoder({
      output: (chunk, meta) => {
        const dc = meta && meta.decoderConfig;
        if (dc) { if (dc.description && !vDesc) vDesc = copy(dc.description); if (dc.colorSpace && !color) color = dc.colorSpace; }
        if (format === 'mp4' && !vDesc) return fail(new Error('De H.264-encoder leverde geen configuratie (avcC)'));
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        V.push({ ts: chunk.timestamp, dur: chunk.duration || durs.get(chunk.timestamp) || Math.round(1e6 / fps), key: chunk.type === 'key', data });
        durs.delete(chunk.timestamp);
        bytes += data.length;
      },
      error: fail,
    });
    venc.configure(cfg);
    let aenc = null;
    if (aCfg) {
      aenc = new AudioEncoder({
        output: (chunk, meta) => {
          const dc = meta && meta.decoderConfig;
          if (dc && dc.description && !aDesc) aDesc = copy(dc.description);
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          A.push({ ts: chunk.timestamp, dur: chunk.duration || (format === 'webm' ? 20000 : Math.round(1024 / aCfg.sampleRate * 1e6)), key: true, data });
          bytes += data.length;
        },
        error: fail,
      });
      aenc.configure(aCfg);
    }

    // Hulpcanvas op de videomaat, zwart gemaakt
    const blank = () => {
      if (!tmp) {
        tmp = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
        tctx = tmp.getContext('2d', { alpha: false });
      }
      tctx.fillStyle = '#000';
      tctx.fillRect(0, 0, w, h);
      return tctx;
    };
    // Bron → VideoFrame met de juiste tijd; afwijkende maat via het hulpcanvas (1 pixel verschil: bijsnijden, anders schalen)
    const toFrame = (src, timestamp, duration) => {
      const vf = src instanceof VideoFrame;
      const sw = vf ? src.displayWidth : src.videoWidth || src.naturalWidth || src.width;
      const sh = vf ? src.displayHeight : src.videoHeight || src.naturalHeight || src.height;
      if (sw === w && sh === h) return new VideoFrame(src, { timestamp, duration, alpha: 'discard' });
      const ctx = blank();
      if (Math.abs(sw - w) <= 1 && Math.abs(sh - h) <= 1) ctx.drawImage(src, 0, 0); else ctx.drawImage(src, 0, 0, w, h);
      return new VideoFrame(tmp, { timestamp, duration, alpha: 'discard' });
    };
    const encode = (vf, keyFrame) => {
      durs.set(vf.timestamp, vf.duration);
      try { venc.encode(vf, { keyFrame }); } finally { vf.close(); }
    };

    const frame = async (source, timeSec, durSec) => {
      check();
      if (timeSec == null) timeSec = lastEnd / 1e6;
      const ts = Math.round(timeSec * 1e6);
      if (!(ts >= 0) || ts <= lastTs) throw new Error('Beelden moeten een oplopende tijd hebben');
      const dur = Math.max(1, Math.round((durSec > 0 ? durSec : 1 / fps) * 1e6));
      const key = !nFrames || timeSec - lastKey >= keyEvery - 0.5 / fps;
      const vf = toFrame(source, ts, dur);
      // De video begint altijd op 0 (ook in spelers zonder bewerkingslijsten): zwart tot het eerste beeld
      if (!nFrames && ts > 0) {
        try { blank(); encode(new VideoFrame(tmp, { timestamp: 0, duration: ts, alpha: 'discard' }), true); } catch (e) { vf.close(); throw e; }
      }
      encode(vf, key);
      if (key) lastKey = timeSec;
      lastTs = ts; lastEnd = ts + dur; nFrames++;
      await drain(venc, 8);
      check();
    };

    // PCM in blokken van hoogstens een seconde naar de encoder (P = null: stilte)
    const pcm = async (P, n, skip) => {
      const sr = aCfg.sampleRate, nc = aCfg.numberOfChannels;
      for (let off = 0; off < n; off += sr) {
        check();
        const m = Math.min(sr, n - off), a = skip + off, buf = new Float32Array(m * nc);
        if (P) {
          for (let c = 0; c < nc; c++) {
            const plane = buf.subarray(c * m, c * m + m);
            if (nc === 1 && P.length > 1) { for (let k = 0; k < m; k++) { let s = 0; for (const p of P) s += p[a + k] || 0; plane[k] = s / P.length; } }   // naar mono
            else plane.set(P[Math.min(c, P.length - 1)].subarray(a, a + m));
          }
        }
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: m, numberOfChannels: nc, timestamp: Math.round(aPos / sr * 1e6), data: buf });
        try { aenc.encode(ad); } finally { ad.close(); }
        aPos += m;
        await drain(aenc, 16);
      }
    };
    // Geluid sluit altijd aan: een gat wordt stilte, overlap wordt overgeslagen
    const audio = async (planes, timeSec) => {
      check();
      if (!aenc || !planes || !planes.length) return;
      const P = Array.from(planes, (p) => (p instanceof Float32Array ? p : Float32Array.from(p || [])));
      const sr = aCfg.sampleRate, total = P[0].length;
      let start = timeSec == null ? aPos : Math.round(timeSec * sr), skip = 0;
      if (!Number.isFinite(start) || start < 0) throw new Error('Ongeldige tijd voor het geluid');
      if (start < aPos) { skip = aPos - start; start = aPos; }
      if (skip >= total) return;
      if (start > aPos) await pcm(null, start - aPos, 0);
      await pcm(P, total - skip, skip);
    };

    const finish = async () => {
      check();
      if (!nFrames) throw new Error('Geen beelden om een video van te maken');
      closed = true;
      try {
        await venc.flush();
        if (aenc) await aenc.flush();
      } catch (e) { fail(e); }
      shut();
      if (cancelled) throw aborted();
      if (err) throw err;
      const r = { V, A, w, h, fps, codec: cfg.codec, vDesc, color, aCfg, aDesc };
      const blob = format === 'webm' ? muxWebm(r) : muxMp4(r);
      V.length = 0; A.length = 0;
      return blob;
    };
    const cancel = () => {
      if (cancelled) return;
      cancelled = closed = true;
      shut();
      V.length = 0; A.length = 0; durs.clear();
    };

    return {
      format, codec: cfg.codec, width: w, height: h, fps, bitrate, keyEvery,
      audioCodec: aCfg ? aCfg.codec : null, audioSkipped,
      get frames() { return nFrames; },
      get bytes() { return bytes; },
      frame, audio, finish, cancel,
    };
  };

  App.Video = { support, create };
})();
