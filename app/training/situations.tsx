import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useDatabase } from '@/db/DatabaseProvider';
import { useAppParams } from '@/navigation/hooks';
import { ArrowLeft, BrainCircuit, RotateCcw } from 'lucide-react-native';
import { useAppRouter } from '@/navigation/hooks';
import { colors } from '@/constants/theme';
import { Screen, Eyebrow, Heading, Panel, PrimaryButton, Field, Chip, SectionHeader } from '@/components/ui';
import { SCENARIOS, nextScenario, type Scenario, type Difficulty } from '@/features/training/scenarios';
import { recordAttempt, scenarioForReview, createReviewVariant, resolveReview } from '@/features/training/engine';

export default function SituationsScreen() {
  const db = useDatabase(); const router = useAppRouter(); const params = useAppParams<{ difficulty?: string; reviewId?: string; scenarioId?: string }>();
  const [difficulty, setDifficulty] = useState<Difficulty>((params.difficulty as Difficulty) || 'Intermediate');
  const [scenario, setScenario] = useState<Scenario>(() => { const base = params.scenarioId ? scenarioForReview(params.scenarioId) : undefined; return base && params.reviewId ? createReviewVariant(base) : base || nextScenario([], undefined, (params.difficulty as Difficulty) || undefined); });
  const [reviewQueueId, setReviewQueueId] = useState<number | null>(params.reviewId ? Number(params.reviewId) : null);
  const [choice, setChoice] = useState(''); const [rationale, setRationale] = useState(''); const [result, setResult] = useState<any>(null); const [busy, setBusy] = useState(false);
  const isReview = reviewQueueId !== null;
  const option = useMemo(() => scenario.options.find((item) => item.id === choice), [scenario, choice]);
  const submit = async () => {
    if (!choice) return Alert.alert('Choose a decision', 'Select the action you would take.');
    setBusy(true);
    try {
      const saved = await recordAttempt(db, scenario, choice, rationale, !isReview);
      if (isReview && reviewQueueId !== null) await resolveReview(db, reviewQueueId, saved.score);
      setResult(saved);
    } catch (error) { Alert.alert('Could not save attempt', String(error)); }
    finally { setBusy(false); }
  };
  const next = () => { setReviewQueueId(null); setScenario(nextScenario([scenario.id], undefined, difficulty)); setChoice(''); setRationale(''); setResult(null); };
  return <Screen>
    <Pressable onPress={() => router.back()} style={{ flexDirection:'row',alignItems:'center',gap:7 }}><ArrowLeft size={17} color={colors.textSecondary}/><Text style={{color:colors.textSecondary,fontWeight:'700'}}>Back to training</Text></Pressable>
    <View style={{gap:6}}><Eyebrow color={colors.purple}>SITUATION TRAINER / LOCAL ENGINE</Eyebrow><Heading>Read the map.</Heading><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:18}}>Choose a decision, then defend it. Several actions may be viable; scoring rewards the quality of the plan and its risk management.</Text></View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{(['Beginner','Intermediate','Advanced','Immortal-level'] as Difficulty[]).map((d)=><Chip key={d} label={d} compact selected={difficulty===d} onPress={()=>{setDifficulty(d);setScenario(nextScenario([scenario.id],undefined,d));setChoice('');setRationale('');setResult(null);}}/>)}</View>
    <Panel style={{borderColor:'#49377A'}}>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}><Eyebrow color={colors.purple}>{scenario.category.toUpperCase()}</Eyebrow><Text style={{color:colors.yellow,fontSize:10,fontWeight:'800'}}>{scenario.difficulty}</Text></View>
      <Heading style={{fontSize:21}}>{scenario.title}</Heading>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Chip label={scenario.role} compact/><Chip label={scenario.hero} compact/><Chip label={`Minute ${scenario.minute}`} compact/><Chip label={`Level ${scenario.level}`} compact/></View>
      <SectionHeader title="Lineups"/><Text style={{color:colors.textSecondary,fontSize:11,lineHeight:18}}>ALLIES  ·  {scenario.allies.join('  /  ')}</Text><Text style={{color:colors.red,fontSize:11,lineHeight:18}}>ENEMIES  ·  {scenario.enemies.join('  /  ')}</Text>
      <SectionHeader title="Your inventory"/><Text style={{color:colors.text,fontSize:12}}>{scenario.items.join('  ·  ')}</Text>
      <SectionHeader title="Team state"/><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>{scenario.teamState}</Text>
      <SectionHeader title="Map state"/><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>{scenario.mapState}</Text>
      <SectionHeader title="Current objective"/><Text style={{color:colors.text,fontSize:12,lineHeight:19}}>{scenario.objective}</Text>
      <View style={{height:1,backgroundColor:colors.border}}/><Text style={{color:colors.text,fontSize:15,fontWeight:'800',lineHeight:22}}>{scenario.prompt}</Text>
    </Panel>
    {!result ? <Panel>
      <SectionHeader title="Choose your action" subtitle="No option is a magic answer; evaluate the full state."/>
      {scenario.options.map((item,index)=><Pressable key={item.id} onPress={()=>setChoice(item.id)} style={{padding:13,borderRadius:13,borderWidth:1,borderColor:choice===item.id?colors.purple:colors.border,backgroundColor:choice===item.id?colors.purpleSoft:colors.surfaceRaised,gap:4}}><Text style={{color:choice===item.id?colors.purple:colors.muted,fontSize:10,fontWeight:'900'}}>OPTION {String.fromCharCode(65+index)}</Text><Text style={{color:colors.text,fontSize:12,lineHeight:18,fontWeight:'600'}}>{item.label}</Text></Pressable>)}
      <Field label="EXPLAIN YOUR REASONING" value={rationale} onChangeText={setRationale} placeholder="What information, timings, risks and team goals led to your decision?" multiline numberOfLines={4} style={{minHeight:115}}/>
      <PrimaryButton title={busy?'Evaluating…':'Submit decision'} onPress={submit} disabled={busy||!choice}/>
    </Panel> : <Panel style={{borderColor:result.score>=7?colors.green:colors.red}}>
      <Eyebrow color={result.score>=7?colors.green:colors.red}>COACH REVIEW</Eyebrow><View style={{flexDirection:'row',alignItems:'baseline',gap:5}}><Text style={{color:colors.text,fontSize:42,fontWeight:'900'}}>{result.score.toFixed(1)}</Text><Text style={{color:colors.muted,fontSize:13}}>/ 10</Text></View>
      <Text style={{color:colors.text,fontWeight:'800',fontSize:13}}>Your choice: {option?.label}</Text>
      <View style={{gap:7,backgroundColor:colors.surfaceRaised,borderRadius:12,padding:12}}><Text style={{color:colors.text,fontSize:11,fontWeight:'900'}}>SCORING RUBRIC</Text>{([['Decision quality','decision'],['Context understanding','context'],['Risk assessment','risk'],['Timing','timing'],['Teamwork','teamwork'],['Argumentation','reasoning']] as const).map(([label,key])=><View key={key} style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{color:colors.textSecondary,fontSize:11}}>{label}</Text><Text style={{color:result.breakdown[key]>=1?colors.green:colors.yellow,fontSize:11,fontWeight:'800'}}>{result.breakdown[key].toFixed(1)} / {key==='timing'||key==='teamwork'? '1.5':key==='reasoning'?'1.0':'2.0'}</Text></View>)}</View>
      <Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>{result.feedback}</Text>
      <View style={{backgroundColor:colors.surfaceRaised,borderRadius:12,padding:12,gap:6}}><Text style={{color:colors.green,fontWeight:'800',fontSize:11}}>MODEL DECISION FRAMEWORK</Text><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>{scenario.modelAnswer}</Text></View>
      {result.score < 7 ? <Text style={{color:colors.yellow,fontSize:11,lineHeight:17}}>{isReview ? 'Not fixed yet. This concept has been scheduled again for tomorrow.' : 'Added to your error repetition queue. A related concept will return later with a changed scenario variant.'}</Text> : <Text style={{color:colors.green,fontSize:11}}>{isReview ? 'Review passed. The next repetition is scheduled at a longer interval.' : 'Good result. Keep applying the same reasoning under different map conditions.'}</Text>}
      <PrimaryButton title="Next situation" onPress={next} icon={<RotateCcw size={16} color="#100D18"/>}/>
    </Panel>}
    <Text style={{color:colors.muted,fontSize:10,lineHeight:15}}>Training scenarios are curated learning exercises, not a live match feed. They do not claim to represent the current professional meta or guarantee a particular MMR.</Text>
  </Screen>;
}
