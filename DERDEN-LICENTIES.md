# Onderdelen van derden

Inkt en Cel zijn gemaakt door JJ van Schelven. Ze gebruiken de volgende onderdelen van anderen. Die blijven onder hun eigen licentie vallen.

| Onderdeel | Gebruikt voor | Licentie | Hoe |
|---|---|---|---|
| Microsoft Edge WebView2 SDK (`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`, `WebView2Loader.dll`) | Het programmavenster (`Inkt.exe`, `Cel.exe`) | BSD-licentie van Microsoft (verspreiden toegestaan met behoud van de copyrightvermelding) — zie `programma/lib/WebView2-LICENSE.txt` en `WebView2-NOTICE.txt` | Meegeleverd in `programma/lib` |
| Material Symbols (Google) | Pictogrammen | Apache License 2.0 | Meegeleverd in `fonts/` (werkt zonder internet) |
| Inter | Lettertype in de interface | SIL Open Font License 1.1 | Meegeleverd in `fonts/` |
| Andere Google Fonts (Roboto, Lato, Lora, …) | Extra lettertypen voor documenten | SIL Open Font License 1.1 | Geladen via Google Fonts als er internet is; anders een vervangend lettertype |
| mammoth.js | .docx openen in Inkt | BSD 2-Clause | Meegeleverd in `vendor/` |
| JSZip | .docx/.xlsx inpakken | MIT (of GPLv3) | Meegeleverd in `vendor/` |
| KaTeX | Vergelijkingen | MIT | Meegeleverd in `vendor/katex/` |
| SheetJS Community Edition | .xls/.xlsx lezen in Cel | Apache License 2.0 | Geladen via cdnjs |

## Merken

Inkt en Cel zijn onafhankelijke projecten. Ze zijn niet verbonden aan, gesponsord door of goedgekeurd door Microsoft. Microsoft, Word, Excel en Office zijn merken van Microsoft Corporation. Ze worden alleen genoemd om aan te geven met welke bestandsformaten Inkt en Cel kunnen werken (.docx en .xlsx).

Lettertypen als Aptos, Calibri en Segoe UI worden niet meegeleverd. Inkt en Cel gebruiken ze alleen als ze al op de computer staan; anders valt de tekst terug op een ander lettertype.

## Linux-programma (Electron)

De Linux-versies van Inkt en Cel (map `desktop/`, downloads op de Releases-pagina) bevatten **Electron** (MIT-licentie, © GitHub Inc. en de Electron-bijdragers, https://www.electronjs.org) met daarin **Chromium** (BSD-licentie en andere open-sourcelicenties) en **Node.js** (MIT-licentie). De volledige licentieteksten zitten in elk Linux-pakket (`LICENSE.electron.txt` en `LICENSES.chromium.html`). Gebouwd met **electron-builder** (MIT-licentie).
