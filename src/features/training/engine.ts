import type { SQLiteDatabase } from '@/db/database';
import { SCENARIOS, type Scenario, type Difficulty } from './scenarios';

const iso = () => new Date().toISOString();
export type RubricBreakdown = { decision: number; context: number; risk: number; timing: number; teamwork: number; reasoning: number };
export type AttemptResult = { score: number; feedback: string; strengths: string[]; weaknesses: string[]; breakdown: RubricBreakdown; attemptId: number; queuedForReview: boolean };

export function evaluateAnswer(scenario: Scenario, optionId: string, rationale: string) {
  const option = scenario.options.find((item) => item.id === optionId);
  if (!option) throw new Error('Choose one of the available decisions first.');
  const normalized = rationale.toLowerCase();
  const termGroups = {
    context: ['vision','ward','map','missing','position','wave','карта','вижу','линия','враг','enemy','information','информация'],
    risk: ['risk','риск','retreat','отступ','safe','безопас','blind','dark','опас','cooldown','ульт'],
    timing: ['timing','тайминг','minute','минута','rune','руна','cooldown','перезаряд','aegis','roshan','объект'],
    teamwork: ['team','команд','ally','союз','follow','связ','coordinate','communication','саппорт','керри'],
  };
  const matches = Object.fromEntries(Object.entries(termGroups).map(([key, terms]) => [key, terms.filter((term) => normalized.includes(term)).length])) as Record<keyof typeof termGroups, number>;
  const tags = option.tags.join(' ').toLowerCase();
  const rubric: RubricBreakdown = {
    decision: Math.round((option.score / 10 * 2) * 10) / 10,
    context: Math.min(2, (/(vision|map|information|lane|wave|position|target)/.test(tags) ? 1.2 : 0.6) + Math.min(0.8, matches.context * 0.2)),
    risk: Math.min(2, (/(risk|save|vision|position|counter|retreat)/.test(tags) ? 1.2 : 0.5) + Math.min(0.8, matches.risk * 0.2)),
    timing: Math.min(1.5, (/(timing|cooldown|rotation|rune|objective|tempo)/.test(tags) ? 0.9 : 0.4) + Math.min(0.6, matches.timing * 0.2)),
    teamwork: Math.min(1.5, (/(team|communication|save|numbers|ally)/.test(tags) ? 0.9 : 0.4) + Math.min(0.6, matches.teamwork * 0.2)),
    reasoning: rationale.trim().length < 12 ? 0 : Math.min(1, (rationale.trim().length > 60 ? 0.5 : 0.25) + Math.min(0.5, Object.values(matches).reduce((a,b)=>a+b,0) * 0.1)),
  };
  const score = Math.max(0, Math.min(10, Math.round(Object.values(rubric).reduce((sum, value) => sum + value, 0) * 10) / 10));
  const strengths = Object.entries(rubric).filter(([, value]) => value >= 1.3).map(([key]) => key);
  const weaknesses = Object.entries(rubric).filter(([, value]) => value < 0.8).map(([key]) => key);
  const rationaleFeedback = rationale.trim().length < 12
    ? 'Your explanation is too short to assess your reasoning. State what information, timing or risk influenced the decision.'
    : Object.values(matches).reduce((a,b)=>a+b,0) >= 3 ? 'Your explanation references several relevant game concepts. Make the connection between each fact and your chosen action explicit.'
    : 'Your explanation needs more game context. Mention enemy positions, cooldowns, vision, lane state, timing and the team objective.';
  return { option, score, rubric, feedback: `${option.feedback}\n\nReasoning review: ${rationaleFeedback}`, strengths, weaknesses };
}

