// Inkt / Cel (gemaakt door JJ van Schelven) — ingebouwde deelserver voor het Windows-programma.
// Zonder draaiende server.js is er in Inkt.exe/Cel.exe geen netwerkadres om koppelingen te delen.
// Deze kleine HTTP-server (op een gewone TCP-poort, geen beheerdersrechten nodig) start pas zodra de
// gebruiker op Delen klikt: de pagina stuurt het webview-bericht 'deel-server' en krijgt
// {"server":"http://localhost:POORT"} terug. De server levert de app-bestanden uit de programmamap
// en handelt dezelfde /deel-routes af als server.js. Gedeelde documenten staan in
// %LocalAppData%\<Naam>\gedeeld.
// Aansluiten (Launcher.cs, na het aanmaken van core): DeelServer.Attach(core, appDir, dataDir, AppConfig.Name);
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using Microsoft.Web.WebView2.Core;

static class DeelServer
{
    static TcpListener listener;
    static int port;
    static string appDir, dataDir, appName;
    static readonly object fileLock = new object();
    static readonly Random rnd = new Random();
    static readonly Dictionary<string, string> types = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" }, { ".js", "text/javascript; charset=utf-8" }, { ".css", "text/css; charset=utf-8" },
        { ".json", "application/json" }, { ".webmanifest", "application/manifest+json" }, { ".md", "text/markdown; charset=utf-8" },
        { ".png", "image/png" }, { ".jpg", "image/jpeg" }, { ".svg", "image/svg+xml" }, { ".ico", "image/x-icon" }, { ".woff2", "font/woff2" },
    };

    public static void Attach(CoreWebView2 core, string dir, string data, string name)
    {
        appDir = dir; dataDir = data; appName = name;
        core.WebMessageReceived += (s, e) =>
        {
            string msg = null;
            try { msg = e.TryGetWebMessageAsString(); } catch { }
            if (msg != "deel-server") return;
            Start();
            core.PostWebMessageAsString(listener == null ? "{\"server\":null}" : "{\"server\":\"http://localhost:" + port + "\"}");
        };
    }

    static void Start()
    {
        if (listener != null) return;
        int basePort = appName.Equals("Cel", StringComparison.OrdinalIgnoreCase) ? 8081 : 8080;
        for (int i = 0; i < 20 && listener == null; i++)
        {
            try { TcpListener l = new TcpListener(IPAddress.Any, basePort + i * 2); l.Start(); listener = l; port = basePort + i * 2; }
            catch { listener = null; }
        }
        if (listener == null) return;
        Thread t = new Thread(Loop); t.IsBackground = true; t.Start();
    }

    static void Loop()
    {
        while (true)
        {
            TcpClient c;
            try { c = listener.AcceptTcpClient(); } catch { return; }
            ThreadPool.QueueUserWorkItem(delegate { Handle(c); });
        }
    }

    static string LanIp()
    {
        string best = "127.0.0.1";
        try
        {
            foreach (IPAddress a in Dns.GetHostAddresses(Dns.GetHostName()))
            {
                if (a.AddressFamily != AddressFamily.InterNetwork || IPAddress.IsLoopback(a)) continue;
                string s = a.ToString();
                if (best == "127.0.0.1" || (s.StartsWith("192.168.") && !best.StartsWith("192.168."))) best = s;
            }
        }
        catch { }
        return best;
    }

    /* ---------- HTTP ---------- */
    static void Handle(TcpClient client)
    {
        using (client)
        {
            try
            {
                NetworkStream ns = client.GetStream();
                ns.ReadTimeout = 15000; ns.WriteTimeout = 15000;
                MemoryStream head = new MemoryStream();
                byte[] buf = new byte[8192];
                int headEnd = -1; byte[] all = null;
                while (headEnd < 0)
                {
                    int n = ns.Read(buf, 0, buf.Length);
                    if (n <= 0) return;
                    head.Write(buf, 0, n);
                    all = head.ToArray();
                    headEnd = IndexOf(all, new byte[] { 13, 10, 13, 10 });
                    if (head.Length > 1 << 20) return;
                }
                string headText = Encoding.ASCII.GetString(all, 0, headEnd);
                string[] lines = headText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                string[] req = lines[0].Split(' ');
                if (req.Length < 2) return;
                string method = req[0], target = req[1];
                Dictionary<string, string> hdr = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < lines.Length; i++) { int k = lines[i].IndexOf(':'); if (k > 0) hdr[lines[i].Substring(0, k).Trim()] = lines[i].Substring(k + 1).Trim(); }
                int len = 0; string cl; if (hdr.TryGetValue("Content-Length", out cl)) int.TryParse(cl, out len);
                if (len > 60 * 1024 * 1024) { Send(ns, 413, "text/plain", Encoding.UTF8.GetBytes("Te groot"), false); return; }
                MemoryStream body = new MemoryStream();
                int have = all.Length - headEnd - 4;
                if (have > 0) body.Write(all, headEnd + 4, have);
                while (body.Length < len) { int n = ns.Read(buf, 0, (int)Math.Min(buf.Length, len - body.Length)); if (n <= 0) break; body.Write(buf, 0, n); }
                string path = target, query = "";
                int qi = target.IndexOf('?'); if (qi >= 0) { path = target.Substring(0, qi); query = target.Substring(qi + 1); }
                path = Uri.UnescapeDataString(path);
                Dictionary<string, string> q = ParseQuery(query);
                if (path == "/deel" || path.StartsWith("/deel/")) { HandleShare(ns, method, path, q, hdr, Encoding.UTF8.GetString(body.ToArray())); return; }
                Static(ns, path);
            }
            catch { }
        }
    }

    static void Static(NetworkStream ns, string path)
    {
        if (path.StartsWith("/gedeeld/")) { Send(ns, 403, "text/plain", Encoding.UTF8.GetBytes("Geen toegang"), false); return; }
        if (path.EndsWith("/")) path += "index.html";
        string full = Path.GetFullPath(Path.Combine(appDir, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(Path.GetFullPath(appDir), StringComparison.OrdinalIgnoreCase) || Path.GetFileName(full).StartsWith(".") || !File.Exists(full))
        { Send(ns, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Niet gevonden"), false); return; }
        string ct; if (!types.TryGetValue(Path.GetExtension(full), out ct)) ct = "application/octet-stream";
        Send(ns, 200, ct, File.ReadAllBytes(full), false);
    }

    static void Send(NetworkStream ns, int code, string type, byte[] data, bool cors)
    {
        string reason = code == 200 ? "OK" : code == 204 ? "No Content" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : code == 409 ? "Conflict" : code == 405 ? "Method Not Allowed" : code == 413 ? "Payload Too Large" : "Error";
        StringBuilder h = new StringBuilder();
        h.Append("HTTP/1.1 ").Append(code).Append(' ').Append(reason).Append("\r\n");
        h.Append("Content-Type: ").Append(type).Append("\r\nContent-Length: ").Append(data.Length).Append("\r\nCache-Control: no-store\r\nConnection: close\r\n");
        if (cors) h.Append("Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE\r\nAccess-Control-Allow-Headers: Content-Type,X-Code,X-Eigenaar\r\n");
        h.Append("\r\n");
        byte[] hb = Encoding.ASCII.GetBytes(h.ToString());
        ns.Write(hb, 0, hb.Length); ns.Write(data, 0, data.Length); ns.Flush();
    }
    static void Json(NetworkStream ns, int code, string json) { Send(ns, code, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json), true); }

    /* ---------- Delen ---------- */
    class Share { public string id, owner, title, perm, code, by, data; public long version, created, modified; }
    static string ShareDir { get { return Path.Combine(dataDir, "gedeeld"); } }
    static string ShareFile(string id) { foreach (char c in id) if (!char.IsLetterOrDigit(c)) return null; return id.Length < 8 || id.Length > 16 ? null : Path.Combine(ShareDir, id + ".json"); }
    static Share Load(string id)
    {
        string f = ShareFile(id); if (f == null || !File.Exists(f)) return null;
        Dictionary<string, string> o; lock (fileLock) { o = ParseFlat(File.ReadAllText(f, Encoding.UTF8)); }
        if (o == null) return null;
        Share s = new Share { id = Get(o, "id"), owner = Get(o, "owner"), title = Get(o, "title"), perm = Get(o, "perm"), code = Get(o, "code"), by = Get(o, "by"), data = Get(o, "data") };
        long.TryParse(Get(o, "version"), out s.version); long.TryParse(Get(o, "created"), out s.created); long.TryParse(Get(o, "modified"), out s.modified);
        return s;
    }
    static void Save(Share s)
    {
        StringBuilder b = new StringBuilder("{");
        b.Append("\"id\":").Append(Q(s.id)).Append(",\"owner\":").Append(Q(s.owner)).Append(",\"title\":").Append(Q(s.title)).Append(",\"perm\":").Append(Q(s.perm));
        b.Append(",\"code\":").Append(Q(s.code)).Append(",\"by\":").Append(Q(s.by)).Append(",\"version\":").Append(s.version).Append(",\"created\":").Append(s.created).Append(",\"modified\":").Append(s.modified);
        b.Append(",\"data\":").Append(Q(s.data)).Append('}');
        lock (fileLock) { Directory.CreateDirectory(ShareDir); File.WriteAllText(ShareFile(s.id), b.ToString(), Encoding.UTF8); }
    }
    static string Link(Share s) { return "http://" + LanIp() + ":" + port + "/?deel=" + s.id + (string.IsNullOrEmpty(s.code) ? "" : "&code=" + Uri.EscapeDataString(s.code)); }
    static string Info(Share s, bool withData, bool withOwner)
    {
        StringBuilder b = new StringBuilder("{");
        b.Append("\"id\":").Append(Q(s.id)).Append(",\"title\":").Append(Q(s.title)).Append(",\"perm\":").Append(Q(s.perm)).Append(",\"hasCode\":").Append(string.IsNullOrEmpty(s.code) ? "false" : "true");
        b.Append(",\"by\":").Append(Q(s.by)).Append(",\"created\":").Append(s.created).Append(",\"modified\":").Append(s.modified).Append(",\"version\":").Append(s.version).Append(",\"app\":").Append(Q(appName)).Append(",\"link\":").Append(Q(Link(s)));
        if (withOwner) b.Append(",\"owner\":").Append(Q(s.owner));
        if (withData) b.Append(",\"data\":").Append(Q(s.data));
        return b.Append('}').ToString();
    }
    static long Now() { return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }
    static string Rand(int n) { const string a = "abcdefghijklmnopqrstuvwxyz0123456789"; StringBuilder b = new StringBuilder(); lock (rnd) for (int i = 0; i < n; i++) b.Append(a[rnd.Next(a.Length)]); return b.ToString(); }

    static void HandleShare(NetworkStream ns, string method, string path, Dictionary<string, string> q, Dictionary<string, string> hdr, string bodyText)
    {
        if (method == "OPTIONS") { Send(ns, 204, "text/plain", new byte[0], true); return; }
        if (path == "/deel/info") { Json(ns, 200, "{\"app\":" + Q(appName) + ",\"ip\":" + Q(LanIp()) + ",\"port\":" + port + ",\"origin\":" + Q("http://" + LanIp() + ":" + port) + ",\"host\":" + Q(Environment.MachineName) + "}"); return; }
        string ownerHdr = Get(hdr, "X-Eigenaar"); if (string.IsNullOrEmpty(ownerHdr)) ownerHdr = Get(q, "eigenaar");
        string codeHdr = Get(hdr, "X-Code"); if (string.IsNullOrEmpty(codeHdr)) codeHdr = Get(q, "code");
        if (path == "/deel/lijst")
        {
            StringBuilder b = new StringBuilder("[");
            if (Directory.Exists(ShareDir)) foreach (string f in Directory.GetFiles(ShareDir, "*.json")) { Share s = Load(Path.GetFileNameWithoutExtension(f)); if (s != null && s.owner == ownerHdr) { if (b.Length > 1) b.Append(','); b.Append(Info(s, false, false)); } }
            Json(ns, 200, b.Append(']').ToString()); return;
        }
        if (path == "/deel" && method == "POST")
        {
            Dictionary<string, string> o = ParseFlat(bodyText);
            if (o == null || !o.ContainsKey("data")) { Json(ns, 400, "{\"fout\":\"Geen document\"}"); return; }
            Share s = new Share { id = Rand(10), owner = Rand(24), title = Trunc(Get(o, "title"), 200), perm = Get(o, "perm") == "view" ? "view" : "edit", code = Trunc(Get(o, "code"), 40), by = Trunc(Get(o, "by"), 80), data = Get(o, "data"), version = 1, created = Now(), modified = Now() };
            if (string.IsNullOrEmpty(s.title)) s.title = "Naamloos";
            Save(s);
            Json(ns, 200, Info(s, false, true)); return;
        }
        string rest = path.Length > 6 ? path.Substring(6) : "";
        bool versionOnly = rest.EndsWith("/versie"); if (versionOnly) rest = rest.Substring(0, rest.Length - 7);
        Share sh = Load(rest);
        if (sh == null) { Json(ns, 404, "{\"fout\":\"Deze koppeling bestaat niet meer. De eigenaar is gestopt met delen.\"}"); return; }
        bool isOwner = !string.IsNullOrEmpty(ownerHdr) && ownerHdr == sh.owner;
        if (!string.IsNullOrEmpty(sh.code) && codeHdr != sh.code && !isOwner) { Json(ns, 403, "{\"fout\":\"code\",\"hasCode\":true,\"title\":" + Q(sh.title) + ",\"app\":" + Q(appName) + "}"); return; }
        if (method == "GET")
        {
            if (versionOnly) Json(ns, 200, "{\"version\":" + sh.version + ",\"modified\":" + sh.modified + ",\"perm\":" + Q(sh.perm) + ",\"title\":" + Q(sh.title) + "}");
            else Json(ns, 200, Info(sh, true, false));
            return;
        }
        if (method == "PUT")
        {
            if (sh.perm != "edit" && !isOwner) { Json(ns, 403, "{\"fout\":\"Je mag dit document alleen bekijken.\"}"); return; }
            Dictionary<string, string> o = ParseFlat(bodyText);
            if (o == null) { Json(ns, 400, "{\"fout\":\"Ongeldige gegevens\"}"); return; }
            // "base" = de versie waarop de wijziging is gebaseerd; is er intussen een nieuwere, dan 409 met de huidige inhoud (de app voegt dan samen)
            long baseVersion;
            if (long.TryParse(Get(o, "base"), out baseVersion) && baseVersion != sh.version)
            {
                Json(ns, 409, "{\"fout\":\"conflict\",\"version\":" + sh.version + ",\"modified\":" + sh.modified + ",\"data\":" + Q(sh.data) + "}"); return;
            }
            if (o.ContainsKey("data")) sh.data = o["data"];
            if (!string.IsNullOrEmpty(Get(o, "title"))) sh.title = Trunc(o["title"], 200);
            sh.version++; sh.modified = Now();
            Save(sh);
            Json(ns, 200, "{\"version\":" + sh.version + ",\"modified\":" + sh.modified + "}"); return;
        }
        if (method == "PATCH")
        {
            if (!isOwner) { Json(ns, 403, "{\"fout\":\"Alleen de eigenaar kan dit wijzigen.\"}"); return; }
            Dictionary<string, string> o = ParseFlat(bodyText);
            if (o == null) { Json(ns, 400, "{\"fout\":\"Ongeldige gegevens\"}"); return; }
            if (o.ContainsKey("perm")) sh.perm = o["perm"] == "view" ? "view" : "edit";
            if (o.ContainsKey("code")) sh.code = Trunc(o["code"], 40);
            Save(sh);
            Json(ns, 200, Info(sh, false, false)); return;
        }
        if (method == "DELETE")
        {
            if (!isOwner) { Json(ns, 403, "{\"fout\":\"Alleen de eigenaar kan stoppen met delen.\"}"); return; }
            try { lock (fileLock) File.Delete(ShareFile(sh.id)); } catch { }
            Json(ns, 200, "{\"ok\":true}"); return;
        }
        Json(ns, 405, "{\"fout\":\"Niet toegestaan\"}");
    }

    /* ---------- Hulpjes ---------- */
    static string Get(Dictionary<string, string> d, string k) { string v; return d != null && d.TryGetValue(k, out v) ? v : ""; }
    static string Trunc(string s, int n) { return s == null ? "" : s.Length > n ? s.Substring(0, n) : s; }
    static int IndexOf(byte[] hay, byte[] needle)
    {
        for (int i = 0; i <= hay.Length - needle.Length; i++) { int j = 0; while (j < needle.Length && hay[i + j] == needle[j]) j++; if (j == needle.Length) return i; }
        return -1;
    }
    static Dictionary<string, string> ParseQuery(string q)
    {
        Dictionary<string, string> d = new Dictionary<string, string>();
        foreach (string part in q.Split('&')) { if (part.Length == 0) continue; int k = part.IndexOf('='); string key = Uri.UnescapeDataString(k < 0 ? part : part.Substring(0, k)).Replace('+', ' '); string val = k < 0 ? "" : Uri.UnescapeDataString(part.Substring(k + 1).Replace('+', ' ')); d[key] = val; }
        return d;
    }
    // JSON-tekst maken van een tekenreeks
    static string Q(string s)
    {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder("\"");
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': b.Append("\\\""); break;
                case '\\': b.Append("\\\\"); break;
                case '\n': b.Append("\\n"); break;
                case '\r': b.Append("\\r"); break;
                case '\t': b.Append("\\t"); break;
                default: if (c < ' ' || c == (char)0x2028 || c == (char)0x2029) b.Append("\\u").Append(((int)c).ToString("x4")); else b.Append(c); break;
            }
        }
        return b.Append('"').ToString();
    }
    // Een plat JSON-object lezen: { "sleutel": waarde, ... } waarbij waarden tekst, getal, true/false/null zijn.
    // Geneste objecten/matrices worden als ruwe JSON-tekst bewaard (zo blijft 'data' van het document intact).
    static Dictionary<string, string> ParseFlat(string s)
    {
        if (s == null) return null;
        Dictionary<string, string> d = new Dictionary<string, string>();
        int i = 0, n = s.Length;
        Action skipWs = delegate { while (i < n && char.IsWhiteSpace(s[i])) i++; };
        skipWs(); if (i >= n || s[i] != '{') return null; i++;
        while (true)
        {
            skipWs(); if (i >= n) return null;
            if (s[i] == '}') return d;
            if (s[i] == ',') { i++; continue; }
            if (s[i] != '"') return null;
            string key = ReadString(s, ref i); if (key == null) return null;
            skipWs(); if (i >= n || s[i] != ':') return null; i++;
            skipWs(); if (i >= n) return null;
            char c = s[i];
            if (c == '"') { string v = ReadString(s, ref i); if (v == null) return null; d[key] = v; }
            else if (c == '{' || c == '[')
            {
                int start = i, depth = 0; bool inStr = false;
                for (; i < n; i++)
                {
                    char ch = s[i];
                    if (inStr) { if (ch == '\\') i++; else if (ch == '"') inStr = false; }
                    else if (ch == '"') inStr = true;
                    else if (ch == '{' || ch == '[') depth++;
                    else if (ch == '}' || ch == ']') { depth--; if (depth == 0) { i++; break; } }
                }
                d[key] = s.Substring(start, i - start);
            }
            else
            {
                int start = i; while (i < n && s[i] != ',' && s[i] != '}' && !char.IsWhiteSpace(s[i])) i++;
                string raw = s.Substring(start, i - start);
                d[key] = raw == "null" ? "" : raw;
            }
        }
    }
    static string ReadString(string s, ref int i)
    {
        if (s[i] != '"') return null; i++;
        StringBuilder b = new StringBuilder();
        while (i < s.Length)
        {
            char c = s[i++];
            if (c == '"') return b.ToString();
            if (c != '\\') { b.Append(c); continue; }
            if (i >= s.Length) return null;
            char e = s[i++];
            switch (e)
            {
                case '"': b.Append('"'); break; case '\\': b.Append('\\'); break; case '/': b.Append('/'); break;
                case 'b': b.Append('\b'); break; case 'f': b.Append('\f'); break; case 'n': b.Append('\n'); break; case 'r': b.Append('\r'); break; case 't': b.Append('\t'); break;
                case 'u': if (i + 4 > s.Length) return null; b.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber)); i += 4; break;
                default: return null;
            }
        }
        return null;
    }
}
