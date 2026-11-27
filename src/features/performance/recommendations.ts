import type { SQLiteDatabase } from '@/db/database';

export type Recommendation = { id: string; category: string; title: string; reason: string; action: string; evidence: Record<string, number | string>; minutes: number };
export async function getPracticeCoverage(db: SQLiteDatabase) {
  const [situations, items, drafts, reviews, notes] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) count FROM TrainingAttempts'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) count FROM ItemPractice'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) count FROM DraftPractice'),
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) count FROM ErrorReviewQueue WHERE status IN ('due','scheduled')"),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) count FROM CoachNotes'),
  ]);
  return { situations: situations?.count ?? 0, items: items?.count ?? 0, drafts: drafts?.count ?? 0, reviews: reviews?.count ?? 0, notes: notes?.count ?? 0 };
}

export async function buildPersonalRecommendations(db: SQLiteDatabase): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const attempts = await db.getAllAsync<{ category: string; score: number; rubric_json: string }>(
    'SELECT category,score,rubric_json FROM TrainingAttempts ORDER BY created_at DESC LIMIT 80',
  );
  const categoryScores = new Map<string, number[]>();
  const rubricScores = new Map<string, number[]>();
  for (const attempt of attempts) {
    const list = categoryScores.get(attempt.category) ?? []; list.push(attempt.score); categoryScores.set(attempt.category, list);
    try {
      const rubric = JSON.parse(attempt.rubric_json) as Record<string, number>;
      for (const [key, value] of Object.entries(rubric)) {
        if (!Number.isFinite(value)) continue;
        const values = rubricScores.get(key) ?? []; values.push(value); rubricScores.set(key, values);
      }
    } catch { /* Old or malformed rubric entries do not block recommendations. */ }
  }
  const rubricNames: Record<string, string> = { decision: 'Decision quality', context: 'Game context', risk: 'Risk assessment', timing: 'Timing', teamwork: 'Team coordination', reasoning: 'Argumentation' };
  const weakestRubric = [...rubricScores.entries()].map(([key, values]) => ({ key, average: values.reduce((a,b)=>a+b,0)/values.length, count: values.length })).filter((x) => x.count >= 3).sort((a,b)=>a.average-b.average)[0];
  if (weakestRubric) {
    recommendations.push({ id: `rubric-${weakestRubric.key}`, category: 'Situation Trainer', title: `Strengthen ${rubricNames[weakestRubric.key] ?? weakestRubric.key.toLowerCase()}`,
      reason: `Your last ${weakestRubric.count} scored situations average ${weakestRubric.average.toFixed(1)} on this rubric dimension. This is evidence from your submitted training answers, not a match-wide judgment.`,
      action: 'Complete five new situation drills. Explain the information and trade-offs behind each choice.', evidence: { average: Number(weakestRubric.average.toFixed(2)), attempts: weakestRubric.count }, minutes: 25 });
  }
  const weakCategory = [...categoryScores.entries()].map(([category, values]) => ({ category, average: values.reduce((a,b)=>a+b,0)/values.length, count: values.length })).filter((x)=>x.count>=3).sort((a,b)=>a.average-b.average)[0];
  if (weakCategory && (!weakestRubric || weakCategory.category !== weakestRubric.key)) {
    recommendations.push({ id: `category-${weakCategory.category}`, category: weakCategory.category, title: `Review ${weakCategory.category.toLowerCase()}`,
      reason: `${weakCategory.count} recent attempts in this category average ${weakCategory.average.toFixed(1)}/10.`,
      action: 'Repeat similar but varied scenarios, then compare your rationale against the review criteria.', evidence: { average: Number(weakCategory.average.toFixed(2)), attempts: weakCategory.count }, minutes: 25 });
  }
  const repeatErrors = await db.getFirstAsync<{ category: string; count: number }>(
    `SELECT category,COUNT(*) count FROM TrainingAttempts WHERE score<7 GROUP BY category HAVING COUNT(*)>=2 ORDER BY count DESC LIMIT 1`,
  );
  if (repeatErrors) recommendations.push({ id: `repeat-${repeatErrors.category}`, category: repeatErrors.category,
    title: `Break the repeated ${repeatErrors.category.toLowerCase()} error`,
    reason: `${repeatErrors.count} submitted attempts in this category scored below 7/10.`,
    action: 'Work through a fresh scenario with the same decision theme; do not memorize the old answer.', evidence: { lowScoringAttempts: repeatErrors.count }, minutes: 20 });

  const matchSignals = await db.getFirstAsync<{ matches: number; deaths: number | null; gpm: number | null; winrate: number | null }>(
    `SELECT COUNT(*) matches,AVG(deaths) deaths,AVG(gold_per_min) gpm,AVG(win)*100 winrate FROM
     (SELECT * FROM OpenDotaMatches WHERE account_id=(SELECT account_id FROM SteamLinks WHERE id=1) ORDER BY start_time DESC LIMIT 20)`,
  );
  if (matchSignals && matchSignals.matches >= 5 && matchSignals.deaths !== null && matchSignals.deaths >= 8) {
    recommendations.push({ id: 'match-death-review', category: 'Match review', title: 'Review high-death match contexts',
      reason: `Across your latest ${matchSignals.matches} imported matches, average deaths are ${Number(matchSignals.deaths).toFixed(1)}. Death count alone does not prove poor positioning; review the objective, vision, buyback and team state before each death.`,
      action: 'Review two available parsed match records and write down the context for three deaths. Identify whether each trade created map value; a full event timeline may not be available.',
      evidence: { matches: matchSignals.matches, avgDeaths: Number(matchSignals.deaths.toFixed(1)) }, minutes: 25 });
  }
  return recommendations.slice(0, 4);
}

