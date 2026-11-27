import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@/db/DatabaseProvider';
import { Plus, Shield, Swords, Trash2, UserRound } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { addHero, deleteHero, getHeroes, getProfile, saveProfile } from '@/db/repository';
import type { Hero, Role, UserProfile } from '@/types';
import { Chip, EmptyState, Eyebrow, Field, Heading, LoadingState, Panel, PrimaryButton, Screen, SectionHeader } from '@/components/ui';

const ROLES: Role[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

export default function ProfileScreen() {
  const db = useDatabase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [nickname, setNickname] = useState('');
  const [mmr, setMmr] = useState('');
  const [target, setTarget] = useState('4000');
  const [primary, setPrimary] = useState<Role>('Offlane');
  const [secondary, setSecondary] = useState<Role>('Soft Support');
  const [extra, setExtra] = useState<Role>('Hard Support');
  const [minutes, setMinutes] = useState('360');
  const [heroName, setHeroName] = useState('');
  const [heroPosition, setHeroPosition] = useState<Role>('Offlane');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const p = await getProfile(db);
    const list = await getHeroes(db);
    setProfile(p); setHeroes(list);
    if (p) { setNickname(p.nickname); setMmr(String(p.currentMmr)); setTarget(String(p.targetMmr)); setPrimary(p.primaryRole); setSecondary(p.secondaryRole); setExtra(p.extraRole); setMinutes(String(p.dailyTrainingMinutes)); }
  }, [db]);

  useFocusEffect(useCallback(() => { load().catch((error) => Alert.alert('Profile unavailable', String(error))); }, [load]));

  const store = async () => {
    if (!profile) return;
    const current = Number(mmr); const goal = Number(target); const daily = Number(minutes);
    if (!nickname.trim()) return Alert.alert('Nickname required', 'Enter your player nickname.');
    if (![current, goal, daily].every(Number.isInteger) || current < 0 || current > 20000 || goal < 1 || goal > 20000 || daily < 15 || daily > 720) return Alert.alert('Check your values', 'MMR and training time must be valid whole numbers.');
    setSaving(true);
    try {
      await saveProfile(db, { nickname: nickname.trim(), currentMmr: current, targetMmr: goal, primaryRole: primary, secondaryRole: secondary, extraRole: extra, dailyTrainingMinutes: daily });
      const latest = await getProfile(db); setProfile(latest);
      Alert.alert('Profile saved', 'Your player profile has been updated locally.');
    } catch (error) { Alert.alert('Could not save profile', String(error)); }
    finally { setSaving(false); }
  };

  const createHero = async () => {
    if (!heroName.trim()) return Alert.alert('Hero name required', 'Enter a hero name.');
    try { await addHero(db, heroName, heroPosition); setHeroName(''); setHeroes(await getHeroes(db)); }
    catch (error) { Alert.alert('Could not add hero', String(error)); }
  };

  const removeHero = (hero: Hero) => Alert.alert('Remove hero?', `Remove ${hero.name} from your hero pool?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await deleteHero(db, hero.id); setHeroes(await getHeroes(db)); } },
  ]);

  if (!profile) return <Screen><LoadingState /></Screen>;

  return (
    <Screen>
      <View style={{ gap: 7 }}>
        <Eyebrow color={colors.purple}>PLAYER IDENTITY / SETTINGS</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}><View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: '#49377A', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 22 }}>{profile.nickname.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 3 }}><Heading>{profile.nickname}</Heading><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Player profile · local device</Text></View><UserRound size={18} color={colors.textSecondary} /></View>
      </View>

      <Panel>
        <SectionHeader title="Player details" subtitle="Update your MMR and training goals" />
        <Field label="IN-GAME NICKNAME" value={nickname} onChangeText={setNickname} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 10 }}><Field label="CURRENT MMR" value={mmr} onChangeText={setMmr} keyboardType="number-pad" style={{ flex: 1 }} /><Field label="TARGET MMR" value={target} onChangeText={setTarget} keyboardType="number-pad" style={{ flex: 1 }} /></View>
        <Field label="DAILY TRAINING TIME (MIN)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" hint="Planned daily training time. Rest breaks are scheduled separately." />
      </Panel>

      <Panel>
        <SectionHeader title="Position setup" subtitle="Your preferred roles" />
        <RolePicker label="PRIMARY POSITION" value={primary} options={ROLES} onSelect={(value) => { setPrimary(value); if (secondary === value) setSecondary(ROLES.find((role) => role !== value)!); if (extra === value) setExtra(ROLES.find((role) => role !== value && role !== secondary)!); }} />
        <RolePicker label="SECONDARY POSITION" value={secondary} options={ROLES.filter((role) => role !== primary)} onSelect={(value) => { setSecondary(value); if (extra === value) setExtra(ROLES.find((role) => role !== primary && role !== value)!); }} />
        <RolePicker label="ADDITIONAL POSITION" value={extra} options={ROLES.filter((role) => role !== primary && role !== secondary)} onSelect={setExtra} />
        <PrimaryButton title={saving ? 'Saving…' : 'Save profile'} onPress={store} disabled={saving} />
      </Panel>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Hero pool" subtitle={`${heroes.length} heroes · statistics are not invented`} />
        {heroes.length ? ROLES.map((role) => {
          const roleHeroes = heroes.filter((hero) => hero.position === role);
          if (!roleHeroes.length) return null;
          return <View key={role} style={{ gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{role.toUpperCase()}</Text>
            {roleHeroes.map((hero) => <HeroCard key={hero.id} hero={hero} onRemove={() => removeHero(hero)} />)}
          </View>;
        }) : <EmptyState title="Your hero pool is empty" description="Add heroes you actively practice on." />}
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Plus size={17} color={colors.purple} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Add a hero</Text></View>
          <Field label="HERO NAME" value={heroName} onChangeText={setHeroName} placeholder="e.g. Mars" />
          <View style={{ gap: 8 }}><Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800' }}>PLAYED POSITION</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{ROLES.map((role) => <Chip key={role} label={role} compact selected={heroPosition === role} onPress={() => setHeroPosition(role)} />)}</View></View>
          <PrimaryButton title="Add to hero pool" onPress={createHero} />
        </Panel>
      </View>

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Shield size={17} color={colors.green} /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Your data stays on this device</Text></View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>Profile, hero pool, schedule and training sessions are stored in the app's local SQLite database. Phase 1 does not require an account or backend.</Text>
      </Panel>
    </Screen>
  );
}

function RolePicker({ label, value, options, onSelect }: { label: string; value: Role; options: Role[]; onSelect: (role: Role) => void }) {
  return <View style={{ gap: 8 }}><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{options.map((role) => <Chip key={role} label={role} compact selected={value === role} onPress={() => onSelect(role)} />)}</View></View>;
}

function HeroCard({ hero, onRemove }: { hero: Hero; onRemove: () => void }) {
  return <Panel style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' }}><Swords size={19} color={colors.purple} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{hero.name}</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>{hero.position}</Text></View>
      <Pressable onPress={onRemove} hitSlop={8}><Trash2 size={16} color={colors.muted} /></Pressable>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <HeroStat label="MATCHES" value={hero.matches === null ? '—' : String(hero.matches)} />
      <HeroStat label="WINRATE" value={hero.winrate === null ? '—' : `${hero.winrate.toFixed(1)}%`} />
      <HeroStat label="MASTERY" value={hero.mastery === null ? '—' : `Level ${hero.mastery}`} />
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>STRENGTHS</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>{hero.strengths || 'Not assessed yet'}</Text></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.red, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>WEAKNESSES</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>{hero.weaknesses || 'Not assessed yet'}</Text></View>
    </View>
  </Panel>;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 9, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 8, fontWeight: '800' }}>{label}</Text><Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{value}</Text></View>;
}
