# GitHub upload — quick guide (Windows, no local build)

You do **not** need to install Node.js, npm, Expo, EAS, Xcode or CocoaPods on your Windows computer for the GitHub cloud build. The GitHub macOS runner installs the build tools itself.

## 1. Create a new repository

1. On GitHub, create a new repository. `Private` is recommended for an unreleased application.
2. Do not initialize it with a README, .gitignore or licence; keep it empty.

## 2. Upload the extracted project files

1. Download and extract the ZIP on Windows.
2. In File Explorer, enable **View → Show → Hidden items**. This matters because `.gitignore` and `.nvmrc` begin with a dot.
3. Open the extracted project folder and upload its **contents** to the root of the new GitHub repository. Do not upload the ZIP as one file and do not create an extra parent directory around the project.
4. The repository root should show `App.tsx`, `index.js`, `package.json`, `app/`, `src/`, `assets/`, `scripts/`, `docs/`, `.gitignore` and `.nvmrc`.
5. It is expected that there is no committed `ios/` folder. The macOS workflow generates the native Xcode project from the pinned React Native template.

## 3. Apple signing setup is required before the IPA workflow

An installable Ad Hoc IPA cannot be produced without an Apple Distribution certificate and an Ad Hoc provisioning profile for the target iPhone. The profile must include:

- Bundle ID: `com.dotaprolab.mobile`
- The same Apple Team ID used by the certificate
- The iPhone's registered UDID

The `.p12` certificate export must contain its private key and be protected with a password. Keep both source files private. Do not upload them as repository files.

Apple requires an individual Apple Developer Program enrollee to be the legal age of majority in their region. A user who is not eligible must not misrepresent their age; an eligible adult who is genuinely responsible for the developer account, or an eligible organization, must own and manage the signing account and assets.

## 4. Add six GitHub Actions secrets

Open **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | Base64 of the password-protected `.p12` export |
| `IOS_CERTIFICATE_PASSWORD` | The `.p12` export password |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 of the `.mobileprovision` file |
| `IOS_PROVISIONING_PROFILE_NAME` | Exact profile name from Apple Developer |
| `APPLE_TEAM_ID` | Team ID that owns the certificate and profile |
| `KEYCHAIN_PASSWORD` | A new random password for the temporary CI keychain |

The two Base64 values can be created in PowerShell (run from the folder containing the files):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("DOTA_PRO_LAB_Distribution.p12")) | Set-Clipboard
```

Paste that into `IOS_CERTIFICATE_P12_BASE64`. Then:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("DOTA_PRO_LAB_AdHoc.mobileprovision")) | Set-Clipboard
```

Paste that into `IOS_PROVISIONING_PROFILE_BASE64`. Never paste either Base64 string into a normal GitHub file or commit.

## 5. Create the workflow file in GitHub

1. Open `docs/github/ios-ipa.yml` in your repository and copy its complete contents.
2. Choose **Add file → Create new file**.
3. Enter this exact path as the new filename:

   ```text
   .github/workflows/ios-ipa.yml
   ```

4. Paste the workflow contents and commit to `main`.

The commit starts the macOS build. The workflow runs dependency checks, TypeScript, SQLite migration tests, generates the native iOS project, runs CocoaPods, validates signing files, archives with Xcode and exports an Ad Hoc IPA. If required secrets are missing or invalid, the workflow stops with an error rather than producing a fake IPA.

## 6. Download the IPA

After the GitHub Actions run turns green:

1. Open the completed workflow run.
2. Scroll to **Artifacts**.
3. Download `DOTA_PRO_LAB.ipa`.

That IPA is signed for Ad Hoc installation and can only be installed on devices registered in the included provisioning profile.
