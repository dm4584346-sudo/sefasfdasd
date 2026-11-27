import type { SQLiteDatabase } from '@/db/database';
import type { Hero, Role, ScheduleBlock, TrainingSession, UserProfile } from '@/types';

const nowIso = () => new Date().toISOString();
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export async function getProfile(db: SQLiteDatabase): Promise<UserProfile | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM UserProfile WHERE id = 1');
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    currentMmr: row.current_mmr,
    targetMmr: row.target_mmr,
    primaryRole: row.primary_role,
    secondaryRole: row.secondary_role,
    extraRole: row.extra_role,
    dailyTrainingMinutes: row.daily_training_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveProfile(
  db: SQLiteDatabase,
  input: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const now = nowIso();
  const previous = await db.getFirstAsync<{ current_mmr: number }>('SELECT current_mmr FROM UserProfile WHERE id = 1');
  await db.runAsync(
    `INSERT INTO UserProfile (id, nickname, current_mmr, target_mmr, primary_role, secondary_role, extra_role, daily_training_minutes, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname, current_mmr=excluded.current_mmr,
     target_mmr=excluded.target_mmr, primary_role=excluded.primary_role, secondary_role=excluded.secondary_role,
     extra_role=excluded.extra_role, daily_training_minutes=excluded.daily_training_minutes, updated_at=excluded.updated_at`,
    input.nickname.trim(), input.currentMmr, input.targetMmr, input.primaryRole, input.secondaryRole,
    input.extraRole, input.dailyTrainingMinutes, now, now,
  );
  if (!previous || previous.current_mmr !== input.currentMmr) {
    await db.runAsync('INSERT INTO UserProgress (metric_key, metric_value, recorded_at) VALUES (?, ?, ?)', 'mmr', input.currentMmr, now);
  }
}

export async function ensureStarterData(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM HeroPool');
  if ((existing?.count ?? 0) === 0) {
    const createdAt = nowIso();
    await db.runAsync(
      'INSERT INTO HeroPool (name, position, matches, winrate, mastery, strengths, weaknesses, created_at) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?)',
      'Chaos Knight', 'Offlane', '', '', createdAt,
    );
    await db.runAsync(
      'INSERT INTO HeroPool (name, position, matches, winrate, mastery, strengths, weaknesses, created_at) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?)',
      'Skywrath Mage', 'Soft Support', '', '', createdAt,
    );
  }
}

export async function getHeroes(db: SQLiteDatabase): Promise<Hero[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM HeroPool ORDER BY position, name');
  return rows.map((row) => ({
    id: row.id, name: row.name, position: row.position, matches: row.matches,
    winrate: row.winrate, mastery: row.mastery, strengths: row.strengths, weaknesses: row.weaknesses,
  }));
}

export async function addHero(db: SQLiteDatabase, name: string, position: Role): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO HeroPool (name, position, matches, winrate, mastery, strengths, weaknesses, created_at) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?)',
    name.trim(), position, '', '', nowIso(),
  );
}

export async function deleteHero(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM HeroPool WHERE id = ?', id);
}

export async function getSchedule(db: SQLiteDatabase, date = new Date()): Promise<ScheduleBlock[]> {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM TrainingSchedule WHERE scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at, id',
    start.toISOString(), end.toISOString(),
  );
  return rows.map((row) => ({
    id: row.id, title: row.title, category: row.category, durationMinutes: row.duration_minutes,
    scheduledAt: row.scheduled_at, completed: Boolean(row.completed), notes: row.notes,
  }));
}

