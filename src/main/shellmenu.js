'use strict';
// Windows: the context menu of Explorer (the shell menu: Open with, Send to, Scan with Defender, Share ... and everything that programs add) for the files of a panel.
// Electron has no call for it, so a PowerShell helper (C# with the IContextMenu interfaces of the shell) shows it. The helper stays alive between two menus:
// compiling the C# code takes a second or two, only the first menu pays for it (start() is called early in the background).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CS = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

[ComImport, Guid("000214E6-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IShellFolderX {
  [PreserveSig] int ParseDisplayName(IntPtr hwnd, IntPtr pbc, [MarshalAs(UnmanagedType.LPWStr)] string name, ref uint eaten, out IntPtr pidl, ref uint attrs);
  [PreserveSig] int EnumObjects(IntPtr hwnd, int flags, out IntPtr e);
  [PreserveSig] int BindToObject(IntPtr pidl, IntPtr pbc, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int BindToStorage(IntPtr pidl, IntPtr pbc, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int CompareIDs(IntPtr l, IntPtr a, IntPtr b);
  [PreserveSig] int CreateViewObject(IntPtr hwnd, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetAttributesOf(uint c, [MarshalAs(UnmanagedType.LPArray)] IntPtr[] apidl, ref uint attrs);
  [PreserveSig] int GetUIObjectOf(IntPtr hwnd, uint c, [MarshalAs(UnmanagedType.LPArray)] IntPtr[] apidl, ref Guid riid, IntPtr reserved, out IntPtr ppv);
}

[ComImport, Guid("000214E4-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IContextMenuX {
  [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint index, uint idFirst, uint idLast, uint flags);
  [PreserveSig] int InvokeCommand(ref CMINVOKE info);
  [PreserveSig] int GetCommandString(UIntPtr id, uint type, IntPtr reserved, IntPtr name, uint cch);
}

[ComImport, Guid("000214F4-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IContextMenu2X : IContextMenuX {
  [PreserveSig] new int QueryContextMenu(IntPtr hmenu, uint index, uint idFirst, uint idLast, uint flags);
  [PreserveSig] new int InvokeCommand(ref CMINVOKE info);
  [PreserveSig] new int GetCommandString(UIntPtr id, uint type, IntPtr reserved, IntPtr name, uint cch);
  [PreserveSig] int HandleMenuMsg(uint msg, IntPtr w, IntPtr l);
}

[ComImport, Guid("BCFCE0A0-EC17-11D0-8D10-00A0C90F2719"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IContextMenu3X : IContextMenu2X {
  [PreserveSig] new int QueryContextMenu(IntPtr hmenu, uint index, uint idFirst, uint idLast, uint flags);
  [PreserveSig] new int InvokeCommand(ref CMINVOKE info);
  [PreserveSig] new int GetCommandString(UIntPtr id, uint type, IntPtr reserved, IntPtr name, uint cch);
  [PreserveSig] new int HandleMenuMsg(uint msg, IntPtr w, IntPtr l);
  [PreserveSig] int HandleMenuMsg2(uint msg, IntPtr w, IntPtr l, out IntPtr result);
}

[StructLayout(LayoutKind.Sequential)]
public struct CMINVOKE {
  public int cbSize; public int fMask; public IntPtr hwnd; public IntPtr lpVerb;
  [MarshalAs(UnmanagedType.LPStr)] public string lpParameters;
  [MarshalAs(UnmanagedType.LPStr)] public string lpDirectory;
  public int nShow; public int dwHotKey; public IntPtr hIcon;
  [MarshalAs(UnmanagedType.LPStr)] public string lpTitle;
  public IntPtr lpVerbW;
  [MarshalAs(UnmanagedType.LPWStr)] public string lpParametersW;
  [MarshalAs(UnmanagedType.LPWStr)] public string lpDirectoryW;
  [MarshalAs(UnmanagedType.LPWStr)] public string lpTitleW;
  public int ptX; public int ptY;
}

public class ShellMenu : NativeWindow {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern IntPtr CreatePopupMenu();
  [DllImport("user32.dll")] static extern bool DestroyMenu(IntPtr h);
  [DllImport("user32.dll")] static extern uint TrackPopupMenuEx(IntPtr hmenu, uint flags, int x, int y, IntPtr hwnd, IntPtr tpm);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr h);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("shell32.dll")] static extern int SHParseDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr bc, out IntPtr pidl, uint sfgaoIn, out uint sfgaoOut);
  [DllImport("shell32.dll")] static extern int SHBindToParent(IntPtr pidl, ref Guid riid, out IntPtr ppv, out IntPtr pidlLast);
  [DllImport("ole32.dll")] static extern void CoTaskMemFree(IntPtr p);

  const int WM_INITMENUPOPUP = 0x117, WM_DRAWITEM = 0x2B, WM_MEASUREITEM = 0x2C, WM_MENUCHAR = 0x120;
  IContextMenu2X cm2; IContextMenu3X cm3;

  public static void Init() { SetProcessDPIAware(); }

  protected override void WndProc(ref Message m) {
    if (cm2 != null && (m.Msg == WM_INITMENUPOPUP || m.Msg == WM_DRAWITEM || m.Msg == WM_MEASUREITEM || m.Msg == WM_MENUCHAR)) {
      try {
        if (cm3 != null) { IntPtr r; if (cm3.HandleMenuMsg2((uint)m.Msg, m.WParam, m.LParam, out r) == 0) { m.Result = r; return; } }
        else if (cm2.HandleMenuMsg((uint)m.Msg, m.WParam, m.LParam) == 0) { m.Result = IntPtr.Zero; return; }
      } catch { }
    }
    base.WndProc(ref m);
  }

  public static string Show(string[] files, int x, int y) {
    var host = new ShellMenu();
    var cp = new CreateParams(); cp.X = x; cp.Y = y; cp.Width = 1; cp.Height = 1; cp.Style = unchecked((int)0x80000000); cp.ExStyle = 0x88;
    host.CreateHandle(cp);
    var full = new IntPtr[files.Length]; var child = new IntPtr[files.Length];
    IntPtr hmenu = IntPtr.Zero; object cmObj = null; IShellFolderX folder = null; string result = "cmd=0";
    try {
      Guid iidFolder = new Guid("000214E6-0000-0000-C000-000000000046");
      IntPtr folderPtr = IntPtr.Zero;
      for (int i = 0; i < files.Length; i++) {
        uint a; int hr = SHParseDisplayName(files[i], IntPtr.Zero, out full[i], 0, out a);
        if (hr != 0) return "error SHParseDisplayName " + hr.ToString("x") + " " + files[i];
        IntPtr fp; hr = SHBindToParent(full[i], ref iidFolder, out fp, out child[i]);
        if (hr != 0) return "error SHBindToParent " + hr.ToString("x");
        if (i == 0) folderPtr = fp; else Marshal.Release(fp);
      }
      folder = (IShellFolderX)Marshal.GetObjectForIUnknown(folderPtr);
      Marshal.Release(folderPtr);
      Guid iidCm = new Guid("000214E4-0000-0000-C000-000000000046");
      IntPtr cmPtr;
      int h2 = folder.GetUIObjectOf(host.Handle, (uint)files.Length, child, ref iidCm, IntPtr.Zero, out cmPtr);
      if (h2 != 0) return "error GetUIObjectOf " + h2.ToString("x");
      cmObj = Marshal.GetObjectForIUnknown(cmPtr);
      Marshal.Release(cmPtr);
      var cm = (IContextMenuX)cmObj;
      host.cm2 = cmObj as IContextMenu2X; host.cm3 = cmObj as IContextMenu3X;
      hmenu = CreatePopupMenu();
      int q = cm.QueryContextMenu(hmenu, 0, 1, 0x7FFF, 0x10 /*CMF_CANRENAME*/ | ((Control.ModifierKeys & Keys.Shift) != 0 ? 0x100u : 0u));
      int count = GetMenuItemCount(hmenu);
      // the menu may only take the focus when this process owns the foreground: a tap on Alt gives the right
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(host.Handle);
      uint cmd = TrackPopupMenuEx(hmenu, 0x100 | 0x2, x, y, host.Handle, IntPtr.Zero);
      PostMessage(host.Handle, 0, IntPtr.Zero, IntPtr.Zero);
      result = "cmd=" + cmd + " items=" + count;
      if (cmd > 0) {
        var info = new CMINVOKE();
        info.cbSize = Marshal.SizeOf(typeof(CMINVOKE));
        info.fMask = 0x4000 | 0x20000000; // unicode + the point of the click
        info.hwnd = host.Handle;
        info.lpVerb = (IntPtr)(cmd - 1); info.lpVerbW = (IntPtr)(cmd - 1);
        info.nShow = 1; info.ptX = x; info.ptY = y;
        string dir = System.IO.Path.GetDirectoryName(files[0]);
        info.lpDirectory = dir; info.lpDirectoryW = dir;
        int ir = cm.InvokeCommand(ref info);
        result += " invoke=" + ir.ToString("x");
      }
    } finally {
      if (hmenu != IntPtr.Zero) DestroyMenu(hmenu);
      host.cm2 = null; host.cm3 = null;
      if (cmObj != null) Marshal.ReleaseComObject(cmObj);
      if (folder != null) Marshal.ReleaseComObject(folder);
      foreach (var p in full) if (p != IntPtr.Zero) CoTaskMemFree(p);
      host.DestroyHandle();
    }
    return result;
  }
}
`;

const PS = `
$ErrorActionPreference = 'Stop'
$cs = @'
${CS}
'@
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition $cs
[ShellMenu]::Init()
[Console]::Out.WriteLine('ready')
while (($line = [Console]::In.ReadLine()) -ne $null) {
  try {
    $j = $line | ConvertFrom-Json
    $r = [ShellMenu]::Show([string[]]@($j.files), [int]$j.x, [int]$j.y)
    [Console]::Out.WriteLine('done ' + $r)
  } catch { [Console]::Out.WriteLine('error ' + ($_.Exception.Message -replace '[\\r\\n]+', ' ')) }
}
`;

let proc = null;
let ready = null; // promise: the helper has compiled its code
let waiting = null; // resolver of the menu that is open
let buf = '';
let queue = Promise.resolve();

function start() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  if (proc && ready) return ready;
  const file = path.join(os.tmpdir(), 'commander-shellmenu.ps1');
  fs.writeFileSync(file, PS, 'utf8');
  buf = '';
  let onReady;
  ready = new Promise((r) => { onReady = r; });
  proc = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-STA', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const mine = proc;
  const fail = (why) => { if (proc === mine) { proc = null; ready = null; } onReady(false); if (waiting) { const w = waiting; waiting = null; w({ error: why }); } };
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line === 'ready') onReady(true);
      else if (line.startsWith('done ') || line.startsWith('error ')) { if (waiting) { const w = waiting; waiting = null; w(line.startsWith('done ') ? { ok: true, info: line.slice(5) } : { error: line.slice(6) }); } }
    }
  });
  let errText = '';
  proc.stderr.on('data', (d) => { errText += d; });
  proc.on('exit', () => fail(errText.trim().slice(0, 300) || 'The helper of the shell menu stopped'));
  proc.on('error', (e) => fail(e.message));
  return ready;
}

/** shows the shell menu of the files at the screen point (physical pixels); resolves when the menu is closed (and its command, if any, was started) */
function show(files, x, y) {
  const run = async () => {
    const ok = await start();
    if (!ok || !proc) return { error: 'The shell menu helper could not be started' };
    return new Promise((resolve) => {
      waiting = resolve;
      proc.stdin.write(JSON.stringify({ files, x: Math.round(x), y: Math.round(y) }) + '\n');
    });
  };
  queue = queue.then(run, run);
  return queue;
}

function stop() { try { if (proc) proc.kill(); } catch { /* ignore */ } proc = null; ready = null; }

module.exports = { start, show, stop };
