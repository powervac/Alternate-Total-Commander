'use strict';
// "Autostart programs": what starts with Windows (like Sysinternals Autoruns): Run / RunOnce keys, Startup folders, Winlogon, scheduled tasks
// that run at logon or boot, and services that start automatically. Read through PowerShell; entries of the Run keys and Startup folders can be
// switched on / off the way Task Manager does it (StartupApproved) and deleted. On macOS the launchd agents / daemons are listed.
const { execFile } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

const LIST_PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$res = New-Object System.Collections.ArrayList
$vi = @{}
function Full-Path([string]$f) {
  if ($f -and -not [IO.Path]::IsPathRooted($f)) {
    $g = Get-Command $f -CommandType Application | Select-Object -First 1
    if ($g) { return [string]$g.Source }
  }
  return $f
}
function Resolve-Exe([string]$cmd) {
  $c = [Environment]::ExpandEnvironmentVariables(($cmd + '').Trim())
  if ($c -match '^"([^"]+)"') { return (Full-Path $matches[1]) }
  if ($c -match '^(.+?\.(exe|bat|cmd|com|scr|lnk|vbs|js|ps1|msi|dll))(\s|$)') { return (Full-Path $matches[1]) }
  return (Full-Path (($c -split ' ')[0]))
}
function File-Info([string]$f) {
  $o = @{ exists = $false; time = 0; desc = ''; pub = '' }
  if (-not $f) { return $o }
  if ($vi.ContainsKey($f)) { return $vi[$f] }
  if (Test-Path -LiteralPath $f -PathType Leaf) {
    $i = Get-Item -LiteralPath $f -Force
    $o.exists = $true
    $o.time = [int64](([DateTimeOffset]$i.LastWriteTimeUtc).ToUnixTimeMilliseconds())
    $o.desc = [string]$i.VersionInfo.FileDescription
    $o.pub = [string]$i.VersionInfo.CompanyName
  }
  $vi[$f] = $o
  return $o
}
function Approved([string]$hive, [string]$sub, [string]$name) {
  $p = $hive + ':\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\' + $sub
  $v = (Get-ItemProperty -LiteralPath $p -Name $name).$name
  if ($v -is [byte[]] -and $v.Length -gt 0) { return (($v[0] -band 1) -eq 0) }
  return $true
}
function Add-Entry($group, $kind, $loc, $name, $cmd, $enabled, $toggle, $descExtra) {
  $f = (Resolve-Exe $cmd).TrimEnd(',')
  $fi = File-Info $f
  if (-not $f) { $fi = @{ exists = $true; time = 0; desc = ''; pub = '' } }  # nothing to look for (a task that calls a COM handler)
  $d = $fi.desc
  if (-not $d) { $d = $descExtra }
  [void]$res.Add(@{ group = $group; kind = $kind; loc = $loc; name = $name; desc = $d; pub = $fi.pub; cmd = $cmd; file = $f; exists = $fi.exists; time = $fi.time; enabled = $enabled; toggle = $toggle })
}

