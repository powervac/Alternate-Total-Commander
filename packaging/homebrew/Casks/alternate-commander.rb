cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "0.1.944"
  sha256 arm:   "121eff69d8036fd24db799aa458c1d7b59cf246a5de5f1536db5300d6a2c2b62",
         intel: "eb879ff88e96e1e118208f63e7b11100f27515545cf659cb437f2a418826e530"

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
