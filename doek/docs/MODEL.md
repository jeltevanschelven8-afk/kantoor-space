# Doek — documentmodel

Naslag voor iedereen die aan Doek werkt. Een presentatie is gewone JSON (zo staat hij ook in een `.doek`-bestand).
Namen van velden zijn kort en Engels, zoals in OOXML; commentaar en interface zijn Nederlands.

## Eenheden

| Grootheid | Eenheid | Omrekenen naar OOXML |
|---|---|---|
| Positie, grootte, inspringing, marges | px (1/96 inch) | × 9525 = EMU |
| Tekengrootte, lijndikte, alinea-afstand, tekenafstand | pt | × 12700 = EMU (lijn), × 100 (sz) |
| Hoeken | graden (rechtsom) | × 60000 |
| Percentages (transparantie, aanpassingen) | 0..1 | × 100000 |
| Tijd (animaties, overgangen) | seconden | × 1000 = ms |

Diaformaat 16:9 = 1280 × 720 px (13,333 × 7,5 inch), 4:3 = 960 × 720 px.

## Kleuren (`ColorRef`)

Een tekenreeks:

- `'#rrggbb'` — vaste kleur;
- themakleur: `'tx1' 'bg1' 'tx2' 'bg2' 'accent1'…'accent6' 'hlink' 'folHlink'` (ook `'dk1' 'lt1' 'dk2' 'lt2'`);
- met variant: `'accent1/l40'` = 40% lichter (lumMod 60000, lumOff 40000), `'accent1/d25'` = 25% donkerder
  (lumMod 75000). Toegestaan: `l` of `d` met 1..100.

`App.color(ref, theme)` geeft altijd `'#rrggbb'`. Transparantie staat los: `alpha` (0..1, 1 = dekkend).

## Thema

```js
theme = {
  id, name,
  colors: { dk1, lt1, dk2, lt2, accent1, accent2, accent3, accent4, accent5, accent6, hlink, folHlink },  // '#rrggbb'
  fonts: { major: 'Inter', minor: 'Inter' },   // koppen / hoofdtekst; in runs: '+mj' en '+mn'
}
```

## Opvulling (`Fill`), lijn (`Line`), effecten

```js
Fill = { type: 'none' }
     | { type: 'solid', color: ColorRef, alpha? }
     | { type: 'grad', kind: 'linear'|'radial'|'rect'|'path', angle?: graden /* 0 = links→rechts, 90 = boven→onder */,
         stops: [{ p: 0..1, color: ColorRef, alpha? }] }
     | { type: 'img', media: mediaId, mode: 'stretch'|'tile', alpha? }
     | { type: 'pattern', pat: 'pct5'|'pct10'|…|'horz'|'vert'|'dnDiag'|'upDiag'|'cross'|'diagCross'|…, fg: ColorRef, bg: ColorRef }

Line = { type: 'none' }
     | { type: 'solid', color: ColorRef, alpha?, w: pt,
         dash?: 'solid'|'sysDot'|'sysDash'|'dash'|'dashDot'|'lgDash'|'lgDashDot'|'lgDashDotDot',
         cap?: 'flat'|'rnd'|'sq', join?: 'round'|'bevel'|'miter', cmpd?: 'sng'|'dbl'|'thickThin'|'thinThick'|'tri',
         head?: Arrow, tail?: Arrow }      // head = begin van de lijn, tail = einde
Arrow = { type: 'none'|'triangle'|'stealth'|'diamond'|'oval'|'arrow', w?: 'sm'|'med'|'lg', len?: 'sm'|'med'|'lg' }

Effects = {
  shadow?: { type: 'outer'|'inner', color: ColorRef, alpha, blur: px, dist: px, dir: graden },
  glow?: { color: ColorRef, alpha, size: px },
  soft?: px,                                   // zachte randen
  refl?: { alpha: 0..1, size: 0..1, dist: px, blur: px },
  rot3d?: { x: graden, y: graden, persp: px },
  bevel?: { type: string, w: px, h: px },
}
```

`fill`/`line` die `undefined` zijn, volgen de standaardstijl: vormen = `accent1` met donkerdere rand, tekstvakken en
placeholders = geen opvulling en geen rand.

## Presentatie

```js
pres = {
  format: 'doek', version: 1, id, title,
  size: { w: 1280, h: 720, kind: '16:9' },     // kind: '16:9'|'4:3'|'16:10'|'A4'|'custom'
  masters: [Master],
  slides: [Slide],
  sections: [{ id, name }],                     // dia's verwijzen ernaar met slide.sec; altijd aaneengesloten
  shows: [{ id, name, slides: [slideId] }],    // aangepaste voorstellingen
  hf: { dt: false, dtAuto: true, dtFmt: 'long', dtText: '', sldNum: false, ftr: false, ftrText: '', notTitle: true },
  show: { type: 'speaker'|'window'|'kiosk', loop: false, timings: true, anims: true, range: null, custom: null, pen: '#ff0000', laser: '#ff0000' },
  guides: [{ dir: 'h'|'v', pos: px }],
  lang: 'nl-NL'|'en-US',
  props: { created, modified, subject?, keywords?, category? },   // geen auteur: geen persoonsgegevens
  share?: {…}                                    // zie delen.js
}
```

