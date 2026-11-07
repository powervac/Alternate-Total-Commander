#!/usr/bin/env node
'use strict';
// Writes the manifests of the package managers into packaging/ for one version, with the checksums of the files of the GitHub release
// (Windows portable exe, Linux AppImage, macOS dmg):
//   node tools/packaging.js            (the version of package.json)
//   node tools/packaging.js 0.1.924
// winget, Scoop, Chocolatey, a Homebrew cask and the AppStream data for Linux stores. npm run release calls it after the GitHub release is made.
// The checksums come from the release assets (the GitHub API gives "digest"); the dmg files that are not in the release yet are hashed from dist-release/mac.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'powervac/Alternate-Total-Commander';
const SITE = 'https://altcom.cc';
const V = process.argv[2] || JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const BASE = `https://github.com/${REPO}/releases/download/v${V}/`;
const NAME = { win: `Alternate-Commander-${V}-Windows-portable.exe`, linux: `Alternate-Commander-${V}-Linux-x86_64.AppImage`, arm: `Alternate-Commander-${V}-macOS-arm64.dmg`, intel: `Alternate-Commander-${V}-macOS-Intel.dmg` };
const DESC = 'Free, open-source two-panel file manager in the style of Total Commander, for Windows, macOS and Linux.';
const LONG = 'Alternate Commander is a keyboard-first two-panel file manager. Archives (zip, 7z, tar, rar and more) open like folders; Google Drive, Dropbox, Synology NAS and SSH/SFTP servers work as ordinary disks; Find Files, compare and synchronize folders, multi-rename, viewer and editor, music player and settings sync are built in. It is an unofficial project and is not affiliated with Total Commander / Ghisler Software.';
const today = new Date().toISOString().slice(0, 10);

function digests() {
  const r = spawnSync('gh', ['api', `repos/${REPO}/releases/tags/v${V}`, '--jq', '.assets[] | "\\(.name) \\(.digest)"'], { encoding: 'utf8' });
  const out = {};
  for (const l of (r.stdout || '').split('\n')) { const m = /^(\S+) sha256:([0-9a-f]{64})$/.exec(l.trim()); if (m) out[m[1]] = m[2]; }
  return out;
}
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function localDmg(arch) {
  const dir = path.join(ROOT, 'dist-release', 'mac');
  if (!fs.existsSync(dir)) return null;
  let found = null;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (arch === 'arm' ? new RegExp(`-${V.replace(/\./g, '\\.')}-arm64\\.dmg$`).test(e.name) : new RegExp(`-${V.replace(/\./g, '\\.')}\\.dmg$`).test(e.name) && !/arm64/.test(e.name)) found = p; } })(dir);
  return found ? sha(found) : null;
}

const d = digests();
const H = { win: d[NAME.win], linux: d[NAME.linux], arm: d[NAME.arm] || localDmg('arm'), intel: d[NAME.intel] || localDmg('intel') };
console.log('version', V, '| checksums:', Object.entries(H).map(([k, v]) => k + '=' + (v ? v.slice(0, 8) : 'MISSING')).join(' '));
if (!H.win) { console.error('The Windows file is not in the GitHub release v' + V + ': nothing written.'); process.exit(1); }

const out = (rel, text) => { const f = path.join(ROOT, 'packaging', rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text.replace(/\r?\n/g, '\n')); };

