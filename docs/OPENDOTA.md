# OpenDota integration

## Service and current limits

The application uses the public OpenDota REST API at `https://api.opendota.com/api`.
The official OpenDota API documentation currently describes a free allowance of **50,000 calls per month** and a **60 requests/minute** rate limit. These limits are service policy, not an entitlement guaranteed by this application; OpenDota may change quotas, availability, authentication requirements or endpoint behavior. Always re-check the official docs before relying on the service:

- API reference and pricing/limits: https://opendota.apidocumentation.com/
- Documentation landing page: https://docs.opendota.com/
- OpenDota core/API project: https://github.com/odota/core

The client does not embed an API key. It calls the public endpoints directly. The app sends requests only after a user-initiated action (connect, refresh, open a match, or update game constants). A profile sync currently performs three parallel calls, while opening one match and refreshing constants each add their own requests. Avoid repeatedly tapping refresh; local cache is retained between launches.

## Endpoints used

| Purpose | Endpoint | Notes |
|---|---|---|
| Resolve a public profile name | `GET /search?q={name}` | Returns candidate account IDs; user chooses the matching result. |
| Player profile and estimate | `GET /players/{account_id}` | OpenDota model MMR estimate is labeled as an estimate, never official Steam MMR. |
| Recent match history | `GET /players/{account_id}/matches?limit=30&offset=0` | Most recent 30 records are imported in this build. |
| Hero history | `GET /players/{account_id}/heroes` | Cached per account for recorded hero game/win totals; existing Hero Pool entries are updated too. |
| Match detail | `GET /matches/{match_id}` | Requested only when the player opens a match that has not been detailed locally. |
| Hero constants | `GET /heroes` | Cached for offline hero ID/name lookup. |
| Item constants | `GET /constants/items` | Cached for offline item ID/name lookup. |
| Hero ability constants | `GET /constants/hero_abilities` | Optional; absence does not prevent profile/match import. |

## Steam identifiers

- A 32-bit Steam account ID can be entered directly.
- A 17-digit SteamID64 is converted to the Dota account ID using the documented Steam ID base `76561197960265728`.
- `https://steamcommunity.com/profiles/{SteamID64}` is accepted.
- `https://steamcommunity.com/id/{vanity}` and a plain vanity/name are resolved through OpenDota's player search; the user must select the correct public result.

The app does not request a Steam password, Steam Guard code or any account credential.

## Local storage and privacy

The linked account, profile response, fetched player match rows, parsed match details, hero/item constants and sync timestamps are stored in the app's local SQLite database. No project-owned server receives this data. The user can remove the app's local data through the operating system/app storage controls; this project does not provide cloud backup.

## Failure behavior

- Network failure / timeout: display an error and keep previously cached local results.
- HTTP 429: explain that the rate limit was reached and ask the user to wait before another request.
- HTTP 404 / no public results: explain that no public record was found.
- HTTP 5xx: report temporary service unavailability.
- Private/untracked profile: show no fabricated profile or matches; profile can connect only when at least a public profile or match record is available.
- Unparsed/hidden match: the detail request may not contain all requested fields; each unavailable field is displayed as `—`.

## Interpretation limits

OpenDota is a community-run data service, not an official live Steam MMR authority. Its `mmr_estimate` is explicitly presented as a model estimate. The app's role classification is derived from player-slot ordering and is marked as an estimate; it is not guaranteed to match a player's actual lane. The app therefore labels Offlane / Soft Support / Hard Support breakdowns as estimated and does not use KDA alone as a skill judgment.

This release implements parsed match-stat inspection (KDA, GPM, XPM, last hits, denies, net worth, hero/tower damage, items, teamfight participation and lane fields when supplied). It is **not** a video replay player or a full event-by-event replay timeline. OpenDota can return incomplete or unavailable parsed data, and the interface preserves that uncertainty.

## Patch / game data

The build's Valve reference patch is `7.42a`, dated 2026-11-24, verified for this build on 2026-11-27 from Valve's update announcement:

- https://www.dota2.com/newsentry/689774670193362169

Hero/item constants may be refreshed from OpenDota on demand and cached. OpenDota constants do not by themselves prove that all balance values are current for a particular patch. The app does not claim that Item Builder recommendations are automatically validated against live patch balance. Always confirm current item descriptions and gameplay changes in the Dota 2 client and Valve patch notes.
