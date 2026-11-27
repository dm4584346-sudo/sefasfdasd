import type { SQLiteDatabase } from '@/db/database';
import type { OpenDotaHero, OpenDotaItem, OpenDotaMatchDetail, OpenDotaMatchRow, OpenDotaPlayerHero, OpenDotaProfile } from './client';
import { PATCH_REFERENCE } from '../game-data/catalog';
import { isPlayerWinner, roleFromPlayerSlot } from './client';

const iso = () => new Date().toISOString();
export type StoredMatch = {
  match_id: number; account_id: number; hero_id: number; hero_name: string; win: number; start_time: number;
  duration: number; player_slot: number | null; role_estimate: string | null; lane_role: number | null;
  kills: number | null; deaths: number | null; assists: number | null; last_hits: number | null; denies: number | null;
  gold_per_min: number | null; xp_per_min: number | null; net_worth: number | null; hero_damage: number | null;
  tower_damage: number | null; level: number | null; teamfight_participation: number | null; lane_efficiency_pct: number | null;
  items_json: string; parsed_detail: number; fetched_at: string;
};

export async function getLinkedAccount(db: SQLiteDatabase): Promise<{ accountId: number; steamId64: string | null; personaName: string | null; profileUrl: string | null; syncedAt: string | null } | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM SteamLinks WHERE id=1');
  return row ? { accountId: row.account_id, steamId64: row.steam_id_64, personaName: row.persona_name, profileUrl: row.profile_url, syncedAt: row.synced_at } : null;
}

export async function savePlayerBundle(
  db: SQLiteDatabase,
  profile: OpenDotaProfile,
  matches: OpenDotaMatchRow[],
  heroes: OpenDotaPlayerHero[],
  heroNames: Map<number, string>,
  steamId64?: string,
): Promise<void> {
  const now = iso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO SteamLinks(id,account_id,steam_id_64,persona_name,profile_url,profile_json,synced_at,created_at,updated_at)
       VALUES(1,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,steam_id_64=excluded.steam_id_64,
       persona_name=excluded.persona_name,profile_url=excluded.profile_url,profile_json=excluded.profile_json,synced_at=excluded.synced_at,updated_at=excluded.updated_at`,
      profile.profile?.account_id ?? profile.account_id ?? 0, steamId64 ?? profile.profile?.steamid ?? null, profile.profile?.personaname ?? profile.profile?.name ?? null,
      profile.profile?.profileurl ?? null, JSON.stringify(profile), now, now, now,
    );
    const accountId = profile.profile?.account_id ?? profile.account_id ?? 0;
    await db.runAsync(
      `INSERT INTO GameDataCache(data_key,version,data_json,updated_at) VALUES(?,?,?,?)
       ON CONFLICT(data_key) DO UPDATE SET version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`,
      `player-heroes:${accountId}`, 'opendota-player-heroes', JSON.stringify(heroes), now,
    );
    for (const match of matches) {
      const heroName = heroNames.get(match.hero_id) ?? `Hero #${match.hero_id}`;
      const win = isPlayerWinner(match) ? 1 : 0;
      const role = roleFromPlayerSlot(match.player_slot);
      await db.runAsync(
        `INSERT INTO OpenDotaMatches(match_id,account_id,hero_id,hero_name,win,start_time,duration,player_slot,role_estimate,lane_role,
         kills,deaths,assists,last_hits,denies,gold_per_min,xp_per_min,net_worth,hero_damage,tower_damage,level,teamfight_participation,
         lane_efficiency_pct,items_json,parsed_detail,raw_json,fetched_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)
         ON CONFLICT(match_id,account_id) DO UPDATE SET hero_id=excluded.hero_id,hero_name=excluded.hero_name,
         win=excluded.win,start_time=excluded.start_time,duration=excluded.duration,player_slot=excluded.player_slot,
         role_estimate=excluded.role_estimate,lane_role=excluded.lane_role,kills=excluded.kills,deaths=excluded.deaths,assists=excluded.assists,
         last_hits=excluded.last_hits,denies=excluded.denies,gold_per_min=excluded.gold_per_min,xp_per_min=excluded.xp_per_min,
         net_worth=COALESCE(excluded.net_worth,OpenDotaMatches.net_worth),hero_damage=COALESCE(excluded.hero_damage,OpenDotaMatches.hero_damage),
         tower_damage=COALESCE(excluded.tower_damage,OpenDotaMatches.tower_damage),level=COALESCE(excluded.level,OpenDotaMatches.level),
         teamfight_participation=COALESCE(excluded.teamfight_participation,OpenDotaMatches.teamfight_participation),
         lane_efficiency_pct=COALESCE(excluded.lane_efficiency_pct,OpenDotaMatches.lane_efficiency_pct),
         items_json=CASE WHEN excluded.items_json='[]' THEN OpenDotaMatches.items_json ELSE excluded.items_json END,
         raw_json=excluded.raw_json,fetched_at=excluded.fetched_at`,
        match.match_id, profile.profile?.account_id ?? profile.account_id ?? 0, match.hero_id, heroName, win, match.start_time, match.duration, match.player_slot,
        role, match.lane_role ?? null, match.kills ?? null, match.deaths ?? null, match.assists ?? null, match.last_hits ?? null,
        match.denies ?? null, match.gold_per_min ?? null, match.xp_per_min ?? null, match.net_worth ?? null, match.hero_damage ?? null,
        match.tower_damage ?? null, match.level ?? null, match.teamfight_participation ?? null, match.lane_efficiency_pct ?? null,
        JSON.stringify(match.items ?? [match.item_0, match.item_1, match.item_2, match.item_3, match.item_4, match.item_5].filter((v) => !!v)),
        JSON.stringify(match), now,
      );

    }
    for (const hero of heroes) {
      const heroName = heroNames.get(hero.hero_id);
      if (!heroName) continue;
      const hasHero = await db.getFirstAsync<{ id: number }>('SELECT id FROM HeroPool WHERE name=? LIMIT 1', heroName);
      if (hasHero) {
        await db.runAsync('UPDATE HeroPool SET matches=?,winrate=? WHERE id=?', hero.games, hero.games > 0 ? hero.win / hero.games * 100 : null, hasHero.id);
      }
    }
  });
}

