$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = 'https://github.com/powervac/Alternate-Total-Commander/releases/download/v0.1.941/Alternate-Commander-0.1.941-Windows-portable.exe'
  checksum64   = '20a65d342720e9442615386ea40135cf6bc5e64bafcd379e7d17e5f7d0e30033'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -TargetPath $exe