// ---------------------------------------------------------------- winget (3 files: version, installer, locale)
const WG = `manifests/p/powervac/AlternateCommander/${V}/powervac.AlternateCommander`;
out(`winget/${WG}.yaml`, `# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.1.28.0.schema.json

PackageIdentifier: powervac.AlternateCommander
PackageVersion: ${V}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.28.0
`);
out(`winget/${WG}.installer.yaml`, `# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.1.28.0.schema.json

PackageIdentifier: powervac.AlternateCommander
PackageVersion: ${V}
InstallerType: portable
Commands:
- alternate-commander
ReleaseDate: ${today}
Installers:
- Architecture: x64
  InstallerUrl: ${BASE}${NAME.win}
  InstallerSha256: ${H.win.toUpperCase()}
ManifestType: installer
ManifestVersion: 1.28.0
`);
out(`winget/${WG}.locale.en-US.yaml`, `# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.1.28.0.schema.json

PackageIdentifier: powervac.AlternateCommander
PackageVersion: ${V}
PackageLocale: en-US
Publisher: powervac
PublisherUrl: https://github.com/powervac
PublisherSupportUrl: https://github.com/${REPO}/issues
Author: powervac
PackageName: Alternate Commander
PackageUrl: ${SITE}
License: MIT
LicenseUrl: https://github.com/${REPO}/blob/main/LICENSE
ShortDescription: Two-panel file manager in the style of Total Commander
Description: ${LONG}
Moniker: altcom
Tags:
- file-manager
- file-explorer
- two-panel
- dual-pane
- total-commander
- ftp
- sftp
- ssh
- dropbox
- google-drive
- archive
ReleaseNotesUrl: ${SITE}/changelog.html
ManifestType: defaultLocale
ManifestVersion: 1.28.0
`);

// ---------------------------------------------------------------- Scoop (a bucket: the file goes to the bucket/ folder of a repository)
out('scoop/alternate-commander.json', JSON.stringify({
  version: V,
  description: DESC,
  homepage: SITE,
  license: 'MIT',
  architecture: { '64bit': { url: `${BASE}${NAME.win}#/alternate-commander.exe`, hash: H.win } },
  bin: 'alternate-commander.exe',
  shortcuts: [['alternate-commander.exe', 'Alternate Commander']],
  checkver: { github: `https://github.com/${REPO}` },
  autoupdate: { architecture: { '64bit': { url: `https://github.com/${REPO}/releases/download/v$version/Alternate-Commander-$version-Windows-portable.exe#/alternate-commander.exe` } } },
}, null, 2) + '\n');

