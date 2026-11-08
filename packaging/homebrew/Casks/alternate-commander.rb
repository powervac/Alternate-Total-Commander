cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "0.1.928"
  sha256 arm:   "c1bbb039c40b3a99d4a7c2e9f9b2d7751516543de9e8eefd170f9d9cbcb2c9e1",
         intel: "304635f50e80275bc840b3dcfee3d913f4281e1c424d4a673d50fa707e332bf1"

  url "https://github.com/powervac/Alternate-Total-Commander/releases/download/v#{version}/Alternate-Commander-#{version}-macOS-#{arch}.dmg",
      verified: "github.com/powervac/Alternate-Total-Commander/"
  name "Alternate Commander"
  desc "Two-panel file manager in the style of Total Commander"
  homepage "https://altcom.cc/"

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
