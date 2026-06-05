# SG Bus Timings

Android-only Expo SDK 56 app for Singapore bus arrivals. The shell,
header, drawer, search, and settings overlays are React Native —
`View`, `Pressable`, `TextInput`, and `ActivityIndicator` — paired
with a free Leaflet + OpenStreetMap WebView map. The app uses the LTA
DataMall Bus Arrival v3 and `BusStops` endpoints for live data and
stores an LTA AccountKey, the bus-stop cache, favourites, and theme
choice in `AsyncStorage`. The `@expo/ui` package is kept as a locked
dependency for the Compose re-exports in `src/ui/index.tsx`; no
component currently consumes them.

This repository is the Android-only build surface for the project. There
is no iOS target and no web target — the Expo app config is locked to
Android, the package scripts only build Android artefacts, and GitHub
Actions only validates and ships an Android release APK.

## Features

- Search Singapore bus stops by stop code, road name, or landmark.
- View bus stops on a free Leaflet + OpenStreetMap WebView map with
  visible OSM attribution; no Mapbox, Google Maps, or `expo-maps`
  dependency.
- Bus stop markers sized to the current map viewport (capped at 500 in
  bounds, 250 before the first bounds message, hidden below zoom 15
  unless a stop is selected).
- Locate control that focuses the user location and clears the
  current stop / search / route context.
- Pull-up drawer for the selected bus stop, favourites list, and
  per-service route view.
- Selected-stop arrivals and favourites auto-refresh every 20 seconds;
  the drawer shows "Updated \<time\>" after a successful refresh.
- Arrival rows sorted with numeric-aware service-number comparison,
  operator-coloured badges, crowd/load indicators, and a wheelchair
  indicator for `WAB` buses.
- Favourites are stored per bus stop + service number, deduplicated
  on restore, and grouped / sorted numerically.
- Route view with per-direction numeric stop sequence ordering, route
  polylines drawn on the map, and inset-aware route-fit bounds.
- Flexoki light / dark / system theme modes, with the system
  navigation bar and status bar following the effective theme.
- Android hardware back closes settings → search → route → selected
  stop, then falls through to system behaviour.

## Requirements

- Node.js 20+ and npm.
- JDK 25 is the host default but Android builds always use a
  temporary BellSoft Liberica JDK 17 — the host JDK is **not** used
  for Gradle. `compile-android.sh` downloads and verifies the pinned
  `Liberica 17.0.13+12` (standard non-CRaC) JDK itself; you do not
  need to install JDK 17 separately.
- Android SDK installed locally. Set `ANDROID_HOME` (and optionally
  `ANDROID_SDK_ROOT`) or rely on the default `$HOME/Android/Sdk` path
  used by `compile-android.sh`.
- An LTA DataMall AccountKey from <https://datamall.lta.gov.sg/>. The
  AccountKey is entered in-app on first launch and never needs to be
  present in the shell, CI, or repository.
- No Android emulator is required for any step in this README.

The app talks to LTA DataMall `v3/BusArrival`, `BusStops`, and
`BusRoutes` at runtime. Mission validation does not exercise real LTA
credentials — it relies on source inspection, static checks, and
focused tests.

## Setup

```sh
npm ci
```

This installs the locked dependency set declared in
`package.json` / `package-lock.json` (Expo SDK 56, `@expo/ui`,
React 19.2, React Native 0.85, etc.) without prompting for resolution
changes.

The Expo dev server is started with:

```sh
npm start
```

It defaults to the Android target because the app config restricts
`platforms` to `["android"]`.

## Scripts

```sh
npm start                # expo start --android
npm run typecheck        # tsc --noEmit (required gate)
npm test                 # focused node:test suite

# Android-only build surface:
npm run prebuild:android            # expo prebuild --platform android --no-install --clean
npm run build:android:debug         # prebuild + ./compile-android.sh debug (local/manual only)
npm run build:android:release       # prebuild + ./compile-android.sh release (local/manual)
```

`prebuild:android` generates the `android/` directory using
`EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android
--no-install --clean`. The Android project is gitignored and treated
as generated build output; do not commit it.

There is intentionally no `npm run ios` or `npm run web` script — the
mission scope is Android-only and the app config does not advertise
iOS or web as supported build targets.

## Validation

All validation runs without an Android emulator and without a real
LTA AccountKey. Run the following from a clean checkout:

```sh
npm ci
npm run typecheck
EXPO_NO_TELEMETRY=1 npx expo install --check
EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install --clean
npm test
```

`expo prebuild` writes a fresh `android/` directory and exits; it does
not launch a device. `npm test` runs focused `node:test` suites for
the storage / search / favourites / bootstrap / arrival / route /
back-priority / map / shell-insets helpers.

## Local Android Builds

The local entrypoint is `compile-android.sh`. It is the only path
that should touch Gradle from a developer machine.

```sh
./compile-android.sh release          # builds android/app/build/outputs/apk/release/app-release.apk
./compile-android.sh debug            # optional local-only debug build (NOT used in CI)
```

`compile-android.sh`:

1. Validates a cached JDK at `./tmp/jdk-17`. A cached JDK is accepted
   only when `release` shows the BellSoft / Liberica vendor, major
   version 17, `JAVA_VERSION=17.0.13`, `JAVA_RUNTIME_VERSION=17.0.13+12`,
   and no `jdk.internal.crac` module. Any other vendor, major
   version, runtime version, or the CRaC-flavoured build is purged.
2. Otherwise downloads `bellsoft-jdk17.0.13+12-linux-amd64.tar.gz`
   from the BellSoft GitHub release, verifies the SHA1 against
   `sha1sum.txt`, and extracts it under `./tmp/jdk-17`.
