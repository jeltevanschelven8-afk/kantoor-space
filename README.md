# Kantoor Space: a free, open-source office suite

Kantoor Space is a free, open-source alternative to commercial office software, for **Windows and Linux**. It consists of separate programs, each with its own download. There are two right now, and more are coming:

| Program | What it is | Manual |
|---|---|---|
| **Inkt** | Word processor. Opens and saves .docx, with templates, styles, tables, pictures, a table of contents, footnotes, comments, track changes and mail merge. | [INKT.md](INKT.md) · [Nederlands](LEESMIJ.md) |
| **Cel** | Spreadsheet. Opens and saves .xlsx, with 380+ functions, dynamic arrays, charts, PivotTables, conditional formatting and data validation. | [cel/README.md](cel/README.md) · [Nederlands](cel/LEESMIJ.md) |

Both programs are made by **JJ van Schelven**, a 12-year-old developer from the Netherlands.

- No account, no ads and no tracking. Your documents stay on your own computer.
- Works offline. All fonts and libraries are included.
- English and Dutch interface. Switch under **File › Options › Language**.
- Share a document with people on the same network through a link, with live editing for everyone.

## Download

Get the programs from the **[Releases page](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest)**. Inkt and Cel are separate downloads, so you only take what you need.

| Your computer | Download |
|---|---|
| Windows 10 / 11 | `Inkt-…-windows.zip`, `Cel-…-windows.zip` |
| Ubuntu, Debian, Linux Mint, Pop!_OS | `…-linux-x64.deb` |
| Fedora, openSUSE | `…-linux-x64.rpm` |
| Arch, Manjaro, EndeavourOS, other Linux | `…-linux-x64.AppImage` or `…-linux-x64.tar.gz` |
| ARM computers (Raspberry Pi 4/5, ARM laptops) | the same files with `arm64` in the name |

**Step-by-step installation and troubleshooting: [INSTALL.md](INSTALL.md)** (also in Dutch).

## Supported operating systems

| Operating system | Versions | Processor |
|---|---|---|
| **Windows** | Windows 10 and Windows 11 | x64 and ARM64 |
| **Ubuntu** | 22.04 LTS, 24.04 LTS and newer | x64 and ARM64 |
| **Debian** | 12 (Bookworm) and newer | x64 and ARM64 |
| **Linux Mint** | 21 and newer | x64 |
| **Fedora** | 39 and newer | x64 and ARM64 |
| **openSUSE** | Tumbleweed, Leap 15.6 | x64 |
| **Arch Linux** | rolling release (also Manjaro, EndeavourOS) | x64 and ARM64 |
| **Other Linux** | any distribution from about 2022 or newer, via the AppImage or .tar.gz | x64 and ARM64 |
| **macOS** | not supported yet | |

Windows 10 needs the free [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (Windows 11 already has it).

## Project structure

```
kantoor-space/
├── index.html, js/, css/      Inkt (word processor)
├── Inkt.exe                   Inkt for Windows
├── cel/                       Cel (spreadsheet), same layout, with Cel.exe
├── desktop/                   Builds Inkt and Cel for Linux (Electron)
├── programma/                 Source of the Windows program (C#, WebView2)
├── .github/workflows/         Builds all downloads automatically for each new version
├── vendor/, fonts/            Included libraries and fonts (no internet needed)
├── js/lang/, cel/js/lang/     English translations of the interface
├── test/, cel/test/           Stress tests
├── LICENSE                    MIT license
└── DERDEN-LICENTIES.md        Licenses of third-party components
```

## Technical info

- **Written in plain HTML, CSS and JavaScript.** No frameworks and no build step for the apps themselves.
- **Windows:** a small C# program (`programma/Launcher.cs`) shows the app in its own window using WebView2, the web engine built into Windows. Rebuild it with `programma/bouw.ps1`.
- **Linux:** the same apps packaged with [Electron](https://www.electronjs.org) (`desktop/`). `node build.js` in that folder makes the AppImage, .deb, .rpm and .tar.gz files for x64 and ARM64. GitHub Actions does this automatically when a version tag such as `v1.0.0` is pushed.
- **Sharing:** each program has a small built-in server for sharing links on your local network (C# on Windows, Node.js on Linux). Nothing goes to the internet.
- **Storage:** documents are saved inside the program's own storage, with IndexedDB as a backup when that fills up. Use **File › Save As** for a .docx, .xlsx or PDF file.
- **File formats:** .docx via JSZip and Mammoth, .xlsx via JSZip, plus PDF through the print dialog, CSV, HTML, Markdown and plain text.
- **Languages:** the interface source is Dutch. `js/i18n.js` translates it to English at run time using the dictionaries in `js/lang/`. In English mode, Cel also uses English notation (`1,234.56`, `3/15/2026`, `=SUM(A1,A2)`).
- **Tests:** `test/stress.html` (Inkt) and `cel/test/stress.html` (Cel) contain about 500 stress tests of input parsing, number formats, formulas, merging and the sharing API.

## License

MIT. See [LICENSE](LICENSE). Third-party components such as Electron, JSZip, Mammoth, KaTeX, Inter and Material Symbols are listed with their licenses in [DERDEN-LICENTIES.md](DERDEN-LICENTIES.md).

*Kantoor Space, Inkt and Cel are independent projects and are not affiliated with Microsoft. Microsoft, Word and Excel are trademarks of Microsoft Corporation. .docx and .xlsx are open standards (ECMA-376).*
