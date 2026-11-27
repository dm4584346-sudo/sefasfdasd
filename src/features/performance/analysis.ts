import type { SQLiteDatabase } from '@/db/database';
import type { StoredMatch } from '../opendota/storage';

export type PeriodKey = '7d' | '30d' | 'all';
export type PerformanceSummary = {
  matches: number; wins: number; winrate: number | null; avgGpm: number | null; avgXpm: number | null;
  avgDeaths: number | null; avgKda: number | null; avgLastHitsPerMinute: number | null;
  hasSmallSample: boolean;
};
export type HeroPerformance = {
  hero_name: string; matches: number; wins: number; winrate: number; avg_kda: number; avg_gpm: number; avg_xpm: number; avg_deaths: number;
};
export type RolePerformance = { role: string; matches: number; wins: number; winrate: number; avg_gpm: number; avg_xpm: number; avg_deaths: number };

function cutoff(period: PeriodKey): number | null {
  if (period === 'all') return null;
  return Math.floor((Date.now() - (period === '7d' ? 7 : 30) * 86400000) / 1000);
}
function where(period: PeriodKey, accountId?: number, alias = '') {
  const clauses: string[] = []; const params: number[] = [];
  if (accountId != null) { clauses.push(`${alias}account_id = ?`); params.push(accountId); }
  const epoch = cutoff(period);
  if (epoch !== null) { clauses.push(`${alias}start_time >= ?`); params.push(epoch); }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function getPerformanceSummary(db: SQLiteDatabase, period: PeriodKey, accountId?: number): Promise<PerformanceSummary> {
  const filter = where(period, accountId);
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) matches, SUM(win) wins, AVG(gold_per_min) gpm, AVG(xp_per_min) xpm, AVG(deaths) deaths,
     AVG((COALESCE(kills,0)+COALESCE(assists,0))*1.0/CASE WHEN COALESCE(deaths,0)=0 THEN 1 ELSE deaths END) kda,
     AVG(CASE WHEN duration>0 THEN last_hits*60.0/duration ELSE NULL END) lhpm
     FROM OpenDotaMatches${filter.sql}`,
    ...filter.params,
  );
  const matches = Number(row?.matches ?? 0);
  return {
    matches, wins: Number(row?.wins ?? 0), winrate: matches ? Number(row.wins ?? 0) / matches * 100 : null,
    avgGpm: row?.gpm == null ? null : Number(row.gpm), avgXpm: row?.xpm == null ? null : Number(row.xpm),
    avgDeaths: row?.deaths == null ? null : Number(row.deaths), avgKda: row?.kda == null ? null : Number(row.kda),
    avgLastHitsPerMinute: row?.lhpm == null ? null : Number(row.lhpm), hasSmallSample: matches > 0 && matches < 10,
  };
}

export async function getHeroPerformances(db: SQLiteDatabase, period: PeriodKey = 'all', accountId?: number): Promise<HeroPerformance[]> {
  const filter = where(period, accountId);
  return db.getAllAsync<HeroPerformance>(
    `SELECT hero_name,COUNT(*) matches,SUM(win) wins,ROUND(100.0*SUM(win)/COUNT(*),1) winrate,
     ROUND(AVG((COALESCE(kills,0)+COALESCE(assists,0))*1.0/CASE WHEN COALESCE(deaths,0)=0 THEN 1 ELSE deaths END),2) avg_kda,
     ROUND(AVG(gold_per_min),0) avg_gpm,ROUND(AVG(xp_per_min),0) avg_xpm,ROUND(AVG(deaths),1) avg_deaths
     FROM OpenDotaMatches${filter.sql} GROUP BY hero_id,hero_name ORDER BY matches DESC`, ...filter.params,
  );
}

export async function getRolePerformances(db: SQLiteDatabase, period: PeriodKey, accountId?: number): Promise<RolePerformance[]> {
  const filter = where(period, accountId);
  return db.getAllAsync<RolePerformance>(
    `SELECT CASE WHEN role_estimate LIKE 'Offlane%' THEN 'Offlane' WHEN role_estimate LIKE 'Soft Support%' THEN 'Soft Support'
      WHEN role_estimate LIKE 'Hard Support%' THEN 'Hard Support' WHEN role_estimate LIKE 'Carry%' THEN 'Carry' WHEN role_estimate LIKE 'Mid%' THEN 'Mid' ELSE 'Unknown' END role,
     COUNT(*) matches,SUM(win) wins,ROUND(100.0*SUM(win)/COUNT(*),1) winrate,ROUND(AVG(gold_per_min),0) avg_gpm,
     ROUND(AVG(xp_per_min),0) avg_xpm,ROUND(AVG(deaths),1) avg_deaths
     FROM OpenDotaMatches${filter.sql} GROUP BY role ORDER BY matches DESC`, ...filter.params,
  );
}

export async function getMatchTrend(db: SQLiteDatabase, period: PeriodKey, accountId?: number): Promise<{ label: string; matches: number; winrate: number; avgGpm: number | null; avgXpm: number | null }[]> {
  const filter = where(period, accountId);
  const bucket = period === 'all' ? `strftime('%Y-W%W',start_time,'unixepoch','localtime')` : `strftime('%Y-%m-%d',start_time,'unixepoch','localtime')`;
  const rows = await db.getAllAsync<any>(
    `SELECT ${bucket} label,COUNT(*) matches,ROUND(100.0*SUM(win)/COUNT(*),1) winrate,
     AVG(gold_per_min) avgGpm,AVG(xp_per_min) avgXpm FROM OpenDotaMatches${filter.sql} GROUP BY label ORDER BY label`,
    ...filter.params,
  );
  return rows.map((r) => ({ label: r.label, matches: Number(r.matches), winrate: Number(r.winrate), avgGpm: r.avgGpm == null ? null : Number(r.avgGpm), avgXpm: r.avgXpm == null ? null : Number(r.avgXpm) }));
}

export async function getSelectedMatch(db: SQLiteDatabase, matchId: number): Promise<StoredMatch | null> {
  return db.getFirstAsync<StoredMatch>('SELECT * FROM OpenDotaMatches WHERE match_id=? AND account_id=(SELECT account_id FROM SteamLinks WHERE id=1)', matchId);
}

export function formatRoleEstimate(role: string | null): string {
  if (!role) return 'Role unavailable';
  return role.replace(' (slot estimate)', ' · slot estimate');
}
