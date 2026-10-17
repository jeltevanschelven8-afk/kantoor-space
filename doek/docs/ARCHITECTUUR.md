# Doek — architectuur (één pagina)

Doek is de presentatie-editor van Kantoor Space, gemaakt door JJ van Schelven. Zelfde opzet als Inkt en Cel:
**gewone HTML, CSS en JavaScript, geen bouwstap, geen frameworks, geen AI**. Alles werkt offline.

**Waarom geen TypeScript/React/Vite?** De Windows-launcher (`Doek.exe`, hetzelfde bestand als `Inkt.exe`/`Cel.exe`)
en het Linux-programma (Electron, `desktop/`) laden de bestanden rechtstreeks uit de programmamap. Met een bouwstap zou
elke wijziging eerst gebouwd moeten worden en zou Doek anders werken dan de twee andere programma's. Eén stijl voor de
hele suite weegt zwaarder dan typecontrole; het documentmodel staat daarom precies beschreven in [MODEL.md](MODEL.md).

## Lagen

| Laag | Bestanden | Verantwoordelijkheid |
|---|---|---|
| Kern | `core.js` | `App`-namespace, documentmodel (presentatie → dia's → objecten), kleuren/thema's, commando's (`App.def`), geschiedenis (ongedaan maken met momentopnamen per dia), wijzigingsmeldingen, automatisch opslaan |
| Opmaak | `themes.js`, `text.js` | 12 eigen thema's met varianten, master → indelingen → placeholders (zoals OOXML), tekstmodel (alinea's en runs) en overerving van tekststijlen |
| Weergave | `render.js`, `shapes.js`, `charts.js`, `diagrams.js` | Eén DOM/SVG-renderer voor bewerken, miniaturen, voorstelling, afdrukken en exporteren — daardoor is de weergave overal gelijk |
| Bewerken | `editor.js`, `textedit.js`, `objects.js`, `tables.js` | Selectie, slepen/schalen/draaien, slimme hulplijnen, uitlijnen, groeperen, tekst bewerken (contenteditable ↔ model), tabellen |
| Interface | `index.html`, `ui.js`, `ribbon.js`, `panes.js` | Lint met tabbladen en contextuele tabbladen, menu's, dialogen, taakvensters (Opmaak, Animaties, Selectie, Opmerkingen), statusbalk |
| Beweging | `anim.js`, `transitions.js` | Animatie-engine (Web Animations API, eigen tijdlijn-planner, pauzeerbaar en scrubbaar), overgangen incl. Morph |
| Voorstelling | `show.js`, `presenter.js` | Volledig scherm, toetsenbord, pen/laser, presentatorweergave in een tweede venster (BroadcastChannel), timings |
| Bestanden | `file.js`, `pptx.js`, `export.js`, `opslag.js` | Bestand-scherm, .doek (JSON), .pptx lezen/schrijven (JSZip + DOMParser), PDF/PNG/SVG/video, opslag in de browser met IndexedDB voor media |
| Delen | `delen.js`, `native.js`, `gedeelde-map.js`, `start-screen.js` | Zelfde deelfuncties als Inkt/Cel: koppeling op het netwerk met live samenvoegen per dia/object, kopie verzenden, gedeelde map, startscherm |
| Taal | `i18n.js`, `lang/*.js` | Interface in het Nederlands geschreven, live vertaald naar Engels (standaard) |

## Datastroom

1. Elke wijziging is een commando: `App.exec(naam)` → `App.run()` → model aanpassen → `App.changed()`.
2. `changed()` markeert gewijzigde dia's, legt een stap vast in de geschiedenis (alleen gewijzigde dia's worden opnieuw
   als JSON bewaard), plant opnieuw tekenen (één keer per frame) en start automatisch opslaan.
3. De renderer tekent alleen de huidige dia opnieuw; miniaturen worden pas getekend als ze in beeld komen (virtualisatie
   voor 500+ dia's) en alleen voor gewijzigde dia's.

## Projectstructuur

```
doek/
├── index.html, css/, js/, js/lang/   de app
├── Doek.exe, Doek.vbs            Windows-programma (zelfde launcher als Inkt/Cel), VBS-terugval
├── server.js, start-doek.bat       lokale server (poort 8082) met deelfunctie
├── fonts/, vendor/, icons/           meegeleverde lettertypen, JSZip, KaTeX, pictogrammen
├── test/stress.html                  tests (model, geschiedenis, pptx heen-en-terug, animaties, delen, vertaling)
└── docs/                             deze notitie, MODEL.md, BEPERKINGEN.md
```

## Grenzen die bewust zo zijn

Geen AI of machine learning, geen netwerkverzoeken naar externe diensten (alleen het eigen lokale netwerk bij Delen),
geen Microsoft-onderdelen (eigen pictogrammen via Material Symbols, eigen thema's), geen account en geen vragen om
persoonlijke gegevens. Spelling gebruikt het woordenboek van het systeem/de browser (regelgebaseerd, zoals Inkt).
