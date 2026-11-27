import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { initializeDatabase } from '@/db/schema';
import { openAppDatabase, type SQLiteDatabase } from '@/db/database';

const DatabaseContext = createContext<SQLiteDatabase | null>(null);

export function DatabaseProvider({ children }: React.PropsWithChildren) {
  const database = useMemo(() => openAppDatabase(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = React.useCallback(async () => {
    setError(null);
    try {
      await initializeDatabase(database);
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [database]);

  useEffect(() => { void initialize(); }, [initialize]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Database initialization failed</Text>
        <Text selectable style={{ color: colors.textSecondary, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => { setReady(false); void initialize(); }} style={{ padding: 13, borderRadius: 12, backgroundColor: colors.purple }}>
          <Text style={{ color: '#100D18', fontWeight: '800' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.purple} size="large" /></View>;
  }

  return <DatabaseContext.Provider value={database}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): SQLiteDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error('useDatabase must be used inside DatabaseProvider.');
  return database;
}
