import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';

export function Screen({ children, scroll = true, contentStyle }: { children: React.ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Panel({ children, style, ...props }: ViewProps) {
  return <View style={[styles.panel, style]} {...props}>{children}</View>;
}

export function Eyebrow({ children, color = colors.textSecondary }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, icon, style }: { title: string; onPress: () => void; disabled?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, style, disabled && { opacity: 0.45 }, pressed && !disabled && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}>
      {icon}{<Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, style, pressed && { opacity: 0.78 }]}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, compact = false }: { label: string; selected?: boolean; onPress?: () => void; compact?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.chip, compact && styles.chipCompact, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, style, ...inputProps }: Omit<TextInputProps, 'style'> & { label: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.purple}
        style={styles.input}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

export function LoadingState() {
  return <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.purple} /></View>;
}

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.textSecondary },
  purple: { color: colors.purple },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 36, gap: spacing.lg },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: -6 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  primaryButtonText: { color: '#100D18', fontWeight: '800', fontSize: 14 },
  secondaryButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: 14, paddingVertical: 10 },
  chipCompact: { paddingHorizontal: 11, paddingVertical: 8 },
  chipSelected: { borderColor: colors.purple, backgroundColor: colors.purpleSoft },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  chipTextSelected: { color: colors.purple, fontWeight: '800' },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, minHeight: 50, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 11 },
  emptyState: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: 20, gap: 6, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  emptyDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
