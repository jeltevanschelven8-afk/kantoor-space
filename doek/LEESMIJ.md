# Doek: presentaties

*English version: [README.md](README.md) · Terug naar het [projectoverzicht](../README.md)*

Gemaakt door een tienerontwikkelaar uit Nederland. Open source (MIT-licentie, zie `LICENSE` in de map erboven).

Doek is een presentatieprogramma voor Windows en Linux met de vertrouwde indeling van een lint met tabbladen. Zelfde stijl als Inkt (tekstverwerker) en Cel (rekenblad), maar dan in presentatie-oranje. Het opent en bewaart .pptx-bestanden.

Doek is een onafhankelijk project en is niet verbonden aan Microsoft. PowerPoint is een merk van Microsoft Corporation; .pptx is een open standaard (ECMA-376 / ISO 29500).

Geen account, geen naam of andere gegevens invullen: alles blijft op je eigen computer.

## Starten

Download Doek voor Windows of Linux van de [Releases-pagina](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Stap-voor-stap-uitleg per besturingssysteem staat in [INSTALL.md](../INSTALL.md).

- **Windows:** pak `Doek-…-windows.zip` uit en dubbelklik op `Doek.exe`. Vastmaken aan de taakbalk: rechtsklik op het Doek-icoon in de taakbalk › *Aan taakbalk vastmaken*. Snelkoppelingen op het bureaublad en in het Startmenu: rechtsklik op `maak-snelkoppelingen.ps1` › *Uitvoeren met PowerShell*.
- **Linux:** installeer het `.deb`-bestand (Ubuntu, Debian, Mint) of het `.rpm`-bestand (Fedora, openSUSE), of start het `.AppImage`-bestand (Arch en andere). Doek staat daarna in je programmamenu.

Presentaties worden automatisch in het programma opgeslagen. Sla belangrijke presentaties ook op als bestand via **Bestand › Opslaan als**.

## Taal

Doek start standaard in het **Engels**. Nederlands kies je via **Bestand › Opties › Language / Taal**; de keuze wordt op deze computer onthouden.

## Wat zit erin

| Tabblad | Functies |
|---|---|
| **Bestand** | Nieuw (sjablonen), openen (.pptx, .doek), opslaan, opslaan als (.pptx, PDF, PNG, SVG, video, .doek), afdrukken, info, opties |
| **Start** | Dia's en indelingen, secties, plakken en opmaak kopiëren, lettertype en alinea, opsommingen en nummering, vormen, rangschikken, snelle stijlen, zoeken en vervangen |
| **Invoegen** | Dia's, tabellen, afbeeldingen, 150+ vormen, pictogrammen, grafieken, diagrammen, tekstvakken, WordArt, vergelijkingen, koppelingen, opmerkingen, kop-/voettekst, dianummers, datum en tijd, video en audio |
| **Tekenen** | Pennen, markeerstift en gum |
| **Ontwerpen** | 12 thema's met varianten, kleuren, lettertypen, diaformaat, achtergrondstijlen, diamodel |
| **Overgangen** | Diaovergangen, ook Morph, met duur en geluid |
| **Animaties** | Ingang-, nadruk-, uitgang- en bewegingspadanimaties, tijdlijnvenster, triggers en timing |
| **Diavoorstelling** | Vanaf het begin of de huidige dia, presentatorweergave in een tweede venster met notities, timer en volgende dia, pen en laserpointer, aangepaste voorstellingen, timing instellen |
| **Controleren** | Spelling, opmerkingen met antwoorden, notities |
| **Beeld** | Normaal, diasorteerder, notities en leesweergave, overzicht, rasterlijnen en hulplijnen, zoom, donkere modus |

Extra: slimme hulplijnen bij het slepen, groeperen, vormbewerkingen (samenvoegen, aftrekken, snijden, fragmenteren), tabellen met samenvoegen en splitsen, exporteren als video, functie zoeken (Alt+Q), sneltoetsen (F1).

## Goed om te weten

- **.pptx-bestanden:** opgeslagen .pptx-bestanden openen in andere presentatieprogramma's met tekst, opmaak, vormen, tabellen, afbeeldingen, grafieken, notities, overgangen en animaties. Bij het *openen* van een .pptx wordt de inhoud eerst gecontroleerd: onveilige onderdelen uit bestanden van anderen (scripts, onveilige koppelingen) worden verwijderd.
- **PDF:** kies Afdrukken en dan "Opslaan als PDF", of Bestand › Opslaan als › PDF.
- **Internet:** niet nodig. Lettertypen en bibliotheken worden meegeleverd.
- **Niet aanwezig:** macro's (VBA), 3D-modellen en enkele speciale effecten uit andere programma's worden weggelaten of vervangen door een eenvoudige versie.

## Delen

Rechtsboven staat de knop **Delen**, met dezelfde keuzes als in Inkt en Cel:

- **Delen via koppeling** maakt een koppeling die mensen op hetzelfde (wifi-)netwerk openen zolang Doek op jouw computer openstaat. Kies *bewerken* of *weergeven* en eventueel een code. Werken twee mensen tegelijk, dan worden de wijzigingen per dia en per object samengevoegd.
- **Een kopie verzenden** als .pptx of PDF. In het programma opent het deelvenster van je systeem.
- **Toegang beheren** toont alle koppelingen die je vanaf deze computer deelt en laat je het delen stoppen.

Er is geen account nodig en er gaat niets naar internet: delen werkt alleen binnen je eigen netwerk.

## Tests

In `test/` staan de stresstests (ongeveer 45 groepen controles op vijandige bestanden, ongedaan maken, tabellen, zoeken en vervangen, samenvoegen) en aparte tests voor grafieken, diagrammen en vormgeometrie. De resultaten en hoe je ze draait staan in [../TESTS.md](../TESTS.md).

## Maker

Doek is gemaakt door een tienerontwikkelaar uit Nederland, als onderdeel van dezelfde reeks als Inkt (tekstverwerker) en Cel (rekenblad). De architectuur staat in [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md) en het documentmodel in [docs/MODEL.md](docs/MODEL.md).