export async function saveDetailedMatch(db: SQLiteDatabase, accountId: number, detail: OpenDotaMatchDetail, profileHeroes: Map<number, string>, expectedSlot?: number | null): Promise<void> {
  const player = detail.players?.find((item) => item.account_id === accountId) ?? detail.players?.find((item) => expectedSlot != null && item.player_slot === expectedSlot);
  if (!player) throw new Error('OpenDota returned match details, but this account was not present in the player list.');
  const row: OpenDotaMatchRow = { ...player, match_id: detail.match_id, radiant_win: detail.radiant_win, duration: detail.duration, start_time: detail.start_time };
  const heroName = profileHeroes.get(player.hero_id) ?? `Hero #${player.hero_id}`;
  const win = isPlayerWinner(row) ? 1 : 0;
  const items = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5].filter((x): x is number => !!x);
  await db.runAsync(
    `UPDATE OpenDotaMatches SET hero_name=?,win=?,duration=?,player_slot=?,role_estimate=?,lane_role=?,kills=?,deaths=?,assists=?,last_hits=?,denies=?,
     gold_per_min=?,xp_per_min=?,net_worth=?,hero_damage=?,tower_damage=?,level=?,teamfight_participation=?,lane_efficiency_pct=?,items_json=?,
     parsed_detail=1,raw_json=?,fetched_at=? WHERE match_id=? AND account_id=?`,
    heroName, win, detail.duration, player.player_slot, roleFromPlayerSlot(player.player_slot), player.lane_role ?? null,
    player.kills ?? null, player.deaths ?? null, player.assists ?? null, player.last_hits ?? null, player.denies ?? null,
    player.gold_per_min ?? null, player.xp_per_min ?? null, player.net_worth ?? null, player.hero_damage ?? null,
    player.tower_damage ?? null, player.level ?? null, player.teamfight_participation ?? null, player.lane_efficiency_pct ?? null,
    JSON.stringify(items), JSON.stringify(detail), iso(), detail.match_id, accountId,
  );
}

export async function getStoredMatches(db: SQLiteDatabase, limit = 50): Promise<StoredMatch[]> {
  return db.getAllAsync<StoredMatch>(
    'SELECT * FROM OpenDotaMatches WHERE account_id=(SELECT account_id FROM SteamLinks WHERE id=1) ORDER BY start_time DESC LIMIT ?',
    limit,
  );
}
export async function getStoredMatch(db: SQLiteDatabase, matchId: number): Promise<StoredMatch | null> {
  return db.getFirstAsync<StoredMatch>(
    'SELECT * FROM OpenDotaMatches WHERE match_id=? AND account_id=(SELECT account_id FROM SteamLinks WHERE id=1)',
    matchId,
  );
}

