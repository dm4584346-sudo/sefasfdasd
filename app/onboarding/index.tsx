import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useAppRouter } from '@/navigation/hooks';
import { useDatabase } from '@/db/DatabaseProvider';
import { ArrowRight, Crosshair, ShieldCheck, Swords } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { addHero, ensureDefaultSchedule, ensureStarterData, saveProfile, saveSetting } from '@/db/repository';
import { Chip, Eyebrow, Field, Panel, PrimaryButton, Screen, SectionHeader } from '@/components/ui';
import { ROLES, type Role } from '@/types';

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useAppRouter();
  const [nickname, setNickname] = useState('');
  const [mmr, setMmr] = useState('');
  const [targetMmr, setTargetMmr] = useState('4000');
  const [primaryRole, setPrimaryRole] = useState<Role>('Offlane');
  const [secondaryRole, setSecondaryRole] = useState<Role>('Soft Support');
  const [extraRole, setExtraRole] = useState<Role>('Hard Support');
  const [minutes, setMinutes] = useState('360');
  const [heroOne, setHeroOne] = useState('Chaos Knight');
  const [heroTwo, setHeroTwo] = useState('Skywrath Mage');
  const [saving, setSaving] = useState(false);

  const availableSecondary = useMemo(() => ROLES.filter((role) => role !== primaryRole), [primaryRole]);
  const availableExtra = useMemo(() => ROLES.filter((role) => role !== primaryRole && role !== secondaryRole), [primaryRole, secondaryRole]);

  const complete = async () => {
    const current = Number(mmr);
    const target = Number(targetMmr);
    const daily = Number(minutes);
    if (!nickname.trim()) return Alert.alert('Nickname required', 'Enter your in-game nickname to create your player profile.');
    if (!Number.isInteger(current) || current < 0 || current > 20000) return Alert.alert('Check current MMR', 'Enter a valid MMR value.');
    if (!Number.isInteger(target) || target < 1 || target > 20000) return Alert.alert('Check target MMR', 'Enter a valid target MMR.');
    if (!Number.isInteger(daily) || daily < 15 || daily > 720) return Alert.alert('Check training time', 'Choose between 15 and 720 minutes per day.');
    setSaving(true);
    try {
      await saveProfile(db, { nickname: nickname.trim(), currentMmr: current, targetMmr: target, primaryRole, secondaryRole, extraRole, dailyTrainingMinutes: daily });
      await ensureStarterData(db);
      if (heroOne.trim() && heroOne.trim() !== 'Chaos Knight') await addHero(db, heroOne.trim(), primaryRole);
      if (heroTwo.trim() && heroTwo.trim() !== 'Skywrath Mage') await addHero(db, heroTwo.trim(), secondaryRole);
      await ensureDefaultSchedule(db);
      await saveSetting(db, 'onboarding_completed', 'true');
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingTop: 20, paddingBottom: 48 }}>
        <View style={{ gap: 10, marginBottom: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#463477' }}>
            <Crosshair size={25} color={colors.purple} />
          </View>
          <Eyebrow color={colors.purple}>PERSONAL ESPORTS TRAINING ACADEMY</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -1.1 }}>Build your edge.</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>Set up your player profile. Your training plan and progress will be saved on this device.</Text>
        </View>

        <Panel>
          <SectionHeader title="Player identity" subtitle="Your starting point" />
          <Field label="IN-GAME NICKNAME" value={nickname} onChangeText={setNickname} placeholder="e.g. YourDotaID" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="CURRENT MMR" value={mmr} onChangeText={setMmr} placeholder="Enter MMR" keyboardType="number-pad" style={{ flex: 1 }} />
            <Field label="TARGET MMR" value={targetMmr} onChangeText={setTargetMmr} placeholder="4000" keyboardType="number-pad" style={{ flex: 1 }} />
          </View>
        </Panel>

        <Panel>
          <SectionHeader title="Your positions" subtitle="Set your role priorities" />
          <RoleSelector title="PRIMARY POSITION" value={primaryRole} options={ROLES} onSelect={(role) => { setPrimaryRole(role); if (role === secondaryRole) setSecondaryRole(ROLES.find((r) => r !== role)!); if (role === extraRole) setExtraRole(ROLES.find((r) => r !== role && r !== secondaryRole)!); }} />
          <RoleSelector title="SECONDARY POSITION" value={secondaryRole} options={availableSecondary} onSelect={(role) => { setSecondaryRole(role); if (role === extraRole) setExtraRole(ROLES.find((r) => r !== primaryRole && r !== role)!); }} />
          <RoleSelector title="ADDITIONAL POSITION" value={extraRole} options={availableExtra} onSelect={setExtraRole} />
        </Panel>

        <Panel>
          <SectionHeader title="Training focus" subtitle="A sustainable routine beats random volume" />
          <Field label="DAILY TRAINING TIME (MINUTES)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" hint="Default: 360 minutes of planned activity. The schedule includes breaks." />
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>STARTER HERO POOL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Swords size={18} color={colors.purple} /><View style={{ flex: 1 }}><Field label="OFFLANE HERO" value={heroOne} onChangeText={setHeroOne} placeholder="Chaos Knight" /></View></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><ShieldCheck size={18} color={colors.purple} /><View style={{ flex: 1 }}><Field label="SUPPORT HERO" value={heroTwo} onChangeText={setHeroTwo} placeholder="Skywrath Mage" /></View></View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Hero statistics start blank. No match data is fabricated.</Text>
          </View>
        </Panel>

        <PrimaryButton title={saving ? 'Creating profile…' : 'Create player profile'} disabled={saving} onPress={complete} icon={<ArrowRight size={17} color="#100D18" />} />
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>Your profile, training schedule and progress are stored locally on this device.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function RoleSelector({ title, value, options, onSelect }: { title: string; value: Role; options: Role[]; onSelect: (role: Role) => void }) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {options.map((role) => <Chip key={role} label={role} selected={value === role} onPress={() => onSelect(role)} compact />)}
      </View>
    </View>
  );
}
