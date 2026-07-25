import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router, type Href } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Dialog, PaperProvider, Portal, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { config } from '@/core/config';
import { cacheRepository } from '@/data/cache/sqlite-cache';
import { syncSessionOnResume } from '@/data/http/api-client';
import { discoveryKeys } from '@/features/discovery/domain/discovery-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { useAppStore } from '@/state/app-store';
import { ensureActiveProfile } from '@/features/account/data/ensure-active-profile';
import { paperTheme } from '@/theme';
import { ErrorBoundary, ToastHost } from '@/components/ui';
import { AppLock } from '@/features/account/presentation/app-lock';
import { accountApi } from '@/features/account/data/account-api';
import { WatchRoomProvider } from '@/features/watch-together/presentation/watch-room-provider';
import { sanitizeDeepLink, shouldRetryRequest } from '@/core/reliability';
import { markColdStartReady, flushPerformanceEvents } from '@/core/performance';
import { colors, spacing } from '@/theme';
import { DevPerformanceOverlay } from '@/components/dev-performance-overlay';
import { TranslationVoteBanner } from '@/components/translation-vote-banner';
import { checkpointRepository } from '@/features/player/data/player-storage';

const DISMISSED_UPDATE_KEY = 'cine3d.update.dismissedVersion';
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type VersionPolicy = Awaited<ReturnType<typeof accountApi.versionPolicy>>;

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: config.queryStaleTimeMs,
        gcTime: config.queryGcTimeMs,
        retry: (count, error) => shouldRetryRequest(count, error, 'get'),
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  }));

  useEffect(() => {
    void useAppStore.getState().hydrateSession().then(async () => {
      if (!useAppStore.getState().session.tokens.refreshToken) return;
      await syncSessionOnResume(true);
      try {
        useAppStore.getState().setUser(await accountApi.me());
      } catch {
        /* keep cached user when offline; interceptor handles expired sessions */
      }
      await ensureActiveProfile();
      // Load user-specific rails only after tokens are refreshed on cold start.
      void queryClient.invalidateQueries({ queryKey: movieKeys.history() });
      void queryClient.invalidateQueries({ queryKey: discoveryKeys.history() });
    });
    void cacheRepository.pruneStale();
    const networkSubscription = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      if (state.isConnected) void flushPerformanceEvents();
    });
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') {
        void flushPerformanceEvents();
        // Throttled resume sync — avoids rotating refresh tokens on every app switch.
        void syncSessionOnResume().then(async () => {
          if (!useAppStore.getState().session.tokens.refreshToken) return;
          try {
            useAppStore.getState().setUser(await accountApi.me());
          } catch {
            /* keep cached user when offline */
          }
        });
      }
    });
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      const safeRoute = sanitizeDeepLink(link);
      if (safeRoute) router.push(safeRoute as Href);
    });
    markColdStartReady();
    return () => { subscription.remove(); notificationSubscription.remove(); networkSubscription(); };
  }, []);
  useEffect(() => {
    let previousToken = useAppStore.getState().session.tokens.accessToken;
    let previousHydrated = useAppStore.getState().session.hydrated;
    return useAppStore.subscribe((state) => {
      const nextToken = state.session.tokens.accessToken;
      const hydrated = state.session.hydrated;
      if (previousToken && !nextToken) {
        queryClient.clear();
        void cacheRepository.clearAll();
        void checkpointRepository.clearAll();
      }
      // Fresh login while the app is already running (not initial hydrate).
      if (hydrated && nextToken && !previousToken && previousHydrated) {
        void ensureActiveProfile().then(() => {
          void queryClient.invalidateQueries({ queryKey: movieKeys.history() });
          void queryClient.invalidateQueries({ queryKey: discoveryKeys.history() });
        });
      }
      previousToken = nextToken;
      previousHydrated = hydrated;
    });
  }, [queryClient]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider
          theme={paperTheme}
          settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
        >
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
              <ToastHost>
                <VersionGate>
                  <WatchRoomProvider>
                    <AppLock>
                      {children}
                      <TranslationVoteBanner />
                    </AppLock>
                  </WatchRoomProvider>
                </VersionGate>
                <DevPerformanceOverlay />
              </ToastHost>
            </ErrorBoundary>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function compareVersions(current: string, target: string): number {
  const left = current.split('.').map(Number);
  const right = target.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function VersionGate({ children }: PropsWithChildren) {
  const [policy, setPolicy] = useState<VersionPolicy | null>(null);
  const [softVisible, setSoftVisible] = useState(false);

  const refreshPolicy = useCallback(async () => {
    try {
      const next = await accountApi.versionPolicy();
      setPolicy(next);
      const current = accountApi.appVersion;
      const behindLatest = compareVersions(current, next.latestVersion) < 0;
      const forced = next.forceUpdate && compareVersions(current, next.minVersion) < 0;
      if (!behindLatest || forced) {
        setSoftVisible(false);
        return;
      }
      const dismissed = await SecureStore.getItemAsync(DISMISSED_UPDATE_KEY, secureOptions);
      setSoftVisible(dismissed !== next.latestVersion);
    } catch {
      /* offline / policy not configured */
    }
  }, []);

  useEffect(() => {
    void refreshPolicy();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refreshPolicy();
    });
    return () => subscription.remove();
  }, [refreshPolicy]);

  const dismissSoftUpdate = useCallback(() => {
    setSoftVisible(false);
    if (!policy?.latestVersion) return;
    void SecureStore.setItemAsync(DISMISSED_UPDATE_KEY, policy.latestVersion, secureOptions);
  }, [policy?.latestVersion]);

  const openUpdate = useCallback(() => {
    if (policy?.storeUrl) void Linking.openURL(policy.storeUrl);
  }, [policy?.storeUrl]);

  const blocked = Boolean(policy?.forceUpdate && compareVersions(accountApi.appVersion, policy.minVersion) < 0);
  if (blocked && policy) {
    return (
      <View
        accessibilityRole="alert"
        style={{ flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background }}
      >
        <Text variant="headlineSmall">Cần cập nhật ứng dụng</Text>
        <Text>{policy.message || 'Phiên bản này không còn được hỗ trợ.'}</Text>
        <Button mode="contained" disabled={!policy.storeUrl} onPress={openUpdate}>
          Cập nhật
        </Button>
      </View>
    );
  }

  return (
    <>
      {children}
      <Portal>
        <Dialog visible={softVisible} onDismiss={dismissSoftUpdate}>
          <Dialog.Title>Có bản mới</Dialog.Title>
          <Dialog.Content>
            <Text>
              {policy?.message
                || `Đã có CINE3D ${policy?.latestVersion || ''}. Bạn đang dùng ${accountApi.appVersion}.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={dismissSoftUpdate}>Để sau</Button>
            <Button mode="contained" disabled={!policy?.storeUrl} onPress={openUpdate}>
              Cập nhật
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
