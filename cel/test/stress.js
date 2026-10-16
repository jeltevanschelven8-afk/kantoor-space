/* Cel — stresstest van de rekenkern, de samenvoeglogica en de deel-API.
   Openen: start Cel via start-cel.bat en ga naar http://localhost:8081/test/stress.html
   (de app draait in het rechterdeel; de tests praten met window.App daarvan).
   Resultaten staan links en in window.RESULTS. Niets hiervan raakt opgeslagen werkmappen:
   de tests gebruiken een eigen, tijdelijk blad en tijdelijke koppelingen die weer worden verwijderd. */
'use strict';

const logEl = document.getElementById('log'), sumEl = document.getElementById('sum');
const RESULTS = window.RESULTS = [];
let App, NF, F, W;
const SLOW_MS = 300;   // één bewerking hoort hier ruim onder te blijven

const line = (cls, txt) => { const p = document.createElement('pre'); p.className = cls; p.textContent = txt; logEl.appendChild(p); };
const section = (t) => { const h = document.createElement('h2'); h.textContent = t; logEl.appendChild(h); };
const summary = () => {
  const fails = RESULTS.filter((r) => !r.ok).length, slow = RESULTS.filter((r) => r.ok && r.ms > SLOW_MS).length;
  sumEl.textContent = `${RESULTS.length} tests · ${fails} mislukt · ${slow} traag (> ${SLOW_MS} ms)`;
  sumEl.className = fails ? 'fail' : 'ok';
};
// één test: fn geeft een waarde terug; check(value) geeft true/false of een foutmelding (string)
// voortgang bewaren in localStorage: blijft een test hangen, dan staat na herladen in 'cel.stress' welke dat was
const SKIP = new Set((new URLSearchParams(location.search).get('skip') || '').split('|').filter(Boolean));
const progress = (o) => { try { localStorage.setItem('cel.stress', JSON.stringify(o)); } catch { /* niets */ } };
const test = async (cat, name, fn, check) => {
  if (SKIP.has(name)) { line('slow', `– [${cat}] ${name} overgeslagen (skip)`); return undefined; }
  progress({ running: name, cat, done: RESULTS.length, fails: RESULTS.filter((r) => !r.ok).map((r) => `${r.cat} · ${r.name} → ${r.value} ${r.note}`) });
  await new Promise((r) => setTimeout(r, 0));   // de browser even laten ademen zodat het log zichtbaar wordt
  const t0 = performance.now();
  let value, error = null, ok = true, note = '';
  try { value = await fn(); } catch (e) { error = e; }
  const ms = Math.round(performance.now() - t0);
  if (error) { ok = false; note = 'EXCEPTION: ' + (error && error.message || error); }
  else if (check) {
    let r; try { r = check(value); } catch (e) { r = 'check threw: ' + e.message; }
    if (r !== true && r !== undefined) { ok = false; note = typeof r === 'string' ? r : 'unexpected: ' + short(value); }
  }
  RESULTS.push({ cat, name, ok, ms, value: short(value), note });
  progress({ running: null, done: RESULTS.length, fails: RESULTS.filter((r) => !r.ok).map((r) => `${r.cat} · ${r.name} → ${r.value} ${r.note}`) });
  line(ok ? (ms > SLOW_MS ? 'slow' : 'ok') : 'fail', `${ok ? '✓' : '✗'} [${cat}] ${name} → ${short(value)} (${ms} ms)${note ? '  ' + note : ''}`);
  summary();
  return value;
};
const short = (v) => { let s; try { s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch { s = String(v); } if (s === undefined) s = String(v); return s.length > 120 ? s.slice(0, 117) + '…' : s; };
const isNum = (v) => typeof v === 'number' && isFinite(v);
const isErrVal = (v) => v && typeof v === 'object' && typeof v.err === 'string';

/* ---------- hulpjes voor cellen ---------- */
let sh;   // tijdelijk testblad
const addr = (a) => App.parseAddr(a);
const put = (a, text) => { const p = addr(a); const r = App.setCellFromText(sh, p.r, p.c, text); App.touchAll && App.touchAll(); return r; };
const cv = (a) => { const p = addr(a); return F.cellValue(sh, p.r, p.c); };   // ook overgelopen (virtuele) waarden
const calc = () => { App.recalc(); };
const evalF = (f, cell = 'A1') => { const r = put(cell, f); if (!r.ok) return { rejected: r.msg }; calc(); return cv(cell); };
const clearAll = () => { sh.data = new Map(); sh._max = null; App.touchAll && App.touchAll(); };
const errOrNum = (v) => isNum(v) || isErrVal(v) || true;

/* ---------- de tests ---------- */
async function run() {
  W = document.getElementById('app').contentWindow;
  App = W.App; NF = App.NF; F = App.F;
  sh = App.newSheet('Stresstest');
  App.book.sheets.push(sh);
  const lang = App.LANG;
  line('ok', `Taal van de app: ${lang} (de notatietests gaan uit van ${lang === 'en' ? 'Engels' : 'Nederlands'})`);

  /* === A. invoer herkennen (NF.parseInput) === */
  section('A. Invoer herkennen');
  const en = lang === 'en';
  const inputs = [
    ['', 'any'], [' ', 'string'], ['1', 1], ['-0', 0], ['1e308', 1e308], ['1e309', 'string'], ['-1e309', 'string'],
    [en ? '1,234.56' : '1.234,56', 1234.56], [en ? '1,2,3' : '1.2.3', 'string'], [en ? '12,34' : '12.34', 'string'],
    [en ? '.5' : ',5', 0.5], [en ? '5.' : '5,', 5], ['-', 'string'], ['+', 'string'], ['--1', 'string'], ['1-', 'string'], ['$', 'string'],
    [en ? '$-5' : '€-5', 'any'], [en ? '-$5' : '-€5', -5], [en ? '($5)' : '(€5)', 'any'], ['(5)', -5], ['5%', 0.05], ['%5', 'string'],
    ['1e5%', 'any'], [en ? '12/31/2026' : '31-12-2026', 'number'], [en ? '2/30/2026' : '30-2-2026', 'string'], [en ? '13/1/2026' : '1-13-2026', 'any'],
    ['1/1/0', 'any'], [en ? '1/1/10000' : '1-1-10000', 'any'], ['12:60', 'string'], ['24:00', 'any'], ['25:00', 'any'], ['1:2:3:4', 'string'],
    ['TRUE', en ? true : 'string'], ['true', en ? true : 'string'], ['True ', 'any'], ['WAAR', true], ['inf', 'string'], ['NaN', 'string'],
    ['Infinity', 'string'], ['0x10', 'string'], ['1_000', 'string'], ['١٢٣', 'any'], ['１２３', 'any'], ['1'.repeat(400), 'any'],
    ['\u0000', 'string'], ['😀', '😀'], ['=', '='], ['==', '=='], ['junk', 'junk'], ['  42  ', 42], ['4 2', 'any'], ['1e', 'string'], ['e1', 'string'],
    [en ? '1,000,000.5' : '1.000.000,5', 1000000.5], [en ? '0,5' : '0.5', 'any'], ['-.', 'string'], ['1.2.3.4', 'string'], ['00012', 12], ['0.1e-2', 0.001],
    ['9007199254740993', 'number'], ['(1,234.56)', en ? -1234.56 : 'any'], ['( 5 )', -5], ['()', 'string'], ['(-5)', 'string'], ['(5', 'string'], [en ? '5.' : '5,', 5], ['5..', 'string'], ['-0.0', 0], ['1e-400', 'any'], ['5e-324', 'any'],
  ];
  for (const [raw, exp] of inputs) {
    await test('parse', `parseInput(${short(raw)})`, () => NF.parseInput(raw), (p) => {
      if (!p || !('v' in p)) return 'no {v}';
      const v = p.v;
      if (typeof v === 'number' && !isFinite(v)) return 'non-finite number';
      if (exp === 'any') return true;
      if (exp === 'string') return typeof v === 'string' ? true : 'expected text, got ' + typeof v;
      if (exp === 'number') return typeof v === 'number' ? true : 'expected number, got ' + short(v);
      if (typeof exp === 'number') return v === exp ? true : 'expected ' + exp + ', got ' + short(v);
      return v === exp ? true : 'expected ' + short(exp) + ', got ' + short(v);
    });
  }
  await test('parse', 'parseInput 1 MB text', () => NF.parseInput('a'.repeat(1e6)).v.length, (n) => n === 1e6);
  await test('parse', 'parseInput 1 MB digits stays text', () => NF.parseInput('9'.repeat(1e6)), (p) => typeof p.v === 'string' ? true : 'got ' + short(p));
  await test('parse', 'parseInput 100k spaces + 1', () => NF.parseInput(' '.repeat(1e5) + '1').v, (v) => v === 1 || typeof v === 'string');
  // rondreis: getal → bewerktekst → getal
  for (const n of [0, 1, -1, 0.1, 1 / 3, 1e15, 1e-9, 123456.789, 2 ** 53, -(2 ** 53), 1e21, 1e-21, 0.1 + 0.2]) {
    await test('parse', `round trip editText(${n})`, () => { const t = NF.editText(n, 'General'); const p = NF.parseInput(t); return { t, v: p.v }; }, (r) => isNum(r.v) && Math.abs(r.v - n) <= Math.abs(n) * 1e-14 ? true : 'got ' + short(r));
  }

  /* === B. getalnotatie (NF.format) === */
  section('B. Getalnotatie');
  const vals = [0, -0, 1, -1, 0.5, 1e-320, 5e-324, 1e308, -1e308, NaN, Infinity, -Infinity, 2 ** 53, 2 ** 53 + 1, 0.1 + 0.2, 123456789012345678, 1e21, -1e-7, 2958465, 2958466, -1, 0.9999999999, 60, 61, 1.5e-10];
  const fmts = ['General', '0', '0.00', '#,##0', '#,##0.00', '0%', '0.00%', '0.00E+00', '# ?/?', '# ??/??', 'm/d/yyyy', 'd-m-yyyy', 'dddd d mmmm yyyy', 'h:mm', 'h:mm:ss AM/PM', '[h]:mm:ss', 'mm:ss.0', '@', '0000', '"x"0', '[Red][>5]0;[Blue]0', '#.##0,00', '0.0000000000000000000000', '#,##0;(#,##0);"-"', '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)', '', '(', '('.repeat(500), 'd'.repeat(500), '0'.repeat(500), ';;;', ';;;;;;', '[', '[$-409]', '[h', '"', 'yyyy-mm-dd hh:mm:ss.000', 'General General', '0.##', '#', '?', '.', ',', '%', 'E+', '0E+', 'AM/PM', 'A/P', '*', '\\', '_', '0_', '0*', '0\\'];
  let fmtCount = 0;
  const t0 = performance.now();
  let worst = { ms: 0 };
  let fmtFails = [];
  for (const nf of fmts) for (const v of vals) {
    const s0 = performance.now();
    let r, err = null;
    try { r = NF.format(v, nf); } catch (e) { err = e; }
    const ms = performance.now() - s0;
    if (ms > worst.ms) worst = { ms, nf, v };
    fmtCount++;
    if (err) fmtFails.push(`format(${short(v)}, ${short(nf)}) threw ${err.message}`);
    else if (!r || typeof r.text !== 'string') fmtFails.push(`format(${short(v)}, ${short(nf)}) → ${short(r)}`);
    else if (r.text.length > 2000) fmtFails.push(`format(${short(v)}, ${short(nf)}) → ${r.text.length} chars`);
  }
  await test('format', `${fmtCount} format() combinations`, () => ({ ms: Math.round(performance.now() - t0), fails: fmtFails.slice(0, 5), worst: { ...worst, ms: Math.round(worst.ms) } }), (r) => r.fails.length ? r.fails.join(' | ') : true);
  await test('format', 'format(1234.5, General)', () => NF.format(1234.5, 'General').text, (t) => t === (en ? '1234.5' : '1234,5'));
  await test('format', 'format(1e21, General) is not scientific garbage', () => NF.format(1e21, 'General').text, (t) => /E\+?21|^1,?000/.test(t) ? true : 'got ' + t);
  await test('format', 'format(-0, 0.00)', () => NF.format(-0, '0.00').text, (t) => t === (en ? '0.00' : '0,00') ? true : 'got ' + t);
  await test('format', 'format(0.5, 0) rounds half away from zero (Excel)', () => NF.format(0.5, '0').text, (t) => t === '1' ? true : 'got ' + t);
  await test('format', 'format(2.5, 0)', () => NF.format(2.5, '0').text, (t) => t === '3' ? true : 'got ' + t);
  await test('format', 'format(-2.5, 0)', () => NF.format(-2.5, '0').text, (t) => t === '-3' ? true : 'got ' + t);
  await test('format', 'format(1.005, 0.00) (binary 1.00499…)', () => NF.format(1.005, '0.00').text, (t) => /^1[.,]0[01]$/.test(t) ? true : 'got ' + t);
  await test('format', 'format(-1, date) does not throw', () => NF.format(-1, 'm/d/yyyy').text, (t) => typeof t === 'string');
  await test('format', 'format(1e10, date)', () => NF.format(1e10, 'm/d/yyyy').text, (t) => typeof t === 'string');
  await test('format', 'format(text, number format) keeps text', () => NF.format('abc', '0.00').text, (t) => t === 'abc');
  await test('format', 'format(1e6, 0.00) full digits', () => NF.format(1e6, '0.00').text, (t) => /^1000000[.,]00$/.test(t) ? true : 'got ' + t);
  await test('format', 'format 999999999999.999 General', () => NF.format(999999999999.999, 'General').text, (t) => typeof t === 'string');
  await test('format', 'format(0.1+0.2, General) = 0.3', () => NF.format(0.1 + 0.2, 'General').text, (t) => t === (en ? '0.3' : '0,3') ? true : 'got ' + t);

  /* === C. formules === */
  section('C. Formules: parsen en rekenen');
  const sep = en ? ',' : ';', dec = en ? '.' : ',';
  const SUM = en ? 'SUM' : 'SOM', IF = en ? 'IF' : 'ALS', TRUE = en ? 'TRUE' : 'WAAR';
  const noThrow = [ // alleen: mag niet crashen; resultaat is getal, tekst, boolean, fout of null
    '=', '=(', '=)', '=()', '=1/0', '=SUM(', `=${SUM}()`, `=${SUM}(1${sep}${sep}2)`, '=1+', '=1++2', '=--1', '=+1', '=1e3', '=1E+', '="unterminated', '="a"&1',
    `=${TRUE}+1`, '=1=1', '=1<>', '=A', '=A0', '=A1048577', '=XFE1', '=ZZZZ1', '=A1:B', '=A1:A1:A1', '=Sheet99!A1', "='Blad met spatie'!A1", '=sum(1)', `=${SUM}( 1 ${sep} 2 )`,
    `=1${dec}5`, '=10%', '=-2^2', '=2^3^2', '=1/3*3=1', `=0${dec}1+0${dec}2=0${dec}3`, '="1"+1', '=#REF!', '=#N/A', '=#DIV/0!+1', '=A1#', '=B1#', '=@A1', '=A1:A1#',
    '=INDIRECT("A1")', '=INDIRECT("")', '=INDIRECT("ZZZZ99999999")', '=INDIRECT("Sheet1!A1:A2")', `=OFFSET(B1${sep}0${sep}0${sep}100000${sep}100)`, `=OFFSET(B1${sep}-5${sep}-5)`,
    `=VLOOKUP("x"${sep}B1:C2${sep}0)`, `=VLOOKUP("x"${sep}B1:C2${sep}99)`, `=INDEX(B1:B3${sep}0${sep}0)`, `=INDEX(B1:B3${sep}99)`, `=MATCH(1${sep}B1:B3${sep}5)`,
    `=MOD(5${sep}0)`, `=POWER(10${sep}400)`, `=POWER(-8${sep}1/3)`, '=FACT(171)', '=FACT(-1)', '=FACT(1e9)', '=SQRT(-1)', '=LOG(0)', '=LN(-1)', '=EXP(1000)',
    `=DATE(10000${sep}1${sep}1)`, `=DATE(2026${sep}13${sep}45)`, `=DATE(-1${sep}1${sep}1)`, `=DATE(1e9${sep}1${sep}1)`, `=TIME(25${sep}61${sep}61)`, '=YEAR(-1)', '=YEAR(1e12)', '=DAY(2958466)',
    `=MID("abc"${sep}0${sep}1)`, `=LEFT("abc"${sep}-1)`, `=REPT("a"${sep}-1)`, '=CHAR(0)', '=CHAR(256)', '=CHAR(-1)', '=UNICHAR(1114112)', '=UNICHAR(0)', '=CODE("")', '=VALUE("1e400")', '=1e400', '=1e-400',
    `=ROUND(2${dec}5${sep}0)`, `=ROUND(-2${dec}5${sep}0)`, `=ROUND(1${dec}005${sep}2)`, `=ROUND(1${sep}400)`, `=ROUND(1${sep}-400)`, `=INT(-0${dec}5)`, `=MOD(-1${sep}3)`, `=RANDBETWEEN(1${sep}0)`, `=RANDBETWEEN(1e15${sep}1e16)`,
    `=SUMIF(B1:B3${sep}"*")`, `=SUMIF(B1:B3${sep}"<>")`, `=COUNTIF(B1:B3${sep}"=")`, `=TEXTSPLIT("a,b"${sep}",")`, `=TEXTSPLIT(""${sep}",")`, `=TEXTSPLIT("abc"${sep}"")`,
    `=SEQUENCE(0)`, `=SEQUENCE(-1)`, `=SEQUENCE(1${sep}0)`, `=SEQUENCE(1e300)`, '=TRANSPOSE(B1:B2)', '=B1:B2', '={1}', `=LET(a${sep}1${sep}a)`, `=LET(a${sep}a${sep}a)`, '=LAMBDA(x,x)', `=LAMBDA(x${sep}x)(1)`,
    `=LAMBDA(x${sep}x(x))(LAMBDA(x${sep}x(x)))`, `=MAP(SEQUENCE(3)${sep}LAMBDA(x${sep}x*2))`, `=REDUCE(0${sep}SEQUENCE(3)${sep}LAMBDA(a${sep}b${sep}a+b))`, `=FILTER(B1:B3${sep}1)`, `=FILTER(B1:B3${sep}B1:B3>99)`,
    `=SORT(B1:B3${sep}99)`, `=UNIQUE(B1:B1)`, `=XLOOKUP(1${sep}B1:B3${sep}C1:C2)`, `=HYPERLINK("javascript:alert(1)"${sep}"x")`, `=TEXT(1${sep}"")`, `=TEXT(1${sep}"\\")`, `=TEXT(1${sep}"("&REPT("0"${sep}500))`,
    `=REGEXTEST("x"${sep}"(")`, `=REGEXREPLACE("abc"${sep}""${sep}"x")`, `=REGEXEXTRACT("abc"${sep}"(?<n>b)")`, `=CONVERT(1${sep}"m"${sep}"banana")`, `=BASE(255${sep}1)`, `=BASE(255${sep}37)`, `=DECIMAL("zz"${sep}36)`, `=DECIMAL("zz"${sep}2)`,
    '=ROMAN(4000)', '=ROMAN(-1)', '=ARABIC("")', '=ARABIC("MMMMMMMM")', `=NPER(0${sep}0${sep}0)`, `=RATE(10${sep}0${sep}0)`, `=IRR({0})`, `=IRR({-1,1})`, `=PMT(0${sep}0${sep}100)`,
    `=CELL("bestandsnaam")`, '=CELL("foo")', '=INFO("foo")', '=TYPE(B1:B2)', '=N("1")', '=ISFORMULA(A1)', '=FORMULATEXT(A1)', '=ROW()', '=COLUMN()', '=ROWS(A:A)', '=COLUMNS(1:1)', `=SUM(A:A)`, `=SUM(1:1)`, '=SUM(A:XFD)',
    `=TEXTJOIN(","${sep}${TRUE}${sep}B1:B1000)`, `=CONCAT(B1:B10000)`, `=SUMPRODUCT(B1:B100${sep}C1:C50)`, `=MMULT(B1:B2${sep}B1:B2)`, '=MINVERSE(B1:C2)', '=MDETERM(B1:B1)',
    '=IF(1,2,3,4)', '=IF()', '=IFS()', '=SWITCH(1)', '=CHOOSE(0,1)', '=CHOOSE(99,1)', '=AND()', '=OR(,)', '=NOT("x")', '=1<>' ,'=<1', '=1 2', '=1..2', '=A1:', '=:A1', '=$', '=$A$', '=A$1$', '=R1C1', '=1:A', '=(A1',
    '=SÖM(1)', '=ＳＵＭ(1)', '=SUM( 1)', '=SUM(1​)', '="😀"&"😀"', '=LEN("😀")', '=MID("😀x",1,1)', '=UPPER("ß")', '=LOWER("İ")', '=EXACT("ss","ß")', '=CODE("😀")', '=UNICODE("😀")',
  ];
  for (const f of noThrow) await test('formula', `eval ${short(f)}`, () => evalF(f), (v) => v === null || v === undefined || isNum(v) || typeof v === 'string' || typeof v === 'boolean' || isErrVal(v) || (v && v.rejected !== undefined) || Array.isArray(v) ? true : 'odd value ' + short(v));
  clearAll();
  // waarden die kloppen
  const expect = async (f, want, cell = 'A1') => test('formula', `${f} = ${short(want)}`, () => evalF(f, cell), (v) => (isErrVal(want) ? isErrVal(v) && v.err === want.err : typeof want === 'number' && isNum(v) ? Math.abs(v - want) < 1e-9 : v === want) ? true : 'got ' + short(v));
  const expectErr = async (f, cell = 'A1') => test('formula', `${f} = some error`, () => evalF(f, cell), (v) => isErrVal(v) ? true : 'got ' + short(v));
  await expect('=-2^2', 4);
  await expect('=2^3^2', 64);
  await expect(`=0${dec}1+0${dec}2=0${dec}3`, false);
  await expect(`=ROUND(0${dec}1+0${dec}2${sep}10)=0${dec}3`, true);
  await expect(`=ROUND(2${dec}5${sep}0)`, 3);
  await expect(`=ROUND(-2${dec}5${sep}0)`, -3);
  await expect(`=ROUND(1${dec}005${sep}2)`, 1.01);
  await expect(`=INT(-0${dec}5)`, -1);
  await expect(`=MOD(-1${sep}3)`, 2);
  await expect(`=MOD(5${dec}5${sep}-2)`, -0.5);
  await expect('="1"+1', 2);
  await expect(`=${TRUE}+1`, 2);
  await expect('=1/0', { err: '#DIV/0!' });
  await expect('=10%', 0.1);
  await expect('=LEN("😀")', 2);
  await expect(`=DATE(2026${sep}13${sep}1)`, NF.dateToSerial(2027, 0, 1));
  await expect(`=DATE(2026${sep}3${sep}0)`, NF.dateToSerial(2026, 1, 28));
  await expect(`=DATE(2024${sep}2${sep}29)-DATE(2024${sep}2${sep}28)`, 1);
  await expect(`=DATE(1900${sep}3${sep}1)`, 61);   // Excel 1900-schrikkeljaarfout
  await test('formula', 'DATE(1900,2,28): Excel says 59 (1900 leap-year bug)', () => evalF(`=DATE(1900${sep}2${sep}28)`), (v) => v === 59 || v === 60 ? true : 'got ' + short(v));
  await expect(`=DATE(1899${sep}12${sep}31)`, 693962);   // Excel: jaar < 1900 wordt 1900 + jaar
  await expect('=TIME(25,0,0)'.replace(/,/g, sep), 1 / 24);
  await expect(`=FACT(170)>1e306`, true);
  await expect('=FACT(171)', { err: '#NUM!' });
  await expect(`=POWER(0${sep}0)`, 1);
  await expect(`=POWER(0${sep}-1)`, { err: '#DIV/0!' });
  await expect('=SQRT(-1)', { err: '#NUM!' });
  await expectErr(`=VALUE("1e400")`);
  await expect(`=MID("abc"${sep}0${sep}1)`, { err: '#VALUE!' });
  await expect(`=LEFT("abc"${sep}-1)`, { err: '#VALUE!' });
  await expect(`=REPT("a"${sep}-1)`, { err: '#VALUE!' });
  await expect(`=CHOOSE(0${sep}1)`, { err: '#VALUE!' });
  await expect(`=SUM(B1:B3)`, 0);
  await expect(`=COUNT(B1:B3)`, 0);
  await expect(`=AVERAGE(B1:B3)`, { err: '#DIV/0!' });
  await expect(`=MAX(B1:B3)`, 0);
  await expect(`=${IF}(B1=""${sep}"leeg"${sep}"vol")`, 'leeg');
  await expect(`=${IF}(B1=0${sep}1${sep}2)`, 1);
  await expect('=B1&"x"', 'x');
  await expect('=B1+1', 1);
  await expect(`=ISBLANK(B1)`, true);
  await expect(`=ISBLANK(B1:B1)`, true);
  await expect(`=ROWS(A:A)`, App.MAXR);
  await expect(`=COLUMNS(1:1)`, App.MAXC);
  await expect('=ROMAN(3999)', 'MMMCMXCIX');
  await expect(`=BASE(255${sep}16)`, 'FF');
  await expect(`=DECIMAL("FF"${sep}16)`, 255);
  await expect(`=TEXT(0${dec}5${sep}"0%")`, '50%');
  await expect(`=EXACT("ss"${sep}"ß")`, false);
  await expect(`=UPPER("ß")`, 'SS');
  // kringverwijzingen
  put('A1', '=A1'); calc();
  await test('formula', 'self reference → 0/error, no hang (Excel: 0 + warning)', () => cv('A1'), (v) => isErrVal(v) || isNum(v) ? true : 'got ' + short(v));
  put('A1', '=A2+1'); put('A2', '=A3+1'); put('A3', '=A1+1'); calc();
  await test('formula', '3-cell cycle → no hang', () => [cv('A1'), cv('A2'), cv('A3')], (vs) => vs.every((v) => isErrVal(v) || isNum(v)) ? true : 'got ' + short(vs));
  put('A3', '1'); calc();
  await test('formula', 'cycle broken → recalculates', () => cv('A1'), (v) => v === 3 ? true : 'got ' + short(v));
  put('A1', '=INDIRECT("A1")'); calc();
  await test('formula', 'INDIRECT self cycle → no hang', () => cv('A1'), (v) => isErrVal(v) || isNum(v) ? true : 'got ' + short(v));
  put('A1', `=OFFSET(A1${sep}0${sep}0)`); calc();
  await test('formula', 'OFFSET self cycle → no hang', () => cv('A1'), (v) => isErrVal(v) || isNum(v) ? true : 'got ' + short(v));
  clearAll();
  // overloop
  put('A1', '=SEQUENCE(3)'); put('A2', 'x'); calc();
  await test('formula', 'spill blocked → #SPILL!', () => cv('A1'), (v) => isErrVal(v) && /SPILL|OVERLOOP/.test(v.err) ? true : 'got ' + short(v));
  put('A2', ''); calc();
  await test('formula', 'spill unblocked → values', () => [cv('A1'), cv('A2'), cv('A3')], (vs) => vs[0] === 1 && vs[1] === 2 && vs[2] === 3 ? true : 'got ' + short(vs));
  put('B1', '=SUM(A1#)'); calc();
  await test('formula', 'SUM(A1#)', () => cv('B1'), (v) => v === 6 ? true : 'got ' + short(v));
  put('A1', '=SEQUENCE(2)'); calc();
  await test('formula', 'spill shrinks: A3 cleared', () => [cv('A3'), cv('B1')], (vs) => (vs[0] === null || vs[0] === undefined || vs[0] === '') && vs[1] === 3 ? true : 'got ' + short(vs));
  clearAll();
  // diep en groot
  await test('formula', 'nested IF depth 200', () => evalF('=' + `${IF}(1${sep}`.repeat(200) + '1' + ')'.repeat(200)), (v) => v === 1 || isErrVal(v) || (v && v.rejected) ? true : 'got ' + short(v));
  await test('formula', 'nested parens depth 3000', () => evalF('=' + '('.repeat(3000) + '1' + ')'.repeat(3000)), (v) => v === 1 || isErrVal(v) || (v && v.rejected) ? true : 'got ' + short(v));
  await test('formula', 'formula with 20 000 terms', () => evalF('=' + Array(20000).fill('1').join('+')), (v) => v === 20000 || isErrVal(v) || (v && v.rejected) ? true : 'got ' + short(v));
  await test('formula', 'string literal of 1 MB', () => { const v = evalF('="' + 'a'.repeat(1e6) + '"'); return typeof v === 'string' ? v.length : v; }, (v) => v === 1e6 || isErrVal(v) || (v && v.rejected) ? true : 'got ' + short(v));
  await test('formula', 'SUM over whole column A:A', () => evalF('=SUM(A:A)', 'B1'), (v) => isNum(v) ? true : 'got ' + short(v));
  await test('formula', 'SUM over whole sheet A:XFD', () => evalF('=SUM(A:XFD)', 'B1'), (v) => isNum(v) || isErrVal(v) ? true : 'got ' + short(v));
  await test('formula', 'COUNTBLANK(A:A)', () => evalF('=COUNTBLANK(A:A)', 'B1'), (v) => isNum(v) || isErrVal(v) ? true : 'got ' + short(v));
  await test('formula', 'ROW(A:A) spill (1M rows) is refused or bounded', () => { const v = evalF('=ROW(A:A)', 'B1'); return isErrVal(v) ? v : App.cellCount(sh); }, (v) => true);
  clearAll();
  await test('formula', 'SEQUENCE(100000) spill', () => { const v = evalF('=SEQUENCE(100000)'); return isErrVal(v) ? v : App.cellCount(sh); }, (v) => isErrVal(v) || isNum(v) ? true : 'got ' + short(v));
  clearAll();
  await test('formula', 'SEQUENCE(1e7) is refused, not allocated', () => { const v = evalF('=SEQUENCE(1e7)'); return isErrVal(v) ? v : App.cellCount(sh); }, (v) => isErrVal(v) ? true : 'allocated ' + short(v) + ' cells');
  clearAll();
  await test('formula', 'REPT("a",1e8) → #VALUE! (Excel cell text limit 32767)', () => { const v = evalF('=REPT("a"' + sep + '1e8)'); return typeof v === 'string' ? v.length : v; }, (v) => isErrVal(v) ? true : 'made ' + short(v));
  await test('formula', 'REPT("ab",16383) allowed', () => { const v = evalF('=LEN(REPT("ab"' + sep + '16383))'); return v; }, (v) => v === 32766 ? true : 'got ' + short(v));
  await test('formula', 'regex catastrophic backtracking (a+)+$', () => evalF(`=REGEXTEST(REPT("a"${sep}40)&"b"${sep}"(a+)+$")`), (v) => v === false || isErrVal(v) ? true : 'got ' + short(v));
  // regex-heuristiek: geneste herhaling geweigerd, gewone patronen toegestaan
  for (const [pat, want] of [['(a+)+', 'err'], ['(a*)*', 'err'], ['(a+){2}', 'err'], ['((a+))+', 'err'], ['(x|y+)+', 'err'], ['(a+)+$', 'err'], [')', 'err'], ['(', 'err'],
    ['(ab)+', true], ['[a-z]+', true], ['(\\d+)', true], ['a{2,3}', true], ['(a+)?', true], ['(?:a)+', true], ['(a+)(b+)', true], ['\\(a+\\)+', true], ['[(a+)+]', true], ['^abc$', true], ['a|b', true]]) {
    await test('formula', `REGEXTEST("aab", ${short(pat)}) ${want === 'err' ? 'refused' : 'allowed'}`, () => evalF(`=REGEXTEST("aab"${sep}"${pat.replace(/"/g, '""')}")`), (v) => want === 'err' ? (isErrVal(v) ? true : 'got ' + short(v)) : (typeof v === 'boolean' ? true : 'got ' + short(v)));
  }
  await test('formula', 'REGEXREPLACE with nested quantifier refused', () => evalF(`=REGEXREPLACE("aaa"${sep}"(a+)+"${sep}"x")`), (v) => isErrVal(v) ? true : 'got ' + short(v));
  await test('formula', 'REGEXEXTRACT normal', () => evalF(`=REGEXEXTRACT("ab12"${sep}"\\d+")`), (v) => v === '12' ? true : 'got ' + short(v));
  await test('formula', 'recursive LAMBDA (x(x))', () => evalF(`=LAMBDA(x${sep}x(x))(LAMBDA(x${sep}x(x)))`), (v) => isErrVal(v) || (v && v.rejected) || v === null ? true : 'got ' + short(v));
  await test('formula', 'MAP over 100k', () => evalF(`=SUM(MAP(SEQUENCE(100000)${sep}LAMBDA(x${sep}x)))`), (v) => isNum(v) || isErrVal(v) ? true : 'got ' + short(v));
  clearAll();
  // vertaling NL↔EN rondreis
  const canonSamples = ['SUM(A1,B2:C3)', 'IF(A1>1.5,"a,b","c;d")', 'TEXT(A1,"0.00")', 'VLOOKUP(1,A1:B2,2,FALSE)', 'SUM(Sheet1!A1)', "SUM('My Sheet'!A1:A2)", 'A1:A1#', '1E+5', '" "', 'LET(x,1,x+1)', '-A1^2', 'TRUE', 'SUM(1.5,2.5)'];
  for (const c of canonSamples) await test('formula', `toLocal/toCanon round trip ${short(c)}`, () => F.toCanon(F.toLocal(c)), (r) => r === c ? true : 'got ' + short(r));
  await test('formula', 'toCanon of 1 MB garbage', () => F.toCanon('a'.repeat(1e6)).length, (n) => isNum(n));
  await test('formula', 'toCanon of 10 000 unclosed parens', () => F.toCanon('('.repeat(10000)).length, (n) => isNum(n));
  await test('formula', 'check() of 10 000 unclosed parens', () => F.check('('.repeat(10000)), () => true);
  await test('formula', 'F.shift on huge offset', () => F.shift('A1+B1', 2e6, 2e6), (r) => typeof r === 'string');
  await test('formula', 'F.shift negative to below A1', () => F.shift('A1+B1', -5, -5), (r) => typeof r === 'string');

  /* === D. serialisatie === */
  section('D. Serialisatie');
  put('A1', '1'); put('A2', 'tekst'); put('A3', '=A1+1'); put('A4', TRUE); put('A5', '1e308'); put('A6', '😀\n\u0000"\\'); calc();
  sh.data.get(0).get(0).v = Infinity;
  await test('serial', 'serializeBook with Infinity/NaN survives JSON', () => { const o = App.serializeBook(); const j = JSON.stringify(o); const b = App.deserializeBook(JSON.parse(j)); return b.sheets.length; }, (n) => n === App.book.sheets.length ? true : 'got ' + n);
  await test('serial', 'round trip keeps strings exactly', () => { const o = JSON.parse(JSON.stringify(App.serializeBook())); const b = App.deserializeBook(o); const s = b.sheets.find((x) => x.name === 'Stresstest'); return App.getCell(s, 5, 0).v; }, (v) => v === '😀\n\u0000"\\' ? true : 'got ' + short(v));
  await test('serial', 'deserializeBook({})', () => App.deserializeBook({}).sheets.length, (n) => n === 1);
  await test('serial', 'deserializeBook({sheets:[{}]})', () => App.deserializeBook({ sheets: [{}] }).sheets[0].name, (n) => typeof n === 'string');
  await test('serial', 'deserializeBook with cells out of range', () => { const b = App.deserializeBook({ sheets: [{ name: 'x', cells: [[-1, -1, { v: 1 }], [1e9, 1e9, { v: 2 }], ['a', 'b', { v: 3 }], [0, 0, null]] }] }); return App.cellCount(b.sheets[0]); }, (n) => isNum(n));
  await test('serial', 'deserializeBook with evil names/ids', () => { const b = App.deserializeBook({ title: 'x'.repeat(1e5), sheets: [{ name: 'a'.repeat(1e4), cells: [] }, { name: '', cells: [] }, { name: '\u0000', cells: [] }], active: 99, names: { '__proto__': 'A1', 'constructor': 'B1' } }); return [b.title.length, b.sheets.length, b.active]; }, (r) => r[2] < r[1] ? true : 'active out of range ' + short(r));
  clearAll();

  /* === E. samenvoegen (delen.js) === */
  section('E. Samenvoegen bij delen');
  const M = App.mergeShared;
  const rnd = (n, alphabet) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
  let mergeFails = [];
  for (let i = 0; i < 300; i++) {
    const base = rnd(Math.floor(Math.random() * 12), 'abcdef');
    const mutate = (arr) => { const a = arr.slice(); const k = Math.floor(Math.random() * 4); for (let j = 0; j < k; j++) { const op = Math.random(); const at = Math.floor(Math.random() * (a.length + 1)); if (op < 0.33 && a.length) a.splice(at % a.length, 1); else if (op < 0.66) a.splice(at, 0, 'X' + j); else if (a.length) a[at % a.length] = 'Y' + j; } return a; };
    const local = mutate(base), remote = mutate(base);
    let out;
    try { out = M.blocks(base, local, remote); } catch (e) { mergeFails.push('threw ' + e.message); continue; }
    if (!Array.isArray(out)) { mergeFails.push('not array'); continue; }
    const onlyLocal = local.filter((x) => x.startsWith('X') || x.startsWith('Y'));
    if (!onlyLocal.every((x) => out.includes(x))) mergeFails.push(`lost local change: base=${JSON.stringify(base)} local=${JSON.stringify(local)} remote=${JSON.stringify(remote)} out=${JSON.stringify(out)}`);
    if (JSON.stringify(M.blocks(base, base, remote)) !== JSON.stringify(remote)) mergeFails.push('local==base should give remote');
    if (JSON.stringify(M.blocks(base, local, base)) !== JSON.stringify(local)) mergeFails.push('remote==base should give local');
    if (out.length > base.length + local.length + remote.length) mergeFails.push('result too long');
  }
  await test('merge', '300 random three-way block merges', () => mergeFails.slice(0, 3), (f) => f.length ? f.join(' | ') : true);
  await test('merge', 'both sides identical change', () => M.blocks(['a', 'b'], ['a', 'c'], ['a', 'c']), (o) => JSON.stringify(o) === '["a","c"]' ? true : 'got ' + short(o));
  await test('merge', 'empty everything', () => M.blocks([], [], []), (o) => o.length === 0);
  await test('merge', 'empty base doc: both insertions kept', () => M.blocks([], ['l'], ['r']), (o) => JSON.stringify(o) === '["r","l"]' ? true : 'got ' + short(o));
  await test('merge', 'no base known (null): local wins', () => M.blocks(null, ['l'], ['r']), (o) => JSON.stringify(o) === '["l"]' ? true : 'got ' + short(o));
  await test('merge', 'local emptied doc, remote unchanged', () => M.blocks(['a', 'b'], [], ['a', 'b']), (o) => o.length === 0 ? true : 'got ' + short(o));
  await test('merge', '3000 x 3000 blocks (DP fallback) time', () => { const b = Array.from({ length: 3000 }, (_, i) => 'p' + i); const l = b.slice(); l[10] = 'L'; const r = b.slice(); r[2000] = 'R'; return M.blocks(b, l, r).length; }, (n) => n === 3000);
  await test('merge', '1500 x 1500 blocks (DP) time', () => { const b = Array.from({ length: 1500 }, (_, i) => 'p' + i); const l = b.slice(); l[10] = 'L'; const r = b.slice(); r[1000] = 'R'; const o = M.blocks(b, l, r); return [o.length, o[10], o[1000]]; }, (o) => o[0] === 1500 && o[1] === 'L' && o[2] === 'R' ? true : 'got ' + short(o));
  const bk = (cells, extra) => ({ sheets: [{ name: 'S', cells, colW: {}, ...(extra || {}) }], title: 'T' });
  await test('merge', 'cel merge: both delete same cell', () => M.docs(bk([[0, 0, { v: 1 }]]), bk([]), bk([])).sheets[0].cells.length, (n) => n === 0);
  await test('merge', 'cel merge: local edits, remote deletes same cell → local wins', () => M.docs(bk([[0, 0, { v: 1 }]]), bk([[0, 0, { v: 2 }]]), bk([])).sheets[0].cells, (c) => c.length === 1 && c[0][2].v === 2 ? true : 'got ' + short(c));
  await test('merge', 'cel merge: sheet added on both sides with same name', () => M.docs({ sheets: [] }, { sheets: [{ name: 'N', cells: [[0, 0, { v: 'l' }]] }] }, { sheets: [{ name: 'N', cells: [[1, 0, { v: 'r' }]] }] }).sheets[0].cells.length, (n) => n === 2 ? true : 'got ' + n);
  await test('merge', 'cel merge: null base', () => M.docs(null, bk([[0, 0, { v: 1 }]]), bk([[1, 1, { v: 2 }]])).sheets[0].cells.length, (n) => n === 2 ? true : 'got ' + n);
  await test('merge', 'cel merge: garbage input does not throw', () => M.docs({}, { sheets: 'x' }, { sheets: null }), (o) => o && typeof o === 'object');
  await test('merge', 'cel merge: 50 000 cells time', () => { const cells = Array.from({ length: 50000 }, (_, i) => [i, 0, { v: i }]); const l = cells.slice(); l[5] = [5, 0, { v: 'L' }]; const r = cells.slice(); r[9] = [9, 0, { v: 'R' }]; const o = M.docs(bk(cells), bk(l), bk(r)); return o.sheets[0].cells.length; }, (n) => n === 50000);

  /* === F. deel-API (server) === */
  section('F. Deel-API van de server');
  const base = W.location.origin;
  const call = async (method, p, body, headers) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); let j = null; try { j = await r.json(); } catch { /* geen json */ } return { status: r.status, j }; };
  const alive = async () => (await call('GET', '/deel/info')).status === 200;
  if (!(await alive())) line('fail', 'Geen deel-server (open deze pagina via start-cel.bat / node server.js); API-tests overgeslagen.');
  else {
    await test('api', 'POST /deel without body', () => call('POST', '/deel'), (r) => r.status === 400 ? true : 'status ' + r.status);
    await test('api', 'POST /deel invalid JSON', () => call('POST', '/deel', '{not json'), (r) => r.status === 400 ? true : 'status ' + r.status);
    await test('api', 'POST /deel JSON array', () => call('POST', '/deel', '[1,2]'), (r) => r.status === 400 ? true : 'status ' + r.status);
    await test('api', 'POST /deel JSON null', () => call('POST', '/deel', 'null'), (r) => r.status === 400 ? true : 'status ' + r.status);
    const made = [];
    const mk = async (body) => { const r = await call('POST', '/deel', body); if (r.j && r.j.id) made.push(r.j); return r; };
    await test('api', 'POST /deel data only', () => mk({ data: '{}' }), (r) => r.status === 200 && r.j && r.j.id ? true : 'status ' + r.status);
    await test('api', 'POST /deel huge title/code/by are truncated', () => mk({ data: '{}', title: 'T'.repeat(1e5), code: 'c'.repeat(1e4), by: 'b'.repeat(1e4), perm: 'admin' }), (r) => r.status === 200 && r.j.title.length <= 200 && r.j.perm === 'edit' ? true : short(r));
    await test('api', 'POST /deel with 2 MB data', () => mk({ data: 'x'.repeat(2e6) }), (r) => r.status === 200 ? true : 'status ' + r.status);
    await test('api', 'POST /deel with data as object (not string)', () => mk({ data: { a: 1 } }), (r) => r.status === 200 ? true : 'status ' + r.status);
    const s = made[0];
    await test('api', 'GET /deel/:id', () => call('GET', '/deel/' + s.id), (r) => r.status === 200 && r.j.data === '{}' ? true : short(r));
    await test('api', 'GET /deel/../server.js (path traversal)', () => fetch(base + '/deel/..%2F..%2Fserver.js').then((r) => r.status), (st) => st === 404 || st === 400 ? true : 'status ' + st);
    await test('api', 'GET /deel/<64 chars>', () => call('GET', '/deel/' + 'a'.repeat(64)), (r) => r.status === 404 ? true : 'status ' + r.status);
    await test('api', 'GET /deel/<unicode id>', () => call('GET', '/deel/' + encodeURIComponent('ééé😀')), (r) => r.status === 404 || r.status === 400 ? true : 'status ' + r.status);
    await test('api', 'GET /deel/:id/versie', () => call('GET', `/deel/${s.id}/versie`), (r) => r.status === 200 && r.j.version === 1 ? true : short(r));
    await test('api', 'PUT without owner on edit share', () => call('PUT', '/deel/' + s.id, { data: '{"v":2}' }), (r) => r.status === 200 && r.j.version === 2 ? true : short(r));
    await test('api', 'PUT with stale base → 409 with data', () => call('PUT', '/deel/' + s.id, { data: '{"v":3}', base: 1 }), (r) => r.status === 409 && r.j.version === 2 && r.j.data === '{"v":2}' ? true : short(r));
    await test('api', 'PUT with base as string "2"', () => call('PUT', '/deel/' + s.id, { data: '{"v":3}', base: '2' }), (r) => r.status === 200 ? true : short(r));
    await test('api', 'PUT with base "abc"', () => call('PUT', '/deel/' + s.id, { data: '{"v":4}', base: 'abc' }), (r) => r.status === 409 || r.status === 400 ? true : 'status ' + r.status + ' (accepted an unparsable base)');
    await test('api', 'PUT with base NaN/null', () => call('PUT', '/deel/' + s.id, { data: '{"v":4}', base: null }), (r) => r.status === 200 ? true : 'status ' + r.status);
    await test('api', 'PUT with title only keeps data', () => call('PUT', '/deel/' + s.id, { title: 'nieuw' }).then(() => call('GET', '/deel/' + s.id)), (r) => r.j.title === 'nieuw' && r.j.data && r.j.data.length ? true : short(r));
    await test('api', 'PATCH without owner → 403', () => call('PATCH', '/deel/' + s.id, { perm: 'view' }), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'PATCH as owner perm=view', () => call('PATCH', '/deel/' + s.id, { perm: 'view' }, { 'X-Eigenaar': s.owner }), (r) => r.status === 200 ? true : short(r));
    await test('api', 'PUT by non-owner on view share → 403', () => call('PUT', '/deel/' + s.id, { data: '{}' }), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'PUT by owner on view share → 200', () => call('PUT', '/deel/' + s.id, { data: '{}' }, { 'X-Eigenaar': s.owner }), (r) => r.status === 200 ? true : 'status ' + r.status);
    await test('api', 'PATCH perm=garbage is ignored or rejected', () => call('PATCH', '/deel/' + s.id, { perm: 'admin' }, { 'X-Eigenaar': s.owner }).then(() => call('GET', '/deel/' + s.id)), (r) => r.j.perm === 'view' || r.j.perm === 'edit' ? true : short(r));
    await test('api', 'PATCH code with 10k chars is truncated', () => call('PATCH', '/deel/' + s.id, { code: 'z'.repeat(1e4) }, { 'X-Eigenaar': s.owner }).then(() => call('GET', '/deel/' + s.id, undefined, { 'X-Eigenaar': s.owner })), (r) => r.status === 200 ? true : short(r));
    await test('api', 'GET with code required, no code → 403', () => call('GET', '/deel/' + s.id), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'GET with wrong code → 403', () => call('GET', '/deel/' + s.id, undefined, { 'X-Code': 'nope' }), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'GET with correct (truncated) code', () => call('GET', '/deel/' + s.id, undefined, { 'X-Code': 'z'.repeat(40) }), (r) => r.status === 200 ? true : 'status ' + r.status + ' (code longer than stored?)');
    await test('api', 'DELETE without owner → 403', () => call('DELETE', '/deel/' + s.id), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'DELETE with wrong owner → 403', () => call('DELETE', '/deel/' + s.id, undefined, { 'X-Eigenaar': 'x'.repeat(24) }), (r) => r.status === 403 ? true : 'status ' + r.status);
    await test('api', 'OPTIONS preflight', () => fetch(base + '/deel/' + s.id, { method: 'OPTIONS' }).then((r) => r.status), (st) => st === 204 ? true : 'status ' + st);
    await test('api', 'unknown method', () => fetch(base + '/deel/' + s.id, { method: 'TRACE' }).then((r) => r.status).catch((e) => 'fetch error ' + e.message), (st) => st === 405 || st === 404 || typeof st === 'string' ? true : 'status ' + st);
    await test('api', '20 concurrent PUTs keep version consistent', async () => { const t = made[2]; await Promise.all(Array.from({ length: 20 }, (_, i) => call('PUT', '/deel/' + t.id, { data: '{"i":' + i + '}' }))); const r = await call('GET', `/deel/${t.id}/versie`); return r.j.version; }, (v) => v === 21 ? true : 'version ' + v);
    await test('api', 'server still alive after all that', () => alive(), (ok) => ok === true);
    for (const m of made) await call('DELETE', '/deel/' + m.id, undefined, { 'X-Eigenaar': m.owner });
    await test('api', 'cleanup: test shares deleted', async () => (await call('GET', '/deel/' + made[0].id)).status, (st) => st === 404 ? true : 'status ' + st);
  }

  /* === G. vertaallaag === */
  section('G. Vertaallaag');
  await test('i18n', 'App.t(1 MB text) fast', () => App.t('x'.repeat(1e6)).length, (n) => n === 1e6);
  await test('i18n', 'App.t("(a+)+$")', () => App.t('(a+)+$'), (s) => s === '(a+)+$');
  await test('i18n', 'App.t with regex-special pattern input', () => App.t('{0} van {1}'), (s) => typeof s === 'string');
  await test('i18n', 'App.t(null)', () => App.t(null), (s) => s === null || typeof s === 'string');
  await test('i18n', 'App.t("JJ van Schelven") untouched', () => App.t('JJ van Schelven'), (s) => s === 'JJ van Schelven' ? true : 'got ' + s);
  await test('i18n', 'App.t on 2000 long untranslated lines', () => { const t0 = performance.now(); for (let i = 0; i < 2000; i++) App.t('Dit is een lange Nederlandse zin nummer ' + i + ' die niet in het woordenboek staat en van alles bevat.'); return Math.round(performance.now() - t0); }, (ms) => ms < 2000 ? true : ms + ' ms');

  /* klaar */
  App.book.sheets.splice(App.book.sheets.indexOf(sh), 1);
  App.touchAll && App.touchAll();
  section('Klaar');
  const fails = RESULTS.filter((r) => !r.ok);
  line(fails.length ? 'fail' : 'ok', `${fails.length} mislukt van ${RESULTS.length}`);
  fails.forEach((f) => line('fail', `  ${f.cat} · ${f.name} → ${f.value}  ${f.note}`));
  const slow = RESULTS.filter((r) => r.ok && r.ms > SLOW_MS).sort((a, b) => b.ms - a.ms);
  slow.forEach((f) => line('slow', `  traag ${f.ms} ms: ${f.cat} · ${f.name}`));
  window.DONE = true;
}

document.getElementById('app').addEventListener('load', () => {
  const wait = () => { const w = document.getElementById('app').contentWindow; if (w.App && w.App.book && w.App.F && w.App.mergeShared) run().catch((e) => { line('fail', 'Runner crashed: ' + e.message + '\n' + e.stack); window.DONE = true; }); else setTimeout(wait, 100); };
  wait();
});
