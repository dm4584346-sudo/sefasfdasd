#!/usr/bin/env python3
"""Execute the application's ordered SQL migrations against a temporary SQLite database."""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "db" / "schema.ts"
source = SCHEMA.read_text(encoding="utf-8")
migrations = re.findall(r"version:\s*(\d+)\s*,\s*sql:\s*`(.*?)`\s*,?\s*\n\s*\}", source, re.S)
if not migrations:
    raise SystemExit("ERROR: no SQL migrations found in src/db/schema.ts")

versions = [int(version) for version, _ in migrations]
if versions != sorted(set(versions)):
    raise SystemExit(f"ERROR: migrations must be unique and ascending; found {versions}")

connection = sqlite3.connect(":memory:")
connection.execute("PRAGMA foreign_keys = ON")
for version_text, sql in migrations:
    version = int(version_text)
    try:
        connection.executescript(sql)
        connection.execute(f"PRAGMA user_version = {version}")
    except sqlite3.Error as error:
        raise SystemExit(f"ERROR: migration v{version} failed: {error}") from error

expected_tables = {
    "UserProfile", "HeroPool", "TrainingSchedule", "TrainingSessions", "MatchHistory",
    "UserProgress", "TrainingStatistics", "Settings", "TrainingAttempts", "ErrorReviewQueue",
    "CoachNotes", "DraftPractice", "ItemPractice", "SteamLinks", "OpenDotaMatches",
    "MmrEntries", "GameDataCache", "PerformanceRecommendations",
}
actual_tables = {
    row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
}
missing = sorted(expected_tables - actual_tables)
if missing:
    raise SystemExit(f"ERROR: missing database tables: {', '.join(missing)}")

pk = [row[1] for row in connection.execute("PRAGMA table_info(OpenDotaMatches)").fetchall() if row[5]]
if pk != ["match_id", "account_id"]:
    raise SystemExit(f"ERROR: OpenDotaMatches must have composite PK (match_id, account_id); got {pk}")

# Exercise the per-account match key to make sure the v4 data-isolation fix remains valid.
connection.execute("INSERT INTO OpenDotaMatches (match_id, account_id, fetched_at) VALUES (123, 1, 'test')")
connection.execute("INSERT INTO OpenDotaMatches (match_id, account_id, fetched_at) VALUES (123, 2, 'test')")
count = connection.execute("SELECT COUNT(*) FROM OpenDotaMatches WHERE match_id = 123").fetchone()[0]
if count != 2:
    raise SystemExit("ERROR: same match_id could not be stored independently per account")

final_version = connection.execute("PRAGMA user_version").fetchone()[0]
if final_version != versions[-1]:
    raise SystemExit(f"ERROR: expected user_version {versions[-1]}, got {final_version}")

print(f"PASS: migrations v{versions[0]}–v{versions[-1]} applied; {len(expected_tables)} expected tables present; per-account match key verified.")
