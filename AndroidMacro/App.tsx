/**
 * @format
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  NativeModules,
  Pressable,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

type InstalledApp = {
  packageName: string;
  label: string;
};

type AndroidMacroNative = {
  getTimeoutSeconds: () => Promise<number>;
  setTimeoutSeconds: (seconds: number) => Promise<number>;
  getEnabled: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  isAccessibilityEnabled: () => Promise<boolean>;
  openAccessibilitySettings: () => Promise<void>;
  getInstalledApps: () => Promise<InstalledApp[]>;
  getSkippedPackages: () => Promise<string[]>;
  setAppSkipped: (packageName: string, skipped: boolean) => Promise<string[]>;
};

const Native = NativeModules.AndroidMacro as AndroidMacroNative | undefined;

const PRESETS = [10, 15, 20, 30, 45, 60, 120, 180, 300];

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

function SettingsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const colors = isDarkMode ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(true);
  const [timeoutSeconds, setTimeoutSeconds] = useState(20);
  const [timeoutInput, setTimeoutInput] = useState('20');
  const [enabled, setEnabled] = useState(true);
  const [accessibilityOn, setAccessibilityOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!Native) {
      setError('Native settings module is not available.');
      setLoading(false);
      return;
    }

    try {
      const [seconds, isEnabled, serviceOn, skippedPackages] = await Promise.all([
        Native.getTimeoutSeconds(),
        Native.getEnabled(),
        Native.isAccessibilityEnabled(),
        Native.getSkippedPackages(),
      ]);
      setTimeoutSeconds(seconds);
      setTimeoutInput(String(seconds));
      setEnabled(isEnabled);
      setAccessibilityOn(serviceOn);
      setSkipped(new Set(skippedPackages));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApps = useCallback(async () => {
    if (!Native) {
      setAppsLoading(false);
      return;
    }

    try {
      const installed = await Native.getInstalledApps();
      setApps(installed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load apps.');
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadApps();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [load, loadApps]);

  const saveTimeout = useCallback(async (seconds: number) => {
    if (!Native) {
      return;
    }

    setSaving(true);
    try {
      const value = await Native.setTimeoutSeconds(seconds);
      setTimeoutSeconds(value);
      setTimeoutInput(String(value));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save timeout.');
    } finally {
      setSaving(false);
    }
  }, []);

  const saveEnabled = useCallback(async (next: boolean) => {
    if (!Native) {
      return;
    }

    setEnabled(next);
    try {
      const value = await Native.setEnabled(next);
      setEnabled(value);
      setError(null);
    } catch (saveError) {
      setEnabled(!next);
      setError(saveError instanceof Error ? saveError.message : 'Could not save toggle.');
    }
  }, []);

  const saveSkipped = useCallback(async (packageName: string, nextSkipped: boolean) => {
    if (!Native) {
      return;
    }

    setSkipped(current => {
      const copy = new Set(current);
      if (nextSkipped) {
        copy.add(packageName);
      } else {
        copy.delete(packageName);
      }
      return copy;
    });

    try {
      const packages = await Native.setAppSkipped(packageName, nextSkipped);
      setSkipped(new Set(packages));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save skipped app.');
      load();
    }
  }, [load]);

  const commitInput = useCallback(() => {
    const parsed = Number.parseInt(timeoutInput, 10);
    if (!Number.isFinite(parsed)) {
      setTimeoutInput(String(timeoutSeconds));
      return;
    }
    saveTimeout(parsed);
  }, [saveTimeout, timeoutInput, timeoutSeconds]);

  const previewTimeout = useMemo(() => {
    const parsed = Number.parseInt(timeoutInput, 10);
    return Number.isFinite(parsed) ? parsed : timeoutSeconds;
  }, [timeoutInput, timeoutSeconds]);

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? apps.filter(
          app =>
            app.label.toLowerCase().includes(needle) ||
            app.packageName.toLowerCase().includes(needle),
        )
      : apps;

    return [...matched].sort((a, b) => {
      const aSkipped = skipped.has(a.packageName) ? 0 : 1;
      const bSkipped = skipped.has(b.packageName) ? 0 : 1;
      if (aSkipped !== bSkipped) {
        return aSkipped - bSkipped;
      }
      return a.label.localeCompare(b.label);
    });
  }, [apps, query, skipped]);

  const statusText = useMemo(() => {
    if (!accessibilityOn) {
      return 'Accessibility is off. Auto-lock will not run until you enable AndroidMacro in system settings.';
    }
    if (!enabled) {
      return 'Auto-lock is paused in the app. The accessibility service stays on, but the screen will not lock.';
    }
    const skipNote =
      skipped.size > 0
        ? ` Skipped apps (${skipped.size}) will not lock while they are open.`
        : '';
    return `The screen will lock after ${previewTimeout} seconds with no tap, swipe, scroll, or typing.${skipNote}`;
  }, [accessibilityOn, enabled, previewTimeout, skipped.size]);

  const header = (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>AndroidMacro</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Lock the screen after you stop interacting with it.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accent} />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text }]}>Accessibility</Text>
                <Text style={[styles.helper, { color: colors.muted }]}>
                  {accessibilityOn
                    ? 'AndroidMacro is enabled in system settings.'
                    : 'Required once. Android will not turn this on by itself.'}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: accessibilityOn ? colors.successBg : colors.warnBg },
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    { color: accessibilityOn ? colors.success : colors.warn },
                  ]}>
                  {accessibilityOn ? 'On' : 'Off'}
                </Text>
              </View>
            </View>

            {!accessibilityOn && (
              <Pressable
                style={[styles.button, { backgroundColor: colors.accent }]}
                onPress={() => Native?.openAccessibilitySettings()}>
                <Text style={styles.buttonText}>Open Accessibility settings</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text }]}>Auto-lock</Text>
                <Text style={[styles.helper, { color: colors.muted }]}>
                  Turn this off to keep the service enabled without locking.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={saveEnabled}
                disabled={!accessibilityOn}
                thumbColor={enabled ? colors.accent : colors.switchOff}
                trackColor={{ false: colors.track, true: colors.accentTrack }}
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.text }]}>Idle timeout</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              Seconds without tap, swipe, scroll, or typing before the screen locks. Minimum 5,
              maximum 3600.
            </Text>

            <View style={styles.timeoutRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.input,
                  },
                ]}
                keyboardType="number-pad"
                value={timeoutInput}
                onChangeText={setTimeoutInput}
                onBlur={commitInput}
                onSubmitEditing={commitInput}
                editable={!saving}
              />
              <Text style={[styles.secondsLabel, { color: colors.muted }]}>seconds</Text>
              <Pressable
                style={[styles.applyButton, { backgroundColor: colors.accent }]}
                onPress={commitInput}
                disabled={saving}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>

            <View style={styles.presets}>
              {PRESETS.map(value => {
                const selected = previewTimeout === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => saveTimeout(value)}
                    style={[
                      styles.preset,
                      {
                        backgroundColor: selected ? colors.accent : colors.input,
                        borderColor: selected ? colors.accent : colors.border,
                      },
                    ]}>
                    <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600' }}>
                      {value < 60 ? `${value}s` : `${value / 60}m`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.text }]}>Skip apps</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              Auto-lock stays off while a skipped app is open. All other apps still lock after the
              idle timeout.
            </Text>
            <TextInput
              style={[
                styles.search,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                },
              ]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search apps"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.helper, { color: colors.muted }]}>
              {skipped.size} skipped
            </Text>
          </View>

          <Text style={[styles.status, { color: colors.muted }]}>{statusText}</Text>
          {error ? <Text style={[styles.error, { color: colors.warn }]}>{error}</Text> : null}

          {appsLoading ? <ActivityIndicator style={styles.loader} color={colors.accent} /> : null}
        </>
      )}
    </View>
  );

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
      }}
      data={loading ? [] : filteredApps}
      keyExtractor={item => item.packageName}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const isSkipped = skipped.has(item.packageName);
        return (
          <View
            style={[
              styles.appRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={styles.rowText}>
              <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.appPackage, { color: colors.muted }]} numberOfLines={1}>
                {item.packageName}
              </Text>
            </View>
            <Switch
              value={isSkipped}
              onValueChange={value => saveSkipped(item.packageName, value)}
              thumbColor={isSkipped ? colors.accent : colors.switchOff}
              trackColor={{ false: colors.track, true: colors.accentTrack }}
            />
          </View>
        );
      }}
    />
  );
}

const lightColors = {
  background: '#f4f4f5',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  accent: '#2563eb',
  accentTrack: '#93c5fd',
  border: '#e5e7eb',
  input: '#f9fafb',
  success: '#047857',
  successBg: '#d1fae5',
  warn: '#b45309',
  warnBg: '#fef3c7',
  switchOff: '#f4f4f5',
  track: '#d1d5db',
};

const darkColors = {
  background: '#0b0b0f',
  card: '#17171c',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  accent: '#3b82f6',
  accentTrack: '#1d4ed8',
  border: '#27272a',
  input: '#111113',
  success: '#34d399',
  successBg: '#052e1c',
  warn: '#fbbf24',
  warnBg: '#3b2a05',
  switchOff: '#3f3f46',
  track: '#3f3f46',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontWeight: '700',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  timeoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  secondsLabel: {
    flex: 1,
    fontSize: 15,
  },
  applyButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
  },
  appRow: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
  },
  appPackage: {
    fontSize: 12,
  },
});

export default App;
