$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = 'https://github.com/powervac/Alternate-Total-Commander/releases/download/v0.1.929/Alternate-Commander-0.1.929-Windows-portable.exe'
  checksum64   = '9740fbc6ad496bc85b0e9622722a36db1ed1a01efb3e5203a279547da9f1b0a7'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -TargetPath $exe
