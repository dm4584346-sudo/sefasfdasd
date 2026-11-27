import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppRouter } from '@/navigation/hooks';
import { useDatabase } from '@/db/DatabaseProvider';
import { CalendarDays, Check, CheckCircle2, Coffee, Plus, RotateCcw, Trash2 } from 'lucide-react-native';
import { colors, radius } from '@/constants/theme';
import { addScheduleBlock, deleteScheduleBlock, ensureDefaultSchedule, getRecentSessions, getSchedule, toggleScheduleBlock, updateScheduleBlock, setTodayAsRestDay } from '@/db/repository';
import type { ScheduleBlock, TrainingSession } from '@/types';
import { Chip, EmptyState, Eyebrow, Field, Heading, Panel, PrimaryButton, Screen, SectionHeader } from '@/components/ui';

const CATEGORIES = ['Theory', 'Mechanics', 'Ranked', 'Analysis', 'Situational', 'Break', 'Review', 'Rest'];
const toTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const toTimeInput = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export default function TrainingScreen() {
  const router = useAppRouter();
  const db = useDatabase();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [history, setHistory] = useState<TrainingSession[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Theory');
  const [duration, setDuration] = useState('30');
  const [time, setTime] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    let schedule = await getSchedule(db);
    if (schedule.length === 0) {
      await ensureDefaultSchedule(db);
      schedule = await getSchedule(db);
    }
    const recent = await getRecentSessions(db, 8);
    setBlocks(schedule);
    setHistory(recent);
  }, [db]);

  useFocusEffect(useCallback(() => {
    load().catch((error) => Alert.alert('Schedule unavailable', String(error)));
    return undefined;
  }, [load]));

  const activeMinutes = useMemo(() => blocks.filter((b) => b.category !== 'Break' && b.category !== 'Rest').reduce((sum, b) => sum + b.durationMinutes, 0), [blocks]);
  const breakMinutes = useMemo(() => blocks.filter((b) => b.category === 'Break').reduce((sum, b) => sum + b.durationMinutes, 0), [blocks]);
  const completedCount = blocks.filter((b) => b.completed).length;
  const restDay = blocks.some((b) => b.category === 'Rest');

  const openNew = () => {
    const now = new Date();
    setEditing(null); setTitle(''); setCategory('Theory'); setDuration('30');
    setTime(toTimeInput(now));
    setNotes(''); setModalVisible(true);
  };

  const openEdit = (block: ScheduleBlock) => {
    setEditing(block); setTitle(block.title); setCategory(block.category); setDuration(String(block.durationMinutes));
    setTime(toTimeInput(new Date(block.scheduledAt))); setNotes(block.notes); setModalVisible(true);
  };

  const saveBlock = async () => {
    const mins = Number(duration);
    if (!title.trim()) return Alert.alert('Add a title', 'Give this training block a name.');
    if (!Number.isInteger(mins) || mins < 0 || mins > 600) return Alert.alert('Check duration', 'Duration must be between 0 and 600 minutes.');
    setSaving(true);
    try {
      if (editing) await updateScheduleBlock(db, editing.id, title, category, mins, time, notes);
      else await addScheduleBlock(db, title, category, mins, notes, time);
      setModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('Could not save block', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  const removeBlock = () => {
    if (!editing) return;
    Alert.alert('Delete training block?', `“${editing.title}” will be removed from today's schedule.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteScheduleBlock(db, editing.id); setModalVisible(false); await load(); } },
    ]);
  };

  const makeRestDay = () => Alert.alert('Set a recovery day?', 'This replaces today’s schedule. Completed session history will remain saved.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Set rest day', style: 'destructive', onPress: async () => { await setTodayAsRestDay(db); await load(); } },
  ]);

  const toggle = async (block: ScheduleBlock) => {
    try { await toggleScheduleBlock(db, block); await load(); }
    catch (error) { Alert.alert('Could not update block', String(error)); }
  };

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow color={colors.purple}>TRAINING CENTER / DAILY PLAN</Eyebrow>
        <Heading>Training</Heading>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>A structured routine built around deliberate practice.</Text>
      </View>

      <View style={{ gap: 9 }}>
        <SectionHeader title="Skill development" subtitle="Practice decisions, itemization and draft thinking" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/training/situations' as any)} style={{ flex: 1, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#49377A', backgroundColor: '#15121E', gap: 6 }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 12 }}>SITUATION LAB</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Decision drills →</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Local coach · offline</Text></Pressable>
          <Pressable onPress={() => router.push('/training/item-builder' as any)} style={{ flex: 1, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 12 }}>ITEM BUILDER</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Purchase logic →</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Context-first practice</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/training/draft-trainer' as any)} style={{ flex: 1, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 12 }}>DRAFT TRAINER</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Pick with a plan →</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Position 3 / 4 / 5</Text></Pressable>
          <Pressable onPress={() => router.push('/training/dashboard' as any)} style={{ flex: 1, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 12 }}>DASHBOARD</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Review progress →</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Scores & error queue</Text></Pressable>
        </View>
      </View>

      <Panel style={{ backgroundColor: '#15121E', borderColor: '#463477' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow color={colors.purple}>TODAY'S LOAD</Eyebrow><CalendarDays size={17} color={colors.purple} /></View>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-end' }}>
          <View style={{ gap: 4, flex: 1 }}><Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>{Math.floor(activeMinutes / 60)}h {activeMinutes % 60}m</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>planned active training</Text></View>
          <View style={{ gap: 4, alignItems: 'flex-end' }}><Text style={{ color: colors.green, fontSize: 23, fontWeight: '900' }}>{completedCount}/{blocks.length}</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>blocks complete</Text></View>
        </View>
        {breakMinutes > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Coffee size={14} color={colors.green} /><Text style={{ color: colors.green, fontSize: 11 }}>Built-in recovery: {breakMinutes} minutes</Text></View> : <Text style={{ color: colors.yellow, fontSize: 11 }}>Remember to schedule regular breaks.</Text>}
      </Panel>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Schedule" subtitle={restDay ? 'Recovery day' : 'Tap a block to edit · check it off when done'} action={<Pressable onPress={openNew} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Plus size={15} color={colors.purple} /><Text style={{ color: colors.purple, fontWeight: '800', fontSize: 12 }}>ADD</Text></Pressable>} />
        {blocks.length ? <Panel style={{ paddingVertical: 3, gap: 0 }}>
          {blocks.map((block, index) => <ScheduleRow key={block.id} block={block} last={index === blocks.length - 1} onEdit={() => openEdit(block)} onToggle={() => toggle(block)} />)}
        </Panel> : <EmptyState title="No blocks scheduled" description="Create your first practice block or restore the starter six-hour plan." />}
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Pressable onPress={openNew} style={{ flex: 1, minHeight: 43, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }}><Plus size={15} color={colors.textSecondary} /><Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>New block</Text></Pressable>
          <Pressable onPress={makeRestDay} style={{ flex: 1, minHeight: 43, borderRadius: radius.md, borderWidth: 1, borderColor: '#493039', backgroundColor: '#20151B', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }}><Coffee size={15} color={colors.red} /><Text style={{ color: colors.red, fontSize: 11, fontWeight: '700' }}>Set rest day</Text></Pressable>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Recent training history" subtitle="Completed blocks are stored locally" />
        {history.length ? <Panel style={{ gap: 13 }}>{history.map((item) => <View key={item.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ width: 31, height: 31, borderRadius: 10, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Check size={16} color={colors.purple} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{item.title}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{item.category} · {new Date(item.completedAt).toLocaleDateString()}</Text></View><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.durationMinutes}m</Text></View>)}</Panel> : <EmptyState title="No completed sessions yet" description="Mark your first block as complete and it will appear here." />}
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Screen contentStyle={{ paddingTop: 28, paddingBottom: 42 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ gap: 4 }}><Eyebrow color={colors.purple}>{editing ? 'EDIT SESSION' : 'PLAN SESSION'}</Eyebrow><Heading style={{ fontSize: 25 }}>{editing ? 'Update block' : 'New training block'}</Heading></View><Pressable onPress={() => setModalVisible(false)}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Close</Text></Pressable></View>
            <Field label="BLOCK TITLE" value={title} onChangeText={setTitle} placeholder="e.g. Offlane replay review" />
            <View style={{ flexDirection: 'row', gap: 10 }}><Field label="DURATION (MIN)" value={duration} onChangeText={setDuration} keyboardType="number-pad" style={{ flex: 1 }} /><Field label="START TIME (HH:MM)" value={time} onChangeText={setTime} placeholder="16:00" style={{ flex: 1 }} /></View>
            <View style={{ gap: 10 }}><Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CATEGORY</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{CATEGORIES.map((item) => <Chip key={item} label={item} compact selected={category === item} onPress={() => setCategory(item)} />)}</View></View>
            <Field label="NOTES / FOCUS" value={notes} onChangeText={setNotes} placeholder="What should you focus on?" multiline numberOfLines={3} style={{ minHeight: 85 }} />
            <PrimaryButton title={saving ? 'Saving…' : editing ? 'Save changes' : 'Add to schedule'} onPress={saveBlock} disabled={saving} />
            {editing ? <Pressable onPress={removeBlock} style={{ minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }}><Trash2 size={15} color={colors.red} /><Text style={{ color: colors.red, fontWeight: '700' }}>Delete block</Text></Pressable> : null}
          </Screen>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function ScheduleRow({ block, last, onEdit, onToggle }: { block: ScheduleBlock; last: boolean; onEdit: () => void; onToggle: () => void }) {
  const isBreak = block.category === 'Break';
  const isRest = block.category === 'Rest';
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, backgroundColor: isBreak || isRest ? colors.green : colors.purple }} />
    <Pressable onPress={onEdit} style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: block.completed ? colors.muted : colors.text, fontSize: 12, fontWeight: '700', textDecorationLine: block.completed ? 'line-through' : 'none' }}>{block.title}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{block.category} · {block.durationMinutes ? `${block.durationMinutes} min` : 'Recovery'}</Text>
      {block.notes ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>{block.notes}</Text> : null}
    </Pressable>
    <View style={{ alignItems: 'flex-end', gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{toTime(block.scheduledAt)}</Text>
      {!isRest ? <Pressable onPress={onToggle} hitSlop={8}><CheckCircle2 size={22} color={block.completed ? colors.green : colors.muted} fill={block.completed ? '#19382C' : 'transparent'} /></Pressable> : <RotateCcw size={18} color={colors.green} />}
    </View>
  </View>;
}
