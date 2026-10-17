# Inkt — tekstverwerker

Een tekstverwerker met alles wat je van een moderne tekstverwerker verwacht, en compatibel met .docx-bestanden. Gemaakt door **JJ van Schelven**.

*Inkt is een onafhankelijk project en is niet verbonden aan Microsoft. Microsoft Word is een merk van Microsoft Corporation. Zie [DERDEN-LICENTIES.md](DERDEN-LICENTIES.md) voor gebruikte onderdelen van anderen.*

## Starten

Download Inkt voor Windows of Linux van de [Releases-pagina](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest). Stap-voor-stap-uitleg per besturingssysteem staat in [INSTALL.md](INSTALL.md).

- **Windows:** pak `Inkt-…-windows.zip` uit en dubbelklik op `Inkt.exe`. Vastmaken aan de taakbalk: rechtsklik op het Inkt-icoon in de taakbalk › *Aan taakbalk vastmaken*. Snelkoppelingen op het bureaublad en in het Startmenu: rechtsklik op `maak-snelkoppelingen.ps1` › *Uitvoeren met PowerShell*.
- **Linux:** installeer het `.deb`-bestand (Ubuntu, Debian, Mint) of het `.rpm`-bestand (Fedora, openSUSE), of start het `.AppImage`-bestand (Arch en andere). Inkt staat daarna in je programmamenu.

Documenten worden automatisch in het programma opgeslagen. Sla belangrijke documenten ook op als bestand via **Bestand › Opslaan als**.

## Wat zit erin

| Tabblad | Functies |
|---|---|
| **Bestand** | Nieuw (8 sjablonen), openen (.docx, .inkt, .odt, .rtf, .html, .md, .txt), opslaan, opslaan als (.docx, PDF, .html, .md, .txt, .inkt), afdrukken, info, opties |
| **Start** | Plakken (ook zonder opmaak), opmaak kopiëren, lettertype, grootte, vet/cursief/onderstrepen (5 stijlen), doorhalen, sub/superscript, tekst- en markeerkleur, hoofdlettergebruik, opsommingen en nummering (meerdere niveaus, takenlijst), inspringen, sorteren, opmaaktekens, uitlijning, regelafstand, arcering, randen, 12 stijlen, zoeken en vervangen |
| **Invoegen** | Voorblad, lege pagina, pagina-einde, tabellen, afbeeldingen, 15 vormen, grafieken (6 soorten), lijn, koppelingen, bladwijzers, opmerkingen, kop-/voettekst, paginanummers, tekstvak, sierletters, initiaal, datum en tijd, handtekeningregel, tekst uit bestand, vergelijkingen, symbolen |
| **Ontwerpen** | 8 thema's, lettertype- en kleurensets, alinea-afstand, watermerk, paginakleur, paginaranden |
| **Indeling** | Marges (ook slepen op de liniaal), afdrukstand, papierformaat, kolommen, pagina- en kolomeinde, woordafbreking, inspringen en afstand |
| **Verwijzingen** | Automatische inhoudsopgave, voetnoten, citaten en bibliografie (APA/MLA/Chicago), bijschriften, lijst met afbeeldingen |
| **Verzendlijsten** | Adreslijst (typen of CSV), samenvoegvelden, adresblok, begroetingsregel, voorbeeld bekijken, samenvoegen, enveloppen, etiketten |
| **Controleren** | Spelling, woorden tellen, voorlezen, taal, opmerkingen (met antwoorden en oplossen), wijzigingen bijhouden, accepteren/weigeren, documenten vergelijken, beveiligen |
| **Beeld** | Afdruk-, web-, lees- en focusmodus, liniaal, rasterlijnen, navigatievenster, zoom, donkere modus |

Extra: rechtsklikmenu, zwevende werkbalk bij selecteren, functie zoeken (Alt+Q), sneltoetsen (F1). Contextuele tabbladen voor tabellen, afbeeldingen en kop-/voettekst.

## Delen