export async function recordAttempt(db: SQLiteDatabase, scenario: Scenario, optionId: string, rationale: string, queueErrors = true): Promise<AttemptResult> {
  const result = evaluateAnswer(scenario, optionId, rationale);
  const option = result.option;
  let attemptId = 0;
  await db.withTransactionAsync(async () => {
    const inserted = await db.runAsync(
      `INSERT INTO TrainingAttempts (module,scenario_id,category,difficulty,selected_option,rationale,score,max_score,feedback,strengths,weaknesses,rubric_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      'Situation Trainer', scenario.id, scenario.category, scenario.difficulty, optionId, rationale, result.score, 10,
      result.feedback, result.strengths.join(','), result.weaknesses.join(','), JSON.stringify(result.rubric), iso(),
    );
    attemptId = inserted.lastInsertRowId;
    await db.runAsync('INSERT INTO TrainingSessions (title,category,duration_minutes,completed_at,notes) VALUES (?,?,?,?,?)', scenario.title, 'Situational', 15, iso(), `Score ${result.score}/10 · ${scenario.category}`);
    await db.runAsync(`INSERT INTO TrainingStatistics(category,completed_count,total_minutes,recorded_at) VALUES ('Situational',1,15,date('now','localtime')) ON CONFLICT(category,recorded_at) DO UPDATE SET completed_count=completed_count+1,total_minutes=total_minutes+15`);
    await db.runAsync('INSERT INTO UserProgress(metric_key,metric_value,recorded_at) VALUES (?,?,?)', 'training_score', result.score, iso());
    if (result.score < 7 && queueErrors) {
      const due = new Date(); due.setDate(due.getDate() + 1);
      await db.runAsync(
        `INSERT INTO ErrorReviewQueue (scenario_id,category,source_attempt_id,due_at,interval_days,repetitions,ease,status,last_score,created_at)
         VALUES (?,?,?,?,1,0,2.3,'due',?,?)`, scenario.id, scenario.category, attemptId, due.toISOString(), result.score, iso(),
      );
      await db.runAsync('INSERT INTO CoachNotes (category,note,source,created_at) VALUES (?,?,?,?)', scenario.category, `Needs review: ${scenario.title}. ${option.tags.join(', ')}`, 'situation-trainer', iso());
    }
  });
  return { score: result.score, feedback: result.feedback, strengths: result.strengths, weaknesses: result.weaknesses, breakdown: result.rubric, attemptId, queuedForReview: result.score < 7 && queueErrors };
}

export async function resolveReview(db: SQLiteDatabase, queueId: number, score: number) {
  const row = await db.getFirstAsync<any>('SELECT * FROM ErrorReviewQueue WHERE id=?', queueId);
  if (!row) return;
  if (score >= 7) {
    const repetitions = row.repetitions + 1;
    const interval = repetitions <= 1 ? 3 : repetitions === 2 ? 7 : Math.min(30, Math.round(row.interval_days * row.ease));
    const due = new Date(); due.setDate(due.getDate() + interval);
    await db.runAsync("UPDATE ErrorReviewQueue SET status='scheduled', repetitions=?, interval_days=?, due_at=?, last_score=? WHERE id=?", repetitions, interval, due.toISOString(), score, queueId);
  } else {
    const due = new Date(); due.setDate(due.getDate() + 1);
    await db.runAsync("UPDATE ErrorReviewQueue SET repetitions=0, interval_days=1, due_at=?, last_score=?, status='due' WHERE id=?", due.toISOString(), score, queueId);
  }
}

export async function recordModuleSession(db: SQLiteDatabase, title: string, category: string, notes: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO TrainingSessions(title,category,duration_minutes,completed_at,notes) VALUES (?,?,?,?,?)', title, category, 15, iso(), notes);
    await db.runAsync(`INSERT INTO TrainingStatistics(category,completed_count,total_minutes,recorded_at) VALUES (?,1,15,date('now','localtime')) ON CONFLICT(category,recorded_at) DO UPDATE SET completed_count=completed_count+1,total_minutes=total_minutes+15`, category);
  });
}

export async function getTrainingDashboard(db: SQLiteDatabase) {
  const summary = await db.getFirstAsync<any>(`SELECT COUNT(*) attempts, COALESCE(AVG(score),0) avg, SUM(CASE WHEN score>=7 THEN 1 ELSE 0 END) correct FROM TrainingAttempts`);
  const weak = await db.getFirstAsync<any>(`SELECT category, AVG(score) avg FROM TrainingAttempts GROUP BY category ORDER BY avg ASC LIMIT 1`);
  const strong = await db.getFirstAsync<any>(`SELECT category, AVG(score) avg FROM TrainingAttempts GROUP BY category ORDER BY avg DESC LIMIT 1`);
  const fixed = await db.getFirstAsync<any>(`SELECT COUNT(*) count FROM ErrorReviewQueue WHERE status='scheduled' AND repetitions>0`);
  const repeat = await db.getFirstAsync<any>(`SELECT COUNT(*) count FROM TrainingAttempts a WHERE score<7 AND EXISTS (SELECT 1 FROM TrainingAttempts b WHERE b.category=a.category AND b.id<a.id AND b.score<7)`);
  const weekly = await db.getAllAsync<any>(`SELECT date(created_at,'localtime') day, ROUND(AVG(score),1) avg, COUNT(*) attempts FROM TrainingAttempts WHERE created_at >= datetime('now','-6 days') GROUP BY day ORDER BY day`);
  const monthly = await db.getAllAsync<any>(`SELECT strftime('%Y-%W',created_at,'localtime') week, ROUND(AVG(score),1) avg, COUNT(*) attempts FROM TrainingAttempts WHERE created_at >= datetime('now','-30 days') GROUP BY week ORDER BY week`);
  const due = await db.getFirstAsync<any>(`SELECT COUNT(*) count FROM ErrorReviewQueue WHERE status IN ('due','scheduled') AND due_at<=?`, iso());
  return { attempts: summary?.attempts ?? 0, average: Number(summary?.avg ?? 0), correctRate: summary?.attempts ? (summary.correct / summary.attempts) * 100 : 0, weakest: weak?.category ?? null, strongest: strong?.category ?? null, fixed: fixed?.count ?? 0, repeated: repeat?.count ?? 0, weekly, monthly, due: due?.count ?? 0 };
}

export function scenarioForReview(scenarioId: string) { return SCENARIOS.find((item) => item.id === scenarioId); }
export function createReviewVariant(base: Scenario): Scenario {
  const variants = [
    { map: 'A previously missing enemy has just appeared on the far side of the map. Re-evaluate whether the original action is now safer, and what information is still missing.', prompt: 'With one enemy now revealed elsewhere, does your original plan still hold? Explain what changes and what does not.', answer: 'The reveal reduces uncertainty but does not automatically make the objective safe. Recount missing enemies, check whether the revealed hero can return, then update the risk calculation.' },
    { map: 'Your nearest ally is one screen farther away than before, and a key allied cooldown will be unavailable for the next 25 seconds.', prompt: 'Reassess the decision with reduced team follow-up. What is your safest high-value action now?', answer: 'Do not assume the same initiation or objective timing remains valid. Recalculate whether you can safely act without that follow-up; delaying or trading elsewhere may now be better.' },
    { map: 'A key enemy ultimate was used in a separate skirmish moments ago, but the enemy support positions are still unknown.', prompt: 'How does the changed cooldown information affect your timing and risk tolerance?', answer: 'The missing ultimate creates a temporary window, but unknown supports can still punish an isolated move. Use the cooldown window only with a controlled route, numbers and an exit condition.' },
  ];
  const v = variants[Math.floor(Math.random() * variants.length)]!;
  return { ...base, id: `${base.id}-variant-${Date.now()}`, title: `${base.title} · Variation`, minute: base.minute + 1, mapState: `${base.mapState}\n\nVARIATION: ${v.map}`, prompt: v.prompt, modelAnswer: `${base.modelAnswer}\n\nVariation coaching: ${v.answer}` };
}
export function getDifficulty(value: string): Difficulty | undefined { return ['Beginner','Intermediate','Advanced','Immortal-level'].includes(value) ? value as Difficulty : undefined; }
