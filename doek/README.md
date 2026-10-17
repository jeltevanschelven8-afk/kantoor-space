# Doek: presentations

*Nederlandse versie: [LEESMIJ.md](LEESMIJ.md) · Back to the [project overview](../README.md)*

Made by a teenage developer from the Netherlands. Open source (MIT license, see `LICENSE` in the folder above).

Doek is a presentation program for Windows and Linux with the familiar layout of a ribbon with tabs. Same style as Inkt (word processor) and Cel (spreadsheet), but in presentation orange. It opens and saves .pptx files.

Doek is an independent project and is not affiliated with Microsoft. PowerPoint is a trademark of Microsoft Corporation; .pptx is an open standard (ECMA-376 / ISO 29500).

No account, no name or other details to fill in: everything stays on your own computer.

## Getting started

Download Doek for Windows or Linux from the [Releases page](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Step-by-step instructions for every operating system are in [INSTALL.md](../INSTALL.md).

- **Windows:** extract `Doek-…-windows.zip` and double-click `Doek.exe`. Pin it to the taskbar: right-click the Doek icon in the taskbar › *Pin to taskbar*. For shortcuts on the desktop and in the Start menu: right-click `maak-snelkoppelingen.ps1` › *Run with PowerShell*.
- **Linux:** install the `.deb` (Ubuntu, Debian, Mint) or `.rpm` (Fedora, openSUSE), or start the `.AppImage` (Arch and others). Doek then appears in your applications menu.

Presentations are saved automatically inside the program. Also save important presentations as a file via **File › Save As**.

## Language

The interface is in **English** by default. Switch to Dutch (Nederlands) via **File › Options › Language**. The choice is remembered on this computer.

## What's inside

| Tab | Features |
|---|---|
| **File** | New (templates), open (.pptx, .doek), save, save as (.pptx, PDF, PNG, SVG, video, .doek), print, info, options |
| **Home** | Slides and layouts, sections, paste and format painter, font and paragraph formatting, bullets and numbering, shapes, arrange, quick styles, find and replace |
| **Insert** | Slides, tables, pictures, 150+ shapes, icons, charts, diagrams (SmartArt-style), text boxes, WordArt, equations, links, comments, header/footer, slide numbers, date and time, video and audio |
| **Draw** | Pens, highlighter and eraser |
| **Design** | 12 themes with variants, colors, fonts, slide size, background styles, slide master view |
| **Transitions** | Slide transitions, including Morph, with duration and sound |
| **Animations** | Entrance, emphasis, exit and motion path animations, a timeline pane, triggers and timing |
| **Slide Show** | From the start or the current slide, presenter view in a second window with notes, timer and next slide, pen and laser pointer, custom shows, rehearse timings |
| **Review** | Spelling, comments with replies, notes |
| **View** | Normal, slide sorter, notes and reading view, outline, gridlines and guides, zoom, dark mode |

Extras: smart alignment guides while dragging, grouping, shape operations (union, subtract, intersect, fragment), tables with merge and split, export as video, command search (Alt+Q), keyboard shortcuts (F1).

## Good to know

- **.pptx files:** saved .pptx files open in other presentation programs with text, formatting, shapes, tables, pictures, charts, notes, transitions and animations. When *opening* a .pptx, the content is checked first: unsafe parts of files from others (scripts, unsafe links) are removed.
- **PDF:** choose Print and then "Save as PDF", or File › Save As › PDF.
- **Internet:** not needed. Fonts and libraries ship with Doek.
- **Not included:** macros (VBA), 3D models, and some special effects from other programs are left out or replaced by a simple version.

## Sharing

At the top right is the **Share** button, with the same choices as in Inkt and Cel:

- **Share a link** creates a link that people on the same (Wi-Fi) network open while Doek is open on your computer. Choose *edit* or *view* and optionally a code. When two people edit at the same time, the changes are merged slide by slide and object by object.
- **Send a copy** as .pptx or PDF. In the program the share panel of your system opens.
- **Manage access** lists all links you share from this computer and lets you stop sharing.

No account is needed and nothing goes to the internet: sharing only works within your own network.

## Tests

`test/` contains the stress tests (about 45 groups of checks on hostile files, undo/redo, tables, find and replace, merging) and separate tests for charts, diagrams and shape geometry. See [../TESTS.md](../TESTS.md) for the results and how to run them.

## Author

Doek is made by a teenage developer from the Netherlands, as part of the same series as Inkt (word processor) and Cel (spreadsheet). The architecture is described in [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md) and the document model in [docs/MODEL.md](docs/MODEL.md).
