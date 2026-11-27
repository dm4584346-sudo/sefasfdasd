# DOTA PRO LAB — Bare React Native iOS project

**Personal Esports Training Academy** — the existing Phase 1–3 DOTA PRO LAB app, migrated away from Expo to a plain React Native application. The project keeps its training screens, AI Coach, Situation Trainer, Item Builder, Draft Trainer, analytics, OpenDota integration, player profile, schedule and SQLite schema migrations.

> This repository does not use Expo, Expo Router, Expo SQLite, EAS Build or an Expo access token. The iOS app is built with React Native Community CLI, CocoaPods and Xcode on a GitHub-hosted macOS runner.

## Quick GitHub upload guide

For the Windows browser-only route (uploading the project to a new GitHub repository and then creating the workflow file in GitHub), follow [`docs/GITHUB_UPLOAD_STEPS.md`](docs/GITHUB_UPLOAD_STEPS.md). You do not need to build or install dependencies locally. A signed, installable Ad Hoc IPA still requires valid Apple signing secrets before the workflow runs.

## Stack

- React Native `0.88.1` and React `19.3.0`
- React Native Community CLI `20.0.0`
- TypeScript `5.9.2`
- React Navigation 7 (native stack and bottom tabs)
- OP-SQLite `19.0.6` (native SQLite for bare React Native)
- React Native Gesture Handler, Safe Area Context, Screens, SVG and Lucide icons
- iOS bundle identifier: `com.dotaprolab.mobile`
- Display name: `DOTA PRO LAB`

## Project structure

```text
app/                    Existing application screens (kept from Phases 1–3)
  analytics/            Pro analytics screen
  onboarding/           Profile setup
  tabs/                 Home, Training, AI Coach, Analytics, Profile
  training/             Situation, Item, Draft and Training Dashboard
assets/                 Existing app icon and splash artwork
src/
  components/           Shared UI components
  constants/            Theme and design tokens
  db/                   SQLite adapter, provider, repository, migrations v1–v4
  features/             OpenDota, training, coaching, performance and game data
  navigation/           React Navigation and route compatibility hooks
  types/                Shared TypeScript types
docs/                   Build and API documentation
docs/github/            Copy-ready GitHub Actions workflow template
scripts/                Native iOS project generation and SQLite migration checks
App.tsx                 React Native app root
index.js                Native entry point
package.json            Bare React Native dependencies and scripts
```

## Requirements

- Node.js `22.13.1` or newer in the Node 22 line (the GitHub workflow pins `22.13.1`).
- npm.
- For a local iOS build: macOS, Xcode 26 or later, Xcode command-line tools and CocoaPods.
- For a signed installable IPA: an Apple Developer team, an Apple Distribution certificate, and an Ad Hoc provisioning profile containing the target iPhone UDID.

Windows can edit the project and run some JavaScript/TypeScript checks, but it cannot run Xcode or compile the native iOS target.

## Install and validate JavaScript dependencies

From the repository root:

```bash
npm install
npm run typecheck
npm run test:sql
```

`npm run test:sql` applies schema migrations v1–v4 to a temporary SQLite database and checks the required tables and per-account match key. This is a migration/schema test, not a substitute for testing the native OP-SQLite module on an iPhone.

## Run on a Mac

Generate the native iOS shell from the matching React Native template, install pods and run the app:

```bash
npm install
npm run prepare:ios
cd ios && pod install && cd ..
npm run ios
```

The `prepare:ios` script uses React Native Community CLI to create a native iOS project and applies the app's bundle ID, display name, portrait orientation, app icon and launch artwork. It does not generate an Expo project. The generated `ios/` directory is ignored by Git because the CI workflow recreates it from the pinned template on each run.

## GitHub Actions: build a signed IPA without Expo or EAS

The ready-to-copy workflow is at [`docs/github/ios-ipa.yml`](docs/github/ios-ipa.yml). To enable it:

