/* Cel — dictionary Dutch → English: template names and strings built in code, plus (separate dictionary) the contents of the templates and the welcome workbook. */
window.KANTOOR_DICT = Object.assign(window.KANTOOR_DICT || {}, {
  // ---- strings built in code ----
  'JJ van Schelven': 'JJ van Schelven',
  'Deze koppeling kan niet worden geopend: {0}': 'This link cannot be opened: {0}',
  'De gewone opslag is vol. Cel bewaart deze werkmap nu in de reserve-opslag. Sla belangrijke werkmappen ook op als bestand.': 'The regular storage is full. Cel now keeps this workbook in the backup storage. Also save important workbooks as a file.',
  'Kon de werkmap niet opslaan: de opslag is vol. Sla hem op als bestand via Bestand › Opslaan als.': 'Could not save the workbook: the storage is full. Save it as a file via File › Save As.',
  'laagste': 'lowest', 'hoogste': 'highest', 'Som gekopieerd': 'Sum copied',
  'Rand': 'Border', 'Opvulling': 'Fill', 'Bescherming': 'Protection', 'Speciaal': 'Special', 'Aangepast': 'Custom', 'Ctrl+Spatie': 'Ctrl+Space', 'Shift+Spatie': 'Shift+Space',
  'Goedemorgen': 'Good morning', 'Goedemiddag': 'Good afternoon', 'Goedenavond': 'Good evening', 'Goedenacht': 'Good night',
  // ---- template names ----
  'Lege werkmap': 'Blank workbook', 'Maandbudget': 'Monthly budget', 'Factuur': 'Invoice', 'Takenlijst': 'Task list', 'Cijferlijst': 'Grade book', 'Kasboek': 'Cash book', 'Weekplanning': 'Weekly schedule',
});
// Contents of templates/welcome workbook: own dictionary, so that words like "Aantal" may mean something else here (Quantity) than in the interface (Count).
window.KANTOOR_TPL_DICT = Object.assign(window.KANTOOR_TPL_DICT || {}, {
  // ---- sheet names (no spaces, they are used in chart ranges) ----
  'Budget': 'Budget', 'Taken': 'Tasks', 'Cijfers': 'Grades', 'Planning': 'Schedule', 'Welkom': 'Welcome',
  // ---- monthly budget ----
  'Vul de bedragen in; totalen worden automatisch berekend.': 'Fill in the amounts; totals are calculated automatically.',
  'Inkomsten': 'Income', 'Begroot': 'Budgeted', 'Werkelijk': 'Actual', 'Verschil': 'Difference', 'Salaris': 'Salary', 'Toeslagen': 'Benefits', 'Overig': 'Other',
  'Totaal inkomsten': 'Total income', 'Uitgaven': 'Expenses', 'Huur / hypotheek': 'Rent / mortgage', 'Energie en water': 'Energy and water', 'Boodschappen': 'Groceries',
  'Verzekeringen': 'Insurance', 'Telefoon en internet': 'Phone and internet', 'Vervoer': 'Transport', 'Vrije tijd': 'Leisure', 'Sparen': 'Savings', 'Totaal uitgaven': 'Total expenses',
  'Overzicht': 'Summary', 'Over': 'Remaining', 'Begroot en werkelijk': 'Budgeted and actual',
  // ---- invoice ----
  'FACTUUR': 'INVOICE', 'Jouw Bedrijf': 'Your Company', 'Straat 1, 1234 AB Plaats': '1 Street, City, ST 12345', 'KvK 12345678': 'Reg. no. 12345678', 'Factuur aan': 'Bill to',
  'Klantnaam': 'Customer name', 'Adres 10': 'Address 10', '5678 CD Plaats': 'City, ST 56789', 'Factuurnummer': 'Invoice number', 'Factuurdatum': 'Invoice date', 'Vervaldatum': 'Due date',
  'Omschrijving': 'Description', 'Aantal': 'Quantity', 'Prijs': 'Price', 'Bedrag': 'Amount', 'Dienst of product': 'Service or product', 'Subtotaal': 'Subtotal', 'Btw 21%': 'VAT 21%', 'Totaal': 'Total',
  'Gelieve het totaalbedrag binnen 30 dagen over te maken op NL00 BANK 0123 4567 89 onder vermelding van het factuurnummer.': 'Please transfer the total amount within 30 days to NL00 BANK 0123 4567 89, quoting the invoice number.',
  // ---- task list ----
  'Taak': 'Task', 'Wie': 'Who', 'Deadline': 'Deadline', 'Status': 'Status', 'Opmerking': 'Note', 'Plan maken': 'Make a plan', 'Klaar': 'Done', 'Offertes opvragen': 'Request quotes', 'Bezig': 'In progress',
  'Budget goedkeuren': 'Approve budget', 'Te doen': 'To do', 'Uitvoering starten': 'Start execution', 'Evaluatie': 'Evaluation', 'Open taken': 'Open tasks',
  // ---- grade book ----
  'Leerling': 'Student', 'Toets 1': 'Test 1', 'Toets 2': 'Test 2', 'Toets 3': 'Test 3', 'PO': 'Project', 'Gemiddelde': 'Average', 'Resultaat': 'Result', 'Klasgemiddelde': 'Class average',
  'Voldoende': 'Pass', 'Onvoldoende': 'Fail', 'Cijfers per leerling': 'Grades per student',
  // ---- cash book ----
  'Beginsaldo': 'Opening balance', 'Datum': 'Date', 'Categorie': 'Category', 'Ontvangen': 'Received', 'Uitgegeven': 'Spent', 'Saldo': 'Balance', 'Huishouden': 'Household', 'Inkomen': 'Income',
  'Benzine': 'Fuel', 'Verjaardagscadeau': 'Birthday present', 'Terugbetaling': 'Refund', 'Per categorie': 'By category', 'Wonen': 'Housing',
  // ---- weekly schedule ----
  'Maandag': 'Monday', 'Dinsdag': 'Tuesday', 'Woensdag': 'Wednesday', 'Donderdag': 'Thursday', 'Vrijdag': 'Friday', 'Zaterdag': 'Saturday', 'Zondag': 'Sunday', 'Tijd': 'Time',
  'Werk': 'Work', 'Sport': 'Sports', 'Markt': 'Market',
  // ---- welcome workbook ----
  'Welkom bij Cel': 'Welcome to Cel',
  'Rekenblad, gemaakt door JJ van Schelven. Geen account nodig, alles blijft op je eigen computer.': 'Spreadsheet, made by JJ van Schelven. No account needed; everything stays on your own computer.',
  'Maand': 'Month', 'Omzet': 'Revenue', 'Kosten': 'Costs', 'Winst': 'Profit', 'Januari': 'January', 'Februari': 'February', 'Maart': 'March', 'April': 'April', 'Mei': 'May', 'Juni': 'June',
  'Aan de slag': 'Getting started', 'Typ in een cel en druk op Enter.': 'Type in a cell and press Enter.',
  'Begin met = voor een formule, bv. =SOM(C6:C11)': 'Start with = for a formula, e.g. =SUM(C6:C11)',
  'Klik tijdens een formule op cellen om ze toe te voegen.': 'While typing a formula, click cells to add them.',
  'Sleep het vierkantje rechtsonder om door te voeren.': 'Drag the small square at the bottom right to fill.',
  'Alt+= maakt een AutoSom.': 'Alt+= inserts an AutoSum.',
  'Bestand › Openen opent .xlsx-bestanden.': 'File › Open opens .xlsx files.',
  'Bestand › Opslaan als bewaart als .xlsx, .csv of PDF.': 'File › Save As saves as .xlsx, .csv or PDF.',
  'Ctrl+E: Snel aanvullen · Ctrl+Q: Snelle analyse.': 'Ctrl+E: Flash Fill · Ctrl+Q: Quick Analysis.',
  'Probeer =SORTEREN(B6:E11;4;-1) voor een overlopende lijst.': 'Try =SORT(B6:E11,4,-1) for a spilling list.',
  'F1 toont alle sneltoetsen.': 'F1 shows all keyboard shortcuts.',
  'Omzet en kosten per maand': 'Revenue and costs per month',
});
