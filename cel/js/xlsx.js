/* =========================================================
   Cel (gemaakt door JJ van Schelven) — echte .xlsx (Office Open XML): opslaan en openen
   Opslaan: waarden, formules, opmaak, kolombreedten, rijhoogten,
   samengevoegde cellen, titels blokkeren, filters, voorwaardelijke
   opmaak, gegevensvalidatie, koppelingen, notities, afbeeldingen,
   vormen, tekstvakken, grafieken, namen en pagina-instelling.
   ========================================================= */
'use strict';

App.JSZIP = 'vendor/jszip.min.js';   // lokaal meegeleverd (MIT), zie DERDEN-LICENTIES.md in de map erboven
App.Xlsx = {};

(() => {
  const F = App.F, NF = App.NF;
  const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const EMU = 9525;
  const loadZip = async () => window.JSZip || (await App.loadScript(App.JSZIP), window.JSZip);
  const rgb = (c) => { if (!c) return null; c = App.cssToHex ? App.cssToHex(c) || c : c; return 'FF' + String(c).replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6); };
  const BUILTIN_FMT = { General: 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '# ?/?': 12, '# ??/??': 13, 'd-m-yyyy': 14, 'd-mmm-yy': 15, 'd-mmm': 16, 'mmm-yy': 17, 'h:mm AM/PM': 18, 'h:mm:ss AM/PM': 19, 'h:mm': 20, 'h:mm:ss': 21, 'd-m-yyyy h:mm': 22, 'mm:ss': 45, '[h]:mm:ss': 46, 'mm:ss.0': 47, '##0.0E+0': 48, '@': 49 };
  const BUILTIN_BACK = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 5: '"€" #,##0;"€" -#,##0', 6: '"€" #,##0;[Red]"€" -#,##0', 7: '"€" #,##0.00;"€" -#,##0.00', 8: '"€" #,##0.00;[Red]"€" -#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'd-m-yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'd-m-yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 44: '_ "€" * #,##0.00_ ;_ "€" * -#,##0.00_ ;_ "€" * "-"??_ ;_ @_ ', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@' };
  const PAPER_ID = { Letter: 1, Legal: 5, A3: 8, A4: 9, A5: 11 };
  const PAPER_BACK = { 1: 'Letter', 5: 'Legal', 8: 'A3', 9: 'A4', 11: 'A5' };
  const SHAPE_PRST = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', arrow: 'rightArrow', star: 'star5', hexagon: 'hexagon', line: 'line', callout: 'wedgeRectCallout' };
  const OPS = { gt: 'greaterThan', lt: 'lessThan', between: 'between', eq: 'equal' };
  const DV_OPS = { between: 'between', notBetween: 'notBetween', eq: 'equal', ne: 'notEqual', gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual' };
  const qSheet = (n) => "'" + n.replace(/'/g, "''") + "'";

  // Formule zoals Excel hem wil: nieuwere functies met _xlfn.
  const xlFormula = (canon) => {
    const toks = F.tokenize(canon, 'en');
    const usesParams = toks.some((t) => t.t === 'fn' && (t.v === 'LET' || t.v === 'LAMBDA'));
    const names = new Set(Object.keys(App.book.names).map((n) => n.toUpperCase()));
    return F.untokenize(toks.map((t) => {
      if (t.t === 'fn' && App.FN_XLWS && App.FN_XLWS.has(t.v)) return { ...t, v: '_xlfn._xlws.' + t.v };
      if (t.t === 'fn' && App.FN_XLFN.has(t.v)) return { ...t, v: '_xlfn.' + t.v };
      if (t.t === 'fn' && !App.FN[t.v] && usesParams) return { ...t, v: '_xlpm.' + t.v };
      if (t.t === 'name' && usesParams && !names.has(t.v.toUpperCase())) return { ...t, v: '_xlpm.' + t.v };
      return t;
    }), 'en');
  };

  /* ============================== OPSLAAN ============================== */
  App.Xlsx.build = async () => {
    const JSZip = await loadZip();
    const zip = new JSZip();
    const book = App.book;
    const sheets = book.sheets;
    // ---- stijlen ----
    const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/></font>'];
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const numFmts = [];
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const dxfs = [];
    const idx = (list, xml) => { let i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
    const fmtId = (nf) => {
      if (!nf || nf === 'General') return 0;
      if (BUILTIN_FMT[nf] !== undefined) return BUILTIN_FMT[nf];
      let i = numFmts.findIndex((x) => x.code === nf);
      if (i < 0) { numFmts.push({ id: 164 + numFmts.length, code: nf }); i = numFmts.length - 1; }
      return numFmts[i].id;
    };
    const fontXml = (st, link) => `<font>${st.b ? '<b/>' : ''}${st.i ? '<i/>' : ''}${st.s ? '<strike/>' : ''}${st.u || link ? `<u${st.u === 'double' ? ' val="double"' : ''}/>` : ''}<sz val="${st.size || 11}"/>${st.color || link ? `<color rgb="${rgb(st.color || '#0563c1')}"/>` : '<color theme="1"/>'}<name val="${X(st.font || 'Aptos Narrow')}"/><family val="2"/></font>`;
    const bside = (tag, v) => (v ? `<${tag} style="${X(v[0] || 'thin')}"><color rgb="${rgb(v[1] || '#000000')}"/></${tag}>` : `<${tag}/>`);
    const xfCache = new Map();
    const xfOf = (st, link) => {
      if (!st || (!Object.keys(st).length && !link)) return 0;
      const key = JSON.stringify(st) + (link ? 'L' : '');
      if (xfCache.has(key)) return xfCache.get(key);
      const fontId = st.b || st.i || st.s || st.u || st.size || st.font || st.color || link ? idx(fonts, fontXml(st, link)) : 0;
      const fillId = st.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${rgb(st.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      const bd = st.bd || {};
      const borderId = Object.keys(bd).length ? idx(borders, `<border${bd.d ? ' diagonalDown="1"' : ''}${bd.u ? ' diagonalUp="1"' : ''}>${bside('left', bd.l)}${bside('right', bd.r)}${bside('top', bd.t)}${bside('bottom', bd.b)}${bside('diagonal', bd.d || bd.u)}</border>`) : 0;
      const nfId = fmtId(st.nf);
      const al = [];
      if (st.ha) al.push(`horizontal="${{ left: 'left', center: 'center', right: 'right', fill: 'fill', justify: 'justify', centerContinuous: 'centerContinuous', distributed: 'distributed' }[st.ha] || 'general'}"`);
      if (st.va) al.push(`vertical="${{ top: 'top', middle: 'center', center: 'center', bottom: 'bottom' }[st.va] || 'bottom'}"`);
      if (st.wrap) al.push('wrapText="1"');
      if (st.ind) al.push(`indent="${st.ind}"`);
      if (st.rot) al.push(`textRotation="${st.rot > 0 ? st.rot : 90 - st.rot}"`);
      const prot = st.unlocked ? '<protection locked="0"/>' : '';
      const xml = `<xf numFmtId="${nfId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${nfId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${al.length ? ' applyAlignment="1"' : ''}${prot ? ' applyProtection="1"' : ''}>${al.length ? `<alignment ${al.join(' ')}/>` : ''}${prot}</xf>`;
      const i = idx(xfs, xml);
      xfCache.set(key, i);
      return i;
    };
    const dxfOf = (st) => idx(dxfs, `<dxf>${st.b || st.color ? `<font>${st.b ? '<b/>' : ''}${st.color ? `<color rgb="${rgb(st.color)}"/>` : ''}</font>` : ''}${st.fill ? `<fill><patternFill><bgColor rgb="${rgb(st.fill)}"/></patternFill></fill>` : ''}</dxf>`);
    // ---- gedeelde teksten ----
    const sst = [], sstIdx = new Map();
    let sstCount = 0;
    const si = (s) => { sstCount++; if (sstIdx.has(s)) return sstIdx.get(s); sstIdx.set(s, sst.length); sst.push(s); return sst.length - 1; };
    // ---- per blad ----
    const ct = [];   // extra content types
    const wbRels = [];
    const definedNames = [];
    let mediaN = 0, chartN = 0, drawN = 0, commentN = 0;
    const mediaDone = new Map();
    sheets.forEach((sh, si0) => {
      const n = si0 + 1;
      const rels = [];
      const relId = () => 'rId' + (rels.length + 1);
      let xml = XML_HEAD + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">`;
      const fit = sh.page.fitW > 0;
      if (sh.tab || fit || sh.filter) xml += `<sheetPr${sh.filter ? ' filterMode="' + (Object.keys(sh.filter.crit || {}).length ? 1 : 0) + '"' : ''}>${sh.tab ? `<tabColor rgb="${rgb(sh.tab)}"/>` : ''}${fit ? '<pageSetUpPr fitToPage="1"/>' : ''}</sheetPr>`;
      const ur = App.usedRange(sh, true);
      xml += `<dimension ref="${ur ? App.rangeStr(ur) : 'A1'}"/>`;
      const s = sh.sel;
      const fr = sh.freeze.r || 0, fc = sh.freeze.c || 0;
      xml += `<sheetViews><sheetView workbookViewId="0"${si0 === book.active ? ' tabSelected="1"' : ''}${sh.grid ? '' : ' showGridLines="0"'}${sh.heads ? '' : ' showRowColHeaders="0"'}${(sh.zoom || 1) !== 1 ? ` zoomScale="${Math.round(sh.zoom * 100)}" zoomScaleNormal="${Math.round(sh.zoom * 100)}"` : ''}>`;
      if (fr || fc) {
        const pane = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
        xml += `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${App.addr(fr, fc)}" activePane="${pane}" state="frozen"/><selection pane="${pane}" activeCell="${App.addr(s.ar, s.ac)}" sqref="${s.ranges.map(App.rangeStr).join(' ')}"/>`;
      } else xml += `<selection activeCell="${App.addr(s.ar, s.ac)}" sqref="${s.ranges.map(App.rangeStr).join(' ')}"/>`;
      xml += '</sheetView></sheetViews>';
      xml += `<sheetFormatPr defaultRowHeight="${+(sh.defH * 0.75).toFixed(2)}"${sh.defW !== App.DEF_W ? ` defaultColWidth="${+((sh.defW - 5) / 7).toFixed(2)}"` : ''}/>`;
      // kolommen
      const colKeys = new Set([...Object.keys(sh.colW), ...Object.keys(sh.hidC), ...Object.keys(sh.colS)].map(Number));
      if (colKeys.size) {
        xml += '<cols>' + Array.from(colKeys).sort((a, b) => a - b).filter((c) => c < App.MAXC).map((c) => {
          const w = sh.colW[c] ?? sh.defW;
          const st = sh.colS[c];
          return `<col min="${c + 1}" max="${c + 1}" width="${+((w - 5) / 7 + 0.71).toFixed(2)}"${sh.colW[c] !== undefined ? ' customWidth="1"' : ''}${sh.hidC[c] ? ' hidden="1"' : ''}${st && Object.keys(st).length ? ` style="${xfOf(st)}"` : ''}/>`;
        }).join('') + '</cols>';
      }
      // gegevens
      // overgelopen waarden van matrixformules worden als gewone waarden opgeslagen
      const spillVals = new Map();
      App.eachCell(sh, (r, c, cell) => {
        if (!cell.f || !cell.sp) return;
        for (let i = 0; i < cell.sp.h; i++) for (let j = 0; j < cell.sp.w; j++) {
          if (!i && !j) continue;
          let m = spillVals.get(r + i); if (!m) { m = new Map(); spillVals.set(r + i, m); }
          m.set(c + j, cell.sp.vals[i][j]);
        }
      });
      const rowKeys = new Set([...spillVals.keys(), ...sh.data.keys(), ...Object.keys(sh.rowH).map(Number), ...Object.keys(sh.hidR).map(Number), ...Object.keys(sh.fhid).map(Number), ...Object.keys(sh.rowS).map(Number)]);
      xml += '<sheetData>';
      Array.from(rowKeys).sort((a, b) => a - b).forEach((r) => {
        if (r >= App.MAXR) return;
        const row = sh.data.get(r);
        const rs = sh.rowS[r];
        const attrs = `r="${r + 1}"${sh.rowH[r] !== undefined ? ` ht="${+(sh.rowH[r] * 0.75).toFixed(2)}" customHeight="1"` : ''}${sh.hidR[r] || sh.fhid[r] ? ' hidden="1"' : ''}${rs && Object.keys(rs).length ? ` s="${xfOf(rs)}" customFormat="1"` : ''}`;
        let cells = '';
        const sv = spillVals.get(r);
        const colsHere = new Set([...(row ? row.keys() : []), ...(sv ? sv.keys() : [])]);
        Array.from(colsHere).sort((a, b) => a - b).forEach((c) => {
          let cell = row && row.get(c);
          if (sv && sv.has(c) && F.isEmptyCell(cell)) cell = { ...(cell || {}), v: sv.get(c) && sv.get(c).err ? sv.get(c).err : sv.get(c) };
          if (!cell) return;
          const st = App.styleAt(sh, r, c, cell);
          const sIdx = xfOf(st, !!cell.l);
          const ref = App.addr(r, c);
          const sAttr = sIdx ? ` s="${sIdx}"` : '';
          if (cell.f) {
            const v = cell.cv;
            const fx = cell.sp ? `<f t="array" ref="${App.rangeStr({ r1: r, c1: c, r2: r + cell.sp.h - 1, c2: c + cell.sp.w - 1 })}">${X(xlFormula(cell.f))}</f>` : `<f>${X(xlFormula(cell.f))}</f>`;
            if (typeof v === 'number') cells += `<c r="${ref}"${sAttr}>${fx}<v>${v}</v></c>`;
            else if (typeof v === 'boolean') cells += `<c r="${ref}"${sAttr} t="b">${fx}<v>${v ? 1 : 0}</v></c>`;
            else if (v && v.err) cells += `<c r="${ref}"${sAttr} t="e">${fx}<v>${X(v.err)}</v></c>`;
            else cells += `<c r="${ref}"${sAttr} t="str">${fx}<v>${X(v ?? '')}</v></c>`;
            return;
          }
          const v = cell.v;
          if (v === undefined || v === null || v === '') { cells += `<c r="${ref}"${sAttr}/>`; return; }
          if (typeof v === 'number') cells += `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
          else if (typeof v === 'boolean') cells += `<c r="${ref}"${sAttr} t="b"><v>${v ? 1 : 0}</v></c>`;
          else cells += `<c r="${ref}"${sAttr} t="s"><v>${si(String(v))}</v></c>`;
        });
        xml += `<row ${attrs}>${cells}</row>`;
      });
      xml += '</sheetData>';
      if (sh.protect) xml += '<sheetProtection sheet="1" objects="1" scenarios="1"/>';
      // filter
      if (sh.filter) {
        const f = sh.filter;
        const ref = App.rangeStr({ r1: f.r, c1: f.c1, r2: Math.max(f.r2 ?? f.r, f.r), c2: f.c2 });
        xml += `<autoFilter ref="${ref}">`;
        Object.entries(f.crit || {}).forEach(([c, cr]) => {
          if (!cr || !cr.values) return;
          xml += `<filterColumn colId="${+c - f.c1}"><filters${cr.values.includes('') ? ' blank="1"' : ''}>${cr.values.filter((v) => v !== '').map((v) => `<filter val="${X(v)}"/>`).join('')}</filters></filterColumn>`;
        });
        xml += '</autoFilter>';
        definedNames.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${si0}" hidden="1">${X(qSheet(sh.name) + '!' + App.absRangeStr({ r1: f.r, c1: f.c1, r2: Math.max(f.r2 ?? f.r, f.r), c2: f.c2 }))}</definedName>`);
      }
      if (sh.merges.length) xml += `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${App.rangeStr(m)}"/>`).join('')}</mergeCells>`;
      // voorwaardelijke opmaak
      let prio = 1;
      sh.cf.forEach((rule) => {
        const sq = rule.ranges.map(App.rangeStr).join(' ');
        const tl = App.addr(rule.ranges[0].r1, rule.ranges[0].c1);
        const val = (v) => { if (v === undefined || v === null || v === '') return '0'; const s2 = String(v); if (s2[0] === '=') return X(xlFormula(F.toCanon(s2.slice(1)))); const p = NF.parseInput(s2); return typeof p.v === 'number' ? String(p.v) : X('"' + s2.replace(/"/g, '""') + '"'); };
        let r = '';
        const dxf = rule.style ? ` dxfId="${dxfOf(rule.style)}"` : '';
        switch (rule.type) {
          case 'gt': case 'lt': case 'eq': r = `<cfRule type="cellIs"${dxf} priority="${prio}" operator="${OPS[rule.type]}"><formula>${val(rule.v1)}</formula></cfRule>`; break;
          case 'between': r = `<cfRule type="cellIs"${dxf} priority="${prio}" operator="between"><formula>${val(rule.v1)}</formula><formula>${val(rule.v2)}</formula></cfRule>`; break;
          case 'text': r = `<cfRule type="containsText"${dxf} priority="${prio}" operator="containsText" text="${X(rule.v1)}"><formula>NOT(ISERROR(SEARCH("${X(String(rule.v1).replace(/"/g, '""'))}",${tl})))</formula></cfRule>`; break;
          case 'dup': r = `<cfRule type="duplicateValues"${dxf} priority="${prio}"/>`; break;
          case 'uniq': r = `<cfRule type="uniqueValues"${dxf} priority="${prio}"/>`; break;
          case 'top': case 'bottom': r = `<cfRule type="top10"${dxf} priority="${prio}" rank="${rule.rank || 10}"${rule.pct ? ' percent="1"' : ''}${rule.type === 'bottom' ? ' bottom="1"' : ''}/>`; break;
          case 'above': case 'below': r = `<cfRule type="aboveAverage"${dxf} priority="${prio}"${rule.type === 'below' ? ' aboveAverage="0"' : ''}/>`; break;
          case 'formula': r = `<cfRule type="expression"${dxf} priority="${prio}"><formula>${X(xlFormula(rule.f))}</formula></cfRule>`; break;
          case 'bar': r = `<cfRule type="dataBar" priority="${prio}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${rgb(rule.color)}"/></dataBar></cfRule>`; break;
          case 'icons': r = `<cfRule type="iconSet" priority="${prio}"><iconSet iconSet="${{ arrows: '3Arrows', traffic: '3TrafficLights1', symbols: '3Symbols', flags: '3Flags', stars: '3Stars' }[rule.set] || '3Arrows'}"${rule.reverse ? ' reverse="1"' : ''}><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>`; break;
          case 'scale': r = `<cfRule type="colorScale" priority="${prio}"><colorScale><cfvo type="min"/>${rule.colors.length === 3 ? '<cfvo type="percentile" val="50"/>' : ''}<cfvo type="max"/>${rule.colors.map((c) => `<color rgb="${rgb(c)}"/>`).join('')}</colorScale></cfRule>`; break;
          default: break;
        }
        if (r) { xml += `<conditionalFormatting sqref="${sq}">${r}</conditionalFormatting>`; prio++; }
      });
      // validatie
      if (sh.dv.length) {
        xml += `<dataValidations count="${sh.dv.length}">` + sh.dv.map((rule) => {
          const type = { whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', time: 'time', length: 'textLength' }[rule.type];
          const fval = (v) => { const s2 = String(v ?? ''); if (s2[0] === '=') return X(xlFormula(F.toCanon(s2.slice(1)))); const p = NF.parseInput(s2); return typeof p.v === 'number' ? String(p.v) : X(s2); };
          let f = '';
          if (rule.type === 'list') f = rule.list[0] === '=' ? `<formula1>${X(xlFormula(F.toCanon(rule.list.slice(1))))}</formula1>` : `<formula1>${X('"' + rule.list.split(/[;,]/).map((x) => x.trim()).join(',') + '"')}</formula1>`;
          else if (type) f = `<formula1>${fval(rule.v1)}</formula1>${['between', 'notBetween'].includes(rule.op) ? `<formula2>${fval(rule.v2)}</formula2>` : ''}`;
          return `<dataValidation${type ? ` type="${type}"` : ''}${type && rule.type !== 'list' ? ` operator="${DV_OPS[rule.op] || 'between'}"` : ''}${rule.style && rule.style !== 'stop' ? ` errorStyle="${rule.style === 'info' ? 'information' : 'warning'}"` : ''}${rule.blank !== false ? ' allowBlank="1"' : ''}${rule.type === 'list' && rule.inCell === false ? ' showDropDown="1"' : ''} showInputMessage="1" showErrorMessage="1"${rule.errTitle ? ` errorTitle="${X(rule.errTitle)}"` : ''}${rule.err ? ` error="${X(rule.err)}"` : ''}${rule.msgTitle ? ` promptTitle="${X(rule.msgTitle)}"` : ''}${rule.msg ? ` prompt="${X(rule.msg)}"` : ''} sqref="${rule.ranges.map(App.rangeStr).join(' ')}">${f}</dataValidation>`;
        }).join('') + '</dataValidations>';
      }
      // koppelingen
      const links = [];
      App.eachCell(sh, (r, c, cell) => { if (cell.l) links.push({ r, c, l: cell.l }); });
      if (links.length) {
        xml += '<hyperlinks>' + links.map((h) => {
          if (h.l[0] === '#') return `<hyperlink ref="${App.addr(h.r, h.c)}" location="${X(h.l.slice(1))}" display="${X(h.l.slice(1))}"/>`;
          const id = relId(); rels.push(`<Relationship Id="${id}" Type="${REL}hyperlink" Target="${X(h.l)}" TargetMode="External"/>`);
          return `<hyperlink ref="${App.addr(h.r, h.c)}" r:id="${id}"/>`;
        }).join('') + '</hyperlinks>';
      }
      const p = sh.page;
      if (p.grid || p.heads || p.center) xml += `<printOptions${p.center ? ' horizontalCentered="1"' : ''}${p.heads ? ' headings="1"' : ''}${p.grid ? ' gridLines="1"' : ''}/>`;
      const inch = (cm) => +(cm / 2.54).toFixed(3);
      xml += `<pageMargins left="${inch(p.margins.l)}" right="${inch(p.margins.r)}" top="${inch(p.margins.t)}" bottom="${inch(p.margins.b)}" header="0.3" footer="0.3"/>`;
      xml += `<pageSetup paperSize="${PAPER_ID[p.size] || 9}" orientation="${p.orient === 'landscape' ? 'landscape' : 'portrait'}"${p.scale && p.scale !== 100 && !fit ? ` scale="${p.scale}"` : ''}${fit ? ` fitToWidth="${p.fitW}" fitToHeight="0"` : ''}/>`;
      const hfx = (t) => { if (!t) return ''; const [a = '', b = '', c = ''] = t.split('|'); const conv = (x) => x.replace(/&\[Pagina\]/g, '&P').replace(/&\[Pagina's\]/g, '&N').replace(/&\[Datum\]/g, '&D').replace(/&\[Tijd\]/g, '&T').replace(/&\[Bestand\]/g, '&F').replace(/&\[Blad\]/g, '&A'); return X((a ? '&L' + conv(a) : '') + (b ? '&C' + conv(b) : '') + (c ? '&R' + conv(c) : '')); };
      if (p.header || p.footer) xml += `<headerFooter>${p.header ? `<oddHeader>${hfx(p.header)}</oddHeader>` : ''}${p.footer ? `<oddFooter>${hfx(p.footer)}</oddFooter>` : ''}</headerFooter>`;
      // tekening: afbeeldingen, vormen, grafieken
      const objs = sh.objs.filter((o) => o.type !== 'image' || /^data:image\/(png|jpe?g|gif)/.test(App.media[o.media] || ''));
      if (objs.length) {
        drawN++;
        const dRels = [];
        let dx = XML_HEAD + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + NS_R + '" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">';
        objs.forEach((o, k) => {
          const from = `<xdr:from><xdr:col>${o.c}</xdr:col><xdr:colOff>${Math.round((o.dx || 0) * EMU)}</xdr:colOff><xdr:row>${o.r}</xdr:row><xdr:rowOff>${Math.round((o.dy || 0) * EMU)}</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(o.w * EMU)}" cy="${Math.round(o.h * EMU)}"/>`;
          const id = k + 2;
          if (o.type === 'image') {
            const url = App.media[o.media];
            let file = mediaDone.get(url);
            if (!file) {
              const m = /^data:image\/(png|jpe?g|gif);base64,(.*)$/.exec(url);
              const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
              mediaN++; file = `image${mediaN}.${ext}`;
              zip.file('xl/media/' + file, m[2], { base64: true });
              mediaDone.set(url, file);
            }
            const rid = 'rId' + (dRels.length + 1);
            dRels.push(`<Relationship Id="${rid}" Type="${REL}image" Target="../media/${file}"/>`);
            dx += `<xdr:oneCellAnchor>${from}<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Afbeelding ${k + 1}" descr="${X(o.alt || '')}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(o.w * EMU)}" cy="${Math.round(o.h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
          } else if (o.type === 'shape' || o.type === 'textbox') {
            const prst = o.type === 'textbox' ? 'rect' : SHAPE_PRST[o.shape] || 'rect';
            const fill = o.type === 'textbox' ? '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>' : o.fill && o.fill !== 'none' ? `<a:solidFill><a:srgbClr val="${rgb(o.fill).slice(2)}"/></a:solidFill>` : '<a:noFill/>';
            const ln = `<a:ln w="12700"><a:solidFill><a:srgbClr val="${o.type === 'textbox' ? '8A8A8A' : rgb(o.stroke || '#0f4761').slice(2)}"/></a:solidFill></a:ln>`;
            const text = o.text ? `<xdr:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="${o.type === 'textbox' ? 't' : 'ctr'}"/><a:lstStyle/>${String(o.text).split('\n').map((ln2) => `<a:p>${o.type === 'shape' ? '<a:pPr algn="ctr"/>' : ''}<a:r><a:rPr lang="nl-NL" sz="1100">${o.type === 'shape' ? '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>' : '<a:solidFill><a:srgbClr val="222222"/></a:solidFill>'}</a:rPr><a:t>${X(ln2)}</a:t></a:r></a:p>`).join('')}</xdr:txBody>` : '';
            dx += `<xdr:oneCellAnchor>${from}<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${o.type === 'textbox' ? 'Tekstvak' : 'Vorm'} ${k + 1}"/><xdr:cNvSpPr${o.type === 'textbox' ? ' txBox="1"' : ''}/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(o.w * EMU)}" cy="${Math.round(o.h * EMU)}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill}${ln}</xdr:spPr>${text}</xdr:sp><xdr:clientData/></xdr:oneCellAnchor>`;
          } else if (o.type === 'chart') {
            chartN++;
            zip.file(`xl/charts/chart${chartN}.xml`, chartXml(o, sh));
            ct.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
            const rid = 'rId' + (dRels.length + 1);
            dRels.push(`<Relationship Id="${rid}" Type="${REL}chart" Target="../charts/chart${chartN}.xml"/>`);
            dx += `<xdr:oneCellAnchor>${from}<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Grafiek ${k + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`;
          }
        });
        dx += '</xdr:wsDr>';
        zip.file(`xl/drawings/drawing${drawN}.xml`, dx);
        if (dRels.length) zip.file(`xl/drawings/_rels/drawing${drawN}.xml.rels`, XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dRels.join('')}</Relationships>`);
        ct.push(`<Override PartName="/xl/drawings/drawing${drawN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        const id = relId(); rels.push(`<Relationship Id="${id}" Type="${REL}drawing" Target="../drawings/drawing${drawN}.xml"/>`);
        xml += `<drawing r:id="${id}"/>`;
      }
      // notities
      const notes = []; App.eachCell(sh, (r, c, cell) => { if (cell.n) notes.push({ r, c, n: cell.n }); });
      if (notes.length) {
        commentN++;
        zip.file(`xl/comments${commentN}.xml`, XML_HEAD + `<comments xmlns="${NS_MAIN}"><authors><author>Cel</author></authors><commentList>${notes.map((x) => `<comment ref="${App.addr(x.r, x.c)}" authorId="0"><text><r><rPr><sz val="9"/><color indexed="81"/><rFont val="Tahoma"/><family val="2"/></rPr><t xml:space="preserve">${X(x.n)}</t></r></text></comment>`).join('')}</commentList></comments>`);
        let vml = '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="' + commentN + '"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>';
        notes.forEach((x, k) => {
          vml += `<v:shape id="_x0000_s${commentN * 1024 + k + 1}" type="#_x0000_t202" style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;width:108pt;height:59.25pt;z-index:${k + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${x.c + 1}, 15, ${x.r}, 2, ${x.c + 3}, 15, ${x.r + 4}, 16</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${x.r}</x:Row><x:Column>${x.c}</x:Column></x:ClientData></v:shape>`;
        });
        vml += '</xml>';
        zip.file(`xl/drawings/vmlDrawing${commentN}.vml`, vml);
        const a = relId(); rels.push(`<Relationship Id="${a}" Type="${REL}comments" Target="../comments${commentN}.xml"/>`);
        const b = relId(); rels.push(`<Relationship Id="${b}" Type="${REL}vmlDrawing" Target="../drawings/vmlDrawing${commentN}.vml"/>`);
        ct.push(`<Override PartName="/xl/comments${commentN}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
        xml += `<legacyDrawing r:id="${b}"/>`;
      }
      xml += '</worksheet>';
      zip.file(`xl/worksheets/sheet${n}.xml`, xml);
      if (rels.length) zip.file(`xl/worksheets/_rels/sheet${n}.xml.rels`, XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
      wbRels.push(`<Relationship Id="rId${n}" Type="${REL}worksheet" Target="worksheets/sheet${n}.xml"/>`);
      if (sh.printArea) definedNames.push(`<definedName name="_xlnm.Print_Area" localSheetId="${si0}">${X(qSheet(sh.name) + '!' + App.absRangeStr(sh.printArea))}</definedName>`);
      if (sh.printTitles) { const [a, b] = sh.printTitles.split(':'); definedNames.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${si0}">${X(qSheet(sh.name) + '!$' + a + ':$' + (b || a))}</definedName>`); }
    });
    Object.entries(book.names).forEach(([n, f]) => definedNames.push(`<definedName name="${X(n)}">${X(xlFormula(f.replace(/^=/, '')))}</definedName>`));
    const N = sheets.length;
    zip.file('xl/workbook.xml', XML_HEAD + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView activeTab="${book.active}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${X(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>${definedNames.length ? `<definedNames>${definedNames.join('')}</definedNames>` : ''}<calcPr calcId="191029"${book.calc === 'manual' ? ' calcMode="manual"' : ''} fullCalcOnLoad="1"/></workbook>`);
    wbRels.push(`<Relationship Id="rId${N + 1}" Type="${REL}styles" Target="styles.xml"/>`, `<Relationship Id="rId${N + 2}" Type="${REL}sharedStrings" Target="sharedStrings.xml"/>`);
    zip.file('xl/_rels/workbook.xml.rels', XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>`);
    zip.file('xl/sharedStrings.xml', XML_HEAD + `<sst xmlns="${NS_MAIN}" count="${sstCount}" uniqueCount="${sst.length}">${sst.map((s) => `<si><t xml:space="preserve">${X(s)}</t></si>`).join('')}</sst>`);
    zip.file('xl/styles.xml', XML_HEAD + `<styleSheet xmlns="${NS_MAIN}">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map((f) => `<numFmt numFmtId="${f.id}" formatCode="${X(f.code)}"/>`).join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Standaard" xfId="0" builtinId="0"/></cellStyles>${dxfs.length ? `<dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs>` : '<dxfs count="0"/>'}</styleSheet>`);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', XML_HEAD + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(book.title)}</dc:title><dc:creator>Cel</dc:creator><cp:lastModifiedBy>Cel</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(book.created || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Cel — gemaakt door JJ van Schelven</Application><Company>Cel (JJ van Schelven)</Company></Properties>');
    zip.file('_rels/.rels', XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file('[Content_Types].xml', XML_HEAD + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${ct.join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  };

  /* Grafiek als DrawingML */
  const chartXml = (o, sh) => {
    const ch = o.chart;
    const toks = F.tokenize(ch.range || '', 'en').filter((t) => t.t === 'ref');
    const t = toks[0];
    const dsh = t && (t.sheet ? App.sheetByName(t.sheet) : sh);
    const pal = App.CHART_PALETTES[ch.palette || 0] || App.CHART_PALETTES[0];
    const data = App.chartData(o, sh) || { cats: [], series: [] };
    const kind = ch.kind || 'column';
    let series = [];
    if (t && dsh) {
      const g = F.boundRef({ sh: dsh, r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2, ref: true });
      const nm = qSheet(dsh.name) + '!';
      const isText = (r, c) => typeof F.cellValue(dsh, r, c) === 'string';
      // zelfde kop-herkenning als bij tekenen
      let headRow, headCol;
      if (!ch.byRow) {
        headRow = g.r2 > g.r1 && (Array.from({ length: g.c2 - g.c1 }, (_, k) => isText(g.r1, g.c1 + 1 + k)).some(Boolean));
        headCol = g.c2 > g.c1 && (Array.from({ length: g.r2 - g.r1 + 1 - (headRow ? 1 : 0) }, (_, k) => isText(g.r1 + (headRow ? 1 : 0) + k, g.c1)).some(Boolean) || kind === 'scatter');
        const r0 = g.r1 + (headRow ? 1 : 0);
        for (let c = g.c1 + (headCol ? 1 : 0); c <= g.c2; c++) series.push({ tx: headRow ? nm + App.absRangeStr({ r1: g.r1, c1: c, r2: g.r1, c2: c }) : null, cat: headCol ? nm + App.absRangeStr({ r1: r0, c1: g.c1, r2: g.r2, c2: g.c1 }) : null, val: nm + App.absRangeStr({ r1: r0, c1: c, r2: g.r2, c2: c }) });
      } else {
        headCol = g.c2 > g.c1 && Array.from({ length: g.r2 - g.r1 }, (_, k) => isText(g.r1 + 1 + k, g.c1)).some(Boolean);
        headRow = g.r2 > g.r1 && Array.from({ length: g.c2 - g.c1 + 1 - (headCol ? 1 : 0) }, (_, k) => isText(g.r1, g.c1 + (headCol ? 1 : 0) + k)).some(Boolean);
        const c0 = g.c1 + (headCol ? 1 : 0);
        for (let r = g.r1 + (headRow ? 1 : 0); r <= g.r2; r++) series.push({ tx: headCol ? nm + App.absRangeStr({ r1: r, c1: g.c1, r2: r, c2: g.c1 }) : null, cat: headRow ? nm + App.absRangeStr({ r1: g.r1, c1: c0, r2: g.r1, c2: g.c2 }) : null, val: nm + App.absRangeStr({ r1: r, c1: c0, r2: r, c2: g.c2 }) });
      }
    }
    series = series.slice(0, Math.max(1, data.series.length));
    const strCache = (arr) => `<c:strCache><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = (arr) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${arr.length}"/>${arr.map((v, i) => (v === null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache>`;
    const pie = kind === 'pie' || kind === 'doughnut';
    const serXml = series.map((s, k) => {
      const d = data.series[k] || { name: '', vals: [] };
      const color = pal[k % pal.length].slice(1).toUpperCase();
      const sp = kind === 'line' || kind === 'scatter' ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>` : pie ? '' : `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>`;
      const dpts = pie ? data.cats.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${pal[i % pal.length].slice(1).toUpperCase()}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('') : '';
      const tx = s.tx ? `<c:tx><c:strRef><c:f>${X(s.tx)}</c:f>${strCache([d.name])}</c:strRef></c:tx>` : '';
      const lbl = ch.labels ? `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="${pie ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${pie ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>` : '';
      if (kind === 'scatter') {
        return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}${sp}<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:marker>${lbl}${s.cat ? `<c:xVal><c:numRef><c:f>${X(s.cat)}</c:f>${numCache(d.xs || [])}</c:numRef></c:xVal>` : ''}<c:yVal><c:numRef><c:f>${X(s.val)}</c:f>${numCache(d.vals)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`;
      }
      const cat = s.cat ? `<c:cat><c:strRef><c:f>${X(s.cat)}</c:f>${strCache(data.cats)}</c:strRef></c:cat>` : '';
      return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}${sp}${kind === 'line' ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:marker>` : ''}${pie ? '' : '<c:invertIfNegative val="0"/>'.replace(/.*/, kind === 'column' || kind === 'bar' || kind === 'stacked' ? '<c:invertIfNegative val="0"/>' : '')}${dpts}${lbl}${cat}<c:val><c:numRef><c:f>${X(s.val)}</c:f>${numCache(d.vals)}</c:numRef></c:val>${kind === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
    }).join('');
    const axes = `<c:axId val="500000001"/><c:axId val="500000002"/>`;
    const grid = ch.grid !== false ? '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' : '';
    let plot;
    if (kind === 'column' || kind === 'bar' || kind === 'stacked') plot = `<c:barChart><c:barDir val="${kind === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${kind === 'stacked' ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${serXml}<c:gapWidth val="150"/>${kind === 'stacked' ? '<c:overlap val="100"/>' : ''}${axes}</c:barChart>`;
    else if (kind === 'line') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${serXml}<c:marker val="1"/>${axes}</c:lineChart>`;
    else if (kind === 'area') plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${serXml}${axes}</c:areaChart>`;
    else if (kind === 'pie') plot = `<c:pieChart><c:varyColors val="1"/>${serXml}<c:firstSliceAng val="0"/></c:pieChart>`;
    else if (kind === 'doughnut') plot = `<c:doughnutChart><c:varyColors val="1"/>${serXml}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
    else plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${serXml.replace(/<c:spPr><a:ln w="28575"[^]*?<\/c:spPr>/g, '<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>')}${axes}</c:scatterChart>`;
    const txPr = '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="nl-NL"/></a:p></c:txPr>';
    const axXml = pie ? '' : (kind === 'scatter'
      ? `<c:valAx><c:axId val="500000001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${txPr}<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`
      : `<c:catAx><c:axId val="500000001"/><c:scaling><c:orientation val="${kind === 'bar' ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${kind === 'bar' ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>${txPr}<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`)
      + `<c:valAx><c:axId val="500000002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${kind === 'bar' ? 'b' : 'l'}"/>${grid}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr}<c:crossAx val="500000001"/><c:crosses val="${kind === 'bar' ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
    const title = ch.title !== undefined ? ch.title : data.title;
    const titleXml = title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="nl-NL" sz="1400" b="0"/><a:t>${X(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
    const legPos = ch.legend || (pie || data.series.length > 1 ? 'right' : 'none');
    const legend = legPos !== 'none' ? `<c:legend><c:legendPos val="${{ right: 'r', top: 't', bottom: 'b' }[legPos] || 'r'}"/><c:overlay val="0"/>${txPr}</c:legend>` : '';
    return XML_HEAD + `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${titleXml}<c:plotArea><c:layout/>${plot}${axXml}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
  };

  /* ============================== OPENEN ============================== */
  const INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF', '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99', '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];
  const tintColor = (hex, tint) => {
    if (!tint) return hex;
    let r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const f = (v) => Math.round(tint < 0 ? v * (1 + tint) : v + (255 - v) * tint);
    r = f(r); g = f(g); b = f(b);
    return [r, g, b].map((v) => App.clamp(v, 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const childrenNS = (el, name) => (el ? Array.from(el.children).filter((x) => x.localName === name) : []);
  const child = (el, name) => childrenNS(el, name)[0] || null;
  const all = (el, name) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : []);
  const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const resolvePath = (base, target) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/'); parts.pop();
    target.split('/').forEach((p) => { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); });
    return parts.join('/');
  };
  const readRels = async (zip, path) => {
    const dir = path.split('/'); const file = dir.pop();
    const relPath = (dir.length ? dir.join('/') + '/' : '') + '_rels/' + file + '.rels';
    const f = zip.file(relPath);
    const out = {};
    if (!f) return out;
    const doc = parseXml(await f.async('string'));
    all(doc, 'Relationship').forEach((r) => { out[r.getAttribute('Id')] = { type: r.getAttribute('Type'), target: r.getAttribute('TargetMode') === 'External' ? r.getAttribute('Target') : resolvePath(path, r.getAttribute('Target')), external: r.getAttribute('TargetMode') === 'External' }; });
    return out;
  };
  const textOf = (el) => (el ? all(el, 't').map((t) => t.textContent).join('') : '');

  App.Xlsx.read = async (buffer, title) => {
    const JSZip = await loadZip();
    const zip = await JSZip.loadAsync(buffer);
    const wbFile = zip.file('xl/workbook.xml');
    if (!wbFile) throw new Error('Dit is geen geldig .xlsx-bestand.');
    const wb = parseXml(await wbFile.async('string'));
    const wbRels = await readRels(zip, 'xl/workbook.xml');
    // thema
    const theme = ['FFFFFF', '000000', 'E8E8E8', '0E2841', '156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', '96607D'];
    const themeRel = Object.values(wbRels).find((r) => /theme$/.test(r.type));
    if (themeRel && zip.file(themeRel.target)) {
      const td = parseXml(await zip.file(themeRel.target).async('string'));
      const cs = all(td, 'clrScheme')[0];
      if (cs) {
        const get = (n) => { const e = child(cs, n); if (!e) return null; const c = e.firstElementChild; return c ? (c.getAttribute('lastClr') || c.getAttribute('val')) : null; };
        ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].forEach((n, i) => { const v = get(n); if (v) theme[i] = v.toUpperCase(); });
      }
    }
    const color = (el) => {
      if (!el) return null;
      if (el.getAttribute('auto') === '1') return null;
      let hex = null;
      if (el.hasAttribute('rgb')) hex = el.getAttribute('rgb').slice(-6);
      else if (el.hasAttribute('theme')) hex = theme[+el.getAttribute('theme')] || null;
      else if (el.hasAttribute('indexed')) { const i = +el.getAttribute('indexed'); if (i === 64 || i === 65) return null; hex = INDEXED[i] || null; }
      if (!hex) return null;
      hex = tintColor(hex, +el.getAttribute('tint') || 0);
      return '#' + hex.toLowerCase();
    };
    // gedeelde teksten
    const sst = [];
    const sstRel = Object.values(wbRels).find((r) => /sharedStrings$/.test(r.type));
    if (sstRel && zip.file(sstRel.target)) {
      const d = parseXml(await zip.file(sstRel.target).async('string'));
      childrenNS(d.documentElement, 'si').forEach((s) => { const runs = childrenNS(s, 'r'); sst.push(runs.length ? runs.map((r) => textOf(child(r, 't') ? r : r)).join('') : textOf(child(s, 't') ? s : s)); });
    }
    // stijlen
    const xfStyles = [];
    let dxfs = [];
    const stRel = Object.values(wbRels).find((r) => /styles$/.test(r.type));
    if (stRel && zip.file(stRel.target)) {
      const d = parseXml(await zip.file(stRel.target).async('string'));
      const root = d.documentElement;
      const nfMap = {};
      all(root, 'numFmt').forEach((n) => { nfMap[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
      const fontOf = (f) => {
        const st = {};
        if (!f) return st;
        const b = child(f, 'b'); if (b && b.getAttribute('val') !== '0') st.b = true;
        const i = child(f, 'i'); if (i && i.getAttribute('val') !== '0') st.i = true;
        const s = child(f, 'strike'); if (s && s.getAttribute('val') !== '0') st.s = true;
        const u = child(f, 'u'); if (u) st.u = u.getAttribute('val') === 'double' ? 'double' : 'single';
        const sz = child(f, 'sz'); if (sz) { const v = +sz.getAttribute('val'); if (v && v !== 11) st.size = v; }
        const nm = child(f, 'name'); if (nm) { const v = nm.getAttribute('val'); if (v && v !== 'Aptos Narrow' && v !== 'Calibri') st.font = v; else if (v === 'Calibri') st.font = 'Calibri'; }
        const c = color(child(f, 'color')); if (c && c !== '#000000') st.color = c;
        return st;
      };
      const fonts = childrenNS(child(root, 'fonts'), 'font').map(fontOf);
      const baseFont = (fonts[0] && fonts[0].font) || null;
      const fills = childrenNS(child(root, 'fills'), 'fill').map((f) => {
        const p = child(f, 'patternFill');
        if (!p || !p.getAttribute('patternType') || p.getAttribute('patternType') === 'none') { const g = child(f, 'gradientFill'); if (g) { const stop = all(g, 'stop')[0]; return stop ? color(child(stop, 'color')) : null; } return null; }
        if (p.getAttribute('patternType') === 'gray125') return null;
        return color(child(p, 'fgColor')) || color(child(p, 'bgColor'));
      });
      const bordersL = childrenNS(child(root, 'borders'), 'border').map((b) => {
        const out = {};
        [['left', 'l'], ['right', 'r'], ['top', 't'], ['bottom', 'b']].forEach(([tag, k]) => { const e = child(b, tag); if (e && e.getAttribute('style')) out[k] = [e.getAttribute('style'), color(child(e, 'color')) || '#000000']; });
        const dg = child(b, 'diagonal');
        if (dg && dg.getAttribute('style')) { const spec = [dg.getAttribute('style'), color(child(dg, 'color')) || '#000000']; if (b.getAttribute('diagonalDown') === '1') out.d = spec; if (b.getAttribute('diagonalUp') === '1') out.u = spec; }
        return out;
      });
      childrenNS(child(root, 'cellXfs'), 'xf').forEach((xf) => {
        const st = { ...(fonts[+xf.getAttribute('fontId')] || {}) };
        if (baseFont && st.font === baseFont) delete st.font;
        const fill = fills[+xf.getAttribute('fillId')]; if (fill) st.fill = fill;
        const bd = bordersL[+xf.getAttribute('borderId')]; if (bd && Object.keys(bd).length) st.bd = bd;
        const nid = +xf.getAttribute('numFmtId');
        const nf = nfMap[nid] || BUILTIN_BACK[nid];
        if (nf && nf !== 'General') st.nf = nf.replace(/\[\$-[0-9A-F]+\]/gi, '').replace(/^(\[\$[^\]]*\])$/, 'General') || undefined;
        if (st.nf === 'm/d/yyyy' || st.nf === 'mm-dd-yy' || st.nf === 'dd/mm/yyyy' || st.nf === 'dd-mm-yyyy') st.nf = st.nf === 'dd-mm-yyyy' ? 'dd-mm-yyyy' : 'd-m-yyyy';
        const al = child(xf, 'alignment');
        if (al) {
          const h = al.getAttribute('horizontal'); if (h && h !== 'general') st.ha = h === 'centerContinuous' ? 'centerContinuous' : h;
          const v = al.getAttribute('vertical'); if (v && v !== 'bottom') st.va = v === 'center' ? 'middle' : v;
          if (al.getAttribute('wrapText') === '1') st.wrap = true;
          const ind = +al.getAttribute('indent'); if (ind) st.ind = ind;
          const rot = +al.getAttribute('textRotation'); if (rot && rot !== 255) st.rot = rot > 90 ? 90 - rot : rot;
        }
        const pr = child(xf, 'protection'); if (pr && pr.getAttribute('locked') === '0') st.unlocked = true;
        Object.keys(st).forEach((k) => { if (st[k] === undefined) delete st[k]; });
        xfStyles.push(st);
      });
      dxfs = childrenNS(child(root, 'dxfs'), 'dxf').map((x) => {
        const st = {};
        const f = child(x, 'font'); if (f) { if (child(f, 'b')) st.b = true; const c = color(child(f, 'color')); if (c) st.color = c; }
        const fl = child(x, 'fill'); if (fl) { const p = child(fl, 'patternFill'); if (p) { const c = color(child(p, 'bgColor')) || color(child(p, 'fgColor')); if (c) st.fill = c; } }
        return st;
      });
    }
    // bladen
    const book = App.newBook(title || 'Map1');
    book.sheets = [];
    const sheetEls = all(wb, 'sheet');
    const sheetPaths = [];
    for (const se of sheetEls) {
      const rid = se.getAttributeNS(NS_R, 'id') || se.getAttribute('r:id');
      const rel = wbRels[rid];
      const sh = App.newSheet(se.getAttribute('name'));
      sh.hidden = se.getAttribute('state') === 'hidden' || se.getAttribute('state') === 'veryHidden';
      book.sheets.push(sh);
      sheetPaths.push(rel && !/chartsheet/.test(rel.type) ? rel.target : null);
    }
    const media = {};
    for (let k = 0; k < book.sheets.length; k++) {
      const sh = book.sheets[k];
      const path = sheetPaths[k];
      if (!path || !zip.file(path)) continue;
      const d = parseXml(await zip.file(path).async('string'));
      const root = d.documentElement;
      const rels = await readRels(zip, path);
      const sp = child(root, 'sheetPr');
      if (sp) { const tc = color(child(sp, 'tabColor')); if (tc) sh.tab = tc; }
      const sv = all(root, 'sheetView')[0];
      if (sv) {
        if (sv.getAttribute('showGridLines') === '0') sh.grid = false;
        if (sv.getAttribute('showRowColHeaders') === '0') sh.heads = false;
        const z = +sv.getAttribute('zoomScale'); if (z) sh.zoom = App.clamp(z / 100, 0.1, 4);
        const pane = child(sv, 'pane');
        if (pane && (pane.getAttribute('state') === 'frozen' || pane.getAttribute('state') === 'frozenSplit')) sh.freeze = { r: +pane.getAttribute('ySplit') || 0, c: +pane.getAttribute('xSplit') || 0 };
        const sel = all(sv, 'selection').pop();
        if (sel && sel.getAttribute('activeCell')) { const a = App.parseAddr(sel.getAttribute('activeCell')); if (a) sh.sel = { ranges: [{ r1: a.r, c1: a.c, r2: a.r, c2: a.c }], ar: a.r, ac: a.c, ri: 0 }; }
      }
      const fp = child(root, 'sheetFormatPr');
      if (fp) {
        const dh = +fp.getAttribute('defaultRowHeight'); if (dh && Math.abs(dh - 15) > 0.3) sh.defH = Math.round(dh / 0.75);
        const dw = +fp.getAttribute('defaultColWidth'); if (dw) sh.defW = Math.round(dw * 7 + 5 - 5);
        else { const bw = +fp.getAttribute('baseColWidth'); if (bw && bw !== 8) sh.defW = Math.round(bw * 7 + 5 + 4); }
      }
      childrenNS(child(root, 'cols'), 'col').forEach((col) => {
        const a = +col.getAttribute('min') - 1, b = Math.min(+col.getAttribute('max') - 1, App.MAXC - 1);
        const w = +col.getAttribute('width');
        const hidden = col.getAttribute('hidden') === '1';
        const s = col.getAttribute('style');
        if (b - a > 2000) { if (s && xfStyles[+s] && Object.keys(xfStyles[+s]).length && b - a < 16384) { /* hele blad: overslaan */ } return; }
        for (let c = a; c <= b; c++) {
          if (w && col.getAttribute('customWidth') !== '0') { const px = Math.round(w * 7 + 5 - 5 + (w > 1 ? 0 : 0)); if (Math.abs(px - sh.defW) > 1) sh.colW[c] = Math.max(0, Math.round((w - 0.71) * 7 + 5)); }
          if (hidden || w === 0) sh.hidC[c] = 1;
          if (s && xfStyles[+s] && Object.keys(xfStyles[+s]).length) sh.colS[c] = { ...xfStyles[+s] };
        }
      });
      const shared = {};
      const sd = child(root, 'sheetData');
      childrenNS(sd, 'row').forEach((rowEl) => {
        const r = +rowEl.getAttribute('r') - 1;
        const ht = rowEl.getAttribute('ht');
        if (ht && rowEl.getAttribute('customHeight') === '1') { sh.rowH[r] = Math.round(+ht / 0.75); sh.rowManual[r] = 1; }
        else if (ht && Math.abs(+ht / 0.75 - sh.defH) > 1) sh.rowH[r] = Math.round(+ht / 0.75);
        if (rowEl.getAttribute('hidden') === '1') sh.hidR[r] = 1;
        if (rowEl.getAttribute('customFormat') === '1' && rowEl.getAttribute('s')) { const st = xfStyles[+rowEl.getAttribute('s')]; if (st && Object.keys(st).length) sh.rowS[r] = { ...st }; }
        let cIdx = -1;
        childrenNS(rowEl, 'c').forEach((ce) => {
          const ref = ce.getAttribute('r');
          let rr = r, c;
          if (ref) { const a = App.parseAddr(ref); rr = a.r; c = a.c; } else c = cIdx + 1;
          cIdx = c;
          const t = ce.getAttribute('t');
          const s = ce.getAttribute('s');
          const vEl = child(ce, 'v'), fEl = child(ce, 'f');
          const cell = {};
          const st = s ? xfStyles[+s] : null;
          if (st && Object.keys(st).length) cell.s = { ...st };
          let v = vEl ? vEl.textContent : null;
          if (t === 's') v = v !== null ? sst[+v] ?? '' : null;
          else if (t === 'inlineStr') v = textOf(child(ce, 'is'));
          else if (t === 'b') v = v === '1';
          else if (t === 'e') v = v ? { err: v } : null;
          else if (t === 'str') v = v ?? '';
          else if (v !== null && v !== '') v = +v;
          let formula = null;
          if (fEl) {
            const ft = fEl.getAttribute('t');
            const txt = fEl.textContent;
            if (ft === 'shared') {
              const sid = fEl.getAttribute('si');
              if (txt) { shared[sid] = { f: txt, r: rr, c }; formula = txt; }
              else if (shared[sid]) formula = F.shift(shared[sid].f.replace(/_xlfn\.|_xlws\./g, ''), rr - shared[sid].r, c - shared[sid].c);
            } else if (txt) formula = txt;
          }
          if (formula) {
            const canon = formula.replace(/_xlfn\._xlws\.|_xlfn\.|_xlws\.|_xlpm\./g, '').replace(/^=/, '');
            const ok = !/\[/.test(canon) && F.parse(canon).k !== 'syntax' && !F.tokenize(canon, 'en').some((tk) => tk.t === 'fn' && !App.FN[tk.v]);
            if (ok) { cell.f = canon; if (!fEl.getAttribute('cm') && fEl.getAttribute('t') !== 'array') cell.legacy = 1; } else if (v !== null && v !== undefined) cell.v = v && v.err ? v.err : v;
          } else if (v !== null && v !== undefined && v !== '') cell.v = v && v.err ? v.err : v;
          if (Object.keys(cell).length) {
            let row = sh.data.get(rr); if (!row) { row = new Map(); sh.data.set(rr, row); }
            row.set(c, cell);
          }
        });
      });
      if (child(root, 'sheetProtection') && child(root, 'sheetProtection').getAttribute('sheet') === '1') sh.protect = true;
      childrenNS(child(root, 'mergeCells'), 'mergeCell').forEach((m) => { const g = App.parseRange(m.getAttribute('ref')); if (g) sh.merges.push(g); });
      // filter
      const af = child(root, 'autoFilter');
      if (af && af.getAttribute('ref')) {
        const g = App.parseRange(af.getAttribute('ref'));
        if (g) {
          sh.filter = { r: g.r1, r2: g.r2, c1: g.c1, c2: g.c2, crit: {} };
          childrenNS(af, 'filterColumn').forEach((fc) => {
            const fl = child(fc, 'filters'); if (!fl) return;
            const vals = childrenNS(fl, 'filter').map((x) => x.getAttribute('val'));
            if (fl.getAttribute('blank') === '1') vals.push('');
            sh.filter.crit[g.c1 + +fc.getAttribute('colId')] = { values: vals };
          });
        }
      }
      // voorwaardelijke opmaak
      childrenNS(root, 'conditionalFormatting').forEach((cfEl) => {
        const ranges = (cfEl.getAttribute('sqref') || '').split(/\s+/).map(App.parseRange).filter(Boolean);
        if (!ranges.length) return;
        childrenNS(cfEl, 'cfRule').forEach((rule) => {
          const type = rule.getAttribute('type');
          const style = rule.hasAttribute('dxfId') ? dxfs[+rule.getAttribute('dxfId')] : undefined;
          const fs = childrenNS(rule, 'formula').map((x) => x.textContent);
          const val = (f) => { if (f === undefined) return undefined; if (/^".*"$/.test(f)) return f.slice(1, -1).replace(/""/g, '"'); if (/^-?[\d.]+(E-?\d+)?$/i.test(f)) return String(+f).replace('.', ','); return '=' + F.toLocal(f); };
          const base = { id: App.uid('cf'), ranges, style };
          if (type === 'cellIs') {
            const op = rule.getAttribute('operator');
            const map = { greaterThan: 'gt', lessThan: 'lt', between: 'between', equal: 'eq' };
            if (map[op]) sh.cf.push({ ...base, type: map[op], v1: val(fs[0]), v2: val(fs[1]) });
            else if (op === 'greaterThanOrEqual' || op === 'lessThanOrEqual' || op === 'notEqual' || op === 'notBetween') sh.cf.push({ ...base, type: 'formula', f: `${{ greaterThanOrEqual: '>=', lessThanOrEqual: '<=', notEqual: '<>' }[op] ? App.addr(ranges[0].r1, ranges[0].c1) + ({ greaterThanOrEqual: '>=', lessThanOrEqual: '<=', notEqual: '<>' }[op]) + fs[0] : `OR(${App.addr(ranges[0].r1, ranges[0].c1)}<${fs[0]},${App.addr(ranges[0].r1, ranges[0].c1)}>${fs[1]})`}` });
          } else if (type === 'containsText') sh.cf.push({ ...base, type: 'text', v1: rule.getAttribute('text') || '' });
          else if (type === 'duplicateValues') sh.cf.push({ ...base, type: 'dup' });
          else if (type === 'uniqueValues') sh.cf.push({ ...base, type: 'uniq' });
          else if (type === 'top10') sh.cf.push({ ...base, type: rule.getAttribute('bottom') === '1' ? 'bottom' : 'top', rank: +rule.getAttribute('rank') || 10, pct: rule.getAttribute('percent') === '1' });
          else if (type === 'aboveAverage') sh.cf.push({ ...base, type: rule.getAttribute('aboveAverage') === '0' ? 'below' : 'above' });
          else if (type === 'expression' && fs[0]) sh.cf.push({ ...base, type: 'formula', f: fs[0].replace(/_xlfn\./g, '') });
          else if (type === 'iconSet') { const is = all(rule, 'iconSet')[0]; const nm = is ? is.getAttribute('iconSet') || '3TrafficLights1' : '3TrafficLights1'; const set = /Arrow/.test(nm) ? 'arrows' : /Symbol/.test(nm) ? 'symbols' : /Flag/.test(nm) ? 'flags' : /Star/.test(nm) ? 'stars' : 'traffic'; sh.cf.push({ id: base.id, ranges, type: 'icons', set, reverse: is && is.getAttribute('reverse') === '1' }); }
          else if (type === 'dataBar') { const c = color(all(rule, 'color')[0]); sh.cf.push({ id: base.id, ranges, type: 'bar', color: c || '#638ec6' }); }
          else if (type === 'colorScale') { const cs = all(rule, 'color').map(color).filter(Boolean); if (cs.length >= 2) sh.cf.push({ id: base.id, ranges, type: 'scale', colors: cs }); }
        });
      });
      // validatie
      childrenNS(child(root, 'dataValidations'), 'dataValidation').forEach((dv) => {
        const ranges = (dv.getAttribute('sqref') || '').split(/\s+/).map(App.parseRange).filter(Boolean);
        if (!ranges.length) return;
        const type = { whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', time: 'time', textLength: 'length' }[dv.getAttribute('type')] || 'any';
        const f1 = child(dv, 'formula1') ? child(dv, 'formula1').textContent : '', f2 = child(dv, 'formula2') ? child(dv, 'formula2').textContent : '';
        const back = Object.fromEntries(Object.entries(DV_OPS).map(([a, b]) => [b, a]));
        const lit = (f) => (/^-?[\d.]+$/.test(f) ? String(+f).replace('.', ',') : f ? '=' + F.toLocal(f) : '');
        const rule = { ranges, type, op: back[dv.getAttribute('operator')] || 'between', blank: dv.getAttribute('allowBlank') === '1', inCell: dv.getAttribute('showDropDown') !== '1', style: { warning: 'warning', information: 'info' }[dv.getAttribute('errorStyle')] || 'stop', errTitle: dv.getAttribute('errorTitle') || '', err: dv.getAttribute('error') || '', msgTitle: dv.getAttribute('promptTitle') || '', msg: dv.getAttribute('prompt') || '' };
        if (type === 'list') rule.list = /^".*"$/.test(f1) ? f1.slice(1, -1).split(',').join(';') : '=' + F.toLocal(f1);
        else { rule.v1 = lit(f1); rule.v2 = lit(f2); }
        sh.dv.push(rule);
      });
      // koppelingen
      childrenNS(child(root, 'hyperlinks'), 'hyperlink').forEach((h) => {
        const g = App.parseRange(h.getAttribute('ref') || ''); if (!g) return;
        const rid = h.getAttributeNS(NS_R, 'id') || h.getAttribute('r:id');
        const l = rid && rels[rid] ? rels[rid].target : h.getAttribute('location') ? '#' + h.getAttribute('location') : null;
        if (l) { const cell = App.cellAt(sh, g.r1, g.c1); cell.l = l; }
      });
      // pagina
      const po = child(root, 'printOptions');
      if (po) { sh.page.grid = po.getAttribute('gridLines') === '1'; sh.page.heads = po.getAttribute('headings') === '1'; sh.page.center = po.getAttribute('horizontalCentered') === '1'; }
      const pm = child(root, 'pageMargins');
      if (pm) { const cm = (a) => +(+pm.getAttribute(a) * 2.54).toFixed(2); sh.page.margins = { t: cm('top'), b: cm('bottom'), l: cm('left'), r: cm('right') }; }
      const ps = child(root, 'pageSetup');
      if (ps) {
        sh.page.size = PAPER_BACK[+ps.getAttribute('paperSize')] || 'A4';
        sh.page.orient = ps.getAttribute('orientation') === 'landscape' ? 'landscape' : 'portrait';
        if (ps.getAttribute('scale')) sh.page.scale = +ps.getAttribute('scale');
        const fit = sp && all(sp, 'pageSetUpPr')[0] && all(sp, 'pageSetUpPr')[0].getAttribute('fitToPage') === '1';
        if (fit) sh.page.fitW = +ps.getAttribute('fitToWidth') || 1;
      }
      const hf = child(root, 'headerFooter');
      if (hf) {
        const conv = (t) => { if (!t) return ''; const part = (k) => { const m = new RegExp('&' + k + '([^&]*(?:&[^LCR][^&]*)*)').exec(t); return m ? m[1].replace(/&P/g, '&[Pagina]').replace(/&N/g, "&[Pagina's]").replace(/&D/g, '&[Datum]').replace(/&T/g, '&[Tijd]').replace(/&F/g, '&[Bestand]').replace(/&A/g, '&[Blad]').replace(/&"[^"]*"|&\d+|&[BIUSXYKEHO]/g, '') : ''; }; const parts = [part('L'), part('C'), part('R')]; if (!/&[LCR]/.test(t)) parts[1] = t; return parts.join('|').replace(/^\|\|$/, ''); };
        sh.page.header = conv(child(hf, 'oddHeader') && child(hf, 'oddHeader').textContent);
        sh.page.footer = conv(child(hf, 'oddFooter') && child(hf, 'oddFooter').textContent);
      }
      // notities
      const cRel = Object.values(rels).find((r) => /\/comments$/.test(r.type));
      if (cRel && zip.file(cRel.target)) {
        const cd = parseXml(await zip.file(cRel.target).async('string'));
        all(cd, 'comment').forEach((cm) => { const a = App.parseAddr(cm.getAttribute('ref')); if (!a) return; const t = textOf(child(cm, 'text')); if (t) App.cellAt(sh, a.r, a.c).n = t.replace(/^[^:\n]{1,40}:\n/, ''); });
      }
      // tekening
      const dRel = Object.values(rels).find((r) => /\/drawing$/.test(r.type));
      if (dRel && zip.file(dRel.target)) {
        const dd = parseXml(await zip.file(dRel.target).async('string'));
        const drels = await readRels(zip, dRel.target);
        const anchors = Array.from(dd.documentElement.children).filter((x) => /Anchor$/.test(x.localName));
        for (const an of anchors) {
          const from = child(an, 'from'); if (!from) continue;
          const num = (el, n) => +(child(el, n) ? child(el, n).textContent : 0);
          const o = { id: App.uid('o'), c: num(from, 'col'), r: num(from, 'row'), dx: num(from, 'colOff') / EMU, dy: num(from, 'rowOff') / EMU, w: 300, h: 200 };
          const ext = child(an, 'ext');
          if (ext) { o.w = +ext.getAttribute('cx') / EMU; o.h = +ext.getAttribute('cy') / EMU; }
          else {
            const to = child(an, 'to');
            if (to) {
              const x1 = sh.colW, xs = (c) => { let x = 0; for (let i = 0; i < c; i++) x += x1[i] ?? sh.defW; return x; }, ys = (r) => { let y = 0; for (let i = 0; i < Math.min(r, 5000); i++) y += sh.rowH[i] ?? sh.defH; return y; };
              o.w = Math.max(20, xs(num(to, 'col')) + num(to, 'colOff') / EMU - xs(o.c) - o.dx);
              o.h = Math.max(20, ys(num(to, 'row')) + num(to, 'rowOff') / EMU - ys(o.r) - o.dy);
            }
          }
          o.w = Math.round(o.w); o.h = Math.round(o.h);
          const pic = child(an, 'pic'), spEl = child(an, 'sp'), gf = child(an, 'graphicFrame');
          if (pic) {
            const blip = all(pic, 'blip')[0];
            const rid = blip && (blip.getAttributeNS(NS_R, 'embed') || blip.getAttribute('r:embed'));
            const target = rid && drels[rid] && drels[rid].target;
            if (target && zip.file(target)) {
              const ext2 = target.split('.').pop().toLowerCase();
              const mime = ext2 === 'jpg' || ext2 === 'jpeg' ? 'image/jpeg' : ext2 === 'gif' ? 'image/gif' : ext2 === 'png' ? 'image/png' : null;
              if (mime) {
                const b64 = await zip.file(target).async('base64');
                const mid = App.uid('m'); media[mid] = `data:${mime};base64,${b64}`;
                const cNv = all(pic, 'cNvPr')[0];
                sh.objs.push({ ...o, type: 'image', media: mid, alt: cNv ? cNv.getAttribute('descr') || '' : '', nw: o.w, nh: o.h });
              }
            }
          } else if (spEl) {
            const prst = all(spEl, 'prstGeom')[0];
            const kind = prst ? Object.entries(SHAPE_PRST).find(([, v]) => v === prst.getAttribute('prst')) : null;
            const txt = all(spEl, 'p').map((p) => all(p, 't').map((t) => t.textContent).join('')).join('\n');
            const isTb = all(spEl, 'cNvSpPr')[0] && all(spEl, 'cNvSpPr')[0].getAttribute('txBox') === '1';
            const fillC = (() => { const sp2 = child(spEl, 'spPr'); const sf = sp2 && child(sp2, 'solidFill'); const c = sf && all(sf, 'srgbClr')[0]; return c ? '#' + c.getAttribute('val').toLowerCase() : null; })();
            if (isTb || (!kind && txt)) sh.objs.push({ ...o, type: 'textbox', text: txt });
            else sh.objs.push({ ...o, type: 'shape', shape: kind ? kind[0] : 'rect', fill: fillC || '#156082', stroke: '#0f4761', text: txt || undefined });
          } else if (gf) {
            const cEl = all(gf, 'chart')[0];
            const rid = cEl && (cEl.getAttributeNS(NS_R, 'id') || cEl.getAttribute('r:id'));
            const target = rid && drels[rid] && drels[rid].target;
            if (target && zip.file(target)) {
              const cd = parseXml(await zip.file(target).async('string'));
              const plot = all(cd, 'plotArea')[0];
              if (!plot) continue;
              const typeEl = Array.from(plot.children).find((x) => /Chart$/.test(x.localName));
              if (!typeEl) continue;
              let kind = { barChart: 'column', bar3DChart: 'column', lineChart: 'line', line3DChart: 'line', areaChart: 'area', area3DChart: 'area', pieChart: 'pie', pie3DChart: 'pie', doughnutChart: 'doughnut', scatterChart: 'scatter' }[typeEl.localName] || 'column';
              if (kind === 'column') { const bd = child(typeEl, 'barDir'); if (bd && bd.getAttribute('val') === 'bar') kind = 'bar'; const gr = child(typeEl, 'grouping'); if (gr && /stacked/i.test(gr.getAttribute('val'))) kind = 'stacked'; }
              // bereik uit de reeksverwijzingen
              const refs = all(typeEl, 'f').map((x) => x.textContent);
              let g = null, sheetName = null;
              refs.forEach((ref) => {
                const tk = F.tokenize(ref, 'en').find((t2) => t2.t === 'ref');
                if (!tk) return;
                sheetName = sheetName || tk.sheet;
                g = g ? { r1: Math.min(g.r1, tk.r1), c1: Math.min(g.c1, tk.c1), r2: Math.max(g.r2, tk.r2), c2: Math.max(g.c2, tk.c2) } : { r1: tk.r1, c1: tk.c1, r2: tk.r2, c2: tk.c2 };
              });
              if (!g) continue;
              const titleEl = all(cd, 'title')[0];
              const titleTxt = titleEl ? all(titleEl, 't').map((t2) => t2.textContent).join('') : undefined;
              const autoDel = all(cd, 'autoTitleDeleted')[0];
              const leg = all(cd, 'legendPos')[0];
              const ser = all(typeEl, 'ser');
              const byRow = (() => { const v = ser[0] && all(ser[0], 'val')[0]; const f = v && all(v, 'f')[0]; if (!f) return false; const tk = F.tokenize(f.textContent, 'en').find((t2) => t2.t === 'ref'); return tk ? tk.r1 === tk.r2 && tk.c2 > tk.c1 : false; })();
              sh.objs.push({ ...o, type: 'chart', chart: { kind, range: (sheetName ? App.sheetRef(sheetName) + '!' : '') + App.absRangeStr(g), title: titleTxt !== undefined && titleTxt !== '' ? titleTxt : (autoDel && autoDel.getAttribute('val') === '1' ? '' : undefined), legend: all(cd, 'legend').length ? ({ r: 'right', t: 'top', b: 'bottom', l: 'right', tr: 'right' }[leg ? leg.getAttribute('val') : 'r'] || 'right') : 'none', labels: all(typeEl, 'showVal').some((x) => x.getAttribute('val') === '1') || all(typeEl, 'showPercent').some((x) => x.getAttribute('val') === '1'), grid: all(cd, 'majorGridlines').length > 0, palette: 0, byRow } });
            }
          }
        }
      }
    }
    // namen
    all(wb, 'definedName').forEach((dn) => {
      const name = dn.getAttribute('name');
      const txt = dn.textContent.replace(/_xlfn\./g, '');
      const lsid = dn.getAttribute('localSheetId');
      if (name === '_xlnm.Print_Area' && lsid !== null) {
        const tk = F.tokenize(txt.split(',')[0], 'en').find((t) => t.t === 'ref');
        if (tk && book.sheets[+lsid]) book.sheets[+lsid].printArea = { r1: tk.r1, c1: tk.c1, r2: tk.r2, c2: tk.c2 };
        return;
      }
      if (name === '_xlnm.Print_Titles' && lsid !== null) {
        const tk = F.tokenize(txt, 'en').find((t) => t.t === 'ref' && t.kind === 'row');
        if (tk && book.sheets[+lsid]) book.sheets[+lsid].printTitles = (tk.r1 + 1) + ':' + (tk.r2 + 1);
        return;
      }
      if (/^_xlnm\./.test(name) || dn.getAttribute('hidden') === '1' || /#REF!|\[/.test(txt)) return;
      book.names[name] = txt;
    });
    const av = all(wb, 'workbookView')[0];
    if (av && av.getAttribute('activeTab')) book.active = App.clamp(+av.getAttribute('activeTab'), 0, book.sheets.length - 1);
    if (!book.sheets.length) book.sheets.push(App.newSheet('Blad1'));
    if (book.sheets[book.active].hidden) book.active = Math.max(0, book.sheets.findIndex((s) => !s.hidden));
    const calcPr = all(wb, 'calcPr')[0];
    if (calcPr && calcPr.getAttribute('calcMode') === 'manual') book.calc = 'manual';
    return { book, media };
  };
})();
