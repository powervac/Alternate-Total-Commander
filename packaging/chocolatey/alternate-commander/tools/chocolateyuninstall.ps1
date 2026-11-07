$ErrorActionPreference = 'Stop'
Remove-Item "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alternate Commander.lnk" -Force -ErrorAction SilentlyContinue
