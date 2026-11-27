# Project status — Bare React Native iOS preparation

## Preserved application modules

- Home, Training, AI Coach, Analytics and Profile tabs
- Profile onboarding and editing
- Hero Pool and training schedule
- Situation Trainer, answer evaluation and error repetition
- Item Builder and Draft Trainer
- Training Dashboard and Pro Analytics
- OpenDota player/match integration and local cache
- MMR history and performance recommendations
- SQLite schema migration sequence v1–v4

## Native migration

| Area | Current setup |
|---|---|
| Runtime | React Native 0.88.1 |
| React | 19.3.0 |
| TypeScript | 5.9.2 |
| Navigation | React Navigation 7 |
| SQLite | OP-SQLite 19.0.6 behind the existing data API |
| Build | React Native Community CLI 20 + CocoaPods + Xcode |
| EAS / Expo | Removed from the app and build configuration |
| Bundle ID | `com.dotaprolab.mobile` |

## Added build support

- `scripts/prepare-ios-native.sh` creates a matching bare React Native native iOS shell on macOS.
- `scripts/validate-sql-migrations.py` executes migrations v1–v4 against a temporary SQLite database and checks expected tables and per-account match isolation.
- `docs/github/ios-ipa.yml` is the copy-ready GitHub Actions workflow for a signed Ad Hoc IPA.
- Git ignore rules exclude generated native builds, node_modules, signing material and local build output.

## Checks performed in this preparation environment

- Package manifest JSON parsing: pass.
- TypeScript/TSX syntax transpilation: checked separately for the 32 source files; this does not replace `tsc --noEmit`.
- Static internal import/path scan: checked separately; all relative and `@/` imports resolved.
- SQLite migrations v1–v4: pass with the included Python/SQLite verifier (18 expected tables and account-scoped match key).
- GitHub workflow YAML parsing and native-generation shell syntax: pass.
- Workflow validates the signing certificate exists, and checks profile name, Team ID and exact bundle ID before attempting Xcode archive.
- ZIP integrity: checked after archive creation.

## Not verified here

- A complete `npm install` and typecheck against all installed package declarations.
- Native CocoaPods installation or Xcode archive/export.
- A signed IPA, because this environment does not have Xcode, an Apple Distribution private key, a provisioning profile, or the target iPhone UDID.
- Launch, navigation and database behavior on a physical iPhone.

The first GitHub Actions run with valid signing secrets and the iPhone registered in the Ad Hoc provisioning profile is the first native build verification. If it fails, use the failing build log to make the next targeted correction.

## Database upgrade note

The v1–v4 schema and database filename are retained. Expo SQLite and OP-SQLite can resolve their database file paths differently; migration of data from an already-installed Expo binary is not guaranteed by filename alone. Back up any existing on-device database before installing a bare React Native build over it.
