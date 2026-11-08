cask "alternate-commander" do
  arch arm: "arm64", intel: "Intel"

  version "0.1.930"
  sha256 arm:   "259978021f8af468f4f737eae83600d214fe1f59fd3c53e5fa43fbb996e55f19",
         intel: "9a56da6e775ed9b2eac38baf0f7679a6ed970b2984af96393f5b7ce239f3e89f"

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
