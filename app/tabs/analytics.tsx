import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppRouter } from '@/navigation/hooks';
import { useDatabase } from '@/db/DatabaseProvider';
import { Activity, Award, Clock3, Flame, TrendingUp, Swords } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { getMatchSummary, getMmrHistory, getProfile, getTrainingSummary, getWeeklyTraining } from '@/db/repository';
import type { UserProfile } from '@/types';
import { EmptyState, Eyebrow, Heading, LoadingState, Panel, Screen, SectionHeader } from '@/components/ui';

export default function AnalyticsScreen() {
  const db = useDatabase();
  const router = useAppRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [training, setTraining] = useState({ sessions: 0, minutes: 0, todayDone: 0, streak: 0 });
  const [matches, setMatches] = useState({ matches: 0, wins: 0, winrate: null as number | null });
  const [weekly, setWeekly] = useState<{ day: string; minutes: number }[]>([]);
  const [mmrHistory, setMmrHistory] = useState<{ value: number; date: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getProfile(db), getTrainingSummary(db), getMatchSummary(db), getWeeklyTraining(db), getMmrHistory(db)])
      .then(([p, t, m, w, h]) => { if (active) { setProfile(p); setTraining(t); setMatches(m); setWeekly(w); setMmrHistory(h.reverse()); } })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [db]));

  if (loading) return <Screen><LoadingState /></Screen>;
  const maxMinutes = Math.max(60, ...weekly.map((day) => day.minutes));
  const progress = profile ? Math.max(0, Math.min(100, profile.currentMmr / Math.max(1, profile.targetMmr) * 100)) : 0;

  return (
    <Screen>
      <View style={{ gap: 6 }}><Eyebrow color={colors.purple}>PERFORMANCE / INSIGHTS</Eyebrow><Heading>Analytics</Heading><Text style={{ color: colors.textSecondary, fontSize: 13 }}>Your progress, based on saved training and match records.</Text></View>

      <Pressable onPress={() => router.push('/analytics/pro' as never)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#49377A', backgroundColor: '#15121E' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Swords color={colors.purple} size={19} /><View style={{ gap: 3 }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>PRO ANALYTICS</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>OpenDota · Replay Analyzer · MMR Tracker</Text></View></View>
        <Text style={{ color: colors.purple, fontWeight: '900', fontSize: 18 }}>→</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SummaryCard label="SESSIONS" value={String(training.sessions)} detail="completed" icon={<Activity size={16} color={colors.purple} />} />
        <SummaryCard label="TRAINING TIME" value={`${Math.floor(training.minutes / 60)}h ${training.minutes % 60}m`} detail="total" icon={<Clock3 size={16} color={colors.blue} />} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SummaryCard label="TRAINING STREAK" value={`${training.streak} days`} detail="current run" icon={<Flame size={16} color={colors.yellow} />} />
        <SummaryCard label="MATCH WINRATE" value={matches.winrate === null ? '—' : `${matches.winrate.toFixed(1)}%`} detail={matches.matches ? `${matches.wins}/${matches.matches} wins` : 'no match data'} icon={<TrendingUp size={16} color={colors.green} />} />
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="MMR progress" subtitle="Manual baseline · see Pro Analytics for match-linked trends" />
        <Panel>
          {profile ? <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><View style={{ gap: 3 }}><Text style={{ color: colors.textSecondary, fontSize: 10 }}>CURRENT</Text><Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{profile.currentMmr.toLocaleString()}</Text></View><View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={{ color: colors.textSecondary, fontSize: 10 }}>TARGET</Text><Text style={{ color: colors.purple, fontSize: 21, fontWeight: '800' }}>{profile.targetMmr.toLocaleString()}</Text></View></View>
            <View style={{ height: 7, backgroundColor: colors.surfaceSoft, borderRadius: 10, overflow: 'hidden' }}><View style={{ width: `${progress}%`, height: 7, backgroundColor: colors.purple, borderRadius: 10 }} /></View>
            {mmrHistory.length > 1 ? <View style={{ gap: 7 }}>{mmrHistory.map((item, index) => <View key={`${item.date}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{new Date(item.date).toLocaleDateString()}</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 11 }}>{item.value.toLocaleString()} MMR</Text></View>)}</View> : <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>Only the starting value is recorded. Add match results or update your MMR in Profile to build a real trend.</Text>}
          </> : <EmptyState title="Profile not found" description="Complete profile setup to see your progress." />}
        </Panel>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Last 7 days" subtitle="Completed training minutes per day" />
        {weekly.length ? <Panel style={{ gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 145, gap: 8 }}>
            {buildLastSevenDays(weekly).map((day) => <View key={day.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 7 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 9 }}>{day.minutes ? `${day.minutes}m` : '—'}</Text>
              <View style={{ width: '100%', maxWidth: 28, height: Math.max(4, day.minutes / maxMinutes * 92), borderRadius: 7, backgroundColor: day.minutes ? colors.purple : colors.surfaceSoft }} />
              <Text style={{ color: colors.muted, fontSize: 9 }}>{new Date(`${day.day}T12:00:00`).toLocaleDateString([], { weekday: 'short' })}</Text>
            </View>)}
          </View>
        </Panel> : <EmptyState title="No training data yet" description="Complete schedule blocks to populate your weekly training chart." />}
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Performance signals" subtitle="Evidence before assumptions" />
        <Panel style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}><Award size={17} color={colors.purple} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Strengths & weaknesses</Text></View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>The app does not guess your strengths or weaknesses. Training totals are measured locally; imported match signals and role/hero trends are available in Pro Analytics when a public OpenDota profile is connected.</Text>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ gap: 4 }}><Text style={{ color: colors.green, fontSize: 11, fontWeight: '800' }}>TRACKED</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Sessions, training minutes, streak and profile MMR baseline.</Text></View>
          <View style={{ gap: 4 }}><Text style={{ color: colors.yellow, fontSize: 11, fontWeight: '800' }}>NOT AVAILABLE HERE</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Select Pro Analytics for imported match statistics. Full replay timeline extraction remains limited to fields supplied by OpenDota.</Text></View>
        </Panel>
      </View>
    </Screen>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Panel style={{ flex: 1, padding: 13, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>{icon}</View><Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{value}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{detail}</Text></Panel>;
}

function buildLastSevenDays(rows: { day: string; minutes: number }[]) {
  const map = new Map(rows.map((row) => [row.day, row.minutes]));
  const result: { day: string; minutes: number }[] = [];
  const date = new Date(); date.setHours(12, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const day = new Date(date); day.setDate(date.getDate() - i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    result.push({ day: key, minutes: map.get(key) ?? 0 });
  }
  return result;
}
