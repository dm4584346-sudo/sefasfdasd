/** Valve patch reference verified for this build on 2026-11-27. Always re-check before acting on balance data. */
export const PATCH_REFERENCE = {
  label: '7.42a',
  verifiedOn: '2026-11-27',
  releasedOn: '2026-11-24',
  source: 'Valve Dota 2 Updates',
  url: 'https://www.dota2.com/newsentry/689774670193362169',
  note: 'Hero and item constants are refreshed from OpenDota on demand. This patch label is a Valve-verified build reference and is not auto-discovered by OpenDota.',
} as const;

export const GAME_DATA_SOURCES = {
  heroConstants: 'https://api.opendota.com/api/heroes',
  itemConstants: 'https://api.opendota.com/api/constants/items',
  valveUpdates: 'https://www.dota2.com/news',
} as const;
