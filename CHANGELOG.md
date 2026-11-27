# Changelog

## iOS Native Migration — 2026-11-27

- Migrated the existing Phase 1–3 application from Expo Router to React Navigation 7.
- Removed Expo SDK, Expo Router, Expo SQLite, Expo status bar, EAS Build and Expo-specific scripts/configuration.
- Replaced Expo SQLite with OP-SQLite behind a compatibility adapter so existing repositories and feature modules retain their query API.
- Preserved the ordered SQLite schema migrations v1–v4, including account-scoped OpenDota match keys.
- Added a Bare React Native root, native navigation setup, safe-area provider and dark status bar.
- Added an automated macOS GitHub Actions workflow template that generates the native iOS project with React Native Community CLI, installs CocoaPods, signs with user-supplied Apple credentials and exports an Ad Hoc IPA.
- Added a native iOS generation script that applies the existing bundle ID, app name, icon and splash artwork.
- Added a temporary SQLite migration verifier and updated GitHub / Apple signing documentation.
- Fixed the dependency conflict from the previous package manifest by pinning Lucide React Native to a React 19-compatible release.

## Phase 3 — Pro Analytics

- Added OpenDota profile and match history integration with local caching.
- Added replay analytics, per-hero and per-role performance summaries, recommendations and MMR tracking.
- Added game data cache and visual situation contracts.
- Added SQLite migrations v3 and v4.

## Phase 2 — Training System

- Added the local AI Coach / situational engine, answer rubric and error repetition queue.
- Added Situation Trainer, Item Builder, Draft Trainer and training dashboard.

## Phase 1 — Foundation

- Added the original DOTA PRO LAB dark esports UI, profile onboarding, schedule, hero pool, progress and local SQLite foundation.
