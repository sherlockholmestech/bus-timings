#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
TMP_DIR="$REPO_ROOT/tmp"
JDK_DIR="$TMP_DIR/jdk-17"
JDK_VERSION="17.0.15+12"
JDK_TARBALL_NAME="bellsoft-jdk${JDK_VERSION}-linux-amd64-crac.tar.gz"
JDK_URL="https://github.com/bell-sw/Liberica/releases/download/${JDK_VERSION//+/%2B}/${JDK_TARBALL_NAME}"
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
  if [ ! -x "$JDK_DIR/bin/java" ]; then
    return 1
  fi
  local version_output
  if ! version_output="$("$JDK_DIR/bin/java" -version 2>&1)"; then
    echo "Cached JDK at $JDK_DIR failed to report a version. Removing."
    rm -rf "$JDK_DIR"
    return 1
  fi
  local vendor major
  vendor="$(printf '%s\n' "$version_output" | head -n 1)"
  major="$(printf '%s\n' "$version_output" | head -n 1 | sed -nE 's/.*"([0-9]+)\..*/\1/p')"
  case "$vendor" in
    *"$EXPECTED_VENDOR"*) ;;
    *)
      echo "Cached JDK vendor mismatch (expected $EXPECTED_VENDOR, got: $vendor). Removing $JDK_DIR."
      rm -rf "$JDK_DIR"
      return 1
      ;;
  esac
  if [ "$major" != "$EXPECTED_MAJOR" ]; then
    echo "Cached JDK major version mismatch (expected $EXPECTED_MAJOR, got: $major). Removing $JDK_DIR."
    rm -rf "$JDK_DIR"
    return 1
  fi
  return 0
}

download_jdk() {
  mkdir -p "$TMP_DIR"
  local tarball="$TMP_DIR/${JDK_TARBALL_NAME}"
  echo "Downloading BellSoft Liberica JDK ${JDK_VERSION} from GitHub releases..."
  curl -fL --retry 3 --retry-delay 2 -o "$tarball" "$JDK_URL"
  echo "Extracting JDK ${JDK_VERSION}..."
  rm -rf "$TMP_DIR/jdk-17-extract"
  mkdir -p "$TMP_DIR/jdk-17-extract"
  tar -xzf "$tarball" -C "$TMP_DIR/jdk-17-extract" --strip-components=0
  local extracted
  extracted="$(find "$TMP_DIR/jdk-17-extract" -maxdepth 1 -type d -name 'jdk-*' | head -n 1 || true)"
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
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

echo "Using Java:"
java -version

echo ""
echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"

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
