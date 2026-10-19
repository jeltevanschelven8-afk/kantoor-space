# Bouwt het programmabestand met de C#-compiler die in Windows zit, en zet het neer als Inkt.exe, cel\Cel.exe en
# doek\Doek.exe. De code is voor alle drie gelijk (de bestandsnaam bepaalt welke app opent); alleen het ingebouwde
# icoon verschilt, zodat elk programma in Verkenner zijn eigen icoon heeft.
# Uitvoeren: powershell -ExecutionPolicy Bypass -File .\programma\bouw.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$lib = Join-Path $here 'lib'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
$fw = Split-Path -Parent $csc                         # .NET Framework-map (bevat de WinRT-hulpassembly's)
$wm = Join-Path $env:WINDIR 'System32\WinMetadata'    # Windows-metadata voor het deelvenster (Brug.cs)

$apps = @(
  @{ Name = 'Inkt'; Dir = $root;                         Ico = 'icons\inkt.ico' },
  @{ Name = 'Cel';  Dir = (Join-Path $root 'cel');       Ico = 'cel\icons\cel.ico' },
  @{ Name = 'Doek'; Dir = (Join-Path $root 'doek');      Ico = 'doek\icons\doek.ico' }
)
foreach ($a in $apps) {
  if (-not (Test-Path (Join-Path $a.Dir 'index.html'))) { continue }
  $build = Join-Path $here ('Kantoor-' + $a.Name + '.exe')
  & $csc /nologo /target:winexe /platform:anycpu /optimize+ "/out:$build" "/win32icon:$(Join-Path $root $a.Ico)" "/win32manifest:$(Join-Path $here 'app.manifest')" `
    "/r:$(Join-Path $lib 'Microsoft.Web.WebView2.Core.dll')" "/r:$(Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll')" `
    /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll `
    "/r:$fw\System.Runtime.WindowsRuntime.dll" "/r:$fw\System.Runtime.dll" "/r:$fw\System.Runtime.InteropServices.WindowsRuntime.dll" "/r:$fw\System.Threading.Tasks.dll" `
    "/r:$wm\Windows.Foundation.winmd" "/r:$wm\Windows.Storage.winmd" "/r:$wm\Windows.ApplicationModel.winmd" `
    (Join-Path $here 'Launcher.cs') (Join-Path $here 'Brug.cs') (Join-Path $here 'DeelServer.cs')
  if ($LASTEXITCODE -ne 0) { throw ('Bouwen mislukt: ' + $a.Name) }
  Copy-Item $build (Join-Path $a.Dir ($a.Name + '.exe')) -Force
  Copy-Item (Join-Path $lib 'Microsoft.Web.WebView2.Core.dll'), (Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll') $a.Dir -Force
  Copy-Item (Join-Path $lib 'runtimes') $a.Dir -Recurse -Force
  Remove-Item $build -Force
  Write-Output ('Gemaakt: ' + (Join-Path $a.Dir ($a.Name + '.exe')))
}
