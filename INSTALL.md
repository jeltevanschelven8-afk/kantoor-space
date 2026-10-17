# Installation guide

*Nederlandse uitleg staat onderaan.*

Kantoor Space has three separate programs: **Inkt** (word processor), **Cel** (spreadsheet) and **Doek** (presentations). Install the ones you need. All downloads are on the **[Releases page](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest)**.

- [Windows 10 / 11](#windows-10--11)
- [Ubuntu, Debian, Linux Mint](#ubuntu-debian-linux-mint)
- [Fedora, openSUSE](#fedora-opensuse)
- [Arch, Manjaro, EndeavourOS and other Linux](#arch-manjaro-endeavouros-and-other-linux)
- [Problems?](#problems)

Do you have an ARM computer (Raspberry Pi 4/5, an ARM laptop)? Use the files with `arm64` in the name instead of `x64`.

## Windows 10 / 11

1. Download `Inkt-…-windows.zip`, `Cel-…-windows.zip` and/or `Doek-…-windows.zip`.
2. Right-click the ZIP › **Properties**. If there is an **Unblock** checkbox at the bottom, tick it and click **OK**.
3. Right-click the ZIP › **Extract All…** and choose a folder you will keep, for example `Documents\Kantoor Space`.
4. Open the extracted folder and double-click **`Inkt.exe`**, **`Cel.exe`** or **`Doek.exe`**.
5. Optional: for shortcuts on your desktop and in the Start menu, right-click **`maak-snelkoppelingen.ps1`** in the same folder › **Run with PowerShell**.

**Windows 10:** if the program doesn't start, install the free [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/). Windows 11 already has it.

**"Windows protected your PC"?** The programs are not signed with a paid certificate. Click **More info** › **Run anyway**.

## Ubuntu, Debian, Linux Mint

1. Download `Inkt-…-linux-x64.deb`, `Cel-…-linux-x64.deb` and/or `Doek-…-linux-x64.deb`.
2. Double-click the file and choose **Install**, or install it from a terminal:
   ```bash
   sudo apt install ./Inkt-*-linux-x64.deb
   sudo apt install ./Cel-*-linux-x64.deb
   sudo apt install ./Doek-*-linux-x64.deb
   ```
3. Start **Inkt**, **Cel** or **Doek** from your applications menu.

To remove: `sudo apt remove inkt`, `sudo apt remove cel` or `sudo apt remove doek`.

## Fedora, openSUSE

1. Download `Inkt-…-linux-x64.rpm`, `Cel-…-linux-x64.rpm` and/or `Doek-…-linux-x64.rpm`.
2. Install it:
   ```bash
   sudo dnf install ./Inkt-*-linux-x64.rpm        # Fedora
   sudo zypper install ./Inkt-*-linux-x64.rpm     # openSUSE
   ```
3. Start **Inkt**, **Cel** or **Doek** from your applications menu.

## Arch, Manjaro, EndeavourOS and other Linux

**AppImage** (one file, nothing to install):

1. Download `Inkt-…-linux-x64.AppImage`, `Cel-…-linux-x64.AppImage` and/or `Doek-…-linux-x64.AppImage`.
2. Make it executable and start it:
   ```bash
   chmod +x Inkt-*-linux-x64.AppImage
   ./Inkt-*-linux-x64.AppImage
   ```
   Or right-click the file › **Properties** › **Allow executing file as program**, then double-click it.
3. AppImages need FUSE 2. If it doesn't start, install it: `sudo pacman -S fuse2` (Arch), `sudo apt install libfuse2t64` (Ubuntu 24.04) or `sudo apt install libfuse2` (Ubuntu 22.04).

**tar.gz** (no FUSE needed):

```bash
tar xzf Inkt-*-linux-x64.tar.gz
./Inkt-*-linux-x64/inkt
```

## First use

- The interface is in English. To switch to Dutch: **File › Options › Language**.
- Your documents are saved automatically inside the program. Use **File › Save As** to save a copy as .docx, .xlsx, .pptx or PDF.
- To share: click **Share** at the top right. People on the same Wi-Fi network can open the link while the program is open on your computer. The first time, your computer may ask whether the program may use the network: choose **Allow**.

## Updating

Download the new version from the Releases page and install it the same way. Your documents are kept: they are not stored in the program folder.

## Problems?

| Problem | Solution |
|---|---|
| Windows: `Inkt.exe`, `Cel.exe` or `Doek.exe` doesn't start | Install the WebView2 Runtime (see above) |
| Windows blocks the program | **More info** › **Run anyway**, or unblock the ZIP before extracting |
| Linux: AppImage doesn't start | Install FUSE 2 (see above), or use the .deb, .rpm or .tar.gz |
| Linux: `Permission denied` | Run `chmod +x` on the AppImage first |
| Icons look like words | Close the program and start it again |

---

## Nederlands

Alle downloads staan op de **[Releases-pagina](https://github.com/jeltevanschelven8-afk/kantoor-space/releases/latest)**. Inkt (tekstverwerker), Cel (rekenblad) en Doek (presentaties) zijn aparte downloads.

**Windows 10 / 11**
1. Download `Inkt-…-windows.zip`, `Cel-…-windows.zip` en/of `Doek-…-windows.zip`.
2. Rechtsklik op het ZIP-bestand › **Eigenschappen** › vink **Blokkering opheffen** aan (als dat er staat) › **OK**.
3. Rechtsklik › **Alles uitpakken…** naar een map die je bewaart.
4. Dubbelklik op **`Inkt.exe`**, **`Cel.exe`** of **`Doek.exe`**.
5. Snelkoppelingen: rechtsklik op **`maak-snelkoppelingen.ps1`** › **Uitvoeren met PowerShell**.
6. Zegt Windows "Uw pc is beschermd"? Klik op **Meer info** › **Toch uitvoeren**.

**Linux**
- Ubuntu, Debian, Linux Mint: download het `.deb`-bestand en dubbelklik erop, of `sudo apt install ./Inkt-*-linux-x64.deb`.
- Fedora, openSUSE: download het `.rpm`-bestand en installeer het met `sudo dnf install ./Inkt-*-linux-x64.rpm`.
- Arch en andere: download het `.AppImage`-bestand, maak het uitvoerbaar met `chmod +x` en start het. Werkt het niet, installeer dan `fuse2`, of gebruik het `.tar.gz`-bestand.
- Heb je een ARM-computer (Raspberry Pi), neem dan de bestanden met `arm64` in de naam.

Nederlandse menu's: **File › Options › Language › Nederlands**.