3. Exports `JAVA_HOME`, prepends the JDK `bin` directory to `PATH`,
   and sets `ANDROID_HOME` / `ANDROID_SDK_ROOT` (default
   `$HOME/Android/Sdk`) plus the `platform-tools`,
   `cmdline-tools/latest/bin`, and `build-tools` SDK paths so Gradle
   never depends on ambient `PATH` entries.
4. Runs `npx expo prebuild --platform android --no-install --clean`
   if `android/` is missing.
5. Runs `./gradlew assembleRelease` (or `assembleDebug`) and prints
   the resulting APK path.

The script never uses `expo run:android`, `adb install`, or any
emulator/device command. The local debug variant is intentionally
kept as an opt-in for manual device testing and is not part of the
push / pull-request CI gate.

## GitHub Actions

CI is defined in `.github/workflows/android.yml` and is split into
two jobs that are both Linux-only and emulator-free.

### `validate` (push and pull_request)

Runs on every push and pull request targeting `master` / `main`,
with `contents: read` only. Steps:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` (Node 20, npm cache, `package-lock.json`
   cache dependency path).
3. `npm ci`.
4. `npm run typecheck`.
5. `EXPO_NO_TELEMETRY=1 npx expo install --check`.
6. Python YAML lint of `.github/workflows/android.yml` so a workflow
   syntax error cannot silently break CI.
7. `actions/setup-java@v4` with `distribution: liberica`,
   `java-version: "17"`.
8. `android-actions/setup-android@v3`.
9. `EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android
   --no-install --clean`.

The `validate` job **does not** run `./gradlew assembleDebug` or
produce a debug APK. It also never runs `assembleRelease`. Emulator,
`avd`, `adb install`, and `expo run:android` commands are not used
anywhere in the workflow.

### `release` (`release.published`)

Triggered by `release: published`, with `needs: validate` and
`contents: write` so it can attach the APK to the GitHub Release.
The release job shares the same Node setup, `npm ci`, typecheck,
`expo install --check`, Liberica JDK 17, Android SDK setup, and
`expo prebuild` steps as the `validate` job. It deliberately does
**not** re-run the validate-only Python YAML lint of
`.github/workflows/android.yml`; that check exists to catch
workflow syntax errors on every push and pull request, and re-running
it before a release build adds no extra signal beyond the validate
job that already gates this release job. After the shared setup
steps, the release job runs:

1. `chmod +x android/gradlew` and `cd android && ./gradlew
   assembleRelease --stacktrace`.
2. Copy `android/app/build/outputs/apk/release/app-release.apk` to
   `dist/sg-bus-timings-android.apk` for a deterministic release
   asset name.
3. `actions/upload-artifact@v4` with
   `if-no-files-found: error` so a missing APK fails the release.
4. `gh release upload "${{ github.event.release.tag_name }}"
   dist/sg-bus-timings-android.apk --clobber` using the implicit
   `github.token`. No keystore, no signing secret, and no
   `.env` / LTA secrets are read at any point.

The `concurrency` block cancels in-progress runs on the same ref for
`push` and `pull_request` events but never cancels an in-flight
release build.

## LTA AccountKey

The LTA DataMall AccountKey is a runtime input only. It is entered
through the in-app **Settings** overlay as a secure text field,
trimmed, and stored locally in `AsyncStorage` under
`lta.accountKey`. The app re-uses the stored key for bus-stop
sync, arrivals, favourites, and route requests. A whitespace-only
stored key is treated as missing and re-opens settings.

You will **never** need to provide an LTA AccountKey to:

- run `npm ci`, `npm run typecheck`, `expo install --check`, or
  `expo prebuild`;
- run the focused test suite (`npm test`);
- run `compile-android.sh`;
- run the GitHub Actions `validate` or `release` jobs.

The workflow does not read `secrets.*` for LTA, does not configure an
AccountKey environment variable, and does not echo or log a key
value. Do not add `.env`, keystore, signing, or LTA secrets to the
repository, the workflow, or the build scripts.

## Persistent Storage

The app uses these `AsyncStorage` keys exactly:

| Key                   | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `lta.accountKey`      | Trimmed LTA DataMall AccountKey (runtime only). |
| `lta.busStops`        | Cached, sorted, validated bus stop list.       |
| `lta.busStops.cachedAt` | ISO timestamp of the last successful sync.   |
| `lta.favoriteServices` | Saved favourites, sorted, deduped per stop/service. |
| `ui.theme`            | `system`, `light`, or `dark`.                  |

Legacy `lta.busRoutes` and `lta.busRoutes.cachedAt` keys are removed
on every bootstrap and after a successful bus-stop sync; they are
never read.

## Notes

- The free Leaflet + OpenStreetMap map is loaded from
  `https://unpkg.com/leaflet@1.9.4` and OSM tiles from
  `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, with the
  Leaflet attribution control left enabled.
- Arrival timings refresh every 20 seconds while a stop is selected
  or favourites mode is active. The last-updated timestamp only
  advances after a successful refresh in the active mode.
- Service numbers and bus stop codes are sorted with
  `localeCompare(..., undefined, { numeric: true })` everywhere they
  are rendered, including the route view, so `2` < `12` < `100`.
- Operator accent colours (SBST, SMRT, TTS, GAS) and crowd/load
  colours (SEA, SDA, LSD) are hardcoded in `src/components/ArrivalRow.tsx`.
- Foreground-only location: only `ACCESS_COARSE_LOCATION` and
  `ACCESS_FINE_LOCATION` are declared. The app never uses background
  location.

## Assets

- `assets/icon.png` is the Expo app icon and Android adaptive icon
  foreground. It is produced from `assets/logo.svg`.