# Run / RunOnce
$runKeys = @(
  @('HKLM', 'Run', 'SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'Run'),
  @('HKLM', 'RunOnce', 'SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce', ''),
  @('HKLM', 'Run', 'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run', 'Run32'),
  @('HKCU', 'Run', 'SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'Run'),
  @('HKCU', 'RunOnce', 'SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce', '')
)
foreach ($k in $runKeys) {
  $item = Get-Item -LiteralPath ($k[0] + ':\' + $k[2])
  if (-not $item) { continue }
  foreach ($n in $item.GetValueNames()) {
    if ($n -eq '') { continue }
    $cmd = [string]$item.GetValue($n)
    $en = $true
    if ($k[3]) { $en = Approved $k[0] $k[3] $n }
    Add-Entry 'Logon' 'run' ($k[0] + '\' + $k[2]) $n $cmd $en @{ type = 'run'; hive = $k[0]; key = $k[2]; name = $n; approved = $k[3] } ''
  }
}
# Startup folders
$sh = New-Object -ComObject WScript.Shell
foreach ($d in @(@([Environment]::GetFolderPath('Startup'), 'HKCU'), @([Environment]::GetFolderPath('CommonStartup'), 'HKLM'))) {
  if (-not $d[0]) { continue }
  foreach ($f in (Get-ChildItem -LiteralPath $d[0] -Force)) {
    if ($f.Name -eq 'desktop.ini' -or $f.PSIsContainer) { continue }
    $cmd = $f.FullName
    if ($f.Extension -eq '.lnk') { $s = $sh.CreateShortcut($f.FullName); $cmd = ('"' + $s.TargetPath + '" ' + $s.Arguments).Trim() }
    $en = Approved $d[1] 'StartupFolder' $f.Name
    Add-Entry 'Logon' 'startup' $d[0] $f.Name $cmd $en @{ type = 'startup'; hive = $d[1]; name = $f.Name; file = $f.FullName } ''
  }
}
# Winlogon
$wl = Get-Item -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
foreach ($n in @('Shell', 'Userinit', 'Taskman')) {
  $v = [string]$wl.GetValue($n)
  if ($v) { Add-Entry 'Logon' 'winlogon' 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' $n $v $true $null '' }
}
# scheduled tasks that run at logon or at boot
foreach ($t in (Get-ScheduledTask)) {
  $trig = @($t.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon|Boot' })
  if (-not $trig.Count) { continue }
  $a = @($t.Actions)[0]
  if (-not $a) { continue }
  $cmd = (([string]$a.Execute) + ' ' + ([string]$a.Arguments)).Trim()
  Add-Entry 'Tasks' 'task' $t.TaskPath $t.TaskName $cmd ($t.State -ne 'Disabled') @{ type = 'task'; path = $t.TaskPath; name = $t.TaskName } ([string]$t.Description)
}
# services that start by themselves
foreach ($s in (Get-CimInstance Win32_Service -Filter "StartMode='Auto'")) {
  Add-Entry 'Services' 'service' 'Services' $s.Name $s.PathName ($s.State -eq 'Running') $null ([string]$s.DisplayName)
}
ConvertTo-Json -InputObject @($res) -Depth 5 -Compress
`;

const ACT_PS = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$a = $env:CMDR_ARG | ConvertFrom-Json
$t = $a.toggle
try {
  if ($a.op -eq 'enable' -or $a.op -eq 'disable') {
    if ($t.type -eq 'run' -or $t.type -eq 'startup') {
      $sub = if ($t.type -eq 'startup') { 'StartupFolder' } else { $t.approved }
      if (-not $sub) { throw 'This entry cannot be switched off (it runs once).' }
      $p = $t.hive + ':\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\' + $sub
      if (-not (Test-Path -LiteralPath $p)) { New-Item -Path $p -Force | Out-Null }
      $b = New-Object byte[] 12
      $b[0] = if ($a.op -eq 'enable') { 2 } else { 3 }
      Set-ItemProperty -LiteralPath $p -Name $t.name -Value $b -Type Binary
    } elseif ($t.type -eq 'task') {
      if ($a.op -eq 'enable') { Enable-ScheduledTask -TaskPath $t.path -TaskName $t.name | Out-Null } else { Disable-ScheduledTask -TaskPath $t.path -TaskName $t.name | Out-Null }
    } else { throw 'This entry cannot be switched.' }
  } elseif ($a.op -eq 'delete') {
    if ($t.type -eq 'run') { Remove-ItemProperty -LiteralPath ($t.hive + ':\' + $t.key) -Name $t.name }
    elseif ($t.type -eq 'startup') { Remove-Item -LiteralPath $t.file -Force }
    else { throw 'Only entries of the Run keys and of the Startup folders can be deleted here.' }
  }
  '{"ok":true}'
} catch {
  $m = $_.Exception.Message
  if ($m -match 'denied|Zugriff|privilege|0x80070005|UnauthorizedAccess') { $m = 'Access denied: this entry is for all users, start the program as administrator to change it.' }
  ConvertTo-Json -InputObject @{ error = $m } -Compress
}
`;

function runPs(script, arg) {
  return new Promise(async (resolve, reject) => {
    const file = path.join(os.tmpdir(), `commander-autoruns-${process.pid}-${Date.now()}.ps1`);
    await fsp.writeFile(file, '﻿' + script, 'utf8'); // BOM: PowerShell 5 reads the file as UTF-8
    const env = { ...process.env, CMDR_ARG: arg ? JSON.stringify(arg) : '' };
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { env, maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 90000, encoding: 'utf8' }, (err, out, errOut) => {
      fsp.rm(file, { force: true }).catch(() => {});
      if (err && !out) return reject(new Error(String(errOut || err.message).trim().slice(0, 300)));
      resolve(String(out).replace(/^﻿/, '').trim());
    });
  });
}

// ---------------------------------------------------------------- macOS: launchd agents and daemons
async function listMac() {
  const dirs = [
    ['Logon', path.join(os.homedir(), 'Library/LaunchAgents')],
    ['Logon', '/Library/LaunchAgents'],
    ['Services', '/Library/LaunchDaemons'],
  ];
  const out = [];
  for (const [group, dir] of dirs) {
    let names = [];
    try { names = (await fsp.readdir(dir)).filter((n) => n.endsWith('.plist')); } catch { continue; }
    for (const n of names) {
      const file = path.join(dir, n);
      let j = {};
      try {
        j = await new Promise((res) => execFile('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }, (e, o) => { try { res(JSON.parse(o)); } catch { res({}); } }));
      } catch { /* unreadable */ }
      const args = Array.isArray(j.ProgramArguments) ? j.ProgramArguments : j.Program ? [j.Program] : [];
      const exe = args[0] || '';
      let st = null;
      try { st = await fsp.stat(exe); } catch { /* missing */ }
      out.push({ group, kind: 'launchd', loc: dir, name: j.Label || n, desc: '', pub: '', cmd: args.join(' '), file: exe, exists: !!st, time: st ? Math.round(st.mtimeMs) : 0, enabled: !j.Disabled, toggle: null });
    }
  }
  return out;
}

async function list() {
  if (process.platform === 'darwin') return { items: await listMac() };
  if (process.platform !== 'win32') return { error: 'The list of autostart programs is available on Windows and macOS.' };
  const out = await runPs(LIST_PS);
  try { return { items: JSON.parse(out || '[]') }; } catch { return { error: 'Cannot read the list: ' + out.slice(0, 200) }; }
}

async function act(arg) {
  if (process.platform !== 'win32') return { error: 'Changing entries is available on Windows only.' };
  if (!arg || !['enable', 'disable', 'delete'].includes(arg.op) || !arg.toggle) return { error: 'This entry cannot be changed here.' };
  try { return JSON.parse(await runPs(ACT_PS, arg)); } catch (e) { return { error: e.message }; }
}

function register(ipcMain) {
  ipcMain.handle('autoruns:list', async () => { try { return await list(); } catch (e) { return { error: e.message }; } });
  ipcMain.handle('autoruns:act', async (_e, arg) => { try { return await act(arg); } catch (e) { return { error: e.message }; } });
}

module.exports = { register, list, act };
