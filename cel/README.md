# Cel — spreadsheet

*Nederlandse versie: [LEESMIJ.md](LEESMIJ.md) · Back to the [project overview](../README.md)*

**Made by JJ van Schelven.** Version 2.0 · open source.

A spreadsheet program for Windows and Linux with the familiar layout of a ribbon with tabs. Same style as Inkt (the word processor in the folder above), but in spreadsheet green. Open source (MIT license, see `LICENSE` in the folder above).

Cel is an independent project and is not affiliated with Microsoft. Excel is a trademark of Microsoft Corporation; .xlsx is an open standard (ECMA-376 / ISO 29500).

No account, no name or other details to fill in: everything stays on your own computer.

## Language and notation

The interface is in **English** by default. Switch to Dutch (Nederlands) via **File › Options › Language**. The choice is remembered on this computer and also sets the notation:

| | English | Dutch |
|---|---|---|
| Numbers | `1,234.56` | `1.234,56` |
| Dates | `3/15/2026` | `15-3-2026` |
| Formulas | `=SUM(A1:A5,2.5)` | `=SOM(A1:A5;2,5)` |
| Function names | English (SUM, VLOOKUP, IF …) | Dutch (SOM, VERT.ZOEKEN, ALS …); English names work too |
| TRUE/FALSE | `TRUE` / `FALSE` | `WAAR` / `ONWAAR` |

Workbooks are stored in a language-independent form, so a workbook made in Dutch opens unchanged in English and vice versa.

## Getting started

