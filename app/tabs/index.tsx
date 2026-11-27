import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppRouter } from '@/navigation/hooks';
import { useDatabase } from '@/db/DatabaseProvider';
import { ArrowRight, Flame, Play, Swords, Target, TrendingUp } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { getMatchSummary, getProfile, getRecentSessions, getSchedule, getTrainingSummary } from '@/db/repository';
import type { ScheduleBlock, TrainingSession, UserProfile } from '@/types';
import { Eyebrow, Heading, LoadingState, Panel, PrimaryButton, Screen, SectionHeader } from '@/components/ui';

const fmtMinutes = (value: number) => value >= 60 ? `${Math.floor(value / 60)}h ${value % 60 ? `${value % 60}m` : ''}`.trim() : `${value}m`;

export default function HomeScreen() {
  const db = useDatabase();
  const router = useAppRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [training, setTraining] = useState({ sessions: 0, minutes: 0, todayDone: 0, streak: 0 });
  const [matches, setMatches] = useState({ matches: 0, wins: 0, winrate: null as number | null });
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getProfile(db), getSchedule(db), getRecentSessions(db, 4), getTrainingSummary(db), getMatchSummary(db)])
      .then(([p, s, r, t, m]) => { if (active) { setProfile(p); setSchedule(s); setSessions(r); setTraining(t); setMatches(m); } })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [db]));

  if (loading || !profile) return <Screen><LoadingState /></Screen>;
  const mmrDelta = Math.max(0, profile.targetMmr - profile.currentMmr);
  const mmrProgress = profile.targetMmr > 0 ? Math.max(0, Math.min(100, (profile.currentMmr / profile.targetMmr) * 100)) : 0;
  const nextBlocks = schedule.filter((block) => !block.completed).slice(0, 3);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 4 }}>
          <Eyebrow color={colors.purple}>DOTA PRO LAB / PLAYER DASHBOARD</Eyebrow>
          <Heading>Welcome back, {profile.nickname}</Heading>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Keep your focus. Make every session count.</Text>
        </View>
        <Pressable onPress={() => router.navigate('/(tabs)/profile' as never)} style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: colors.purpleSoft, borderColor: '#49377A', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.purple, fontWeight: '900', fontSize: 17 }}>{profile.nickname.slice(0, 1).toUpperCase()}</Text>
        </Pressable>
      </View>

      <Panel style={{ padding: 19, borderColor: '#463477', backgroundColor: '#15121E' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow color={colors.purple}>MMR ROADMAP</Eyebrow>
          <View style={{ backgroundColor: colors.purpleSoft, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.purple, fontSize: 10, fontWeight: '800' }}>TARGET TRACKING</Text></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 3 }}>
          <View style={{ gap: 3 }}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>CURRENT MMR</Text><Text style={{ color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{profile.currentMmr.toLocaleString()}</Text></View>
          <View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>TARGET MMR</Text><Text style={{ color: colors.purple, fontSize: 25, fontWeight: '800' }}>{profile.targetMmr.toLocaleString()}</Text></View>
        </View>
        <View style={{ height: 7, borderRadius: 8, backgroundColor: '#302A3E', overflow: 'hidden' }}><View style={{ width: `${mmrProgress}%`, height: 7, borderRadius: 8, backgroundColor: colors.purple }} /></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{Math.round(mmrProgress)}% of target</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{mmrDelta.toLocaleString()} MMR to go</Text>
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MetricCard label="MATCHES" value={matches.matches ? String(matches.matches) : '—'} detail={matches.winrate === null ? 'No match data yet' : `${matches.winrate.toFixed(1)}% winrate`} icon={<Swords size={17} color={colors.purple} />} />
        <MetricCard label="WINRATE" value={matches.winrate === null ? '—' : `${matches.winrate.toFixed(1)}%`} detail={matches.matches ? `${matches.wins} wins recorded` : 'Awaiting match log'} icon={<TrendingUp size={17} color={colors.green} />} />
        <MetricCard label="STREAK" value={`${training.streak}`} detail="training days" icon={<Flame size={17} color={colors.yellow} />} />
      </View>

      <PrimaryButton title="Start Training" onPress={() => router.navigate('/(tabs)/training' as never)} icon={<Play size={17} color="#100D18" fill="#100D18" />} />

      <View style={{ gap: 13 }}>
        <SectionHeader title="Today's schedule" subtitle={`${training.todayDone} blocks completed today`} action={<Pressable onPress={() => router.navigate('/(tabs)/training' as never)}><Text style={{ color: colors.purple, fontSize: 12, fontWeight: '800' }}>VIEW ALL</Text></Pressable>} />
        {nextBlocks.length ? <Panel style={{ gap: 0, paddingVertical: 4 }}>
          {nextBlocks.map((block, index) => <SchedulePreview key={block.id} block={block} last={index === nextBlocks.length - 1} />)}
        </Panel> : <Panel><Text style={{ color: colors.green, fontWeight: '700' }}>Today's plan is complete.</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Great work. Protect your recovery time.</Text></Panel>}
      </View>

      <View style={{ gap: 13 }}>
        <SectionHeader title="Training activity" subtitle="Saved on this device" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Panel style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>SESSIONS DONE</Text><Text style={{ color: colors.text, fontSize: 25, fontWeight: '900' }}>{training.sessions}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>All time</Text></Panel>
          <Panel style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>TIME TRAINED</Text><Text style={{ color: colors.text, fontSize: 25, fontWeight: '900' }}>{fmtMinutes(training.minutes)}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>All time</Text></Panel>
        </View>
        <Panel style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Recent sessions</Text><Target size={16} color={colors.purple} /></View>
          {sessions.length ? sessions.map((session) => <View key={session.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{session.title}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{session.category}</Text></View><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{fmtMinutes(session.durationMinutes)}</Text></View>) : <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Complete a training block to start building your activity history.</Text>}
          <Pressable onPress={() => router.navigate('/(tabs)/analytics' as never)} style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 3 }}><Text style={{ color: colors.purple, fontWeight: '800', fontSize: 11 }}>OPEN ANALYTICS</Text><ArrowRight size={13} color={colors.purple} /></Pressable>
        </Panel>
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, textAlign: 'center' }}>DOTA PRO LAB · PHASE 1 FOUNDATION</Text>
    </Screen>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Panel style={{ flex: 1, padding: 12, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }}>{label}</Text>{icon}</View><Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{value}</Text><Text style={{ color: colors.muted, fontSize: 9, lineHeight: 13 }}>{detail}</Text></Panel>;
}

function SchedulePreview({ block, last }: { block: ScheduleBlock; last: boolean }) {
  const date = new Date(block.scheduledAt);
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, gap: 12 }}>
    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, backgroundColor: block.category === 'Break' ? colors.green : colors.purple }} />
    <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{block.title}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{block.category}</Text></View>
    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
  </View>;
}
