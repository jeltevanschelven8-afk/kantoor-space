// Inkt / Cel — brug tussen de app en Windows.
// De app stuurt berichten via window.chrome.webview.postMessage({ id, cmd, ... }); het programma antwoordt met { id, ok, ... }.
// Opdrachten: share (Windows-deelvenster), pdf (echte PDF maken), pickFolder, list, read, write, reveal, folders.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Windows.ApplicationModel.DataTransfer;
using Windows.Foundation;
using Windows.Storage;

[ComImport, Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IDataTransferManagerInterop
{
    IntPtr GetForWindow([In] IntPtr appWindow, [In] ref Guid riid);
    void ShowShareUIForWindow(IntPtr appWindow);
}

static class Brug
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
    static readonly string ShareDir = Path.Combine(Path.GetTempPath(), AppConfig.Name, "Delen");
    static TypedEventHandler<DataTransferManager, DataRequestedEventArgs> shareHandler;
    static DataTransferManager shareManager;

    public static void Attach(Form form, CoreWebView2 core)
    {
        core.AddScriptToExecuteOnDocumentCreatedAsync("window.InktNative = { versie: 1 };");
        core.WebMessageReceived += async (s, e) =>
        {
            Dictionary<string, object> msg = null;
            object id = null;
            string raw = e.WebMessageAsJson ?? "";
            if (!raw.TrimStart().StartsWith("{")) return;   // geen opdracht voor de brug (bv. van de deelserver)
            try { msg = Json.Deserialize<Dictionary<string, object>>(raw); } catch { return; }
            if (msg == null || !msg.ContainsKey("cmd") || !msg.ContainsKey("id")) return;
            try
            {
                msg.TryGetValue("id", out id);
                Dictionary<string, object> res = await Handle(form, core, msg);
                res["id"] = id;
                res["ok"] = true;
                core.PostWebMessageAsJson(Json.Serialize(res));
            }
            catch (Exception ex)
            {
                core.PostWebMessageAsJson(Json.Serialize(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", ex.Message } }));
            }
        };
    }

    /* ---------- Beveiliging: alleen in toegestane mappen lezen en schrijven ----------
       Toegestaan zijn: mappen die de gebruiker zelf in een Windows-venster koos (onthouden in
       %LocalAppData%\<Naam>\toegestane-mappen.txt), de vaste submap <synchronisatiemap>\<Naam>
       (bijv. OneDrive\Inkt) en de tijdelijke deelmap. Zo kan een kwaadaardig document via de
       brug nooit willekeurige bestanden op de computer lezen of overschrijven. */
    static readonly string AllowFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppConfig.Name, "toegestane-mappen.txt");
    static readonly string[] ReadExt = { ".inkt", ".docx", ".xlsx", ".csv", ".cel" };
    static readonly string[] WriteExt = { ".inkt", ".docx", ".xlsx", ".csv", ".cel", ".pdf" };

    static List<string> AllowedRoots()
    {
        var roots = new List<string> { ShareDir };
        foreach (string v in new[] { "OneDrive", "OneDriveConsumer", "OneDriveCommercial" })
        {
            string p = Environment.GetEnvironmentVariable(v);
            if (!string.IsNullOrEmpty(p)) roots.Add(Path.Combine(p, AppConfig.Name));
        }
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        foreach (string d in new[] { "Google Drive", "Dropbox", "iCloudDrive" }) roots.Add(Path.Combine(home, d, AppConfig.Name));
        try { if (File.Exists(AllowFile)) roots.AddRange(File.ReadAllLines(AllowFile)); } catch { }
        return roots;
    }
    static void RememberRoot(string dir)
    {
        try
        {
            var list = File.Exists(AllowFile) ? new List<string>(File.ReadAllLines(AllowFile)) : new List<string>();
            string full = Path.GetFullPath(dir);
            if (!list.Exists(x => string.Equals(x, full, StringComparison.OrdinalIgnoreCase))) list.Add(full);
            Directory.CreateDirectory(Path.GetDirectoryName(AllowFile));
            File.WriteAllLines(AllowFile, list.ToArray());
        }
        catch { }
    }
    static bool Inside(string path, string root)
    {
        try
        {
            string p = Path.GetFullPath(path).TrimEnd('\\') + "\\";
            string r = Path.GetFullPath(root).TrimEnd('\\') + "\\";
            return p.StartsWith(r, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }
    // Controleert pad (en optioneel extensie); gooit een fout als het niet mag
    static string Guard(string path, string[] exts, bool isDir)
    {
        if (string.IsNullOrEmpty(path) || path.IndexOfAny(Path.GetInvalidPathChars()) >= 0) throw new Exception("Ongeldig pad");
        string full = Path.GetFullPath(path);
        if (exts != null && !isDir && Array.IndexOf(exts, Path.GetExtension(full).ToLowerInvariant()) < 0) throw new Exception("Dit bestandstype is niet toegestaan");
        foreach (string r in AllowedRoots()) if (Inside(full, r)) return full;
        throw new Exception("Geen toegang tot deze map. Kies de map eerst zelf via 'Gedeelde map instellen'.");
    }

    static string Str(Dictionary<string, object> m, string k) { object v; return m.TryGetValue(k, out v) && v != null ? v.ToString() : null; }
    static long ToMs(DateTime t) { return (long)(t.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds; }

    static async Task<Dictionary<string, object>> Handle(Form form, CoreWebView2 core, Dictionary<string, object> m)
    {
        var res = new Dictionary<string, object>();
        string cmd = Str(m, "cmd");
        switch (cmd)
        {
            case "share":
            {
                // Bestand tijdelijk wegschrijven en het Windows-deelvenster openen
                Directory.CreateDirectory(ShareDir);
                string path = Path.Combine(ShareDir, SafeName(Str(m, "name")));
                string sext = Path.GetExtension(path).ToLowerInvariant();
                if (!Inside(path, ShareDir) || Array.IndexOf(new[] { ".inkt", ".docx", ".xlsx", ".csv", ".pdf", ".txt", ".html", ".md", ".odt", ".rtf", ".cel" }, sext) < 0) throw new Exception("Dit bestandstype kan niet worden gedeeld");
                File.WriteAllBytes(path, Convert.FromBase64String(Str(m, "data")));
                try { await ShowShare(form.Handle, path, Str(m, "title") ?? Path.GetFileName(path)); res["method"] = "share"; }
                catch { Reveal(path); res["method"] = "reveal"; }
                res["path"] = path;
                break;
            }
            case "pdf":
            {
                string path = Str(m, "path");
                if (!string.IsNullOrEmpty(path)) path = Guard(path, new[] { ".pdf" }, false);   // alleen binnen toegestane mappen
                if (string.IsNullOrEmpty(path))
                {
                    var dlg = new SaveFileDialog { Filter = "PDF-document (*.pdf)|*.pdf", FileName = SafeName(Str(m, "name") ?? "document.pdf"), OverwritePrompt = true };
                    if (dlg.ShowDialog(form) != DialogResult.OK) { res["cancelled"] = true; break; }
                    path = dlg.FileName;
                }
                CoreWebView2PrintSettings ps = core.Environment.CreatePrintSettings();
                ps.ShouldPrintHeaderAndFooter = false;
                ps.ShouldPrintBackgrounds = true;
                ps.MarginTop = ps.MarginBottom = ps.MarginLeft = ps.MarginRight = 0;
                // De marges van een PDF-pagina krijgen de achtergrondkleur van het venster: tijdelijk wit
                Microsoft.Web.WebView2.WinForms.WebView2 view = null;
                foreach (Control c in form.Controls) if (c is Microsoft.Web.WebView2.WinForms.WebView2) view = (Microsoft.Web.WebView2.WinForms.WebView2)c;
                System.Drawing.Color oldBg = view != null ? view.DefaultBackgroundColor : System.Drawing.Color.White;
                if (view != null) view.DefaultBackgroundColor = System.Drawing.Color.White;
                bool ok;
                try { ok = await core.PrintToPdfAsync(path, ps); }
                finally { if (view != null) view.DefaultBackgroundColor = oldBg; }
                if (!ok) throw new Exception("PDF maken is mislukt");
                res["path"] = path;
                if (Str(m, "share") == "1") { try { await ShowShare(form.Handle, path, Path.GetFileName(path)); } catch { Reveal(path); } }
                break;
            }
            case "pickFolder":
            {
                var dlg = new FolderBrowserDialog { Description = Str(m, "title") ?? "Kies een map", ShowNewFolderButton = true };
                string start = Str(m, "start");
                if (!string.IsNullOrEmpty(start) && Directory.Exists(start)) dlg.SelectedPath = start;
                if (dlg.ShowDialog(form) == DialogResult.OK) { res["path"] = dlg.SelectedPath; RememberRoot(dlg.SelectedPath); } else res["cancelled"] = true;
                break;
            }
            case "folders":
            {
                // Bekende synchronisatiemappen voorstellen
                var list = new List<object>();
                foreach (string v in new[] { "OneDrive", "OneDriveConsumer", "OneDriveCommercial" })
                {
                    string p = Environment.GetEnvironmentVariable(v);
                    if (!string.IsNullOrEmpty(p) && Directory.Exists(p) && !list.Exists(x => ((Dictionary<string, object>)x)["path"].ToString() == p))
                        list.Add(new Dictionary<string, object> { { "name", v == "OneDriveCommercial" ? "OneDrive (werk of school)" : "OneDrive" }, { "path", p } });
                }
                string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                foreach (string[] c in new[] { new[] { "Google Drive", "Google Drive" }, new[] { "Dropbox", "Dropbox" }, new[] { "iCloud Drive", "iCloudDrive" } })
                {
                    string p = Path.Combine(home, c[1]);
                    if (Directory.Exists(p)) list.Add(new Dictionary<string, object> { { "name", c[0] }, { "path", p } });
                }
                res["folders"] = list;
                break;
            }
            case "list":
            {
                string dir = Guard(Str(m, "path"), null, true);
                var files = new List<object>();
                if (Directory.Exists(dir))
                {
                    string[] exts = (Str(m, "ext") ?? ".docx,.inkt").Split(',');
                    foreach (string f in Directory.GetFiles(dir))
                    {
                        string ext = Path.GetExtension(f).ToLowerInvariant();
                        if (Array.IndexOf(exts, ext) < 0 || Path.GetFileName(f).StartsWith("~$")) continue;
                        var fi = new FileInfo(f);
                        files.Add(new Dictionary<string, object> { { "name", fi.Name }, { "path", fi.FullName }, { "size", fi.Length }, { "modified", ToMs(fi.LastWriteTime) } });
                    }
                }
                else res["missing"] = true;
                res["files"] = files;
                break;
            }
            case "read":
            {
                string path = Guard(Str(m, "path"), ReadExt, false);
                res["data"] = Convert.ToBase64String(File.ReadAllBytes(path));
                res["modified"] = ToMs(File.GetLastWriteTime(path));
                break;
            }
            case "write":
            {
                string path = Guard(Str(m, "path"), WriteExt, false);
                string expect = Str(m, "expect");
                if (expect != null && Str(m, "force") != "1" && File.Exists(path))
                {
                    long now = ToMs(File.GetLastWriteTime(path));
                    if (Math.Abs(now - long.Parse(expect)) > 1500) { res["conflict"] = true; res["modified"] = now; break; }
                }
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                string tmp = path + ".inkt-tmp";
                File.WriteAllBytes(tmp, Convert.FromBase64String(Str(m, "data")));
                if (File.Exists(path)) File.Replace(tmp, path, null); else File.Move(tmp, path);
                res["modified"] = ToMs(File.GetLastWriteTime(path));
                break;
            }
            case "stat":
            {
                string path = Guard(Str(m, "path"), WriteExt, false);
                res["exists"] = File.Exists(path);
                if (File.Exists(path)) res["modified"] = ToMs(File.GetLastWriteTime(path));
                break;
            }
            case "reveal":
                Reveal(Guard(Str(m, "path"), null, true));
                break;
            default:
                throw new Exception("Onbekende opdracht: " + cmd);
        }
        return res;
    }

    static string SafeName(string n)
    {
        n = string.IsNullOrEmpty(n) ? "document" : n;
        foreach (char c in Path.GetInvalidFileNameChars()) n = n.Replace(c, '-');
        return n;
    }

    static void Reveal(string path)
    {
        if (string.IsNullOrEmpty(path)) return;
        if (File.Exists(path)) Process.Start("explorer.exe", "/select,\"" + path + "\"");
        else if (Directory.Exists(path)) Process.Start("explorer.exe", "\"" + path + "\"");
    }

    // Windows-deelvenster (zoals de knop Delen in Verkenner) voor één bestand
    static async Task ShowShare(IntPtr hwnd, string path, string title)
    {
        // WinRT-bewerking afwachten zonder de await-hulpen (die verwachten andere Windows-metadata)
        var tcs = new TaskCompletionSource<StorageFile>();
        IAsyncOperation<StorageFile> op = StorageFile.GetFileFromPathAsync(path);
        op.Completed = (o, status) =>
        {
            if (status == AsyncStatus.Completed) tcs.TrySetResult(o.GetResults());
            else tcs.TrySetException(new Exception("Bestand kon niet worden voorbereid om te delen"));
        };
        StorageFile file = await tcs.Task;
        var interop = (IDataTransferManagerInterop)WindowsRuntimeMarshal.GetActivationFactory(typeof(DataTransferManager));
        Guid iid = new Guid("a5caee9b-8708-49d1-8d36-67d25a8da00c");
        IntPtr ptr = interop.GetForWindow(hwnd, ref iid);
        DataTransferManager dtm = (DataTransferManager)Marshal.GetObjectForIUnknown(ptr);
        Marshal.Release(ptr);
        if (shareManager != null && shareHandler != null) { try { shareManager.DataRequested -= shareHandler; } catch { } }
        shareHandler = (s, e) =>
        {
            e.Request.Data.Properties.Title = title;
            e.Request.Data.Properties.Description = "Gedeeld vanuit " + AppConfig.Name;
            e.Request.Data.SetStorageItems(new IStorageItem[] { file });
        };
        shareManager = dtm;
        dtm.DataRequested += shareHandler;
        interop.ShowShareUIForWindow(hwnd);
    }
}
