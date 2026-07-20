# Cine3D Mobile

Expo SDK 57 / React Native client for Cine3D. The foundation uses Expo Router,
strict TypeScript, React Native Paper, TanStack Query, Zustand, Axios,
SecureStore and SQLite.

## Start

```bash
npm install
cp .env.example .env.local
npm run start
```

`EXPO_PUBLIC_API_URL` should be `https://api.cine3d.id.vn/api` in production.
Use an HTTPS URL reachable from the device. Native plugins require a development
build for full SecureStore, notification, video and biometric behavior:

```bash
npx expo run:android
# or
eas build --profile development --platform android
```

## Quality checks

```bash
npm run typecheck
npm test
npm run lint
npm run check
```

## Architecture

- `app/`: typed file-based navigation and route composition.
- `src/domain/`: shared business entities and API error contracts.
- `src/features/*/{domain,data,presentation}`: feature-owned interfaces,
  adapters and native UI.
- `src/data/`: SecureStore authentication, Axios transport and migrated SQLite
  cache.
- `src/core/`: runtime configuration and root providers.
- `src/components/` and `src/theme/`: reusable MD3 dark design system.

The app is portrait-first. Player routes can opt into landscape fullscreen
according to `expo.extra.player.supportsFullscreenLandscape`; orientation
locking belongs in the player feature when it is introduced.

Universal links are configured for `https://cine3d.id.vn`. Production also
requires hosting valid Android `assetlinks.json` and Apple association files on
that domain with the final signing identifiers.

## Discovery route map

- `/search` — native search and filtered Explore catalog.
- `/the-loai/[slug]`, `/quoc-gia/[slug]`, `/nam/[year]` — shared paginated browse screen.
- `/schedule` — upcoming and recently released episodes.
- `/actors/[slug]`, `/directors/[slug]` — filmography and authenticated follow action.
- `/movies/[slug]` — canonical movie detail link (`/movie/[slug]` remains compatible).

The same paths are accepted by the `cine3d://` scheme and Android App Links.
