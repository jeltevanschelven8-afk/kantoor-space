# Bouwt het programmabestand met de C#-compiler die in Windows zit, en zet het neer als Inkt.exe en (als de map
# 'cel' bestaat) als cel\Cel.exe. Beide zijn exact hetzelfde bestand: de naam bepaalt welke app opent.
# Uitvoeren: powershell -ExecutionPolicy Bypass -File .\programma\bouw.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$lib = Join-Path $here 'lib'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
$fw = Split-Path -Parent $csc                         # .NET Framework-map (bevat de WinRT-hulpassembly's)
$wm = Join-Path $env:WINDIR 'System32\WinMetadata'    # Windows-metadata voor het deelvenster (Brug.cs)

$build = Join-Path $here 'Kantoor.exe'
& $csc /nologo /target:winexe /platform:anycpu /optimize+ "/out:$build" "/win32icon:$(Join-Path $root 'icons\inkt.ico')" "/win32manifest:$(Join-Path $here 'app.manifest')" `
  "/r:$(Join-Path $lib 'Microsoft.Web.WebView2.Core.dll')" "/r:$(Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll')" `
  /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll `
  "/r:$fw\System.Runtime.WindowsRuntime.dll" "/r:$fw\System.Runtime.dll" "/r:$fw\System.Runtime.InteropServices.WindowsRuntime.dll" "/r:$fw\System.Threading.Tasks.dll" `
  "/r:$wm\Windows.Foundation.winmd" "/r:$wm\Windows.Storage.winmd" "/r:$wm\Windows.ApplicationModel.winmd" `
  (Join-Path $here 'Launcher.cs') (Join-Path $here 'Brug.cs') (Join-Path $here 'DeelServer.cs')
if ($LASTEXITCODE -ne 0) { throw 'Bouwen mislukt' }

function Install-App([string]$name, [string]$dir) {
  Copy-Item $build (Join-Path $dir ($name + '.exe')) -Force
  Copy-Item (Join-Path $lib 'Microsoft.Web.WebView2.Core.dll'), (Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll') $dir -Force
  Copy-Item (Join-Path $lib 'runtimes') $dir -Recurse -Force
  Write-Output ('Gemaakt: ' + (Join-Path $dir ($name + '.exe')))
}
Install-App 'Inkt' $root
$cel = Join-Path $root 'cel'
if (Test-Path (Join-Path $cel 'index.html')) { Install-App 'Cel' $cel }