Download Cel for Windows or Linux from the [Releases page](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Step-by-step instructions for every operating system are in [INSTALL.md](../INSTALL.md).

- **Windows:** extract `Cel-…-windows.zip` and double-click `Cel.exe`. Pin it to the taskbar: right-click the Cel icon in the taskbar › *Pin to taskbar*. For shortcuts on the desktop and in the Start menu: right-click `maak-snelkoppelingen.ps1` › *Run with PowerShell*.
- **Linux:** install the `.deb` (Ubuntu, Debian, Mint) or `.rpm` (Fedora, openSUSE), or start the `.AppImage` (Arch and others). Cel then appears in your applications menu.

Documents are saved automatically inside the program. Also save important workbooks as a file via **File › Save As**.

## What's inside

| Tab | Features |
|---|---|
| **File** | New (7 templates: budget, invoice, task list, grade book, cash book, weekly schedule), open (.xlsx, .csv, .txt, .cel), save, save as (.xlsx, PDF, .cel, .csv, .html), print, info, options |
| **Home** | Paste (also values, formulas, formats, transpose, paste special), format painter, font, size, bold/italic/underline, strikethrough, borders (13 kinds), fill and font color, alignment, orientation, indent, wrap text, merge, number formats (general, number, currency, accounting, date, time, percentage, fraction, scientific, text, custom), decimals, conditional formatting (rules, top/bottom, data bars, color scales, icon sets, manage), Quick Analysis (Ctrl+Q), format as table (21 styles), cell styles, insert and delete cells/rows/columns, row height/column width, hide, AutoSum, fill, series, clear, sort and filter, find and replace, go to |
| **Insert** | PivotTable, table, pictures, 10 shapes, charts (column, stacked, bar, line, area, pie, doughnut, scatter), sparklines (line, column, win/loss), links, notes, text box, header/footer, date and time, symbols |
| **Page Layout** | Margins, orientation, paper size, print area, print titles, fit to, scale, gridlines and headings (view/print), tab color |
| **Formulas** | Almost 380 functions in all common categories (math, statistics, text, date, lookup, logical, financial, engineering, database, web), including dynamic arrays that spill into the cells below (FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, TEXTSPLIT, VSTACK, TAKE, CHOOSECOLS …), LET and LAMBDA (with MAP, REDUCE, SCAN), regular expressions (REGEXTEST, REGEXEXTRACT, REGEXREPLACE), distributions (NORM.DIST, T.TEST, BINOM.DIST …), CONVERT and DSUM etc., Insert Function with an arguments dialog, Name Manager, trace precedents/dependents, show formulas, error checking, evaluate formula, automatic/manual calculation |
| **Data** | Import text/CSV, refresh all, Flash Fill (Ctrl+E), sort (multiple levels), filter (with search and check boxes), text to columns, remove duplicates, data validation (list with drop-down, numbers, dates, text length), clean up spaces, goal seek, group, subtotals |
| **Review** | Spelling, workbook statistics, read aloud, notes (new, delete, previous/next, show all), protect sheet, unlock cells |
| **View** | Normal and page break preview, print preview, formula bar, gridlines, headings, zoom, zoom to selection, freeze panes, new window, dark mode |

Extras: formula bar with name box, pointing at cells while typing a formula (with colored frames), F4 for absolute references, function autocomplete with help per argument, fill handle (numbers, dates, months, days, "Week 1"), move by dragging, multiple sheets (add, rename, drag, color, hide), status bar with sum/average/count, context menus, command search (Alt+Q), keyboard shortcuts (F1) like in Excel.

## Good to know

- **.xlsx files**: saved .xlsx files open in other spreadsheet programs with formulas, formatting, column widths, merged cells, frozen panes, filters, conditional formatting, validation, notes, links, pictures, shapes and charts. When *opening* an .xlsx, values, formulas, formatting, notes, pictures and (simple) charts are kept. Formulas with table references (such as `Table1[Column]`) are read as fixed values. The old .xls format is not supported.
- **CSV**: Save As offers two variants: with commas (international) and with semicolons (as used in the Netherlands and much of Europe). Numbers follow the notation of the chosen language.
- **PDF**: choose Print and then "Save as PDF".
- **Internet**: not needed. The icons and the .xlsx library ship with Cel (folders `fonts` and `vendor`). Only the extra fonts in the font list (Roboto, Open Sans …) come from the internet; without internet Cel falls back to a similar font.
- **PivotTables**: Insert › PivotTable. Choose rows (two levels), columns, a filter and one or more values (sum, count, average, max, min). Refresh via right-click or Data › Refresh All.
- **Spilling**: a formula that returns multiple values (e.g. `=SORT(A2:C20,2)`) automatically fills the cells below; `A1#` refers to that whole range. If something is in the way, `#SPILL!` appears.
- **Not included**: macros (VBA), Power Query, slicers, threaded comments (notes are available), links to external workbooks and table objects with structured references (such as `Table1[Column]`) (Format as Table does give the formatting and a filter). Sparklines are not saved in .xlsx.

## Start screen

Cel opens with a start screen (like familiar office programs): Home, New and Open on the left; a greeting, templates, a search box and the tabs **Recent**, **Pinned** (pin icon next to a workbook) and **Shared with me** on the right. Choose *Blank workbook* or a recent workbook to begin. Turn it off via File › Options › "Show the start screen when Cel starts".

## Sharing

At the top right is the **Share** button (also Alt+S), with the same choices as in familiar office programs:

- **Share a link** — creates a link such as `http://192.168.1.10:8081/?deel=abc123`. Choose *Anyone with the link can edit* or *… view* beforehand and optionally a code. Anyone on the same (Wi-Fi) network opens the link in a browser and sees the workbook; with *edit*, changes from both sides arrive within a few seconds; when two people edit at the same time, the changes are merged cell by cell. The link works as long as Cel is open on your computer (via `start-cel.bat`, `Cel.vbs` or `Cel.exe`). The first time, Windows asks whether Cel may have network access: choose *Allow*. Shared workbooks are stored in the `gedeeld` folder (with `Cel.exe` in `%LocalAppData%\Cel\gedeeld`).
- **Send a copy** — as .xlsx or PDF. In `Cel.exe` the Windows share panel opens (email, WhatsApp, Nearby Sharing …); on Linux the file is saved and your email program opens.
- **Manage access** — all links you share from this computer: switch between edit and view, copy the link, stop sharing.

Whoever has opened a link finds the workbook on the start screen under **Shared with me**. No account is needed and nothing goes to the internet: sharing only works within your own network.

## Tests

`test/stress.html` runs a stress test of the calculation engine (input recognition, number formats, formulas, circular references, spilling), the merge logic used when sharing, and the sharing API: start Cel via `start-cel.bat` and open http://localhost:8081/test/stress.html. Every test shows its result on the left; everything should be green.

## Author

Cel is made by **JJ van Schelven**, as part of the same series as Inkt (word processor). Sources for the function names and shortcuts: Microsoft's public documentation on [Excel functions by category](https://support.microsoft.com/office/excel-functions-by-category-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb) and [keyboard shortcuts in Excel](https://support.microsoft.com/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f).