export async function ensureDefaultSchedule(db: SQLiteDatabase, date = new Date()): Promise<void> {
  const existing = await getSchedule(db, date);
  if (existing.length > 0) return;
  const base = new Date(date); base.setHours(10, 0, 0, 0);
  const blocks = [
    ['Game theory', 'Theory', 45, 'Review one concept: lane equilibrium, rotations or map pressure.'],
    ['Mechanical warm-up', 'Mechanics', 45, 'Last hits, spell range, camera movement and quick item use.'],
    ['Short break', 'Break', 15, 'Step away from the screen and reset.'],
    ['Ranked block', 'Ranked', 150, 'Play with one focus goal. Stop after two mentally exhausting games.'],
    ['Long break', 'Break', 20, 'Hydrate, eat and rest your eyes.'],
    ['Replay review', 'Analysis', 45, 'Review one match and write down two actionable mistakes.'],
    ['Situation drills', 'Situational', 45, 'Practice rotations, team-fight positioning and objective timing.'],
    ['Session review', 'Review', 30, 'Record one strength, one weakness and tomorrow’s focus.'],
  ] as const;
  let cursor = new Date(base);
  for (const [title, category, duration, notes] of blocks) {
    await db.runAsync(
      'INSERT INTO TrainingSchedule (title, category, duration_minutes, scheduled_at, completed, notes, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      title, category, duration, cursor.toISOString(), notes, nowIso(),
    );
    cursor = new Date(cursor.getTime() + duration * 60_000);
  }
}

export async function addScheduleBlock(
  db: SQLiteDatabase,
  title: string,
  category: string,
  durationMinutes: number,
  notes = '',
  timeValue?: string,
): Promise<void> {
  const scheduled = new Date();
  if (timeValue) {
    const [hoursRaw, minutesRaw] = timeValue.split(':');
    const hours = Number(hoursRaw); const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) throw new Error('Enter a valid time in HH:MM format.');
    scheduled.setHours(hours, minutes, 0, 0);
  }
  await db.runAsync(
    'INSERT INTO TrainingSchedule (title, category, duration_minutes, scheduled_at, completed, notes, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    title.trim(), category, durationMinutes, scheduled.toISOString(), notes, nowIso(),
  );
}

export async function toggleScheduleBlock(db: SQLiteDatabase, block: ScheduleBlock): Promise<void> {
  const completed = !block.completed;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE TrainingSchedule SET completed = ? WHERE id = ?', completed ? 1 : 0, block.id);
    if (completed && block.category !== 'Break' && block.category !== 'Rest') {
      await db.runAsync(
        'INSERT INTO TrainingSessions (title, category, duration_minutes, completed_at, notes) VALUES (?, ?, ?, ?, ?)',
        block.title, block.category, block.durationMinutes, nowIso(), block.notes,
      );
      await db.runAsync(
        `INSERT INTO TrainingStatistics (category, completed_count, total_minutes, recorded_at)
         VALUES (?, 1, ?, date('now', 'localtime'))
         ON CONFLICT(category, recorded_at) DO UPDATE SET completed_count=completed_count+1, total_minutes=total_minutes+excluded.total_minutes`,
        block.category, block.durationMinutes,
      );
    } else if (!completed && block.category !== 'Break' && block.category !== 'Rest') {
      const session = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM TrainingSessions WHERE title = ? AND category = ? AND date(completed_at, 'localtime') = date('now', 'localtime') ORDER BY id DESC LIMIT 1",
        block.title, block.category,
      );
      if (session) await db.runAsync('DELETE FROM TrainingSessions WHERE id = ?', session.id);
      await db.runAsync("UPDATE TrainingStatistics SET completed_count = MAX(0, completed_count - 1), total_minutes = MAX(0, total_minutes - ?) WHERE category = ? AND recorded_at = date('now', 'localtime')", block.durationMinutes, block.category);
      await db.runAsync("DELETE FROM TrainingStatistics WHERE completed_count = 0 AND total_minutes = 0 AND category = ? AND recorded_at = date('now', 'localtime')", block.category);
    }
  });
}

export async function getRecentSessions(db: SQLiteDatabase, limit = 5): Promise<TrainingSession[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM TrainingSessions ORDER BY completed_at DESC LIMIT ?', limit);
  return rows.map((row) => ({
    id: row.id, title: row.title, category: row.category,
    durationMinutes: row.duration_minutes, completedAt: row.completed_at, notes: row.notes,
  }));
}

