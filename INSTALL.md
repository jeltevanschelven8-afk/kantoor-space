# Installation guide

*Nederlandse uitleg staat onderaan.*

Kantoor Space contains two apps: **Inkt** (word processor) and **Cel** (spreadsheet). You can use them as a Windows program, in your browser, or without installing anything.

## Step 1: download

1. Go to https://github.com/jeltevanschelven8-afk/kantoor-space
2. Click the green **Code** button › **Download ZIP**.
3. Right-click the downloaded ZIP › **Properties**. If there is an **Unblock** checkbox at the bottom, tick it and click **OK**.
4. Right-click the ZIP › **Extract All…** and choose a folder you will keep, for example `Documents\Kantoor Space`.

## Step 2: choose how to start

### A. As a Windows program (recommended)

1. Open the extracted folder.
2. Double-click **`Inkt.exe`** for the word processor.
3. Open the **`cel`** folder and double-click **`Cel.exe`** for the spreadsheet.
4. Optional, for shortcuts on your desktop and in the Start menu: right-click **`maak-snelkoppelingen.ps1`** › **Run with PowerShell**. Do the same with **`cel\maak-snelkoppelingen.ps1`**.

**Requirements:** Windows 10 or 11. The programs use Microsoft Edge WebView2, which is built into Windows 11. On Windows 10, install the free [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) if a program doesn't start.

**Does Windows say "Windows protected your PC"?** The programs are not signed with a paid certificate. Click **More info** › **Run anyway**. If Smart App Control blocks them completely, use option B.

### B. In your browser

1. Install [Node.js](https://nodejs.org) (choose the LTS version).
2. Inkt: double-click **`start-inkt.bat`**. Your browser opens http://localhost:8080.
3. Cel: double-click **`cel\start-cel.bat`**. Your browser opens http://localhost:8081.
4. Keep the black window open while you work. Close it to stop the app.

On macOS or Linux, open a terminal in the folder and run `node server.js` (for Cel: in the `cel` folder), then open the address above.

### C. Without installing anything

Double-click **`index.html`** (Inkt) or **`cel\index.html`** (Cel). Everything works, except sharing a link with others, which needs option A or B.

## Step 3: first use

- The interface is in English. To switch to Dutch: **File › Options › Language**.
- Your documents are saved automatically on your own computer. Use **File › Save As** to save a copy as .docx, .xlsx or PDF.
- To share: click **Share** at the top right. People on the same Wi-Fi network can open the link in their browser while the app is open on your computer.

## Updating

Download the new ZIP and extract it over the old folder. Your documents are not stored in this folder, so they stay where they are.

## Problems?

| Problem | Solution |
|---|---|
| `Inkt.exe` or `Cel.exe` doesn't start | Install the WebView2 Runtime (see above), or use option B |
| Windows blocks the program | **More info** › **Run anyway**, or unblock the ZIP before extracting (step 1.3) |
| `start-inkt.bat` says Node.js was not found | Install Node.js and try again |
| "Port 8080 is already in use" | Inkt is already running. Open http://localhost:8080 |
| Icons look like words | Press Ctrl+F5 to reload |

---

## Nederlands

1. Ga naar https://github.com/jeltevanschelven8-afk/kantoor-space › groene knop **Code** › **Download ZIP**.
2. Rechtsklik op het ZIP-bestand › **Eigenschappen** › vink **Blokkering opheffen** aan (als dat er staat) › **OK**.
3. Rechtsklik › **Alles uitpakken…** naar een map die je bewaart.
4. Dubbelklik op **`Inkt.exe`** (tekstverwerker) of **`cel\Cel.exe`** (rekenblad).
5. Snelkoppelingen: rechtsklik op **`maak-snelkoppelingen.ps1`** › **Uitvoeren met PowerShell** (ook in de map `cel`).
6. Zegt Windows "Uw pc is beschermd"? Klik op **Meer info** › **Toch uitvoeren**.
7. Nederlandse menu's: **File › Options › Language › Nederlands**.

Werkt het programma niet, installeer dan [Node.js](https://nodejs.org) en dubbelklik op `start-inkt.bat` of `cel\start-cel.bat`.
