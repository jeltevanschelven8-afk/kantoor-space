' Doek (gemaakt door JJ van Schelven) — start het presentatieprogramma als eigen programmavenster.
' Start de lokale server onzichtbaar (als die nog niet draait) en opent Doek in een eigen venster zonder adresbalk.
Option Explicit
Dim sh, fso, dir, url, i, edge, chrome, pf86, pf, la
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://localhost:8082/"

Function ServerUp()
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 500, 500, 1000, 1000
  http.open "GET", url & "manifest.webmanifest", False
  http.send
  ServerUp = (Err.Number = 0 And http.status = 200)
  On Error GoTo 0
End Function

If Not ServerUp() Then
  sh.CurrentDirectory = dir
  ' 0 = verborgen venster; --stil = stopt vanzelf na 30 minuten zonder gebruik
  sh.Run "cmd /c node """ & dir & "\server.js"" 8082 --stil", 0, False
  For i = 1 To 40
    WScript.Sleep 250
    If ServerUp() Then Exit For
  Next
End If

pf86 = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%")
pf = sh.ExpandEnvironmentStrings("%ProgramFiles%")
la = sh.ExpandEnvironmentStrings("%LocalAppData%")
edge = ""
If fso.FileExists(pf86 & "\Microsoft\Edge\Application\msedge.exe") Then edge = pf86 & "\Microsoft\Edge\Application\msedge.exe"
If edge = "" And fso.FileExists(pf & "\Microsoft\Edge\Application\msedge.exe") Then edge = pf & "\Microsoft\Edge\Application\msedge.exe"
chrome = ""
If fso.FileExists(pf & "\Google\Chrome\Application\chrome.exe") Then chrome = pf & "\Google\Chrome\Application\chrome.exe"
If chrome = "" And fso.FileExists(la & "\Google\Chrome\Application\chrome.exe") Then chrome = la & "\Google\Chrome\Application\chrome.exe"

' Eigen browserprofiel voor Doek: geen inlogscherm, geen account, geen synchronisatie en geen welkomstschermen.
Dim profiel, opts
profiel = la & "\Doek\Profiel"
If Not fso.FolderExists(la & "\Doek") Then fso.CreateFolder la & "\Doek"
opts = " --user-data-dir=""" & profiel & """ --no-first-run --no-default-browser-check --disable-sync" & _
       " --disable-features=msImplicitSignin,msEdgeWelcomePage,msShowSigninPrompt,EdgeSignin" & _
       " --app=" & url & " --window-size=1400,900"
If edge <> "" Then
  sh.Run """" & edge & """" & opts, 1, False
ElseIf chrome <> "" Then
  sh.Run """" & chrome & """" & opts, 1, False
Else
  sh.Run url, 1, False
End If
