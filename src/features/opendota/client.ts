/** Public OpenDota REST client. No API key is required for the documented free tier. */
export const OPENDOTA_BASE_URL = 'https://api.opendota.com/api';
export const OPENDOTA_DOCS_URL = 'https://docs.opendota.com/';
const STEAM_ID_64_BASE = 76561197960265728n;

export type OpenDotaProfileSummary = {
  account_id: number; personaname?: string; name?: string | null; steamid?: string;
  profileurl?: string; avatarfull?: string; last_login?: string;
};
export type OpenDotaProfile = {
  account_id?: number;
  profile?: OpenDotaProfileSummary | null;
  rank_tier?: number | null; competitive_rank?: number | null;
  solo_competitive_rank?: number | null;
  mmr_estimate?: { estimate?: number; stdDev?: number; n?: number };
  tracked_until?: string | null; leaderboard_rank?: number | null;
};
export type OpenDotaSearchResult = { account_id: number; personaname: string; avatar?: string; last_match_time?: string };
export type OpenDotaMatchRow = {
  match_id: number; player_slot: number; radiant_win: boolean; duration: number; start_time: number;
  hero_id: number; kills?: number; deaths?: number; assists?: number; last_hits?: number; denies?: number;
  gold_per_min?: number; xp_per_min?: number; net_worth?: number; hero_damage?: number; tower_damage?: number;
  level?: number; lane_role?: number; lane_efficiency_pct?: number; items?: number[];
  item_0?: number; item_1?: number; item_2?: number; item_3?: number; item_4?: number; item_5?: number;
  teamfight_participation?: number;
};
export type OpenDotaPlayerDetail = OpenDotaMatchRow & {
  account_id?: number; teamfight_participation?: number; purchase_log?: Array<{ time: number; item_id: number }>;
};
export type OpenDotaMatchDetail = {
  match_id: number; radiant_win: boolean; duration: number; start_time: number; game_mode?: number;
  players: OpenDotaPlayerDetail[];
};
export type OpenDotaHero = { id: number; name: string; localized_name: string; primary_attr?: string; attack_type?: string; roles?: string[]; legs?: number };
export type OpenDotaPlayerHero = { hero_id: number; last_played?: number; games: number; win: number; with_games?: number; with_win?: number; against_games?: number; against_win?: number };
export type OpenDotaItem = { id: number; dname?: string; qual?: string; cost?: number; desc?: string; notes?: string; attrib?: Array<{key:string;header?:string;value:string}> };

export class OpenDotaError extends Error {
  readonly status?: number;
  readonly code: 'network' | 'rate_limit' | 'not_found' | 'server' | 'invalid' | 'unknown';
  constructor(message: string, code: OpenDotaError['code'], status?: number) {
    super(message); this.name = 'OpenDotaError'; this.code = code; this.status = status;
  }
}

