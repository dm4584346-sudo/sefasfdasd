import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@/db/DatabaseProvider';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Database, ExternalLink, ShieldAlert, Swords, Target } from 'lucide-react-native';
import { Chip, EmptyState, Eyebrow, Field, Heading, LoadingState, Panel, PrimaryButton, Screen, SectionHeader, SecondaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { clearTodayAsRestDay, getProfile, saveProfile, saveSetting, setTodayAsRestDay } from '@/db/repository';
import type { UserProfile, Role } from '@/types';
import { fetchGameConstants, fetchMatchDetail, fetchPlayerBundle, normalizeSteamInput, OpenDotaError, searchPlayers, type OpenDotaHero, type OpenDotaPlayerHero, type OpenDotaProfile, type OpenDotaSearchResult } from '@/features/opendota/client';
import { getCachedProfile, getGameDataUpdatedAt, getHeroCatalog, getHeroNameMap, getItemNameMap, getLinkedAccount, getMmrEntries, getPlayerHeroHistory, getStoredMatch, getStoredMatches, recordMmrEntry, saveDetailedMatch, saveGameData, savePlayerBundle, addManualMatch, type MmrRecord, type StoredMatch } from '@/features/opendota/storage';
import { getHeroPerformances, getMatchTrend, getPerformanceSummary, getRolePerformances, type HeroPerformance, type PeriodKey, type PerformanceSummary, type RolePerformance } from '@/features/performance/analysis';
import { buildPersonalRecommendations, getPracticeCoverage, scheduleRecommendation } from '@/features/performance/recommendations';
import { PATCH_REFERENCE } from '@/features/game-data/catalog';

const ROLE_OPTIONS: Role[] = ['Offlane', 'Soft Support', 'Hard Support'];
const numberOrNull = (raw: string) => raw.trim() === '' ? null : Number(raw);
const fmt = (n: number | null | undefined, digits = 0) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);
const fmtDate = (epoch: number) => new Date(epoch * 1000).toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });
const fmtDuration = (seconds: number) => `${Math.floor(seconds / 60)}m`;
const localDayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export default function ProAnalyticsScreen() {
  const db = useDatabase();
  const [input, setInput] = useState('');
  const [linked, setLinked] = useState<{ accountId: number; steamId64: string | null; personaName: string | null; profileUrl: string | null; syncedAt: string | null } | null>(null);
  const [profileData, setProfileData] = useState<OpenDotaProfile | null>(null);
  const [searchRows, setSearchRows] = useState<OpenDotaSearchResult[]>([]);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [selected, setSelected] = useState<StoredMatch | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [heroes, setHeroes] = useState<HeroPerformance[]>([]);
  const [roles, setRoles] = useState<RolePerformance[]>([]);
  const [trend, setTrend] = useState<{ label: string; matches: number; winrate: number; avgGpm: number | null; avgXpm: number | null }[]>([]);
  const [mmrRows, setMmrRows] = useState<MmrRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Awaited<ReturnType<typeof buildPersonalRecommendations>>>([]);
  const [coverage, setCoverage] = useState({ situations: 0, items: 0, drafts: 0, reviews: 0, notes: 0 });
  const [fatigue, setFatigue] = useState<'fresh'|'normal'|'tired'|'rest'>('normal');
  const [heroNames, setHeroNames] = useState<Map<number, string>>(new Map());
  const [itemNames, setItemNames] = useState<Map<number, string>>(new Map());
  const [heroCatalog, setHeroCatalog] = useState<OpenDotaHero[]>([]);
  const [playerHeroHistory, setPlayerHeroHistory] = useState<OpenDotaPlayerHero[]>([]);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [appProfile, setAppProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [gameDataBusy, setGameDataBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mmrInput, setMmrInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [manualHero, setManualHero] = useState('Chaos Knight');
  const [manualRole, setManualRole] = useState<Role>('Offlane');
  const [manualResult, setManualResult] = useState<'win' | 'loss'>('win');
  const [mmrDelta, setMmrDelta] = useState('');

  const reloadLocal = useCallback(async (nextPeriod: PeriodKey = period) => {
    const [link, storedMatches, mmr, p, cachedProfile, names, itemMap, heroDataCache, playerHeroData, updated, summaryData, heroData, roleData, trendData, recs, moduleCoverage, fatigueSetting, fatigueDateSetting] = await Promise.all([
      getLinkedAccount(db), getStoredMatches(db, 30), getMmrEntries(db), getProfile(db), getCachedProfile(db),
      getHeroNameMap(db), getItemNameMap(db), getHeroCatalog(db), getPlayerHeroHistory(db), getGameDataUpdatedAt(db), getPerformanceSummary(db, nextPeriod),
      getHeroPerformances(db, nextPeriod), getRolePerformances(db, nextPeriod), getMatchTrend(db, nextPeriod), buildPersonalRecommendations(db), getPracticeCoverage(db), db.getFirstAsync<{value:string}>('SELECT value FROM Settings WHERE key=?','fatigue_level'), db.getFirstAsync<{value:string}>('SELECT value FROM Settings WHERE key=?','fatigue_date'),
    ]);
    setLinked(link); setMatches(storedMatches); setMmrRows(mmr); setAppProfile(p); setProfileData(cachedProfile as OpenDotaProfile | null);
    setHeroNames(names); setItemNames(itemMap); setHeroCatalog(heroDataCache); setPlayerHeroHistory(playerHeroData); setDataUpdatedAt(updated); setSummary(summaryData); setHeroes(heroData); setRoles(roleData); setTrend(trendData); setRecommendations(recs); setCoverage(moduleCoverage); const fatigueToday = fatigueDateSetting?.value === localDayKey(); setFatigue(fatigueToday && (fatigueSetting?.value === 'fresh' || fatigueSetting?.value === 'tired' || fatigueSetting?.value === 'rest') ? fatigueSetting.value : 'normal');
    setMmrInput(p ? String(p.currentMmr) : ''); setTargetInput(p ? String(p.targetMmr) : '');
    if (link) {
      const [currentSummary, currentHeroes, currentRoles, currentTrend] = await Promise.all([
        getPerformanceSummary(db, nextPeriod, link.accountId), getHeroPerformances(db, nextPeriod, link.accountId),
        getRolePerformances(db, nextPeriod, link.accountId), getMatchTrend(db, nextPeriod, link.accountId),
      ]);
      setSummary(currentSummary); setHeroes(currentHeroes); setRoles(currentRoles); setTrend(currentTrend);
    } else { setSummary({ matches: 0, wins: 0, winrate: null, avgGpm: null, avgXpm: null, avgDeaths: null, avgKda: null, avgLastHitsPerMinute: null, hasSmallSample: false }); setHeroes([]); setRoles([]); setTrend([]); }
    setSelected((current) => current ? storedMatches.find((m) => m.match_id === current.match_id) ?? null : null);
  }, [db, period]);

  useFocusEffect(useCallback(() => {
    let active = true;
    reloadLocal().catch((e) => setError(String(e))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadLocal]));

  const syncAccount = async (accountId: number, steamId64?: string) => {
    setBusy(true); setError(''); setSearchRows([]);
    try {
      const bundle = await fetchPlayerBundle(accountId);
      let names = await getHeroNameMap(db);
      if (names.size === 0) {
        try {
          const constants = await fetchGameConstants();
          await saveGameData(db, constants.heroes, constants.items, constants.abilities);
          names = new Map(constants.heroes.map((hero) => [hero.id, hero.localized_name]));
        } catch { /* Stats import remains usable when constants are unavailable. */ }
      }
      await savePlayerBundle(db, bundle.profile, bundle.matches, bundle.heroes, names, steamId64);
      setInput(String(accountId));
      await reloadLocal(period);
      Alert.alert('OpenDota connected', `${bundle.profile.profile?.personaname ?? `Account ${accountId}`} · ${bundle.matches.length} match records imported.`);
    } catch (e) {
      const message = e instanceof OpenDotaError ? e.message : String(e);
      setError(message);
      Alert.alert('Could not connect profile', message);
    } finally { setBusy(false); }
  };

  const connect = async () => {
    setError(''); setSearchRows([]);
    try {
      const normalized = normalizeSteamInput(input);
      if (normalized.kind === 'account') await syncAccount(normalized.accountId, normalized.steamId64);
      else {
        setBusy(true);
        const found = await searchPlayers(normalized.query);
        setSearchRows(found);
        if (!found.length) setError('No public player profiles found for this name. Try a 32-bit account ID or Steam profile URL.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const refresh = async () => {
    if (!linked) return;
    await syncAccount(linked.accountId, linked.steamId64 ?? undefined);
  };

  const refreshGameData = async () => {
    setGameDataBusy(true); setError('');
    try {
      const constants = await fetchGameConstants();
      await saveGameData(db, constants.heroes, constants.items, constants.abilities);
      await reloadLocal(period);
      Alert.alert('Game data updated', `${constants.heroes.length} heroes, ${Object.keys(constants.items).length} item constants and ${Object.keys(constants.abilities).length} hero ability entries cached locally.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      Alert.alert('Game data unavailable', message);
    } finally { setGameDataBusy(false); }
  };

  const loadDetails = async (match: StoredMatch) => {
    setSelected(match);
    if (!linked || match.parsed_detail) return;
    setDetailBusy(true); setError('');
    try {
      const detail = await fetchMatchDetail(match.match_id);
      await saveDetailedMatch(db, linked.accountId, detail, heroNames, match.player_slot);
      await reloadLocal(period);
      setSelected(await getStoredMatch(db, match.match_id));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally { setDetailBusy(false); }
  };

  const saveMmr = async () => {
    const value = numberOrNull(mmrInput);
    const target = numberOrNull(targetInput);
    if (value === null || !Number.isInteger(value) || value < 0 || value > 20000) return Alert.alert('Invalid MMR', 'Enter a whole-number MMR between 0 and 20,000.');
    if (target === null || !Number.isInteger(target) || target < 0 || target > 20000) return Alert.alert('Invalid target', 'Enter a whole-number target MMR between 0 and 20,000.');
    try {
      const p = await getProfile(db);
      if (!p) throw new Error('Player profile is missing.');
      await saveProfile(db, { nickname: p.nickname, currentMmr: value, targetMmr: target, primaryRole: p.primaryRole, secondaryRole: p.secondaryRole, extraRole: p.extraRole, dailyTrainingMinutes: p.dailyTrainingMinutes });
      await recordMmrEntry(db, { mmr: value, result: 'manual', source: 'manual-entry', note: 'Manually entered by the player.' });
      await reloadLocal(period);
      Alert.alert('MMR updated', 'Saved as a player-entered rating. OpenDota does not provide a guaranteed official live MMR value.');
    } catch (e) { Alert.alert('Could not save MMR', String(e)); }
  };

  const saveManualMatch = async () => {
    const delta = numberOrNull(mmrDelta);
    if (delta !== null && (!Number.isInteger(delta) || Math.abs(delta) > 1000)) return Alert.alert('Invalid MMR change', 'Enter a whole number between -1000 and 1000, or leave it blank.');
    try {
      await addManualMatch(db, { hero: manualHero.trim() || 'Unspecified hero', role: manualRole, result: manualResult, mmrChange: delta, note: 'Manually entered match result. No automatic MMR value was assumed.' });
      setMmrDelta(''); await reloadLocal(period);
      Alert.alert('Match saved', delta === null ? 'Match result was saved. MMR was not changed because no rating delta was entered.' : 'Match result and manually entered MMR delta were saved.');
    } catch (e) { Alert.alert('Could not save match', String(e)); }
  };

  const updateFatigue = async (next: 'fresh'|'normal'|'tired'|'rest') => {
    setFatigue(next);
    try {
      await saveSetting(db, 'fatigue_level', next);
      await saveSetting(db, 'fatigue_date', localDayKey());
      if (next === 'rest') await setTodayAsRestDay(db);
      else await clearTodayAsRestDay(db);
    } catch (e) { Alert.alert('Could not update schedule', String(e)); }
  };

  const addToSchedule = async (recommendation: (typeof recommendations)[number]) => {
    try {
      if (fatigue === 'rest') throw new Error('You marked today as a recovery day. Recommendations are not added to the schedule.');
      await scheduleRecommendation(db, recommendation, fatigue === 'tired' ? 'tired' : fatigue === 'fresh' ? 'fresh' : 'normal');
      Alert.alert('Added to schedule', `${recommendation.title} was added to today’s plan.`);
    }
    catch (e) { Alert.alert('Schedule unchanged', String(e)); }
  };

  if (loading) return <Screen><LoadingState /></Screen>;
  const mmrTrendValues = mmrRows.slice().reverse().map((r) => r.mmr);
  const displayedProfileName = profileData?.profile?.personaname ?? linked?.personaName ?? 'Linked player';
  const matchStats = summary?.matches ?? 0;
  const heroRows = [...heroes];
  for (const playerHero of playerHeroHistory) {
    const name = heroNames.get(playerHero.hero_id) ?? `Hero #${playerHero.hero_id}`;
    if (!heroRows.some((hero) => hero.hero_name.toLowerCase() === name.toLowerCase())) heroRows.push({ hero_name: name, matches: 0, wins: 0, winrate: 0, avg_kda: 0, avg_gpm: 0, avg_xpm: 0, avg_deaths: 0 });
  }
  for (const name of ['Chaos Knight', 'Skywrath Mage']) {
    if (!heroRows.some((hero) => hero.hero_name.toLowerCase() === name.toLowerCase())) heroRows.push({ hero_name: name, matches: 0, wins: 0, winrate: 0, avg_kda: 0, avg_gpm: 0, avg_xpm: 0, avg_deaths: 0 });
  }

  return (
    <Screen>
      <View style={{ gap: 5 }}>
        <Eyebrow color={colors.purple}>PHASE 3 / PRO ANALYTICS</Eyebrow>
        <Heading>Pro Analytics</Heading>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Match data, performance trends and personal development signals. Imported data is cached locally.</Text>
      </View>

      <Panel style={{ borderColor: '#49377A', backgroundColor: '#15121E', gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Swords size={17} color={colors.purple} /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>OpenDota connection</Text></View>
          {linked ? <Chip label="CONNECTED" selected compact /> : <Chip label="NOT CONNECTED" compact />}
        </View>
        {linked ? <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{displayedProfileName}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Account ID: {linked.accountId} · SteamID64: {linked.steamId64 ?? 'not exposed'}</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>Last sync: {linked.syncedAt ? new Date(linked.syncedAt).toLocaleString() : 'not yet synced'}</Text>
          {profileData?.mmr_estimate?.estimate ? <Text style={{ color: colors.yellow, fontSize: 11 }}>OpenDota estimated rating: {Math.round(profileData.mmr_estimate.estimate).toLocaleString()} · model estimate, not official Steam MMR</Text> : null}
        </View> : <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>Enter a Steam account ID, SteamID64, or public Steam profile URL/name. Private or untracked profiles may return no match data.</Text>}
        <Field label="STEAM ID / PROFILE URL / VANITY NAME" value={input} onChangeText={setInput} placeholder="7656119… or steamcommunity.com/id/name" autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PrimaryButton title={busy ? 'Connecting…' : 'Find / Connect'} onPress={connect} disabled={busy || !input.trim()} style={{ flex: 1 }} />
          {linked ? <SecondaryButton title={busy ? '…' : 'Refresh'} onPress={refresh} disabled={busy} style={{ minWidth: 92, justifyContent: 'center' }} /> : null}
        </View>
        {searchRows.length ? <View style={{ gap: 7 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>PICK THE CORRECT PUBLIC PROFILE</Text>
          {searchRows.map((row) => <Pressable key={row.account_id} disabled={busy} onPress={() => syncAccount(row.account_id)} style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{row.personaname || `Account ${row.account_id}`}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Account ID {row.account_id} · tap to connect</Text>
          </Pressable>)}
        </View> : null}
        {error ? <View style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}><ShieldAlert color={colors.red} size={15} /><Text style={{ flex: 1, color: colors.red, fontSize: 11, lineHeight: 16 }}>{error}</Text></View> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 9 }}>OpenDota · public API · no key required</Text>
          <Pressable onPress={() => Linking.openURL('https://docs.opendota.com/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: colors.purple, fontSize: 10, fontWeight: '800' }}>API DOCS</Text><ExternalLink color={colors.purple} size={12} /></Pressable>
        </View>
      </Panel>

      <Panel style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Database size={16} color={colors.purple} /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Game data / patch reference</Text></View>
          <Chip label={`PATCH ${PATCH_REFERENCE.label}`} compact />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>Hero and item constants can be refreshed from OpenDota and stored for offline lookup. Valve reference patch: {PATCH_REFERENCE.label}, released {PATCH_REFERENCE.releasedOn}. This label is verified for this app build, not automatically detected by OpenDota.</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>Last constants sync: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : 'not synced yet'}</Text>
        <PrimaryButton title={gameDataBusy ? 'Updating…' : 'Update heroes & items'} onPress={refreshGameData} disabled={gameDataBusy} />
        <Pressable onPress={() => Linking.openURL(PATCH_REFERENCE.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={{ color: colors.purple, fontSize: 10, fontWeight: '800' }}>OPEN VALVE PATCH NOTES</Text><ExternalLink size={12} color={colors.purple} /></Pressable>
      </Panel>

      <View style={{ gap: 9 }}>
        <SectionHeader title="Performance snapshot" subtitle="Calculated only from imported match records" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Metric label="MATCHES" value={String(matchStats)} detail={period === '7d' ? 'last 7 days' : period === '30d' ? 'last 30 days' : 'all imported'} />
          <Metric label="WINRATE" value={summary?.winrate == null ? '—' : `${fmt(summary.winrate, 1)}%`} detail={summary ? `${summary.wins} wins` : 'no data'} />
          <Metric label="AVG GPM" value={fmt(summary?.avgGpm)} detail="per match" />
          <Metric label="AVG XPM" value={fmt(summary?.avgXpm)} detail="per match" />
          <Metric label="AVG DEATHS" value={fmt(summary?.avgDeaths, 1)} detail="context matters" />
          <Metric label="AVG KDA" value={fmt(summary?.avgKda, 2)} detail="not a solo skill score" />
          <Metric label="LAST HITS / MIN" value={fmt(summary?.avgLastHitsPerMinute, 1)} detail="farm pace, role-dependent" />
        </View>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <Chip label="7 DAYS" compact selected={period === '7d'} onPress={() => { setPeriod('7d'); reloadLocal('7d'); }} />
          <Chip label="30 DAYS" compact selected={period === '30d'} onPress={() => { setPeriod('30d'); reloadLocal('30d'); }} />
          <Chip label="ALL TIME" compact selected={period === 'all'} onPress={() => { setPeriod('all'); reloadLocal('all'); }} />
        </View>
        {summary?.hasSmallSample ? <Text style={{ color: colors.yellow, fontSize: 10 }}>Small sample: {summary.matches} matches. Treat these averages as descriptive, not stable conclusions.</Text> : null}
        {summary?.matches === 0 ? <EmptyState title="No imported matches for this period" description="Connect a public profile and refresh its match history. No sample data is inserted." /> : null}
        {trend.length > 1 ? <Panel style={{ gap: 7 }}><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>WINRATE TREND BY {period === 'all' ? 'WEEK' : 'DAY'}</Text><Sparkline values={trend.map((point) => point.winrate)} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontSize: 9 }}>{trend[0]?.label}</Text><Text style={{ color: colors.muted, fontSize: 9 }}>{trend[trend.length - 1]?.label}</Text></View><Text style={{ color: colors.textSecondary, fontSize: 9 }}>First → latest bucket: GPM {fmt(trend[0]?.avgGpm)} → {fmt(trend[trend.length - 1]?.avgGpm)} · XPM {fmt(trend[0]?.avgXpm)} → {fmt(trend[trend.length - 1]?.avgXpm)}</Text></Panel> : null}
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Replay Analyzer / Match history" subtitle="Basic stats are imported first; full player details load per selected match" />
        {matches.length ? matches.slice(0, 15).map((match) => <Pressable key={match.match_id} disabled={detailBusy} onPress={() => loadDetails(match)} style={{ borderRadius: 14, borderWidth: 1, borderColor: selected?.match_id === match.match_id ? '#5A428F' : colors.border, backgroundColor: selected?.match_id === match.match_id ? '#191426' : colors.surface, padding: 12, gap: 7 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 2, flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>{match.hero_name}</Text><Text style={{ color: colors.muted, fontSize: 9 }}>{fmtDate(match.start_time)} · {fmtDuration(match.duration)} · {match.role_estimate ?? 'Role unknown'}</Text></View>
            <Text style={{ color: match.win ? colors.green : colors.red, fontWeight: '900', fontSize: 11 }}>{match.win ? 'WIN' : 'LOSS'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>K/D/A {match.kills ?? '—'}/{match.deaths ?? '—'}/{match.assists ?? '—'} · GPM {match.gold_per_min ?? '—'} · XPM {match.xp_per_min ?? '—'}</Text>
            <Text style={{ color: colors.purple, fontWeight: '800', fontSize: 9 }}>{match.parsed_detail ? 'DETAIL LOADED' : 'LOAD DETAIL'}</Text>
          </View>
        </Pressable>) : <EmptyState title="No match history" description="OpenDota only returns public and available match records. If your profile is private, no match data may be available." />}
        {detailBusy ? <LoadingState /> : null}
        {selected ? <MatchDetailPanel match={selected} itemNames={itemNames} /> : null}
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Hero Mastery" subtitle="Recorded OpenDota hero history + selected imported match window" />
        {heroRows.length ? heroRows.sort((a,b) => {
          const aId = [...heroNames.entries()].find(([,name]) => name.toLowerCase() === a.hero_name.toLowerCase())?.[0];
          const bId = [...heroNames.entries()].find(([,name]) => name.toLowerCase() === b.hero_name.toLowerCase())?.[0];
          const aGames = playerHeroHistory.find((row) => row.hero_id === aId)?.games ?? a.matches;
          const bGames = playerHeroHistory.find((row) => row.hero_id === bId)?.games ?? b.matches;
          return bGames - aGames;
        }).map((hero) => {
          const heroId = [...heroNames.entries()].find(([,name]) => name.toLowerCase() === hero.hero_name.toLowerCase())?.[0];
          const history = playerHeroHistory.find((row) => row.hero_id === heroId);
          const recordedMatches = history?.games ?? null;
          const recordedWinrate = history && history.games > 0 ? history.win / history.games * 100 : null;
          const visibleWinrate = recordedWinrate ?? (hero.matches > 0 ? hero.winrate : null);
          const sampleGames = hero.matches;
          return <Panel key={hero.hero_name} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{hero.hero_name}</Text><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 11 }}>{recordedMatches !== null ? `${recordedMatches} recorded` : sampleGames ? `${sampleGames} in sample` : 'No matches'}</Text></View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              <SmallValue label="WINRATE" value={visibleWinrate === null ? '—' : `${fmt(visibleWinrate, 1)}%`} /><SmallValue label={`AVG KDA · ${period.toUpperCase()} SAMPLE`} value={sampleGames ? fmt(hero.avg_kda, 2) : '—'} /><SmallValue label="GPM · SAMPLE" value={sampleGames ? fmt(hero.avg_gpm) : '—'} /><SmallValue label="XPM · SAMPLE" value={sampleGames ? fmt(hero.avg_xpm) : '—'} />
            </View>
            {history ? <Text style={{ color: colors.muted, fontSize: 9 }}>OpenDota recorded hero history: {history.win} wins from {history.games} recorded matches; private or untracked matches may be missing. KDA / GPM / XPM are calculated only from the imported match sample above.</Text> : null}
            <Text style={{ color: colors.muted, fontSize: 9 }}>{recordedMatches === null && sampleGames === 0 ? 'No imported player history. This is a hero-pool placeholder, not a zero performance result.' : (recordedMatches ?? sampleGames) < 10 ? 'Small sample; mastery tier not assessed yet.' : masteryBand(recordedMatches ?? sampleGames)} · Descriptive stats do not establish hero strength independently of role, draft and patch.</Text>
            {heroCatalog.find((item) => item.localized_name.toLowerCase() === hero.hero_name.toLowerCase()) ? <Text style={{ color: colors.muted, fontSize: 9 }}>Hero constants: {(() => { const meta = heroCatalog.find((item) => item.localized_name.toLowerCase() === hero.hero_name.toLowerCase()); return [meta?.primary_attr, meta?.attack_type, ...(meta?.roles ?? [])].filter(Boolean).join(' · '); })()}</Text> : null}
            {sampleGames > 0 ? <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{hero.matches >= 10 && visibleWinrate !== null && visibleWinrate < 45 ? 'Review draft fit and game context before concluding the pick is a weakness.' : hero.matches >= 10 && visibleWinrate !== null && visibleWinrate >= 55 ? 'Positive personal sample; identify which draft and lane conditions made the pick work.' : 'Review lane outcomes and objective decisions as the sample grows.'}</Text> : null}
            <Text style={{ color: colors.purple, fontSize: 10, lineHeight: 16 }}>Practice focus: {heroPracticeSuggestion(hero.hero_name)}</Text>
          </Panel>;
        }) : <EmptyState title="Hero mastery awaits match data" description="Chaos Knight and Skywrath Mage remain in your Phase 1 hero pool. Their match-derived stats will appear after importing public matches." />}
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Position performance" subtitle="Position is estimated from player-slot order; verify role manually" />
        {roles.filter((role) => ['Offlane','Soft Support','Hard Support'].includes(role.role)).length ? roles.filter((role) => ['Offlane','Soft Support','Hard Support'].includes(role.role)).map((role) => <Panel key={role.role} style={{ gap: 6 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>{role.role}</Text><Text style={{ color: colors.purple, fontWeight: '800', fontSize: 11 }}>{role.matches} matches</Text></View><Text style={{ color: colors.textSecondary, fontSize: 10 }}>Winrate {fmt(role.winrate,1)}% · GPM {fmt(role.avg_gpm)} · XPM {fmt(role.avg_xpm)} · deaths {fmt(role.avg_deaths,1)}</Text></Panel>) : <EmptyState title="No role sample yet" description="Position-wise averages will appear when match records contain enough slot data." />}
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="MMR Tracker" subtitle="Player-entered rating history; not an official live Steam rating" />
        <Panel style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><View style={{ gap: 3 }}><Text style={{ color: colors.muted, fontSize: 9, fontWeight: '800' }}>CURRENT TRACKED MMR</Text><Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{(appProfile?.currentMmr ?? 0).toLocaleString()}</Text></View><Target size={22} color={colors.purple} /></View>
          <Field label="CURRENT MMR" value={mmrInput} onChangeText={setMmrInput} keyboardType="number-pad" />
          <Field label="TARGET MMR" value={targetInput} onChangeText={setTargetInput} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{[3000,3500,4000].map((goal) => <Chip key={goal} compact label={`${goal}`} selected={Number(targetInput) === goal} onPress={() => setTargetInput(String(goal))} />)}</View>
          <PrimaryButton title="Save rating & goal" onPress={saveMmr} />
          {mmrRows.length > 1 ? <MmrChart values={mmrTrendValues} /> : <Text style={{ color: colors.muted, fontSize: 10 }}>Add more manual MMR entries to build a trend chart.</Text>}
          {mmrRows.slice(0, 4).map((row) => <View key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.textSecondary, fontSize: 10 }}>{new Date(row.recorded_at).toLocaleDateString()} · {row.source}</Text><Text style={{ color: colors.text, fontWeight: '800', fontSize: 10 }}>{row.mmr.toLocaleString()} {row.delta != null ? `(${row.delta > 0 ? '+' : ''}${row.delta})` : ''}</Text></View>)}
        </Panel>
        <Panel style={{ gap: 9 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>Record a match result manually</Text>
          <Field label="HERO" value={manualHero} onChangeText={setManualHero} />
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>{ROLE_OPTIONS.map((role) => <Chip key={role} compact selected={manualRole === role} label={role} onPress={() => setManualRole(role)} />)}</View>
          <View style={{ flexDirection: 'row', gap: 7 }}><Chip label="WIN" compact selected={manualResult === 'win'} onPress={() => setManualResult('win')} /><Chip label="LOSS" compact selected={manualResult === 'loss'} onPress={() => setManualResult('loss')} /></View>
          <Field label="MMR CHANGE (OPTIONAL)" value={mmrDelta} onChangeText={setMmrDelta} keyboardType="numbers-and-punctuation" placeholder="e.g. +25 or -25; blank = no rating change" />
          <PrimaryButton title="Save match result" onPress={saveManualMatch} />
        </Panel>
      </View>

      <Panel style={{ gap: 9 }}>
        <SectionHeader title="Pro Schedule 2.0 · daily readiness" subtitle="You set your own fatigue level; the schedule never forces extra queue time" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Chip label="FRESH" compact selected={fatigue === 'fresh'} onPress={() => updateFatigue('fresh')} />
          <Chip label="NORMAL" compact selected={fatigue === 'normal'} onPress={() => updateFatigue('normal')} />
          <Chip label="TIRED · LIGHT PLAN" compact selected={fatigue === 'tired'} onPress={() => updateFatigue('tired')} />
          <Chip label="REST DAY" compact selected={fatigue === 'rest'} onPress={() => updateFatigue('rest')} />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 16 }}>{fatigue === 'rest' ? 'Recovery selected. Training recommendations remain visible but will not be scheduled.' : fatigue === 'tired' ? 'Recommended blocks are shortened to a light review session. You can also choose a full rest day.' : 'Recommendation blocks are checked against your existing daily training-time target before being added.'}</Text>
      </Panel>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Personal Coach Recommendations" subtitle="Generated from your actual training attempts and imported match sample" />
        <Panel style={{ gap: 5 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Evidence coverage</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>Situation answers: {coverage.situations} · Item Builder sessions: {coverage.items} · Draft sessions: {coverage.drafts} · Review queue: {coverage.reviews} · Coach notes: {coverage.notes}</Text><Text style={{ color: colors.muted, fontSize: 9 }}>Item and draft modules are recorded but currently not scored; the app does not infer weakness from ungraded practice.</Text></Panel>
        {recommendations.length ? recommendations.map((rec) => <Panel key={rec.id} style={{ gap: 7 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Chip label={rec.category.toUpperCase()} compact /><Text style={{ color: colors.muted, fontSize: 9 }}>{rec.minutes} MIN</Text></View>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>{rec.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>{rec.reason}</Text>
          <Text style={{ color: colors.purple, fontSize: 11, lineHeight: 17 }}>Next: {rec.action}</Text>
          <SecondaryButton title="Add focused practice to schedule" onPress={() => addToSchedule(rec)} />
        </Panel>) : <EmptyState title="Not enough evidence for recommendations" description="Submit Situation Trainer attempts or import at least five public matches. The coach will not invent weak areas or achievements." />}
      </View>

      <Panel style={{ gap: 8 }}>
        <Eyebrow color={colors.purple}>DATA TRANSPARENCY</Eyebrow>
        <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 16 }}>OpenDota's player match history contains available parsed fields. A detailed match call may fail or omit data when a replay is not parsed, hidden or otherwise unavailable. Player-slot role is an estimate, not a verified lane assignment. KDA is never used alone to judge performance.</Text>
        <Text style={{ color: colors.muted, fontSize: 9 }}>Free API policy reference: 50,000 calls/month and 60 requests/minute as currently documented. Avoid repeated refreshes; limits and service availability may change.</Text>
      </Panel>
    </Screen>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Panel style={{ width: '31.5%', minWidth: 94, padding: 11, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 8, fontWeight: '900' }}>{label}</Text><Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{value}</Text><Text style={{ color: colors.textSecondary, fontSize: 9 }}>{detail}</Text></Panel>;
}
function SmallValue({ label, value }: { label: string; value: string }) { return <View style={{ minWidth: 65, flex: 1, gap: 3 }}><Text style={{ color: colors.muted, fontSize: 8, fontWeight: '900' }}>{label}</Text><Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{value}</Text></View>; }
function masteryBand(matches: number) { return matches >= 40 ? 'Specialist practice tier' : matches >= 15 ? 'Established practice tier' : 'Practiced tier'; }
function heroPracticeSuggestion(heroName: string) {
  const name = heroName.toLowerCase();
  if (name === 'chaos knight') return 'Practice lane pressure, choosing your first major item timing, and deciding when Phantasm should convert into an objective rather than a low-value chase.';
  if (name === 'skywrath mage') return 'Practice support rotations with vision, target selection around silence, and staying outside enemy counter-initiation range after committing your spells.';
  return 'Review one lane decision and one mid-game objective decision from a recent match on this hero. Compare the timing, vision and team follow-up.';
}

function MatchDetailPanel({ match, itemNames }: { match: StoredMatch; itemNames: Map<number, string> }) {
  let itemIds: number[] = [];
  try { itemIds = JSON.parse(match.items_json) as number[]; } catch { itemIds = []; }
  return <Panel style={{ gap: 9, borderColor: '#49377A' }}>
    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>Match #{match.match_id} · detailed player record</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <SmallValue label="LEVEL" value={fmt(match.level)} /><SmallValue label="NET WORTH" value={fmt(match.net_worth)} /><SmallValue label="HERO DAMAGE" value={fmt(match.hero_damage)} /><SmallValue label="TOWER DAMAGE" value={fmt(match.tower_damage)} /><SmallValue label="TEAMFIGHT" value={match.teamfight_participation == null ? '—' : `${fmt(match.teamfight_participation * 100, 0)}%`} /><SmallValue label="LANE EFF." value={match.lane_efficiency_pct == null ? '—' : fmt(match.lane_efficiency_pct * 100, 0) + '%'} />
    </View>
    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>ITEMS</Text>
    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{itemIds.length ? itemIds.map((id) => itemNames.get(id) ?? `Item #${id}`).join(' · ') : 'No item data available in the returned match record.'}</Text>
    {!match.parsed_detail ? <Text style={{ color: colors.yellow, fontSize: 9 }}>Showing available cached match-list fields. Tap again after a successful detail load for parsed metrics.</Text> : null}
  </Panel>;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 300, height = 68, pad = 7;
  const min = Math.min(...values, 0), max = Math.max(...values, 100);
  const points = values.map((v, i) => ({ x: pad + (values.length <= 1 ? 0 : i * (width - pad * 2) / (values.length - 1)), y: height - pad - (v - min) / Math.max(1, max - min) * (height - pad * 2) }));
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Line x1={0} y1={height/2} x2={width} y2={height/2} stroke={colors.border} strokeDasharray="4 5" /><Path d={d} stroke={colors.purple} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />{points.slice(-1).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.purple} />)}</Svg>;
}
function MmrChart({ values }: { values: number[] }) {
  const width = 300, height = 100, pad = 9;
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => ({ x: pad + (values.length <= 1 ? 0 : i * (width - pad * 2) / (values.length - 1)), y: height - pad - (v - min) / Math.max(1, max - min) * (height - pad * 2) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  return <View style={{ gap: 5 }}><Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '800' }}>MMR HISTORY · {values.length} ENTRIES</Text><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Line x1="0" y1={height/2} x2={width} y2={height/2} stroke={colors.border} strokeDasharray="4 5" /><Path d={path} stroke={colors.purple} strokeWidth="2.5" fill="none" strokeLinecap="round" />{points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={2.6} fill={colors.purple} />)}</Svg><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontSize: 9 }}>{Math.min(...values).toLocaleString()}</Text><Text style={{ color: colors.muted, fontSize: 9 }}>{Math.max(...values).toLocaleString()}</Text></View></View>;
}
