cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "0.1.938"
  sha256 arm:   "eb12b36070404d53d3508bb25014261041ce798d8cbc067166fb258ee9a6897b",
         intel: "6c3f9990f13eff589e8d3bee137e8f62e7877ac7945a139d70ac8cde7b015e7a"

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