- **Startscherm:** bij het openen zie je het startscherm met sjablonen, een zoekvak en de tabbladen *Recent*, *Vastgemaakt* en *Gedeeld*. Esc of de pijl terug brengt je naar het lege document. Uitzetten kan via Bestand › Opties › Algemeen.
- **Een kopie verzenden:** knop **Delen** rechtsboven › *Een kopie verzenden*. In het programma opent het Windows-deelvenster (e-mail, WhatsApp, Nabij delen, Teams…). Je kiest .docx of PDF.
- **Gedeelde map:** Bestand › Opslaan › *Opslaan in gedeelde map* (of via het Delen-menu). Kies eenmalig je OneDrive-, Google Drive- of Dropbox-map of een netwerkmap. Daarna:
  - worden wijzigingen automatisch bijgewerkt;
  - zie je de bestanden op het startscherm onder *Gedeeld*;
  - waarschuwt Inkt als iemand anders het bestand intussen heeft gewijzigd. Je kiest dan: hun versie openen, jouw versie als kopie opslaan, of overschrijven.
- **Delen via koppeling:** Delen › *Delen via koppeling* maakt een koppeling die anderen op hetzelfde netwerk in hun browser openen, zolang Inkt openstaat. Wijzigen twee mensen tegelijk, dan worden de wijzigingen per alinea samengevoegd.

## Taal

Inkt start standaard in het **Engels**. Nederlands kies je via **Bestand › Opties › Language / Taal** (of op de Account-pagina); de keuze wordt op deze computer onthouden. Met Engels is ook de notatie Engels (1,234.56 · 3/15/2026), met Nederlands Nederlands (1.234,56 · 15-3-2026). Engelse handleiding: [INKT.md](INKT.md). Overzicht van het hele project: [README.md](README.md).

## Goed om te weten

- **.docx-bestanden**: geëxporteerde .docx-bestanden openen in andere tekstverwerkers met opmaak, tabellen, afbeeldingen, voetnoten, opmerkingen, bijgehouden wijzigingen en kop-/voettekst. Bij het *openen* van een .docx blijven tekst, koppen, lijsten, tabellen (met kolombreedtes en celkleuren), afbeeldingen, uitlijning, afstand, tekstkleur en -grootte, markering, pagina-einden, pagina-instelling en kop-/voettekst behouden. Na het openen schrijft Ctrl+S terug naar hetzelfde .docx-bestand (alleen in het programma of in Chrome/Edge). Opent Inkt een .docx waarvan niet alles kon worden overgenomen, dan zegt het dat.
- **.odt en .rtf** kunnen ook worden geopend (tekst, opmaak, lijsten, tabellen); opslaan gaat als .docx of .inkt.
- **PDF**: kies Afdrukken en dan "Opslaan als PDF".
- **Internet**: niet nodig. Pictogrammen, lettertypen en de bibliotheken voor .docx en vergelijkingen worden meegeleverd (mappen `fonts/` en `vendor/`). Alleen de extra lettertypen voor documenten (Roboto, Lora, …) komen van internet; zonder internet wordt een vervangend lettertype gebruikt.
- **Veiligheid**: een document dat je opent (ook uit de gedeelde map of via een koppeling) kan geen code uitvoeren: scripts en gevaarlijke koppelingen worden eruit gehaald. Koppelingen in een document openen alleen als webpagina of e-mail.
- **Opslag**: documenten worden op deze computer bewaard. Raakt de gewone opslag vol, dan gaan eerst oude versies weg en gebruikt Inkt een grotere reserve-opslag; je krijgt een melding. Sla belangrijke documenten ook op als bestand.
- **Paginering**: een lange tabel loopt op het scherm door over meerdere pagina's (rijen die niet meer passen beginnen op de volgende pagina) en een kop blijft bij de alinea erna. Eén alinea die langer is dan een hele pagina wordt op het scherm niet gesplitst; bij afdrukken en PDF wel.
- **Voetnoten** staan op het scherm onderaan het document. In de .docx-export staan ze onderaan de pagina.

## Cel (rekenblad)

In de map `cel` staat **Cel**, het rekenblad in dezelfde stijl. Start het via **Cel** op het bureaublad of in het Startmenu. Zie `cel/LEESMIJ.md`.

## Doek (presentaties)

In de map `doek` staat **Doek**, het presentatieprogramma in dezelfde stijl: thema's, diamodellen, vormen, tabellen, grafieken, diagrammen, animaties, overgangen (ook Morph), een presentatorweergave en video maken. Het opent en bewaart .pptx-bestanden. Start het via **Doek** op het bureaublad of in het Startmenu. Zie `doek/LEESMIJ.md`.