// ---------------------------------------------------------------- Chocolatey
out('chocolatey/alternate-commander/alternate-commander.nuspec', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>alternate-commander</id>
    <version>${V}</version>
    <title>Alternate Commander</title>
    <authors>powervac</authors>
    <owners>powervac</owners>
    <projectUrl>${SITE}</projectUrl>
    <projectSourceUrl>https://github.com/${REPO}</projectSourceUrl>
    <bugTrackerUrl>https://github.com/${REPO}/issues</bugTrackerUrl>
    <docsUrl>${SITE}</docsUrl>
    <iconUrl>https://raw.githubusercontent.com/${REPO}/main/build/icon.png</iconUrl>
    <licenseUrl>https://github.com/${REPO}/blob/main/LICENSE</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <tags>file-manager two-panel dual-pane total-commander ssh sftp dropbox google-drive archive portable foss cross-platform</tags>
    <summary>Two-panel file manager in the style of Total Commander</summary>
    <description>${LONG}

This package installs the portable executable of the program from the GitHub release and adds a Start menu shortcut. The program updates itself (Configuration &gt; Check for Updates).</description>
    <releaseNotes>${SITE}/changelog.html</releaseNotes>
  </metadata>
  <files>
    <file src="tools\\**" target="tools" />
  </files>
</package>
`);
out('chocolatey/alternate-commander/tools/chocolateyinstall.ps1', `$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = Join-Path $toolsDir 'Alternate-Commander.exe'

$packageArgs = @{
  packageName  = $env:ChocolateyPackageName
  fileFullPath = $exe
  url64bit     = '${BASE}${NAME.win}'
  checksum64   = '${H.win}'
  checksumType64 = 'sha256'
}
Get-ChocolateyWebFile @packageArgs

# a program with a window: the shim must not wait for it
New-Item "$exe.gui" -ItemType File -Force | Out-Null
Install-ChocolateyShortcut -ShortcutFilePath "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Alternate Commander.lnk" -TargetPath $exe
`);
out('chocolatey/alternate-commander/tools/chocolateyuninstall.ps1', `$ErrorActionPreference = 'Stop'
Remove-Item "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Alternate Commander.lnk" -Force -ErrorAction SilentlyContinue
`);

// ---------------------------------------------------------------- Homebrew cask (a tap: the file goes to Casks/ of the repository powervac/homebrew-tap)
if (H.arm && H.intel) {
  out('homebrew/Casks/alternate-commander.rb', `cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "${V}"
  sha256 arm:   "${H.arm}",
         intel: "${H.intel}"

  url "https://github.com/${REPO}/releases/download/v#{version}/Alternate-Commander-#{version}-macOS-#{arch}.dmg",
      verified: "github.com/${REPO}/"
  name "Alternate Commander"
  desc "Two-panel file manager in the style of Total Commander"
  homepage "${SITE}/"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Commander.app"

  # the app is not signed by Apple: remove the quarantine mark and sign it locally (needed on Apple Silicon)
  postflight do
    system_command "/usr/bin/xattr", args: ["-cr", "#{appdir}/Commander.app"]
    system_command "/usr/bin/codesign", args: ["--force", "--deep", "--sign", "-", "#{appdir}/Commander.app"]
  end

  zap trash: [
    "~/Library/Application Support/Commander",
    "~/Library/Preferences/local.commander.filemanager.plist",
    "~/Library/Saved Application State/local.commander.filemanager.savedState",
  ]
end
`);
} else console.log('No dmg checksums: the Homebrew cask is not written.');

// ---------------------------------------------------------------- Linux stores: AppStream data and the desktop file (Flathub, Snap Store, software centres)
out('linux/io.github.powervac.AlternateCommander.metainfo.xml', `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>io.github.powervac.AlternateCommander</id>
  <name>Alternate Commander</name>
  <summary>Two-panel file manager in the style of Total Commander</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>
  <developer_name>powervac</developer_name>
  <description>
    <p>Alternate Commander is a keyboard-first two-panel file manager. Archives (zip, 7z, tar, rar and more) open like folders; Google Drive, Dropbox, Synology NAS and SSH/SFTP servers work as ordinary disks.</p>
    <p>Find Files, compare and synchronize folders, multi-rename, a viewer and an editor, a music player and settings sync are built in. It is an unofficial project and is not affiliated with Total Commander / Ghisler Software.</p>
  </description>
  <launchable type="desktop-id">io.github.powervac.AlternateCommander.desktop</launchable>
  <url type="homepage">${SITE}</url>
  <url type="bugtracker">https://github.com/${REPO}/issues</url>
  <url type="vcs-browser">https://github.com/${REPO}</url>
  <url type="faq">${SITE}/changelog.html</url>
  <screenshots>
    <screenshot type="default"><image>https://raw.githubusercontent.com/${REPO}/main/docs/img/two-panels.png</image><caption>Two panels</caption></screenshot>
    <screenshot><image>https://raw.githubusercontent.com/${REPO}/main/docs/img/archive-as-folder.png</image><caption>An archive opened like a folder</caption></screenshot>
    <screenshot><image>https://raw.githubusercontent.com/${REPO}/main/docs/img/thumbnails.png</image><caption>Thumbnails</caption></screenshot>
  </screenshots>
  <categories><category>Utility</category><category>FileManager</category></categories>
  <content_rating type="oars-1.1" />
  <releases>
    <release version="${V}" date="${today}"><url>${SITE}/changelog.html</url></release>
  </releases>
</component>
`);
out('linux/io.github.powervac.AlternateCommander.desktop', `[Desktop Entry]
Type=Application
Name=Alternate Commander
Comment=Two-panel file manager in the style of Total Commander
Exec=alternate-commander %U
Icon=io.github.powervac.AlternateCommander
Terminal=false
Categories=Utility;FileManager;
Keywords=file;manager;commander;two-panel;ssh;sftp;dropbox;
`);
console.log('packaging/ written for ' + V);
