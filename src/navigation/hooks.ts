import { StackActions, useNavigation, useRoute } from '@react-navigation/native';

type RouteParams = Record<string, string | number | boolean | undefined>;
type RouteTarget = string | { pathname: string; params?: RouteParams };
type ResolvedTarget = { name: string; params?: Record<string, unknown> };

const ROUTES: Record<string, ResolvedTarget> = {
  '/(tabs)': { name: 'MainTabs' },
  '/(tabs)/home': { name: 'MainTabs', params: { screen: 'Home' } },
  '/(tabs)/training': { name: 'MainTabs', params: { screen: 'Training' } },
  '/(tabs)/coach': { name: 'MainTabs', params: { screen: 'Coach' } },
  '/(tabs)/analytics': { name: 'MainTabs', params: { screen: 'Analytics' } },
  '/(tabs)/profile': { name: 'MainTabs', params: { screen: 'Profile' } },
  '/onboarding': { name: 'Onboarding' },
  '/analytics/pro': { name: 'ProAnalytics' },
  '/training/situations': { name: 'Situations' },
  '/training/item-builder': { name: 'ItemBuilder' },
  '/training/draft-trainer': { name: 'DraftTrainer' },
  '/training/dashboard': { name: 'TrainingDashboard' },
};

function resolveTarget(target: RouteTarget): ResolvedTarget {
  const pathname = typeof target === 'string' ? target : target.pathname;
  const mapped = ROUTES[pathname];
  if (!mapped) throw new Error(`Unknown DOTA PRO LAB route: ${pathname}`);
  const suppliedParams = typeof target === 'string' ? undefined : target.params;
  return {
    name: mapped.name,
    params: mapped.params || suppliedParams
      ? { ...(mapped.params ?? {}), ...(suppliedParams ?? {}) }
      : undefined,
  };
}

/** Route-style compatibility layer used by the original Phase 1–3 screens. */
export function useAppRouter() {
  const navigation = useNavigation<any>();
  const navigate = (target: RouteTarget) => {
    const route = resolveTarget(target);
    navigation.navigate(route.name, route.params);
  };
  return {
    navigate,
    push: navigate,
    replace: (target: RouteTarget) => {
      const route = resolveTarget(target);
      navigation.dispatch(StackActions.replace(route.name, route.params));
    },
    back: () => {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs');
    },
  };
}

export function useAppParams<T extends Record<string, unknown>>() {
  const route = useRoute<any>();
  return (route.params ?? {}) as T;
}
