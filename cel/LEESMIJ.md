# Cel — rekenblad

**Gemaakt door JJ van Schelven.** Versie 2.0 · open source.

Een rekenprogramma voor Windows en Linux met de vertrouwde indeling van een lint met tabbladen. Zelfde stijl als Inkt (de tekstverwerker in de map erboven), maar dan in rekenblad-groen. Open source (MIT-licentie, zie `LICENSE` in de map erboven).

Cel is een onafhankelijk project en is niet verbonden aan Microsoft. Excel is een merk van Microsoft Corporation; .xlsx is een open standaard (ECMA-376 / ISO 29500).

Geen account, geen naam of andere gegevens invullen: alles blijft op je eigen computer.

## Starten

Download Cel voor Windows of Linux van de [Releases-pagina](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Stap-voor-stap-uitleg per besturingssysteem staat in [INSTALL.md](../INSTALL.md).

- **Windows:** pak `Cel-…-windows.zip` uit en dubbelklik op `Cel.exe`. Vastmaken aan de taakbalk: rechtsklik op het Cel-icoon in de taakbalk › *Aan taakbalk vastmaken*. Snelkoppelingen op het bureaublad en in het Startmenu: rechtsklik op `maak-snelkoppelingen.ps1` › *Uitvoeren met PowerShell*.
- **Linux:** installeer het `.deb`-bestand (Ubuntu, Debian, Mint) of het `.rpm`-bestand (Fedora, openSUSE), of start het `.AppImage`-bestand (Arch en andere). Cel staat daarna in je programmamenu.

Werkmappen worden automatisch in het programma opgeslagen. Sla belangrijke werkmappen ook op als bestand via **Bestand › Opslaan als**.

## Wat zit erin

| Tabblad | Functies |
|---|---|
| **Bestand** | Nieuw (7 sjablonen: budget, factuur, takenlijst, cijferlijst, kasboek, weekplanning), openen (.xlsx, .csv, .txt, .cel), opslaan, opslaan als (.xlsx, PDF, .cel, .csv, .html), afdrukken, info, opties |
| **Start** | Plakken (ook waarden, formules, opmaak, transponeren, plakken speciaal), opmaak kopiëren, lettertype, grootte, vet/cursief/onderstrepen, doorhalen, randen (13 soorten), opvul- en tekstkleur, uitlijning, draaien, inspringen, terugloop, samenvoegen, getalnotaties (standaard, getal, valuta, financieel, datum, tijd, procent, breuk, wetenschappelijk, tekst, aangepast), decimalen, voorwaardelijke opmaak (regels, top/onder, gegevensbalken, kleurenschalen, pictogramsets, beheren), Snelle analyse (Ctrl+Q), opmaken als tabel (21 stijlen), celstijlen, cellen/rijen/kolommen invoegen en verwijderen, rijhoogte/kolombreedte, verbergen, AutoSom, doorvoeren, reeksen, wissen, sorteren en filteren, zoeken en vervangen, ga naar |
| **Invoegen** | Draaitabel, tabel, afbeeldingen, 10 vormen, grafieken (kolom, gestapeld, staaf, lijn, vlak, cirkel, ring, spreiding), sparklines (lijn, kolom, winst/verlies), koppelingen, notities, tekstvak, koptekst/voettekst, datum en tijd, symbolen |
| **Pagina-indeling** | Marges, afdrukstand, papierformaat, afdrukbereik, titels afdrukken, passend maken, schaal, rasterlijnen en koppen (weergeven/afdrukken), tabkleur |
| **Formules** | Bijna 380 functies met Nederlandse namen in alle gangbare categorieën (wiskunde, statistiek, tekst, datum, zoeken, logisch, financieel, technisch, database, web), waaronder dynamische matrices die overlopen naar de cellen eronder (FILTER, SORTEREN, SORTEREN.OP, UNIEK, REEKS, TEKST.SPLITSEN, VERT.STAPELEN, NEMEN, KIES.KOLOMMEN …), LET en LAMBDA (met KAART, REDUCE, SCAN), reguliere expressies (REGEXTEST, REGEXEXTRAHEREN, REGEXVERVANGEN), verdelingen (NORM.VERD.N, T.TOETS, BINOM.VERD …), CONVERTEREN en DBSOM e.d., functie invoegen met argumentenvenster, namen beheren, bronnen/doelen aanwijzen, formules weergeven, foutcontrole, formule evalueren, automatisch/handmatig berekenen |
| **Gegevens** | Tekst/CSV importeren, alles vernieuwen, Snel aanvullen (Ctrl+E), sorteren (meerdere niveaus), filter (met zoeken en vinkjes), tekst naar kolommen, dubbele waarden verwijderen, gegevensvalidatie (lijst met keuzeknop, getallen, datums, tekstlengte), spaties opschonen, doelzoeken, groeperen, subtotalen |
| **Controleren** | Spelling, werkmapstatistieken, voorlezen, notities (nieuw, verwijderen, vorige/volgende, alles weergeven), blad beveiligen, cellen ontgrendelen |
| **Beeld** | Normaal en pagina-einde-voorbeeld, afdrukvoorbeeld, formulebalk, rasterlijnen, koppen, zoom, zoomen naar selectie, titels blokkeren, nieuw venster, donkere modus |

Extra: formulebalk met naamvak, cellen aanwijzen tijdens het typen van een formule (met gekleurde kaders), F4 voor absolute verwijzingen, automatisch aanvullen van functies met uitleg per argument, vulgreep (getallen, datums, maanden, dagen, "Week 1"), verplaatsen door te slepen, meerdere bladen (toevoegen, hernoemen, slepen, kleuren, verbergen), statusbalk met som/gemiddelde/aantal, rechtsklikmenu's, functie zoeken (Alt+Q), sneltoetsen (F1) zoals in Excel.

## Taal en notatie

Cel start standaard in het **Engels**. Nederlands kies je via **Bestand › Opties › Language / Taal**; de keuze wordt op deze computer onthouden en bepaalt ook de notatie: Engels gebruikt `1,234.56`, `3/15/2026`, `=SUM(A1:A5,2.5)`, Engelse functienamen, `TRUE`/`FALSE` en komma's in CSV; Nederlands gebruikt `1.234,56`, `15-3-2026`, `=SOM(A1:A5;2,5)`, Nederlandse functienamen, `WAAR`/`ONWAAR` en puntkomma's in CSV. Werkmappen worden taalonafhankelijk opgeslagen: een Nederlandse werkmap opent ongewijzigd in het Engels en andersom. Engelse handleiding: [README.md](README.md).

## Goed om te weten

- **Nederlandse notatie** (bij taal Nederlands): komma als decimaalteken, puntkomma tussen argumenten (`=SOM(A1:A5;2,5)`) en Nederlandse functienamen. Engelse namen (`=SUM(...)`) werken ook. Typ `1.000` of `1000`, `15%`, `€ 12,50`, `3-4-2026` of `14:30` en Cel herkent getal, procent, valuta, datum of tijd.
- **.xlsx-bestanden**: opgeslagen .xlsx-bestanden openen in andere rekenbladprogramma's met formules, opmaak, kolombreedten, samengevoegde cellen, bevroren titels, filters, voorwaardelijke opmaak, validatie, notities, koppelingen, afbeeldingen, vormen en grafieken. Bij het *openen* van een .xlsx blijven waarden, formules, opmaak, notities, afbeeldingen en (eenvoudige) grafieken behouden. Formules met tabelverwijzingen (zoals `Tabel1[Kolom]`) worden als vaste waarde ingelezen. Het oude .xls-formaat wordt niet ondersteund.
- **CSV**: wordt opgeslagen met puntkomma's, zoals in Nederland gebruikelijk. Er is ook een variant met komma's.
- **PDF**: kies Afdrukken en dan "Opslaan als PDF".
- **Internet**: niet nodig. De pictogrammen en de bibliotheek voor .xlsx worden meegeleverd (mappen `fonts` en `vendor`). Alleen de extra lettertypen in de lettertypelijst (Roboto, Open Sans …) komen van internet; zonder internet valt Cel terug op een vergelijkbaar lettertype.
- **Draaitabellen**: Invoegen › Draaitabel. Kies rijen (twee niveaus), kolommen, een filter en één of meer waarden (som, aantal, gemiddelde, max, min). Vernieuwen via rechtsklik of Gegevens › Alles vernieuwen.
- **Overlopen**: een formule die meerdere waarden geeft (bv. `=SORTEREN(A2:C20;2)`) vult automatisch de cellen eronder; met `A1#` verwijs je naar dat hele bereik. Staat er iets in de weg, dan verschijnt `#OVERLOOP!`.
- **Niet aanwezig**: macro's (VBA), Power Query, slicers, gedeelde opmerkingen (wel notities), koppelingen naar externe werkmappen en tabelobjecten met gestructureerde verwijzingen (zoals `Tabel1[Kolom]`) (Opmaken als tabel geeft wel de opmaak en een filter). Sparklines worden niet in .xlsx opgeslagen.

## Startscherm

Cel opent met een startscherm (zoals bekende kantoorprogramma's): links Start, Nieuw en Openen, rechts een begroeting, sjablonen, een zoekvak en de tabbladen **Recent**, **Vastgemaakt** (punaise-icoon bij een werkmap) en **Gedeeld met mij**. Kies *Lege werkmap* of een recente werkmap om te beginnen. Uitzetten kan via Bestand › Opties › "Het startscherm weergeven bij het starten van Cel".

## Delen

Rechtsboven staat de knop **Delen** (ook via Alt+S), met dezelfde keuzes als in bekende kantoorprogramma's:

- **Delen via koppeling** — maak een koppeling zoals `http://192.168.1.10:8081/?deel=abc123`. Kies vooraf *Iedereen met de koppeling kan bewerken* of *… weergeven* en eventueel een code. Iedereen op hetzelfde (wifi-)netwerk opent de koppeling in een browser en ziet de werkmap; bij *bewerken* komen wijzigingen van beide kanten binnen enkele seconden bij elkaar binnen; wijzigen twee mensen tegelijk, dan worden de wijzigingen per cel samengevoegd. De koppeling werkt zolang Cel op jouw computer openstaat (via `start-cel.bat`, `Cel.vbs` of `Cel.exe`). Windows vraagt de eerste keer of Cel netwerktoegang mag hebben: kies *Toestaan*. Gedeelde werkmappen staan in de map `gedeeld` (bij `Cel.exe` in `%LocalAppData%\Cel\gedeeld`).
- **Een kopie verzenden** — als .xlsx of PDF. In `Cel.exe` opent het Windows-deelvenster (e-mail, WhatsApp, Nabij delen …); op Linux wordt het bestand opgeslagen en opent je e-mailprogramma.
- **Toegang beheren** — alle koppelingen die je vanaf deze computer deelt: bewerken of weergeven wisselen, koppeling kopiëren, stoppen met delen.

Wie een koppeling heeft geopend, vindt de werkmap terug op het startscherm onder **Gedeeld met mij**. Er is geen account nodig en er gaat niets naar internet: delen werkt alleen binnen je eigen netwerk.

## Tests

In `test/stress.html` zit een stresstest van de rekenkern (invoer herkennen, getalnotatie, formules, kringverwijzingen, overloop), de samenvoeglogica bij delen en de deel-API: start Cel via `start-cel.bat` en open http://localhost:8081/test/stress.html. Links verschijnt per test het resultaat; alles hoort groen te zijn.

## Maker

Cel is gemaakt door **JJ van Schelven**, als onderdeel van dezelfde reeks als Inkt (tekstverwerker). Bronnen voor de functienamen en sneltoetsen: de openbare documentatie van Microsoft over [Excel-functies per categorie](https://support.microsoft.com/nl-nl/office/excel-functies-per-categorie-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb) en [sneltoetsen in Excel](https://support.microsoft.com/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f). 