Media (afbeeldingen, video, geluid) staan **niet** in `pres` maar in `App.media` (`id → { mime, url }`, `url` is een
data-URL). In een `.doek`-bestand staan ze onder `media`. In de browser staan ze in IndexedDB.

## Master en indelingen

```js
Master = {
  id, name, theme: Theme,
  bg: Fill,
  objs: [Obj],                  // decoraties en placeholders: title, body, dt, ftr, sldNum
  tx: { title: [Lvl], body: [Lvl × 9], other: [Lvl × 9] },   // tekststijlen per niveau
  layouts: [Layout],
}
Layout = { id, name, type, bg?: Fill, hideMaster?: bool, objs: [Obj] }
// type: 'title'|'obj'|'secHead'|'twoObj'|'twoTxTwoObj'|'titleOnly'|'blank'|'objTx'|'picTx'|'vertTx'|'vertTitleAndTx'|'cust'
Lvl = ParaProps & RunProps   // bijv. { marL: 30, indent: -30, sz: 28, font: '+mn', color: 'tx1', bullet: {…}, spcBef: 10 }
```

Overerving van tekstopmaak (van zwak naar sterk): `master.tx` → master-placeholder → indeling-placeholder →
`obj.text.lst` → alinea → run. Lettertype `'+mj'`/`'+mn'` = themalettertype. Geometrie van een placeholder op een dia
die `x/y/w/h === undefined` heeft, komt van de placeholder in de indeling (en anders van de master).

## Dia

```js
Slide = {
  id, layout: layoutId, objs: [Obj], name?,
  bg?: Fill, hideMaster?: bool,
  trans?: Transition, anims: [Anim],
  notes?: TextBody, comments?: [Comment],
  hidden?: bool, sec?: sectionId,
}
Transition = { type: 'fade'|'push'|'wipe'|'split'|'reveal'|'cover'|'uncover'|'cut'|'zoom'|'cube'|'flip'|'rotate'|'doors'|'window'|
                     'clock'|'shape'|'curl'|'dissolve'|'checker'|'blinds'|'morph'|'none', dir?: string, dur: s,
               click: true, after?: s|null, sound?: mediaId, morphBy?: 'obj'|'word'|'char' }
Comment = { id, author: string, text: string, t: ms, x?: px, y?: px, done?: bool, replies: [{ id, author, text, t }] }
```

## Objecten

Gemeenschappelijke velden:

```js
Obj = {
  id, type, name,
  x, y, w, h,                    // px; rotatie draait om het midden
  rot?: graden, flipH?: bool, flipV?: bool,
  hidden?: bool, locked?: bool,
  alt?: string, decorative?: bool,    // alt-tekst wordt alleen handmatig ingevuld
  ph?: { type, idx, prompt? },        // placeholder: 'title'|'ctrTitle'|'subTitle'|'body'|'obj'|'dt'|'ftr'|'sldNum'|'pic'|'chart'|'tbl'|'media'
  fill?: Fill, line?: Line, fx?: Effects,
  link?: Link, hover?: Link,
}
Link = { kind: 'url', url } | { kind: 'slide', slide: slideId } | { kind: 'first'|'last'|'next'|'prev'|'end'|'lastViewed' }
     | { kind: 'show', show: showId, ret?: bool } | { kind: 'file', path }
```

