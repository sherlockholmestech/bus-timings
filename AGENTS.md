# Agent Notes — SG Bus Timings

Expo/React Native mobile app for Singapore bus arrivals. Uses LTA DataMall API and an embedded Leaflet map inside a WebView.

## Commands

```sh
npm install
npm start                 # Expo dev server
npm run android           # expo run:android
npm run typecheck         # tsc --noEmit
npm test                  # node --experimental-strip-types + node:test focused suite
```

No lint or formatter is configured. `npm test` is the only automated test
runner; it runs focused tests for the pure helpers and storage/search
modules with `node:test` and is invoked directly by the mission
validation contract — there is no Jest/Mocha/equivalent setup.

## TypeScript

- Extends `expo/tsconfig.base`.
- `strict: true` and `noUncheckedIndexedAccess: true` are enabled.

## Babel

`babel.config.js` must include `react-native-reanimated/plugin` for react-native-reanimated/Bottom Sheet to work.

## Architecture

- **Entry point**: `App.tsx` (single-screen app, no routing).
- **Components**: `src/components/`
- **Libs**: `src/lib/lta.ts` (API), `src/lib/geo.ts` (coordinates), `src/lib/search.ts` (stop search scoring)
- **Theme**: `src/theme.ts` — Flexoki palette, extends react-native-paper `MD3Theme` with an `expressive` object for spacing/radius.
- **Map**: `src/components/LeafletMap.tsx` renders a WebView with inline HTML/JS that loads Leaflet from `unpkg.com`. Map behavior changes require editing the HTML string inside that file.

## Important Conventions

- **Operator colors** are hardcoded in `ArrivalRow.tsx` (SBST, SMRT, TTS, GAS).
- **Crowd/load colors** are hardcoded there too (SEA/SDA/LSD).
- Service numbers sort with `localeCompare(..., undefined, { numeric: true })`.
- Arrival auto-refresh interval is 20 seconds while a stop is selected.

## Android Builds

- `android/` is gitignored but may exist locally after `expo run:android`. Do not commit it.
- `compile-android.sh` builds a release APK locally by downloading a temporary BellSoft Liberica JDK 17 into `./tmp` and running `./gradlew assembleRelease`.
- EAS Build is the standard path for production (see README).

## Runtime Requirements

- The app requires an LTA DataMall AccountKey, entered via the in-app Settings screen and stored in AsyncStorage.
- Bus stop list is fetched once and cached locally; live arrivals are fetched per stop.
- Without the key, the app shows the settings overlay on launch.

## Assets

- `assets/icon.png` is the Expo/Android icon. It is produced from `assets/logo.svg`.