export async function scheduleRecommendation(db: SQLiteDatabase, recommendation: Recommendation, fatigue: 'fresh'|'normal'|'tired' = 'normal'): Promise<void> {
  const duration = fatigue === 'tired' ? Math.max(10, Math.round(recommendation.minutes * 0.6)) : recommendation.minutes;
  const title = fatigue === 'tired' ? `Light: ${recommendation.title}` : recommendation.title;
  const profile = await db.getFirstAsync<{ daily_training_minutes: number }>('SELECT daily_training_minutes FROM UserProfile WHERE id=1');
  const planned = await db.getFirstAsync<{ minutes: number }>("SELECT COALESCE(SUM(duration_minutes),0) minutes FROM TrainingSchedule WHERE date(scheduled_at,'localtime')=date('now','localtime') AND category NOT IN ('Break','Rest') AND completed=0");
  const allowed = profile?.daily_training_minutes ?? 360;
  if ((planned?.minutes ?? 0) + duration > allowed) throw new Error(`This block would exceed your daily training target (${allowed} minutes). Reorganize the schedule first.`);
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const existing = await db.getFirstAsync<{ scheduled_at: string }>(
    "SELECT scheduled_at FROM TrainingSchedule WHERE title=? AND date(scheduled_at,'localtime')=date('now','localtime') LIMIT 1", title,
  );
  if (existing) throw new Error('This recommendation is already in today’s schedule.');

  // Add the recommendation to the first free gap after now, avoiding overlaps
  // with existing incomplete training and break blocks.
  const blocks = await db.getAllAsync<{ scheduled_at: string; duration_minutes: number }>(
    "SELECT scheduled_at,duration_minutes FROM TrainingSchedule WHERE date(scheduled_at,'localtime')=date('now','localtime') AND completed=0 AND duration_minutes>0 ORDER BY scheduled_at",
  );
  let cursor = new Date(now);
  const durationMs = duration * 60_000;
  for (const block of blocks) {
    const blockStart = new Date(block.scheduled_at);
    if (!Number.isFinite(blockStart.getTime())) continue;
    const blockEnd = new Date(blockStart.getTime() + block.duration_minutes * 60_000);
    if (blockEnd <= cursor) continue;
    if (blockStart.getTime() >= cursor.getTime() + durationMs) break;
    if (blockStart < new Date(cursor.getTime() + durationMs) && blockEnd > cursor) cursor = blockEnd;
  }
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  if (cursor.getTime() + durationMs > endOfDay.getTime()) throw new Error('There is no free time left today for this block. Keep tomorrow’s plan or adjust the schedule manually.');

  await db.runAsync(
    `INSERT INTO TrainingSchedule(title,category,duration_minutes,scheduled_at,completed,notes,created_at) VALUES(?,?,?,?,0,?,?)`,
    title, 'Recommended', duration, cursor.toISOString(),
    `${recommendation.reason} ${recommendation.action}`, new Date().toISOString(),
  );
}