export async function saveGameData(db: SQLiteDatabase, heroes: OpenDotaHero[], items: Record<string, OpenDotaItem>, abilities: Record<string, unknown> = {}): Promise<void> {
  const now = iso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO GameDataCache(data_key,version,data_json,updated_at) VALUES('heroes','opendota-live',?,?)
      ON CONFLICT(data_key) DO UPDATE SET version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`, JSON.stringify(heroes), now);
    await db.runAsync(`INSERT INTO GameDataCache(data_key,version,data_json,updated_at) VALUES('items','opendota-live',?,?)
      ON CONFLICT(data_key) DO UPDATE SET version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`, JSON.stringify(items), now);
    await db.runAsync(`INSERT INTO GameDataCache(data_key,version,data_json,updated_at) VALUES('abilities','opendota-live',?,?)
      ON CONFLICT(data_key) DO UPDATE SET version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`, JSON.stringify(abilities), now);
    await db.runAsync(`INSERT INTO GameDataCache(data_key,version,data_json,updated_at) VALUES('patch','valve-reference',?,?)
      ON CONFLICT(data_key) DO UPDATE SET version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`, JSON.stringify(PATCH_REFERENCE), now);
  });
}
export async function getGameDataUpdatedAt(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ updated_at: string }>("SELECT MAX(updated_at) updated_at FROM GameDataCache WHERE data_key IN ('heroes','items','abilities','patch')");
  return row?.updated_at ?? null;
}
export async function getPlayerHeroHistory(db: SQLiteDatabase): Promise<OpenDotaPlayerHero[]> {
  const row = await db.getFirstAsync<{ data_json: string }>(
    "SELECT data_json FROM GameDataCache WHERE data_key='player-heroes:'||(SELECT account_id FROM SteamLinks WHERE id=1)",
  );
  if (!row) return [];
  try {
    const history = JSON.parse(row.data_json) as OpenDotaPlayerHero[];
    return Array.isArray(history) ? history : [];
  } catch { return []; }
}

export async function getHeroNameMap(db: SQLiteDatabase): Promise<Map<number, string>> {
  const row = await db.getFirstAsync<{ data_json: string }>("SELECT data_json FROM GameDataCache WHERE data_key='heroes'");
  if (!row) return new Map();
  try {
    const pairs = JSON.parse(row.data_json) as OpenDotaHero[];
    return new Map((Array.isArray(pairs) ? pairs : []).map((hero) => [hero.id, hero.localized_name]));
  } catch { return new Map(); }
}
export async function getHeroCatalog(db: SQLiteDatabase): Promise<OpenDotaHero[]> {
  const row = await db.getFirstAsync<{ data_json: string }>("SELECT data_json FROM GameDataCache WHERE data_key='heroes'");
  if (!row) return [];
  try {
    const heroes = JSON.parse(row.data_json) as OpenDotaHero[];
    return Array.isArray(heroes) ? heroes : [];
  } catch { return []; }
}
export async function getItemNameMap(db: SQLiteDatabase): Promise<Map<number, string>> {
  const row = await db.getFirstAsync<{ data_json: string }>("SELECT data_json FROM GameDataCache WHERE data_key='items'");
  if (!row) return new Map();
  try {
    const data = JSON.parse(row.data_json) as Record<string, OpenDotaItem>;
    return new Map(Object.entries(data).map(([id, item]) => [Number(id), item.dname ?? `Item #${id}`]));
  } catch { return new Map(); }
}
export async function getCachedProfile(db: SQLiteDatabase): Promise<Record<string, unknown> | null> {
  const row = await db.getFirstAsync<{ profile_json: string }>('SELECT profile_json FROM SteamLinks WHERE id=1');
  if (!row) return null;
  try { return JSON.parse(row.profile_json) as Record<string, unknown>; } catch { return null; }
}

export async function recordMmrEntry(db: SQLiteDatabase, input: { mmr: number; delta?: number | null; result?: 'win'|'loss'|'manual'|null; source?: string; matchId?: number | null; note?: string }): Promise<void> {
  const now = iso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO MmrEntries(mmr,delta,result,source,match_id,note,recorded_at) VALUES(?,?,?,?,?,?,?)', input.mmr,
      input.delta ?? null, input.result ?? 'manual', input.source ?? 'manual', input.matchId ?? null, input.note ?? '', now);
  });
}
export type MmrRecord = { id: number; mmr: number; delta: number | null; result: string | null; source: string; note: string; recorded_at: string };
export async function getMmrEntries(db: SQLiteDatabase, limit = 60): Promise<MmrRecord[]> {
  return db.getAllAsync<MmrRecord>('SELECT * FROM MmrEntries ORDER BY recorded_at DESC LIMIT ?', limit);
}

export async function addManualMatch(db: SQLiteDatabase, input: { hero: string; role: string; result: 'win'|'loss'; mmrChange: number | null; note: string }): Promise<number> {
  const now = iso();
  let updatedMmr = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO MatchHistory(hero_name,result,mmr_change,match_date,role,notes,external_match_id) VALUES(?,?,?,?,?,?,NULL)',
      input.hero, input.result, input.mmrChange, now, input.role, input.note);
    const profile = await db.getFirstAsync<{ current_mmr: number }>('SELECT current_mmr FROM UserProfile WHERE id=1');
    updatedMmr = profile?.current_mmr ?? 0;
    if (input.mmrChange !== null) {
      updatedMmr = Math.max(0, updatedMmr + input.mmrChange);
      await db.runAsync('UPDATE UserProfile SET current_mmr=?,updated_at=? WHERE id=1', updatedMmr, now);
      await db.runAsync('INSERT INTO MmrEntries(mmr,delta,result,source,note,recorded_at) VALUES(?,?,?,?,?,?)', updatedMmr, input.mmrChange, input.result, 'manual-match', input.note, now);
      await db.runAsync('INSERT INTO UserProgress(metric_key,metric_value,recorded_at) VALUES(?,?,?)', 'mmr', updatedMmr, now);
    }
  });
  return updatedMmr;
}
