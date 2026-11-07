# Package manager manifests

Written by `node tools/packaging.js [version]` from the files of the GitHub release (`npm run release` runs it after the release is made).
Everything here is **a copy for one version**: after each release the files are written again, then submitted (or pushed to your own repository).

| System | Folder | Where it goes |
|---|---|---|
| Windows: **winget** | `winget/manifests/p/powervac/AlternateCommander/<version>/` | pull request to https://github.com/microsoft/winget-pkgs |
| Windows: **Scoop** | `scoop/alternate-commander.json` | your own bucket `powervac/scoop-bucket` (folder `bucket/`) |
| Windows: **Chocolatey** | `chocolatey/alternate-commander/` | https://community.chocolatey.org (moderated) |
| macOS: **Homebrew cask** | `homebrew/Casks/alternate-commander.rb` | your own tap `powervac/homebrew-tap` (folder `Casks/`) |
| Linux: **AppStream / desktop file** | `linux/` | Flathub, Snap Store, AppImageHub (see below) |

The Windows files are the portable exe of the GitHub release (`Alternate-Commander-<version>-Windows-portable.exe`); the program is not code-signed yet, so
the moderators of winget and Chocolatey scan it (Defender, VirusTotal). Code signing (SignPath Foundation) makes this smoother.

## winget

```
winget validate --manifest packaging/winget/manifests/p/powervac/AlternateCommander/<version>
```
Then submit: fork `microsoft/winget-pkgs`, copy the folder to `manifests/p/powervac/AlternateCommander/<version>/` and open a pull request.
The easy way: `wingetcreate update powervac.AlternateCommander --version <version> --urls <exe url> --submit` (after the first version is accepted), or the GitHub Action
`vedantmgoyal9/winget-releaser`, which makes the pull request after every GitHub release. Users: `winget install powervac.AlternateCommander`.

## Scoop

Create a public repository `powervac/scoop-bucket` with the file in `bucket/alternate-commander.json`. Users:
```
scoop bucket add powervac https://github.com/powervac/scoop-bucket
scoop install alternate-commander
```
`checkver` and `autoupdate` are in the file: the bucket's own Excavator action keeps it current.

## Chocolatey

```
cd packaging/chocolatey/alternate-commander
choco pack
choco apikey --key <your key> --source https://push.chocolatey.org/
choco push alternate-commander.<version>.nupkg --source https://push.chocolatey.org/
```
The first version goes through manual moderation (a few days). Users: `choco install alternate-commander`.

## Homebrew (macOS)

Needs the two dmg files in the GitHub release (`Alternate-Commander-<version>-macOS-arm64.dmg` and `...-macOS-Intel.dmg`).
Create a public repository `powervac/homebrew-tap` with the file in `Casks/alternate-commander.rb`. Users:
```
brew install --cask powervac/tap/alternate-commander
```
The main `homebrew/cask` repository does not accept apps that are not signed and notarized by Apple, so a tap is the way for now.
The cask removes the quarantine mark and signs the app locally (the same as `install-mac.sh`).

## Linux

- **AppImageHub (appimage.github.io):** a pull request to https://github.com/AppImage/appimage.github.io adding `apps/Alternate-Commander.md` (name, description, links to the repository and the AppImage). No other work needed: the AppImage of every release already exists.
- **Flathub:** needs a Flatpak manifest that builds from source (an Electron app is built with `flatpak-node-generator` and the `org.electronjs.Electron2.BaseApp`) plus the files in `linux/`
  (`io.github.powervac.AlternateCommander.metainfo.xml`, `.desktop` and an icon). Submit to https://github.com/flathub/flathub (a new-app pull request). This is a separate piece of work.
- **Snap Store:** electron-builder can build a snap (`electron-builder --linux snap`) on a Linux runner with snapcraft; needs a Snap Store account and `SNAPCRAFT_STORE_CREDENTIALS` in GitHub secrets.
