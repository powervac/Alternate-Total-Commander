$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = 'https://github.com/powervac/Alternate-Total-Commander/releases/download/v0.1.942/Alternate-Commander-0.1.942-Windows-portable.exe'
  checksum64   = 'afec05eb5371385c2e2431c8e61ee53d3a06fd84fb688eaff47c1daa8d1f0915'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -TargetPath $exe
