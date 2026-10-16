# Inkt — word processor

*Nederlandse versie: [LEESMIJ.md](LEESMIJ.md) · Back to the [project overview](README.md)*

A word processor with everything you expect from a modern one, compatible with .docx files. Made by **JJ van Schelven**. Open source (MIT license, see [LICENSE](LICENSE)).

*Inkt is an independent project and is not affiliated with Microsoft. Microsoft Word is a trademark of Microsoft Corporation. See [DERDEN-LICENTIES.md](DERDEN-LICENTIES.md) for third-party components.*

No account, no name or other details to fill in: everything stays on your own computer.

## Language

The interface is in **English** by default. Switch to Dutch (Nederlands) via **File › Options › Language** (or on the Account page). The choice is remembered on this computer. In English mode the number and date notation is also English (1,234.56 · 3/15/2026); in Dutch mode it is Dutch (1.234,56 · 15-3-2026).

## Getting started

Download Inkt for Windows or Linux from the [Releases page](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Step-by-step instructions for every operating system are in [INSTALL.md](INSTALL.md).

- **Windows:** extract `Inkt-…-windows.zip` and double-click `Inkt.exe`. Pin it to the taskbar: right-click the Inkt icon in the taskbar › *Pin to taskbar*. For shortcuts on the desktop and in the Start menu: right-click `maak-snelkoppelingen.ps1` › *Run with PowerShell*.
- **Linux:** install the `.deb` (Ubuntu, Debian, Mint) or `.rpm` (Fedora, openSUSE), or start the `.AppImage` (Arch and others). Inkt then appears in your applications menu.

Documents are saved automatically inside the program. Also save important documents as a file via **File › Save As**.

## What's inside

| Tab | Features |
|---|---|
| **File** | New (8 templates), open (.docx, .inkt, .html, .md, .txt), save, save as (.docx, PDF, .html, .md, .txt, .inkt), print, info, options |
| **Home** | Paste (also without formatting), format painter, font, size, bold/italic/underline (5 styles), strikethrough, sub/superscript, font and highlight color, change case, bullets and numbering (multilevel, task list), indent, sort, formatting marks, alignment, line spacing, shading, borders, 12 styles, find and replace |
| **Insert** | Cover page, blank page, page break, tables, pictures, 15 shapes, charts (6 kinds), line, links, bookmarks, comments, header/footer, page numbers, text box, WordArt, drop cap, date and time, signature line, text from file, equations, symbols |
| **Design** | 8 themes, font and color sets, paragraph spacing, watermark, page color, page borders |
| **Layout** | Margins (also by dragging on the ruler), orientation, paper size, columns, page and column breaks, hyphenation, indent and spacing |
| **References** | Automatic table of contents, footnotes, citations and bibliography (APA/MLA/Chicago), captions, table of figures |
| **Mailings** | Recipient list (typed or CSV), merge fields, address block, greeting line, preview results, finish & merge, envelopes, labels |
| **Review** | Spelling, word count, read aloud, language, comments (with replies and resolve), track changes, accept/reject, compare documents, protect |
| **View** | Print, web, read and focus mode, ruler, gridlines, navigation pane, zoom, dark mode |

Extras: context menu, mini toolbar on selection, command search (Alt+Q), keyboard shortcuts (F1). Contextual tabs for tables, pictures and header/footer.

## Sharing

- **Start screen:** on opening you see the start screen with templates, a search box and the tabs *Recent*, *Pinned* and *Shared with me*. Esc or the back arrow takes you to the blank document. Turn it off via File › Options › General.
- **Send a copy:** **Share** button at the top right › *Send a copy*. In the program the Windows share panel opens (email, WhatsApp, Nearby Sharing, Teams…). You choose .docx or PDF.
- **Shared folder:** File › Save › *Save to shared folder* (or via the Share menu). Pick your OneDrive, Google Drive or Dropbox folder or a network folder once. After that changes are updated automatically, the files appear on the start screen under *Shared*, and Inkt warns you when someone else has changed the file in the meantime (open their version, save yours as a copy, or overwrite).
- **Share a link:** Share › *Share a link* creates a link that others on the same network open in their browser, as long as Inkt is open on your computer. Choose *Anyone with the link can edit* or *… view*, optionally with a code. When two people edit at the same time, the changes are merged paragraph by paragraph. Nothing goes to the internet; sharing only works within your own network.

## Good to know

- **.docx files**: exported .docx files open in other word processors with formatting, tables, pictures, footnotes, comments, tracked changes and header/footer. When *opening* a .docx, text, headings, lists, tables, pictures, page setup and header/footer are kept; font colors and sizes from the file are lost.
- **PDF**: choose Print and then "Save as PDF".
- **Internet**: the icons, extra fonts, equations and opening or saving .docx load a library from the internet. Without internet, typing works as usual but the icons are not shown.
- **Pagination**: a paragraph or table longer than one page is not split across two pages on screen. It is when printing and in PDF.
- **Footnotes** are shown at the end of the document on screen. In the .docx export they are at the bottom of the page.

## Cel (spreadsheet)

The `cel` folder contains **Cel**, the spreadsheet in the same style. Start it via **Cel** on the desktop or in the Start menu. See [cel/README.md](cel/README.md).
