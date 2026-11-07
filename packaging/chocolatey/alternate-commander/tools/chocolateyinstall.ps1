$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = 'https://github.com/powervac/Alternate-Total-Commander/releases/download/v0.1.926/Alternate-Commander-0.1.926-Windows-portable.exe'
  checksum64   = '13f0bc481c918109fdc74bc03318dc12aba86b3741d5899a22e27c6e6b71fef1'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -TargetPath $exe
