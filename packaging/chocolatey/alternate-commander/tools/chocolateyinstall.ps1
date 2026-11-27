$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = 'https://github.com/powervac/Alternate-Total-Commander/releases/download/v0.1.943/Alternate-Commander-0.1.943-Windows-portable.exe'
  checksum64   = 'b5a82ffd29b73bcf581c2d6c57f2b873aaa790de8d6371b3608eedcf97e75101'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -TargetPath $exe
