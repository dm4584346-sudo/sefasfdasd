# Native iOS build (no Expo / no EAS)

DOTA PRO LAB is prepared as a Bare React Native 0.88.1 application. Expo Router, Expo SQLite, Expo SDK and EAS Build have been removed from runtime and build configuration.

## Native shell generation

The repository deliberately keeps the React Native iOS shell generated during CI rather than committing an Xcode project. This ensures the Podfile, AppDelegate, SceneDelegate, asset catalog and Xcode project all come from the same pinned React Native template version.

```bash
npm install
npm run prepare:ios
cd ios && pod install && cd ..
npm run ios
```

The script runs React Native Community CLI 20.0.0 with React Native 0.88.1 and CocoaPods integration (`--skip-spm`). It then applies:

- Bundle ID `com.dotaprolab.mobile`
- Display name `DOTA PRO LAB`
- Dark appearance and portrait orientation
- Existing 1024×1024 app icon and splash artwork

## GitHub Actions build

Copy [`github/ios-ipa.yml`](github/ios-ipa.yml) to `.github/workflows/ios-ipa.yml` in the repository root. It runs on `macos-26`, installs JavaScript dependencies, checks TypeScript, validates SQLite migrations, creates the native iOS project, installs CocoaPods, imports the Apple signing certificate/profile, archives with Xcode and exports `DOTA_PRO_LAB.ipa` as a workflow artifact.

Add the six signing secrets before the first workflow commit or manual run. The workflow checks for them at the start and validates that the profile is for the configured Team ID and bundle ID.

Required repository Actions secrets:

- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `IOS_PROVISIONING_PROFILE_NAME`
- `APPLE_TEAM_ID`
- `KEYCHAIN_PASSWORD`

The Ad Hoc provisioning profile must include the iPhone's registered UDID and App ID `com.dotaprolab.mobile`. The profile Team ID must match `APPLE_TEAM_ID`. No Expo token is used. Apple requires individual Apple Developer Program enrollees to be the legal age of majority in their region; where the user is not yet eligible, a genuinely responsible eligible adult or organization must own and manage the developer signing team.

## Why signing is required

A native `.ipa` file intended for installation must be signed for a supported Apple distribution method. An Ad Hoc IPA requires an Apple Distribution certificate and a matching Ad Hoc profile. GitHub can run Xcode on a macOS runner, but cannot invent the Apple account's signing identity or make an unsigned archive installable.

Official references:

- https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile
- https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices/
- https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications

## Data note

Migrations v1–v4 remain in `src/db/schema.ts`. OP-SQLite uses the same logical database filename, but a previous Expo SQLite install may have stored its file at a different path. Existing on-device user data should be backed up before replacing an installed Expo version.
