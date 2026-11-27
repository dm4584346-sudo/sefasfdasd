import type { SQLiteDatabase } from '@/db/database';

/**
 * Ordered schema migrations. Add a new migration with an incremented version
 * instead of editing the SQL for a version already released to users.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS UserProfile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nickname TEXT NOT NULL,
        current_mmr INTEGER NOT NULL DEFAULT 0,
        target_mmr INTEGER NOT NULL DEFAULT 4000,
        primary_role TEXT NOT NULL DEFAULT 'Offlane',
        secondary_role TEXT NOT NULL DEFAULT 'Soft Support',
        extra_role TEXT NOT NULL DEFAULT 'Hard Support',
        daily_training_minutes INTEGER NOT NULL DEFAULT 360,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS HeroPool (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        matches INTEGER,
        winrate REAL,
        mastery INTEGER,
        strengths TEXT NOT NULL DEFAULT '',
        weaknesses TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(name, position)
      );

      CREATE TABLE IF NOT EXISTS TrainingSchedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS TrainingSessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS MatchHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hero_name TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('win', 'loss')),
        mmr_change INTEGER,
        match_date TEXT NOT NULL,
        role TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        external_match_id TEXT
      );

      CREATE TABLE IF NOT EXISTS UserProgress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_key TEXT NOT NULL,
        metric_value REAL NOT NULL,
        recorded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS TrainingStatistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        completed_count INTEGER NOT NULL DEFAULT 0,
        total_minutes INTEGER NOT NULL DEFAULT 0,
        recorded_at TEXT NOT NULL,
        UNIQUE(category, recorded_at)
      );

      CREATE TABLE IF NOT EXISTS Settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_date ON TrainingSchedule(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_completed ON TrainingSessions(completed_at);
      CREATE INDEX IF NOT EXISTS idx_matches_date ON MatchHistory(match_date);
      CREATE INDEX IF NOT EXISTS idx_progress_metric ON UserProgress(metric_key, recorded_at);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS TrainingAttempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, module TEXT NOT NULL, scenario_id TEXT NOT NULL,
        category TEXT NOT NULL, difficulty TEXT NOT NULL, selected_option TEXT NOT NULL,
        rationale TEXT NOT NULL DEFAULT '', score REAL NOT NULL, max_score REAL NOT NULL DEFAULT 10,
        feedback TEXT NOT NULL, strengths TEXT NOT NULL DEFAULT '', weaknesses TEXT NOT NULL DEFAULT '',
        rubric_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ErrorReviewQueue (
        id INTEGER PRIMARY KEY AUTOINCREMENT, scenario_id TEXT NOT NULL, category TEXT NOT NULL,
        source_attempt_id INTEGER NOT NULL, due_at TEXT NOT NULL, interval_days INTEGER NOT NULL DEFAULT 1,
        repetitions INTEGER NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.3, status TEXT NOT NULL DEFAULT 'due',
        last_score REAL, created_at TEXT NOT NULL,
        FOREIGN KEY(source_attempt_id) REFERENCES TrainingAttempts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_review_due ON ErrorReviewQueue(status, due_at);
      CREATE INDEX IF NOT EXISTS idx_attempts_date ON TrainingAttempts(created_at);
      CREATE TABLE IF NOT EXISTS CoachNotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, note TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'training', created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS DraftPractice (
        id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, enemy_pick TEXT NOT NULL,
        ally_pick TEXT NOT NULL, selected_hero TEXT NOT NULL, score REAL,
        analysis TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ItemPractice (
        id INTEGER PRIMARY KEY AUTOINCREMENT, hero TEXT NOT NULL, role TEXT NOT NULL,
        enemy_pick TEXT NOT NULL, ally_pick TEXT NOT NULL DEFAULT '', owned_items TEXT NOT NULL DEFAULT '',
        minute INTEGER NOT NULL, gold INTEGER NOT NULL,
        chosen_item TEXT NOT NULL, rationale TEXT NOT NULL DEFAULT '', score REAL,
        data_version TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS SteamLinks (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        account_id INTEGER NOT NULL UNIQUE,
        steam_id_64 TEXT,
        persona_name TEXT,
        profile_url TEXT,
        profile_json TEXT NOT NULL DEFAULT '{}',
        synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS OpenDotaMatches (
        match_id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        hero_id INTEGER NOT NULL DEFAULT 0,
        hero_name TEXT NOT NULL DEFAULT 'Unknown hero',
        win INTEGER NOT NULL DEFAULT 0,
        start_time INTEGER NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        player_slot INTEGER,
        role_estimate TEXT,
        lane_role INTEGER,
        kills INTEGER,
        deaths INTEGER,
        assists INTEGER,
        last_hits INTEGER,
        denies INTEGER,
        gold_per_min INTEGER,
        xp_per_min INTEGER,
        net_worth INTEGER,
        hero_damage INTEGER,
        tower_damage INTEGER,
        level INTEGER,
        teamfight_participation REAL,
        lane_efficiency_pct REAL,
        items_json TEXT NOT NULL DEFAULT '[]',
        parsed_detail INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL DEFAULT '{}',
        fetched_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_match_external_unique ON MatchHistory(external_match_id) WHERE external_match_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_od_matches_account_date ON OpenDotaMatches(account_id, start_time DESC);
      CREATE INDEX IF NOT EXISTS idx_od_matches_hero ON OpenDotaMatches(account_id, hero_id);
      CREATE INDEX IF NOT EXISTS idx_od_matches_role ON OpenDotaMatches(account_id, role_estimate);

      CREATE TABLE IF NOT EXISTS MmrEntries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mmr INTEGER NOT NULL,
        delta INTEGER,
        result TEXT CHECK(result IN ('win','loss','manual') OR result IS NULL),
        source TEXT NOT NULL DEFAULT 'manual',
        match_id INTEGER,
        note TEXT NOT NULL DEFAULT '',
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mmr_entries_date ON MmrEntries(recorded_at);

      CREATE TABLE IF NOT EXISTS GameDataCache (
        data_key TEXT PRIMARY KEY,
        version TEXT,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS PerformanceRecommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        reason TEXT NOT NULL,
        action TEXT NOT NULL,
        evidence_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
    `,
  },
  {
    version: 4,
    sql: `
      -- A match can appear in multiple players' histories. Preserve each player's
      -- independently imported row instead of overwriting another account.
      CREATE TABLE OpenDotaMatches_v4 (
        match_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        hero_id INTEGER NOT NULL DEFAULT 0,
        hero_name TEXT NOT NULL DEFAULT 'Unknown hero',
        win INTEGER NOT NULL DEFAULT 0,
        start_time INTEGER NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        player_slot INTEGER,
        role_estimate TEXT,
        lane_role INTEGER,
        kills INTEGER,
        deaths INTEGER,
        assists INTEGER,
        last_hits INTEGER,
        denies INTEGER,
        gold_per_min INTEGER,
        xp_per_min INTEGER,
        net_worth INTEGER,
        hero_damage INTEGER,
        tower_damage INTEGER,
        level INTEGER,
        teamfight_participation REAL,
        lane_efficiency_pct REAL,
        items_json TEXT NOT NULL DEFAULT '[]',
        parsed_detail INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL DEFAULT '{}',
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (match_id, account_id)
      );
      INSERT INTO OpenDotaMatches_v4 (
        match_id,account_id,hero_id,hero_name,win,start_time,duration,player_slot,role_estimate,lane_role,
        kills,deaths,assists,last_hits,denies,gold_per_min,xp_per_min,net_worth,hero_damage,tower_damage,level,
        teamfight_participation,lane_efficiency_pct,items_json,parsed_detail,raw_json,fetched_at
      ) SELECT
        match_id,account_id,hero_id,hero_name,win,start_time,duration,player_slot,role_estimate,lane_role,
        kills,deaths,assists,last_hits,denies,gold_per_min,xp_per_min,net_worth,hero_damage,tower_damage,level,
        teamfight_participation,lane_efficiency_pct,items_json,parsed_detail,raw_json,fetched_at
        FROM OpenDotaMatches;
      DROP TABLE OpenDotaMatches;
      ALTER TABLE OpenDotaMatches_v4 RENAME TO OpenDotaMatches;
      CREATE INDEX IF NOT EXISTS idx_od_matches_account_date ON OpenDotaMatches(account_id, start_time DESC);
      CREATE INDEX IF NOT EXISTS idx_od_matches_hero ON OpenDotaMatches(account_id, hero_id);
      CREATE INDEX IF NOT EXISTS idx_od_matches_role ON OpenDotaMatches(account_id, role_estimate);
    `,
  },
];

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