export async function getTrainingSummary(db: SQLiteDatabase): Promise<{ sessions: number; minutes: number; todayDone: number; streak: number }> {
  const total = await db.getFirstAsync<any>('SELECT COUNT(*) as sessions, COALESCE(SUM(duration_minutes), 0) as minutes FROM TrainingSessions');
  const today = await db.getFirstAsync<any>("SELECT COUNT(*) as done FROM TrainingSessions WHERE date(completed_at, 'localtime') = date('now', 'localtime')");
  const days = await db.getAllAsync<{ day: string }>("SELECT DISTINCT date(completed_at, 'localtime') as day FROM TrainingSessions ORDER BY day DESC LIMIT 60");
  let streak = 0;
  const date = new Date(); date.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(date);
  const yesterday = new Date(date); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const daySet = new Set(days.map((item) => item.day));
  if (daySet.has(todayKey) || daySet.has(yesterdayKey)) {
    const cursor = daySet.has(todayKey) ? date : yesterday;
    while (daySet.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return { sessions: total?.sessions ?? 0, minutes: total?.minutes ?? 0, todayDone: today?.done ?? 0, streak };
}

export async function getMatchSummary(db: SQLiteDatabase): Promise<{ matches: number; wins: number; winrate: number | null }> {
  const row = await db.getFirstAsync<any>(
    `SELECT
       (SELECT COUNT(*) FROM MatchHistory WHERE external_match_id IS NULL) +
       (SELECT COUNT(*) FROM OpenDotaMatches WHERE account_id=(SELECT account_id FROM SteamLinks WHERE id=1)) AS matches,
       (SELECT COUNT(*) FROM MatchHistory WHERE external_match_id IS NULL AND result='win') +
       (SELECT COALESCE(SUM(win),0) FROM OpenDotaMatches WHERE account_id=(SELECT account_id FROM SteamLinks WHERE id=1)) AS wins`,
  );
  const matches = row?.matches ?? 0;
  const wins = row?.wins ?? 0;
  return { matches, wins, winrate: matches > 0 ? (wins / matches) * 100 : null };
}

export async function saveSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO Settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
    key, value, nowIso(),
  );
}

export async function updateScheduleBlock(
  db: SQLiteDatabase,
  id: number,
  title: string,
  category: string,
  durationMinutes: number,
  timeValue: string,
  notes: string,
): Promise<void> {
  const [hoursRaw, minutesRaw] = timeValue.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Enter a valid time in HH:MM format.');
  }
  const scheduledAt = new Date();
  scheduledAt.setHours(hours, minutes, 0, 0);
  await db.runAsync(
    'UPDATE TrainingSchedule SET title = ?, category = ?, duration_minutes = ?, scheduled_at = ?, notes = ? WHERE id = ?',
    title.trim(), category, durationMinutes, scheduledAt.toISOString(), notes, id,
  );
}

export async function deleteScheduleBlock(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM TrainingSchedule WHERE id = ?', id);
}

export async function setTodayAsRestDay(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Only replace the app's own marker. Never delete user-created training blocks.
    await db.runAsync(
      "DELETE FROM TrainingSchedule WHERE title='Recovery day' AND category='Rest' AND date(scheduled_at,'localtime')=date('now','localtime')",
    );
    const at = new Date(); at.setHours(10, 0, 0, 0);
    await db.runAsync(
      'INSERT INTO TrainingSchedule (title, category, duration_minutes, scheduled_at, completed, notes, created_at) VALUES (?, ?, 0, ?, 0, ?, ?)',
      'Recovery day', 'Rest', at.toISOString(), 'Recovery day selected. Existing schedule blocks are preserved; adjust or skip them manually if needed.', nowIso(),
    );
  });
}

export async function clearTodayAsRestDay(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    "DELETE FROM TrainingSchedule WHERE title='Recovery day' AND category='Rest' AND date(scheduled_at,'localtime')=date('now','localtime')",
  );
}

export async function getWeeklyTraining(db: SQLiteDatabase): Promise<{ day: string; minutes: number }[]> {
  const rows = await db.getAllAsync<{ day: string; minutes: number }>(
    "SELECT date(completed_at, 'localtime') as day, SUM(duration_minutes) as minutes FROM TrainingSessions WHERE date(completed_at, 'localtime') >= date('now', 'localtime', '-6 days') GROUP BY day ORDER BY day",
  );
  return rows;
}

export async function getMmrHistory(db: SQLiteDatabase): Promise<{ value: number; date: string }[]> {
  return db.getAllAsync<{ value: number; date: string }>(
    "SELECT metric_value as value, recorded_at as date FROM UserProgress WHERE metric_key = 'mmr' ORDER BY recorded_at DESC LIMIT 12",
  );
}
