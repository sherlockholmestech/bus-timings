#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
TMP_DIR="$REPO_ROOT/tmp"
JDK_DIR="$TMP_DIR/jdk-17"
# Pinned BellSoft Liberica JDK 17 standard (non-CRaC) build. The CRaC variant
# adds the jdk.internal.crac module which breaks Gradle's JImage reader, so we
# stick to the standard variant published on the GitHub release page.
JDK_VERSION="17.0.13+12"
JDK_TARBALL_NAME="bellsoft-jdk${JDK_VERSION}-linux-amd64.tar.gz"
JDK_URL="https://github.com/bell-sw/Liberica/releases/download/${JDK_VERSION//+/%2B}/${JDK_TARBALL_NAME}"
JDK_SHA1SUMS_URL="https://github.com/bell-sw/Liberica/releases/download/${JDK_VERSION//+/%2B}/sha1sum.txt"
EXPECTED_VENDOR="Liberica"
EXPECTED_MAJOR="17"
EXPECTED_VERSION_PREFIX="17.0."

usage() {
  cat <<USAGE
Usage: $0 [debug|release]

Runs the Android prebuild (if needed) and builds the requested APK variant
using a temporary BellSoft Liberica JDK 17 pinned under \`./tmp\`.

  debug    - runs \`./gradlew assembleDebug\` (default)
  release  - runs \`./gradlew assembleRelease\`

Environment variables:
  ANDROID_HOME / ANDROID_SDK_ROOT  - Android SDK location (default: \$HOME/Android/Sdk)
USAGE
}

VARIANT="${1:-debug}"
case "$VARIANT" in
  debug) GRADLE_TASK="assembleDebug" ;;
  release) GRADLE_TASK="assembleRelease" ;;
  -h|--help|help) usage; exit 0 ;;
  *)
    echo "Unknown variant: $VARIANT" >&2
    usage >&2
    exit 1
    ;;
esac

# Always reject a cached JDK that does not match the expected vendor/major.
validate_cached_jdk() {
  if [ ! -x "$JDK_DIR/bin/java" ] || [ ! -r "$JDK_DIR/release" ]; then
    return 1
  fi
  local release_file="$JDK_DIR/release"
  local implementor java_version
  implementor="$(grep -E '^IMPLEMENTOR=' "$release_file" | head -n 1 | sed -E 's/^IMPLEMENTOR="?([^"]+)"?$/\1/')"
  java_version="$(grep -E '^JAVA_VERSION=' "$release_file" | head -n 1 | sed -E 's/^JAVA_VERSION="?([^"]+)"?$/\1/')"
  if [ -z "$implementor" ] || [ -z "$java_version" ]; then
    echo "Cached JDK at $JDK_DIR is missing IMPLEMENTOR or JAVA_VERSION metadata. Removing."
    rm -rf "$JDK_DIR"
    return 1
  fi
  if ! [[ "$implementor" == *"$EXPECTED_VENDOR"* ]] && ! [[ "$implementor" == "BellSoft" ]]; then
    echo "Cached JDK vendor mismatch (expected $EXPECTED_VENDOR or BellSoft, got: $implementor). Removing $JDK_DIR."
    rm -rf "$JDK_DIR"
    return 1
  fi
  local major
  major="$(printf '%s' "$java_version" | sed -nE 's/^([0-9]+)\..*/\1/p')"
  if [ "$major" != "$EXPECTED_MAJOR" ]; then
    echo "Cached JDK major version mismatch (expected $EXPECTED_MAJOR, got: $major). Removing $JDK_DIR."
    rm -rf "$JDK_DIR"
    return 1
  fi
  return 0
}

# Fetch the published BellSoft sha1sum.txt and extract the expected SHA1
# for this JDK tarball. Fails the script if the entry cannot be found.
fetch_expected_sha1() {
  local sha1sums_file="$TMP_DIR/sha1sum.txt"
  if ! curl -fsL --retry 3 --retry-delay 2 -o "$sha1sums_file" "$JDK_SHA1SUMS_URL"; then
    echo "Error: failed to download BellSoft sha1sum.txt from $JDK_SHA1SUMS_URL" >&2
    return 1
  fi
  local expected
  expected="$(awk -v name="$JDK_TARBALL_NAME" '$2 == name { print tolower($1); exit }' "$sha1sums_file" || true)"
  if [ -z "$expected" ]; then
    echo "Error: no SHA1 entry found for $JDK_TARBALL_NAME in $sha1sums_file" >&2
    return 1
  fi
  printf '%s' "$expected"
}

# Verify a downloaded tarball against the expected SHA1 from sha1sum.txt.
verify_tarball_sha1() {
  local tarball="$1"
  local expected="$2"
  local actual
  if ! actual="$(sha1sum "$tarball" | awk '{ print tolower($1) }')"; then
    echo "Error: could not compute SHA1 for $tarball" >&2
    return 1
  fi
  if [ "$actual" != "$expected" ]; then
    echo "Error: SHA1 mismatch for $JDK_TARBALL_NAME" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    return 1
  fi
  echo "SHA1 verified for $JDK_TARBALL_NAME"
}

download_jdk() {
  mkdir -p "$TMP_DIR"
  local tarball="$TMP_DIR/${JDK_TARBALL_NAME}"
  local expected_sha1
  echo "Fetching BellSoft published checksums from $JDK_SHA1SUMS_URL"
  expected_sha1="$(fetch_expected_sha1)"

  echo "Downloading BellSoft Liberica JDK ${JDK_VERSION} from GitHub releases..."
  curl -fL --retry 3 --retry-delay 2 -o "$tarball" "$JDK_URL"

  echo "Verifying SHA1 of downloaded tarball..."
  verify_tarball_sha1 "$tarball" "$expected_sha1"

  echo "Extracting JDK ${JDK_VERSION}..."
  rm -rf "$TMP_DIR/jdk-17-extract"
  mkdir -p "$TMP_DIR/jdk-17-extract"
  tar -xzf "$tarball" -C "$TMP_DIR/jdk-17-extract" --strip-components=0
  local extracted
  extracted="$(find "$TMP_DIR/jdk-17-extract" -mindepth 1 -maxdepth 1 -type d -name 'jdk-*' | head -n 1 || true)"
  if [ -z "$extracted" ]; then
    echo "Error: could not find extracted JDK directory under $TMP_DIR/jdk-17-extract" >&2
    exit 1
  fi
  rm -rf "$JDK_DIR"
  ln -sfn "$extracted" "$JDK_DIR"
  rm -f "$tarball"
}

if ! validate_cached_jdk; then
  download_jdk
  if ! validate_cached_jdk; then
    echo "Error: downloaded JDK at $JDK_DIR is not BellSoft Liberica major $EXPECTED_MAJOR." >&2
    "$JDK_DIR/bin/java" -version >&2 || true
    exit 1
  fi
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"
unset JAVA_VERSION

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
# Include every Android SDK tool path needed for a no-emulator Gradle build
# so the script is self-contained and does not rely on ambient PATH entries.
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/build-tools"

echo "Using Java:"
java -version

echo ""
echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "ANDROID_SDK_ROOT: $ANDROID_SDK_ROOT"

if [ ! -d "$REPO_ROOT/android" ]; then
  echo ""
  echo "android/ directory not found. Running Expo prebuild first."
  cd "$REPO_ROOT"
  EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install --clean
fi

echo ""
echo "Building Android $VARIANT APK..."
cd "$REPO_ROOT/android"
./gradlew "$GRADLE_TASK" --stacktrace

echo ""
echo "Build complete. APK located at:"
echo "  android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
