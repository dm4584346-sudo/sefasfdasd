import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, BrainCircuit, ChartNoAxesCombined, House, UserRound } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { getProfile } from '@/db/repository';
import { useDatabase } from '@/db/DatabaseProvider';
import HomeScreen from '../../app/tabs/index';
import TrainingScreen from '../../app/tabs/training';
import CoachScreen from '../../app/tabs/coach';
import AnalyticsScreen from '../../app/tabs/analytics';
import ProfileScreen from '../../app/tabs/profile';
import OnboardingScreen from '../../app/onboarding';
import SituationsScreen from '../../app/training/situations';
import ItemBuilder from '../../app/training/item-builder';
import DraftTrainer from '../../app/training/draft-trainer';
import TrainingDashboard from '../../app/training/dashboard';
import ProAnalyticsScreen from '../../app/analytics/pro';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function GateScreen() {
  const db = useDatabase();
  const navigation = useNavigation<any>();
  const [failed, setFailed] = React.useState(false);
  useEffect(() => {
    let active = true;
    getProfile(db).then((profile) => {
      if (active) navigation.reset({ index: 0, routes: [{ name: profile ? 'MainTabs' : 'Onboarding' }] });
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [db, navigation]);
  return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
    <ActivityIndicator size="large" color={colors.purple}/>
    {failed ? <Text style={{ color: colors.textSecondary }}>Could not load the local profile. Please restart the app.</Text> : null}
  </View>;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs.Navigator screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.purple,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: '#101017', borderTopColor: colors.border, borderTopWidth: 1,
      height: 58 + Math.max(insets.bottom, 12), paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12),
    },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  }}>
    <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}/>
    <Tabs.Screen name="Training" component={TrainingScreen} options={{ title: 'Training', tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }}/>
    <Tabs.Screen name="Coach" component={CoachScreen} options={{ title: 'AI Coach', tabBarIcon: ({ color, size }) => <BrainCircuit color={color} size={size} /> }}/>
    <Tabs.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics', tabBarIcon: ({ color, size }) => <ChartNoAxesCombined color={color} size={size} /> }}/>
    <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }}/>
  </Tabs.Navigator>;
}

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.purple },
};

export default function AppNavigator() {
  return <NavigationContainer theme={navigationTheme}>
    <Stack.Navigator initialRouteName="Gate" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="Gate" component={GateScreen}/>
      <Stack.Screen name="Onboarding" component={OnboardingScreen}/>
      <Stack.Screen name="MainTabs" component={MainTabs}/>
      <Stack.Screen name="Situations" component={SituationsScreen}/>
      <Stack.Screen name="ItemBuilder" component={ItemBuilder}/>
      <Stack.Screen name="DraftTrainer" component={DraftTrainer}/>
      <Stack.Screen name="TrainingDashboard" component={TrainingDashboard}/>
      <Stack.Screen name="ProAnalytics" component={ProAnalyticsScreen}/>
    </Stack.Navigator>
  </NavigationContainer>;
}
