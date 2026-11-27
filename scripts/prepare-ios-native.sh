#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
SCAFFOLD_DIR="$WORK_ROOT/dota-pro-lab-native-scaffold"
IOS_DIR="$ROOT_DIR/ios"

if [[ -d "$IOS_DIR" ]]; then
  echo "Removing previously generated iOS project at $IOS_DIR"
  rm -rf "$IOS_DIR"
fi
rm -rf "$SCAFFOLD_DIR"

cd "$ROOT_DIR"
echo "Generating a plain React Native 0.88.1 iOS project (no Expo, no EAS)..."
npx --yes @react-native-community/cli@20.0.0 init DotaProLab \
  --version 0.88.1 \
  --directory "$SCAFFOLD_DIR" \
  --package-name com.dotaprolab.mobile \
  --title "DOTA PRO LAB" \
  --skip-install \
  --skip-git-init \
  --skip-spm \
  --install-pods false \
  --pm npm

if [[ ! -d "$SCAFFOLD_DIR/ios" ]]; then
  echo "::error::React Native CLI did not generate an ios directory."
  exit 1
fi

cp -R "$SCAFFOLD_DIR/ios" "$IOS_DIR"
APP_DIR="$IOS_DIR/DotaProLab"
INFO_PLIST="$APP_DIR/Info.plist"
if [[ ! -f "$INFO_PLIST" ]]; then
  INFO_PLIST="$(find "$IOS_DIR" -maxdepth 4 -name Info.plist -not -path '*/Pods/*' | head -n 1)"
fi
if [[ -z "${INFO_PLIST:-}" || ! -f "$INFO_PLIST" ]]; then
  echo "::error::Could not find the generated iOS Info.plist."
  exit 1
fi

/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName DOTA PRO LAB' "$INFO_PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c 'Add :CFBundleDisplayName string DOTA PRO LAB' "$INFO_PLIST"
/usr/libexec/PlistBuddy -c 'Set :UIUserInterfaceStyle Dark' "$INFO_PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c 'Add :UIUserInterfaceStyle string Dark' "$INFO_PLIST"

# Keep the app focused on the intended iPhone portrait layout.
/usr/libexec/PlistBuddy -c 'Delete :UISupportedInterfaceOrientations' "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c 'Add :UISupportedInterfaceOrientations array' "$INFO_PLIST"
/usr/libexec/PlistBuddy -c 'Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait' "$INFO_PLIST"

ASSET_CATALOG="$APP_DIR/Images.xcassets"
mkdir -p "$ASSET_CATALOG/AppIcon.appiconset" "$ASSET_CATALOG/SplashLogo.imageset"
cp "$ROOT_DIR/assets/icon.png" "$ASSET_CATALOG/AppIcon.appiconset/icon.png"
cp "$ROOT_DIR/assets/splash.png" "$ASSET_CATALOG/SplashLogo.imageset/splash.png"
cat > "$ASSET_CATALOG/AppIcon.appiconset/Contents.json" <<'JSON'
{
  "images": [
    {
      "filename": "icon.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    }
  ],
  "info": { "author": "xcode", "version": 1 }
}
JSON
cat > "$ASSET_CATALOG/SplashLogo.imageset/Contents.json" <<'JSON'
{
  "images": [
    { "filename": "splash.png", "idiom": "universal" }
  ],
  "info": { "author": "xcode", "version": 1 }
}
JSON

# Use the existing DOTA PRO LAB artwork on a native iOS launch screen.
LAUNCH_STORYBOARD="$(find "$APP_DIR" -maxdepth 4 -name LaunchScreen.storyboard -print -quit)"
if [[ -n "$LAUNCH_STORYBOARD" && -f "$LAUNCH_STORYBOARD" ]]; then
cat > "$LAUNCH_STORYBOARD" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23094" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" initialViewController="launchViewController">
    <device id="retina6_12" orientation="portrait" appearance="dark"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23084"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="launchScene">
            <objects>
                <viewController id="launchViewController" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="launchRootView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="SplashLogo" translatesAutoresizingMaskIntoConstraints="NO" id="launchLogo"/>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="launchSafeArea"/>
                        <color key="backgroundColor" red="0.020" green="0.020" blue="0.031" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="launchLogo" firstAttribute="centerX" secondItem="launchRootView" secondAttribute="centerX" id="logo-center-x"/>
                            <constraint firstItem="launchLogo" firstAttribute="centerY" secondItem="launchRootView" secondAttribute="centerY" id="logo-center-y"/>
                            <constraint firstItem="launchLogo" firstAttribute="width" constant="320" id="logo-width"/>
                            <constraint firstItem="launchLogo" firstAttribute="height" constant="320" id="logo-height"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="launchFirstResponder" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
    <resources>
        <image name="SplashLogo" width="1024" height="1024"/>
    </resources>
</document>
XML
fi

echo "Native iOS project generated at $IOS_DIR"
echo "Bundle identifier: com.dotaprolab.mobile"
echo "Display name: DOTA PRO LAB"
echo "Icon and launch-screen artwork copied from the existing project."
