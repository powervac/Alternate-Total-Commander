cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "0.1.924"
  sha256 arm:   "5e622f16887bce60342694ab19d86a07b73b30938c0e612afcd3844bffe83957",
         intel: "518946d89f38db36bf37bb0c2aa897b2889e0a62ec2f26cf5681c37086773f44"

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
