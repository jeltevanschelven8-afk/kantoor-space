// Inkt / Cel — eigen Windows-programma.
// Toont de app in een eigen venster met de WebView2-component van Windows (dezelfde techniek als Teams en Outlook).
// Geen browser, geen adresbalk, geen account en geen server: de bestanden worden rechtstreeks uit de programmamap geladen.
// Bouwen: programma\bouw.ps1
// Eén en hetzelfde programmabestand werkt voor elke app: de naam komt uit de bestandsnaam (Inkt.exe -> "Inkt",
// Cel.exe -> "Cel"), de app wordt geladen uit de map waar het bestand staat, het icoon uit icons\<naam>.ico.
// Zo hoeft Windows (Smart App Control) maar één programmabestand te vertrouwen.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class AppConfig
{
    public static string Name;
    public static string Host;
    public static string Start = "index.html";
    public static Icon AppIcon;
}

static class Program
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    [STAThread]
    static void Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        AppConfig.Name = Path.GetFileNameWithoutExtension(Application.ExecutablePath);
        AppConfig.Host = AppConfig.Name.ToLowerInvariant() + ".local";
        string ico = Path.Combine(dir, "icons", AppConfig.Name.ToLowerInvariant() + ".ico");
        try { AppConfig.AppIcon = File.Exists(ico) ? new Icon(ico) : Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        // Eigen taakbalk-identiteit, zodat Inkt en Cel elk een eigen knop met eigen icoon krijgen
        try { SetCurrentProcessExplicitAppUserModelID("Kantoor." + AppConfig.Name); } catch { }
        if (!File.Exists(Path.Combine(dir, AppConfig.Start)))
        {
            MessageBox.Show("Kan " + AppConfig.Start + " niet vinden naast " + AppConfig.Name + ".exe.", AppConfig.Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm(args.Length > 0 ? args[0] : null));
    }
}

class MainForm : Form
{
    readonly WebView2 web;
    readonly string appDir = AppDomain.CurrentDomain.BaseDirectory;
    readonly string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppConfig.Name);
    // Let op: dataDir gebruikt AppConfig.Name, die in Main wordt gezet voordat het eerste venster ontstaat.
    readonly string startHash;
    static int openWindows;

    public MainForm(string hash)
    {
        startHash = hash;
        openWindows++;
        Text = AppConfig.Name;
        if (AppConfig.AppIcon != null) Icon = AppConfig.AppIcon;
        StartPosition = FormStartPosition.Manual;
        LoadWindowBounds();
        web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(243, 243, 243) };
        Controls.Add(web);
        Load += async (s, e) => await InitAsync();
        FormClosing += (s, e) => SaveWindowBounds();
        FormClosed += (s, e) => { if (--openWindows == 0) Application.Exit(); };
    }

    async Task InitAsync()
    {
        // Juiste WebView2Loader.dll kiezen (ARM64, x64 of x86)
        string arch = (Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? "").ToUpperInvariant();
        string rid = arch == "ARM64" ? "win-arm64" : arch == "X86" ? "win-x86" : "win-x64";
        string loader = Path.Combine(appDir, "runtimes", rid, "native");
        if (Directory.Exists(loader)) CoreWebView2Environment.SetLoaderDllFolderPath(loader);
        try
        {
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataDir, "WebView2"));
            await web.EnsureCoreWebView2Async(env);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show("De Microsoft Edge WebView2 Runtime ontbreekt. Installeer die via https://go.microsoft.com/fwlink/p/?LinkId=2124703 en start " + AppConfig.Name + " opnieuw.",
                AppConfig.Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }
        catch (Exception ex)
        {
            MessageBox.Show(AppConfig.Name + " kon niet starten: " + ex.Message, AppConfig.Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        CoreWebView2 core = web.CoreWebView2;
        CoreWebView2Settings st = core.Settings;
        st.AreDevToolsEnabled = false;
        st.IsStatusBarEnabled = false;            // geen adresbalkje linksonder bij koppelingen
        st.IsZoomControlEnabled = false;          // Ctrl+scroll regelt de app zelf
        st.AreBrowserAcceleratorKeysEnabled = false; // geen browsersneltoetsen (F5, Ctrl+R, ...)
        st.IsGeneralAutofillEnabled = false;      // geen "gegevens opslaan"-vragen
        st.IsPasswordAutosaveEnabled = false;
        st.IsSwipeNavigationEnabled = false;

        // De programmamap is bereikbaar als https://<naam>.local/ (alleen binnen dit programma)
        core.SetVirtualHostNameToFolderMapping(AppConfig.Host, appDir, CoreWebView2HostResourceAccessKind.Allow);

        Brug.Attach(this, core);   // delen, PDF en gedeelde mappen (zie Brug.cs)
        DeelServer.Attach(core, appDir, dataDir, AppConfig.Name);   // delen via koppeling op het netwerk (zie DeelServer.cs)
        core.DocumentTitleChanged += (s, e) => { Text = string.IsNullOrEmpty(core.DocumentTitle) ? AppConfig.Name : core.DocumentTitle; };
        core.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
            Uri u;
            if (Uri.TryCreate(e.Uri, UriKind.Absolute, out u) && u.Host == AppConfig.Host) new MainForm(u.Fragment).Show();
            else OpenExternal(e.Uri);
        };
        core.NavigationStarting += (s, e) =>
        {
            Uri u;
            if (Uri.TryCreate(e.Uri, UriKind.Absolute, out u) && u.Host != AppConfig.Host && u.Scheme != "about" && u.Scheme != "data")
            {
                e.Cancel = true;      // externe koppelingen openen in de standaardbrowser
                OpenExternal(e.Uri);
            }
        };
        core.Navigate("https://" + AppConfig.Host + "/" + AppConfig.Start + (string.IsNullOrEmpty(startHash) ? "" : startHash));
    }

    // Alleen webpagina's en e-mail openen in het standaardprogramma; nooit bestanden of programma's (beveiliging)
    static void OpenExternal(string url)
    {
        Uri u;
        if (!Uri.TryCreate(url, UriKind.Absolute, out u)) return;
        if (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeMailto) return;
        try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
    }

    string BoundsFile { get { return Path.Combine(dataDir, "venster.txt"); } }

    void LoadWindowBounds()
    {
        Rectangle area = Screen.PrimaryScreen.WorkingArea;
        Rectangle b = new Rectangle(area.X + area.Width / 14, area.Y + area.Height / 14, area.Width * 6 / 7, area.Height * 6 / 7);
        bool max = false;
        try
        {
            string[] p = File.ReadAllText(BoundsFile).Split(',');
            Rectangle r = new Rectangle(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
            max = p.Length > 4 && p[4] == "1";
            foreach (Screen sc in Screen.AllScreens) if (sc.WorkingArea.IntersectsWith(r) && r.Width > 300 && r.Height > 200) { b = r; break; }
        }
        catch { }
        if (openWindows > 1) b.Offset(30 * (openWindows - 1), 30 * (openWindows - 1));
        Bounds = b;
        if (max) WindowState = FormWindowState.Maximized;
    }

    void SaveWindowBounds()
    {
        try
        {
            Directory.CreateDirectory(dataDir);
            Rectangle r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            File.WriteAllText(BoundsFile, r.X + "," + r.Y + "," + r.Width + "," + r.Height + "," + (WindowState == FormWindowState.Maximized ? "1" : "0"));
        }
        catch { }
    }
}