export function normalizeSteamInput(raw: string): { kind: 'account'; accountId: number; steamId64?: string } | { kind: 'query'; query: string } {
  const input = raw.trim();
  if (!input) throw new OpenDotaError('Enter a Steam ID, Steam profile URL or profile vanity name.', 'invalid');
  const profile64 = input.match(/steamcommunity\.com\/profiles\/(\d{17})/i)?.[1];
  const vanity = input.match(/steamcommunity\.com\/id\/([^/?#]+)/i)?.[1];
  const numeric = profile64 ?? (/^\d+$/.test(input) ? input : null);
  if (numeric) {
    try {
      const n = BigInt(numeric);
      const account = numeric.length >= 16 ? n - STEAM_ID_64_BASE : n;
      if (account <= 0n || account > 4294967295n) throw new Error('range');
      return { kind: 'account', accountId: Number(account), ...(numeric.length >= 16 ? { steamId64: numeric } : {}) };
    } catch {
      throw new OpenDotaError('The numeric Steam ID is not valid. Use the 32-bit account ID or a 17-digit SteamID64.', 'invalid');
    }
  }
  const query = decodeURIComponent(vanity ?? input.replace(/^@/, '')).trim();
  if (query.length < 2 || query.length > 80) throw new OpenDotaError('The profile name must contain 2–80 characters.', 'invalid');
  return { kind: 'query', query };
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    response = await fetch(`${OPENDOTA_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new OpenDotaError(timedOut ? 'OpenDota request timed out after 15 seconds. Cached data is still available.' : `Could not reach OpenDota. Check your connection. ${String(error)}`, 'network');
  } finally { clearTimeout(timeout); }
  if (response.status === 404) throw new OpenDotaError('OpenDota has no public data for this profile or match.', 'not_found', 404);
  if (response.status === 429) throw new OpenDotaError('OpenDota rate limit reached. Wait before refreshing again.', 'rate_limit', 429);
  if (response.status >= 500) throw new OpenDotaError(`OpenDota is temporarily unavailable (${response.status}).`, 'server', response.status);
  if (!response.ok) throw new OpenDotaError(`OpenDota returned HTTP ${response.status}.`, 'unknown', response.status);
  try { return await response.json() as T; }
  catch { throw new OpenDotaError('OpenDota returned an unreadable response.', 'unknown', response.status); }
}

export async function searchPlayers(query: string): Promise<OpenDotaSearchResult[]> {
  const rows = await request<OpenDotaSearchResult[]>(`/search?q=${encodeURIComponent(query.trim())}`);
  return Array.isArray(rows) ? rows.slice(0, 8) : [];
}

export async function fetchPlayerBundle(accountId: number): Promise<{
  profile: OpenDotaProfile; matches: OpenDotaMatchRow[]; heroes: OpenDotaPlayerHero[];
}> {
  const [profile, matches, heroes] = await Promise.all([
    request<OpenDotaProfile>(`/players/${accountId}`),
    request<OpenDotaMatchRow[]>(`/players/${accountId}/matches?limit=30&offset=0`),
    request<OpenDotaPlayerHero[]>(`/players/${accountId}/heroes`),
  ]);
  const resolvedId = profile?.profile?.account_id ?? profile?.account_id;
  if (resolvedId != null && resolvedId !== accountId) throw new OpenDotaError('The profile response did not match the requested Steam account.', 'invalid');
  const safeMatches = Array.isArray(matches) ? matches : [];
  if (!profile?.profile && safeMatches.length === 0) throw new OpenDotaError('No public profile or match data is available. Check the account ID and Dota 2 privacy settings.', 'not_found');
  return { profile: { ...(profile ?? {}), account_id: accountId }, matches: safeMatches, heroes: Array.isArray(heroes) ? heroes : [] };
}

export async function fetchMatchDetail(matchId: number): Promise<OpenDotaMatchDetail> {
  return request<OpenDotaMatchDetail>(`/matches/${matchId}`);
}

export async function fetchGameConstants(): Promise<{ heroes: OpenDotaHero[]; items: Record<string, OpenDotaItem>; abilities: Record<string, unknown> }> {
  const [heroes, items, abilities] = await Promise.all([
    request<OpenDotaHero[]>('/heroes'),
    request<Record<string, OpenDotaItem>>('/constants/items'),
    request<Record<string, unknown>>('/constants/hero_abilities').catch(() => ({})),
  ]);
  return { heroes: Array.isArray(heroes) ? heroes : [], items: items ?? {}, abilities: abilities ?? {} };
}

export function roleFromPlayerSlot(slot?: number | null): string {
  if (slot === undefined || slot === null || !Number.isFinite(slot)) return 'Unknown';
  const teamSlot = slot >= 128 ? slot - 128 : slot;
  // Slot-order role is only a heuristic; stack swaps and unusual lane assignments can differ.
  return ['Carry (slot estimate)', 'Mid (slot estimate)', 'Offlane (slot estimate)', 'Soft Support (slot estimate)', 'Hard Support (slot estimate)'][teamSlot] ?? 'Unknown';
}

export function isPlayerWinner(match: Pick<OpenDotaMatchRow, 'player_slot' | 'radiant_win'>): boolean {
  const radiant = match.player_slot < 128;
  return radiant === match.radiant_win;
}