1. Create a new GitHub repository and upload the **contents** of this project ZIP to its root (not the ZIP file itself).
2. In the Apple Developer account, register the iPhone UDID, create the App ID `com.dotaprolab.mobile`, create an Apple Distribution certificate and download an **Ad Hoc** provisioning profile that includes that iPhone.
3. Export the distribution certificate and private key as a password-protected `.p12` file. Keep the provisioning profile as the downloaded `.mobileprovision` file.
4. Add these repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

   | Secret name | Value |
   |---|---|
   | `IOS_CERTIFICATE_P12_BASE64` | Base64 text of the `.p12` file |
   | `IOS_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
   | `IOS_PROVISIONING_PROFILE_BASE64` | Base64 text of the `.mobileprovision` file |
   | `IOS_PROVISIONING_PROFILE_NAME` | Exact profile name shown in the Apple Developer portal |
   | `APPLE_TEAM_ID` | Apple Developer Team ID |
   | `KEYCHAIN_PASSWORD` | A new random password for the temporary CI keychain |

   Do not commit certificate files, provisioning profiles, passwords or tokens to the repository. The workflow decodes them only on the temporary macOS runner.

5. Before committing the workflow, make sure all six signing secrets above are present. Without them the workflow deliberately stops before build to avoid wasting macOS runner time.
6. In GitHub, choose **Add file → Create new file** and set the file name to:

   ```text
   .github/workflows/ios-ipa.yml
   ```

7. Copy the complete content of `docs/github/ios-ipa.yml` into the new file and commit it to the `main` branch. A push to `main` (including the workflow commit) starts the workflow. You can also run it manually from **Actions → DOTA PRO LAB — Native iOS IPA → Run workflow**.
8. When the run finishes successfully, open the run's **Artifacts** section and download `DOTA_PRO_LAB.ipa`.

The workflow performs dependency installation, TypeScript validation, SQLite migration tests, creates the native iOS project, runs CocoaPods, imports Apple signing assets, archives with Xcode and exports an Ad Hoc IPA. If signing secrets are missing or invalid, the build fails with a clear error instead of producing a fake or unsigned IPA.

### Create Base64 values on macOS

```bash
base64 -i DOTA_PRO_LAB_Distribution.p12 | tr -d '\n' | pbcopy
# Paste into IOS_CERTIFICATE_P12_BASE64

base64 -i DOTA_PRO_LAB_AdHoc.mobileprovision | tr -d '\n' | pbcopy
# Paste into IOS_PROVISIONING_PROFILE_BASE64
```

On Windows PowerShell, if the files were obtained through the legitimate Apple Developer signing process:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("DOTA_PRO_LAB_Distribution.p12")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("DOTA_PRO_LAB_AdHoc.mobileprovision")) | Set-Clipboard
```

Copy each value separately to its matching GitHub Secret. Never paste Base64 signing material into a normal GitHub file or commit.

## Installing the IPA on iPhone

An Ad Hoc IPA can only be installed on devices included in the provisioning profile. Download the `DOTA_PRO_LAB.ipa` artifact from a successful GitHub Actions run, then install it using Apple Configurator or a supported device-installation workflow. Enable Developer Mode on the iPhone if iOS requests it. A TestFlight/App Store distribution profile is a different export method and is not interchangeable with Ad Hoc.

Apple's official instructions:

- [Create an Ad Hoc provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile)
- [Distribute your app to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices/)
- [GitHub: install an Apple certificate on macOS runners](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)

## Local SQLite and upgrades

The Phase 1–3 migration sequence v1–v4 is retained and initialized on app launch. The application uses the existing database filename `dota-pro-lab.db` through OP-SQLite. Because Expo SQLite and OP-SQLite may use different on-device file locations, an already-installed Expo build's database file is **not guaranteed** to be discovered automatically by this new bare app. If you have user data on a previously installed Expo build, export/back up that database before replacing the app; a dedicated one-time file migration may be required.

## OpenDota and offline behavior

OpenDota requests remain optional and are made by the existing app logic. Local profile, training, review queue and analytics data remain in SQLite. OpenDota match imports and current game-data lookups require network access; cached data stays available according to the existing module logic. No OpenDota API key is embedded in the client.

## Important limits

- This ZIP is a source project and build pipeline, not a prebuilt IPA.
- The native `ios/` Xcode project is generated on the macOS runner from the pinned React Native CLI template. The current build environment used to prepare this ZIP does not provide Xcode, Apple certificates or your registered iPhone, so no real signed IPA or physical-device test is claimed here.
- Ad Hoc signing requires the Apple Developer account holder's certificate/profile and registered devices. Apple requires an individual enrollee to be the legal age of majority in their region. A person who is not yet eligible must not enrol by misrepresenting their age; an eligible adult who is genuinely responsible for the developer account, or an eligible organization, must manage the Apple Developer team and signing assets.
- The app migration changes navigation from Expo Router to React Navigation and replaces Expo SQLite with OP-SQLite while retaining the screen source and schema sequence. Native integration still needs the first successful GitHub macOS build and on-device verification.

## Licence and third-party services

OpenDota is used through its public API; review the current OpenDota documentation and limits before large-scale use. React Native and the listed dependencies retain their respective upstream licences.
