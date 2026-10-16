# Kantoor Space: a free, open-source office suite

Kantoor Space is a free, open-source alternative to commercial office software. It runs in your browser or as a Windows program. There are two apps right now, and more are coming:

| App | What it is | Manual |
|---|---|---|
| **Inkt** | Word processor. Opens and saves .docx, with templates, styles, tables, pictures, a table of contents, footnotes, comments, track changes and mail merge. | [INKT.md](INKT.md) · [Nederlands](LEESMIJ.md) |
| **Cel** | Spreadsheet. Opens and saves .xlsx, with 380+ functions, dynamic arrays, charts, PivotTables, conditional formatting and data validation. | [cel/README.md](cel/README.md) · [Nederlands](cel/LEESMIJ.md) |

Both apps are made by **JJ van Schelven**, a 12-year-old developer from the Netherlands.

- No account, no ads and no tracking. Your documents stay on your own computer.
- Works offline. All fonts and libraries are included.
- English and Dutch interface. Switch under **File › Options › Language**.
- Share a document with people on the same network through a link, with live editing for everyone.

## Installation

**Step-by-step guide with troubleshooting: [INSTALL.md](INSTALL.md)** (also in Dutch).

### Option 1: Windows program (recommended)

1. On this GitHub page, click the green **Code** button and choose **Download ZIP**.
2. Right-click the downloaded ZIP and choose **Properties**. If you see **Unblock** at the bottom, tick it and click **OK**. Windows otherwise marks the programs inside as "from the internet" and may block them.
3. Extract the ZIP to a folder you will keep, for example `Documents\Kantoor`.
4. Open the folder and double-click:
   - `Inkt.exe` for the word processor
   - `cel\Cel.exe` for the spreadsheet
5. Optional: to get shortcuts on your desktop and in the Start menu, right-click `maak-snelkoppelingen.ps1` and choose **Run with PowerShell**. Do the same for `cel\maak-snelkoppelingen.ps1`.

**Requirements:** Windows 10 or 11 with the Microsoft Edge WebView2 Runtime. Windows 11 already has it. On Windows 10 you can [download it free from Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/) if the programs don't start.

**"Windows protected your PC"?** The programs are new and not signed with a paid certificate. Click **More info** › **Run anyway**. If Smart App Control blocks them completely, use option 2.

### Option 2: in your browser (any computer)

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. Download and extract the ZIP as in option 1.
3. Start an app:
   - Inkt: double-click `start-inkt.bat`, or run `node server.js` in the main folder. Then open http://localhost:8080
   - Cel: double-click `cel\start-cel.bat`, or run `node server.js` in the `cel` folder. Then open http://localhost:8081

On macOS or Linux, run the `node server.js` commands from a terminal. Keep the window open while you work. Both apps can be open at the same time.

### Option 3: quick look without installing anything

Double-click `index.html` (Inkt) or `cel\index.html` (Cel). Everything works except sharing through a link, which needs the small server from option 2.

### Updating

Download the new ZIP and extract it over the old folder. Your documents are not stored in this folder, so you won't lose them. Saving important documents as a file (**File › Save As**) is still a good idea.

## Project structure

```
Kantoor/
├── index.html, js/, css/      Inkt (word processor)
├── Inkt.exe, Inkt.vbs         Inkt as a Windows program
├── start-inkt.bat, server.js  Inkt in the browser (with link sharing)
├── test/stress.html           Stress tests for Inkt
├── cel/                       Cel (spreadsheet), same layout:
│   ├── index.html, js/, css/
│   ├── Cel.exe, start-cel.bat, server.js
│   └── test/stress.html       Stress tests for the calculation engine
├── programma/                 Source of the Windows program (C#, WebView2) and build script
├── vendor/, fonts/            Included libraries and fonts (no internet needed)
├── js/lang/, cel/js/lang/     English translations of the interface
├── LICENSE                    MIT license
└── DERDEN-LICENTIES.md        Licenses of third-party components
```

## Technical info

- **Plain HTML, CSS and JavaScript.** No frameworks, no build step, nothing to install for development. Open the files in any editor and reload the page.
- **Windows program:** a small C# launcher (`programma/Launcher.cs`) shows the app in a WebView2 window. Rebuild it with `programma/bouw.ps1`.
- **Server:** `server.js` is a tiny Node.js web server without dependencies. It serves the app and handles link sharing on your local network (`/deel` routes). Shared documents are stored in the `gedeeld` folder, which is not uploaded to GitHub.
- **Storage:** documents are saved in the browser's local storage, with IndexedDB as a backup when that fills up.
- **File formats:** .docx via JSZip and Mammoth, .xlsx via JSZip, plus PDF through the print dialog, CSV, HTML, Markdown and plain text.
- **Languages:** the interface source is Dutch. `js/i18n.js` translates it to English at run time using the dictionaries in `js/lang/`. In English mode, Cel also uses English notation (`1,234.56`, `3/15/2026`, `=SUM(A1,A2)`).
- **Tests:** start an app with its server and open `/test/stress.html`: http://localhost:8080/test/stress.html for Inkt, http://localhost:8081/test/stress.html for Cel (about 470 tests of input parsing, number formats, formulas, merging and the sharing API).

## License

MIT. See [LICENSE](LICENSE). Third-party components such as JSZip, Mammoth, KaTeX, Inter and Material Symbols are listed with their licenses in [DERDEN-LICENTIES.md](DERDEN-LICENTIES.md).

*Kantoor, Inkt and Cel are independent projects and are not affiliated with Microsoft. Microsoft, Word and Excel are trademarks of Microsoft Corporation. .docx and .xlsx are open standards (ECMA-376).*
