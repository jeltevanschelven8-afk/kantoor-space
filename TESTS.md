# Test results

*Nederlandse samenvatting onderaan.*

We try to break our own programs on purpose before anyone else does. The tests throw very strange input at each program: empty files, enormous numbers, hostile files with hidden scripts, thousands of random edits, and two people changing the same document at once. If a test makes the program crash, hang or give a wrong answer, we fix the program and keep the test.

**Last run: all tests passed.**

| Program | What it is | Checks | Passed | Failed | Too slow |
|---|---|---|---|---|---|
| **Inkt** | Word processor | 100 | 100 | 0 | 6 (see below) |
| **Cel** | Spreadsheet | 468 | 468 | 0 | 0 |
| **Doek** | Presentations | 45 groups of checks | 45 | 0 | 0 |
| **Doek** | Charts, diagrams and shapes (extra tests) | 317,945 + 359,891 + 275 checks | all | 0 | 0 |

*"Too slow" means a check that took more than 0.3 seconds. It still gave the right answer.*

## What is tested, in plain words

**Inkt (word processor)**
- About 60 attacks with hidden scripts in documents and web pages (the program must strip them, never run them)
- Opening broken or hostile .rtf, .odt and .docx files: empty files, broken zips, enormous numbers, thousands of nested parts, without crashing or hanging
- Saving a .docx and opening it again keeps the document the same (1,500 paragraphs with formatting)
- Layout with extreme cases: a table of 3,000 rows, a row taller than a page, margins bigger than the page, 300 headings in a row
- Storage: documents are not lost when the browser storage is full, and old versions are cleaned up
- 500 comments shown at once
- (Sharing is covered by the Cel tests, because Inkt and Cel use the same sharing code.)

**Cel (spreadsheet)**
- Typing numbers, dates and text the way people really type them, including strange ones (`1e309`, `(5)`, `5.`)
- Showing numbers and dates in about 1,500 different formats
- 300+ formulas: wrong arguments, very long formulas, formulas that refer to themselves, formulas that make huge lists
- Dangerous formulas are refused instead of freezing the program (a pattern that makes a regular expression run forever)
- Saving and reopening a workbook, and sharing it with two people editing at once
- The sharing server: wrong passwords, huge uploads, broken requests, 20 people at the same moment

**Doek (presentations)**
- Opening hostile .pptx files: scripts, unsafe links, files that unpack into gigabytes (zip bombs), 5,000 nested groups, 5,000 slides
- Undo and redo after 200 random edits
- Tables: 300 random edits, 100 × 50 tables, pasting odd text and web pages
- Find & replace with special characters, 20,000 matches
- Merging changes when two people edit at once
- Charts, diagrams and shape geometry (union, subtract, intersect): hundreds of thousands of automatic checks
- The program never contacts the internet (checked: no outside hosts)

## Problems the tests found, and we fixed

- **Cel:** a formula with a nested repeat in a text pattern could freeze the whole program. It is now refused.
- **Cel:** a huge text repeat (`REPT`) could fill the computer's memory. It is now limited to what a cell can hold.
- **Cel:** very large numbers like `1e309` turned into an empty cell. They now stay text.
- **Cel:** `(5)` and `5.` were seen as text instead of numbers.
- **Cel / Inkt:** when someone shared an empty document and two people then typed at once, one person's work could be lost. Both are kept now.
- **Cel (Linux):** numbers showed as `####` because the font was missing. A free font is now included.

## The 6 slow checks in Inkt

Six of Inkt's checks take between 0.3 and 5 seconds. They are correct, only slow, because the test is deliberately extreme: a 4 MB document full of attacks (4.8 s), a web page nested 20,000 levels deep (1.6 s), 500 comments (1.1 s), a table of 3,000 rows (0.5 s), a .docx round trip with 1,500 paragraphs (0.4 s) and storage without its backup database (0.3 s). A normal document is far lighter.

## Run the tests yourself

You need [Node.js](https://nodejs.org). Open a terminal in the main folder.

```bash
node server.js 8080                       # Inkt: then open http://localhost:8080/test/stress.html
cd cel && node server.js 8081             # Cel:  then open http://localhost:8081/test/stress.html
cd doek && node server.js 8082            # Doek: then run: node test/run-stress.js http://localhost:8082/
```

Each test page shows a green line per check, or a red line with the reason when something fails. The Doek runner needs Microsoft Edge or Chrome installed. It prints `geslaagd 45/45, mislukt 0` when everything is fine ("geslaagd" means passed, "mislukt" means failed).

---

## Nederlands

Voordat iemand anders het doet, proberen we onze eigen programma's expres kapot te maken. De tests gooien rare invoer naar elk programma: lege bestanden, enorme getallen, vijandige bestanden met verborgen scripts, duizenden willekeurige bewerkingen, en twee mensen die tegelijk hetzelfde document wijzigen. Gaat het programma daardoor stuk, hangt het of geeft het een fout antwoord, dan repareren we het programma en bewaren we de test.

**Laatste run: alle tests geslaagd.**

| Programma | Controles | Geslaagd | Mislukt |
|---|---|---|---|
| Inkt (tekstverwerker) | 100 | 100 | 0 |
| Cel (rekenblad) | 468 | 468 | 0 |
| Doek (presentaties) | 45 groepen + honderdduizenden kleine controles voor grafieken, diagrammen en vormen | alle | 0 |

Zelf draaien: zie de commando's hierboven. Elke testpagina laat per controle een groene regel zien, of een rode regel met de reden als er iets misgaat.
