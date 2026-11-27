# Data model — Phase 3

SQLite migration history is additive. Phase 1 migration v1 and Phase 2 migration v2 are preserved. Phase 3 migration v3 creates the analytics tables; migration v4 safely changes the OpenDota match key to be account-scoped.

## Added in v3

- `SteamLinks`: the currently linked public account and cached profile response.
- `OpenDotaMatches`: normalized match rows plus source JSON and a `parsed_detail` flag. Initial v3 keyed rows by OpenDota match ID; v4 adds account scope to the primary key.
- `MmrEntries`: manually entered rating snapshots and explicitly user-entered match deltas. No automatic MMR change is inferred from a W/L result.
- `GameDataCache`: hero/item/ability constants, patch reference and account-scoped `player-heroes:{accountId}` response snapshots for offline hero mastery.
- `PerformanceRecommendations`: persistent recommendation record structure for future completion/status workflows. Current recommendation generation is derived from actual attempts and imported matches.

The migration also adds a partial unique index on non-null `MatchHistory.external_match_id`. Manual entries continue to use `NULL` external IDs. OpenDota sync stores imported rows in `OpenDotaMatches` rather than duplicating them in `MatchHistory`.

## Migration v4: account-safe match identity

Migration v4 creates a replacement table with `PRIMARY KEY (match_id, account_id)`, copies every existing v3 row, drops the old table and renames the replacement. Match/date, hero and role indexes are recreated. No match records are intentionally deleted.

This is necessary because the same Dota match can appear in two players' match histories. A global `match_id` key would otherwise let the second account overwrite the first account's personal row.

## Account switching

`SteamLinks` has one active row. Imported match records remain locally cached per account, including rows for the same `match_id` when multiple accounts participated. Player analytics, match lists and match detail queries filter by the currently linked account. Phase 1's home summary counts manual `MatchHistory` entries plus imported matches for the currently linked account only. Switching profile does not blend imported match statistics.

`player-heroes:{accountId}` is similarly keyed by account. The recorded hero totals come from the OpenDota endpoint and may not include private, unavailable or otherwise untracked matches.

## Future visual situation data

`src/features/visual-situations/contracts.ts` defines normalized map coordinates, tactical units, objectives and action targets. It is a data contract only; it intentionally does not replace the existing text-based Situation Trainer or imply that a tactical renderer/map asset is included.
