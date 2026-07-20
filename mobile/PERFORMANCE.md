# Mobile performance and accessibility

## Budgets (targets, not measurements)

- Cold start to interactive: <= 2.5 s on a mid-range physical Android device.
- Screen TTI after navigation: <= 1.0 s with warm cache, <= 2.0 s on network.
- Player tap-to-first-frame: <= 2.5 s on broadband; rebuffer events <= 1 per 10 minutes.
- JS long tasks: no operation over 100 ms during scrolling or playback.
- Query cache: 24-hour garbage collection; SQLite response cache <= 20 MB.
- Offline downloads: <= 2 GB managed content, with missing-file reconciliation.
- Touch targets: >= 48 dp; text remains usable at 200% system font scale.

These are release gates to measure. They are not claims about current frame rate or device results.

## Measure

Use a physical, non-debug device and a release/profile build. Record device model, OS, network,
app commit, and whether caches were cold or warm.

```sh
npx expo run:android --variant release
npx react-native log-android
```

Capture startup and frame traces with Android Studio Profiler/System Trace. Measure player startup
and buffering from the bounded `player_startup` and `player_buffer` analytics events. Compare at
least three cold launches and report median/p95; do not infer FPS from visual inspection.

For local diagnostics only, start Expo with `EXPO_PUBLIC_PERF_OVERLAY=1`. The overlay is guarded by
`__DEV__`, defaults off, and cannot appear in a production bundle.

Run Android Accessibility Scanner and TalkBack in portrait, landscape, split-screen, a 600 dp
tablet emulator, and a foldable emulator. Repeat with font size 200%, remove animations, reduce
transparency where supported, keyboard navigation, offline mode, and interrupted downloads.

## Automated gates

```sh
npm run typecheck
npm test
npm run build:check
```

Breakpoint, reduced-motion, cache TTL/eviction, deep-link sanitization, and retry policy have
deterministic unit coverage. Device profiling remains required because emulator timings are not
release measurements.