| `type` | Extra velden |
|---|---|
| `shape` | `geom` (OOXML-presetnaam, standaard `'rect'`), `adj` ({ adj: 16667 } in OOXML-eenheden), `path` (eigen geometrie, zie onder), `text`, `txbox` (true = tekstvak) |
| `line` | `pts: [[x1,y1],[x2,y2]]`, `geom: 'line'|'straightConnector1'|'bentConnector3'|'curvedConnector3'`, `adj`, `conn?: { st?: { obj, site }, end?: { obj, site } }`, `line`; `x/y/w/h` worden afgeleid |
| `image` | `media`, `nat: { w, h }`, `crop?: { l, t, r, b }` (0..1), `geom?` (bijsnijden naar vorm), `pic?: { bright: -1..1, contrast: -1..1, sat: 0..2, alpha: 0..1, recolor?: 'gray'|'sepia'|'wash'|'bw'|'duo:ColorRef', blur?: px, sharpen?: 0..1, chroma?: '#rrggbb' }` |
| `table` | `cols: [px]`, `rows: [{ h, cells: [Cell] }]`, `tstyle: { id, first, last, bandR, bandC, firstC, lastC }` |
| `chart` | `chart: Chart` (zie charts.js) |
| `group` | `objs: [Obj]` in coördinaten binnen de groep (0..w, 0..h) |
| `video`, `audio` | `media`, `poster?`, `trim?: { start, end }`, `fade?: { in, out }`, `play: 'click'|'auto'|'seq'`, `loop?`, `rewind?`, `hide?`, `vol?`, `marks?: [{ t, name }]` |
| `diagram` | `dia: { layout, items: [{ id, text, lvl }], color: 'accent1'|'colorful1'|…, look: 'flat'|'subtle'|'intense'|'outline' }` |
| `equation` | `tex` (LaTeX), `color?`, `sz?` (pt) |
| `icon` | `icon` (naam uit Material Symbols), `color` |
| `ink` | `strokes: [{ pts: [[x, y, druk]], color, w: px, alpha?, hl?: bool }]` (coördinaten binnen het object) |

Eigen geometrie (`path`, voor vrije vormen, punten bewerken en samengevoegde vormen):

```js
path = { w, h, subs: [{ closed: bool, pts: [{ x, y, c1?: [x, y], c2?: [x, y] }] }] }   // c1/c2 = besturingspunten van de curve naar dit punt
```

Cel van een tabel: `{ text: TextBody, fill?, bd?: { l?: Line, r?, t?, b?, d1?, d2? }, span?: { c, r }, merged?: bool, vAlign?, ins? }`.

## Tekst

```js
TextBody = {
  paras: [Para],
  vAlign?: 't'|'ctr'|'b', ins?: { l, t, r, b } /* px, standaard 9.6, 4.8, 9.6, 4.8 */,
  fit?: 'none'|'shrink'|'resize', scale?: { font, spc } /* berekend bij verkleinen */,
  wrap?: bool, cols?: { n, gap }, vert?: 'horz'|'vert'|'vert270'|'stacked', rtl?: bool,
  warp?: string,                 // WordArt-vorm, bijv. 'textArchUp'
  lst?: { [lvl]: Lvl },          // eigen lijststijl van dit object
}
Para = {
  runs: [Run],                   // minstens één run (mag lege tekst hebben)
  align?: 'l'|'ctr'|'r'|'just'|'dist', lvl?: 0..8,
  marL?: px, indent?: px, lnSpc?: { pct } | { pt }, spcBef?: pt, spcAft?: pt,
  bullet?: { type: 'none' } | { type: 'char', char, font?, color?, sz? } | { type: 'auto', scheme, start? , color?, sz? },
  tabs?: [{ pos: px, algn }], rtl?: bool, end?: RunProps,
}
Run = {
  t: string,                     // '\v' = regeleinde binnen de alinea
  b?, i?, u?: 'sng'|'dbl'|'heavy'|'dotted'|'dash'|'dotDash'|'wavy', s?: 'sng'|'dbl',
  base?: % /* 30 = superscript, -25 = subscript */, caps?: 'all'|'small',
  sz?: pt, font?: string, color?: ColorRef, alpha?, hl?: ColorRef, spc?: pt, kern?: pt,
  fill?: Fill, ln?: Line, fx?: Effects,       // WordArt
  lang?: string, link?: Link, fld?: { type: 'slidenum'|'datetime' }, ot?: { liga?, smcp?, onum?, tnum? },
}
```

## Animaties

```js
Anim = {
  id, obj: objId,
  cls: 'entr'|'emph'|'exit'|'path',
  eff: string,            // bijv. 'appear' 'fade' 'fly' 'float' 'wheel' 'wipe' 'split' 'zoom' 'spin' 'bounce' 'pulse' 'teeter' 'color' 'grow' 'transp'
  dir?: string, emph?: { color?, scale?, angle?, alpha? },
  start: 'click'|'with'|'after', dur: s, delay: s,
  rep?: number|'next'|'end', rew?: bool,
  seq?: 'one'|'para',     // per alinea = elke alinea een eigen stap
  by?: 'all'|'word'|'letter', byDelay?: 0..1,
  after?: { type: 'none'|'dim'|'hide'|'hideClick', color? },
  trig?: { obj: objId } | { media: objId, mark: string },
  path?: string,          // bewegingspad als SVG-pad in fracties van de diagrootte, bijv. 'M0 0 L0.25 0'
  sound?: mediaId,
}
```

De volgorde in `slide.anims` is de volgorde in het animatiedeelvenster. Effecten met een trigger staan in een eigen
reeks die start bij een klik op het triggerobject.
