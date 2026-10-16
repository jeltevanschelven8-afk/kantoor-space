# Inkt — maakt snelkoppelingen op het bureaublad en in het Startmenu.
# Uitvoeren: rechtsklik > Uitvoeren met PowerShell, of: powershell -ExecutionPolicy Bypass -File .\maak-snelkoppelingen.ps1
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$shell = New-Object -ComObject WScript.Shell
$targets = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) '')
)
foreach ($folder in $targets) {
  $lnk = $shell.CreateShortcut((Join-Path $folder 'Inkt.lnk'))
  $lnk.TargetPath = Join-Path $dir 'Inkt.exe'
  $lnk.Arguments = ''
  $lnk.WorkingDirectory = $dir
  $lnk.IconLocation = (Join-Path $dir 'icons\inkt.ico') + ',0'
  $lnk.Description = 'Inkt word processor - made by JJ van Schelven'
  $lnk.Save()
  Write-Output ('Snelkoppeling gemaakt: ' + (Join-Path $folder 'Inkt.lnk'))
}


