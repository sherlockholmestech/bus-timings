#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$SCRIPT_DIR/tmp"
JDK_DIR="$TMP_DIR/jdk-17"

# Download JDK 17 if not already present
if [ ! -d "$JDK_DIR/bin" ]; then
  echo "JDK 17 not found in ./tmp. Downloading Eclipse Temurin JDK 17..."
  mkdir -p "$TMP_DIR"

  JDK_TAR="$TMP_DIR/jdk17.tar.gz"
  JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.14_7.tar.gz"

  curl -L -o "$JDK_TAR" "$JDK_URL"

  echo "Extracting..."
  mkdir -p "$TMP_DIR/jdk17-extract"
  tar -xzf "$JDK_TAR" -C "$TMP_DIR/jdk17-extract" --strip-components=0

  # Find the extracted jdk folder and symlink it
  EXTRACTED_JDK=$(find "$TMP_DIR/jdk17-extract" -maxdepth 1 -type d -name 'jdk-*' | head -n 1)
  if [ -z "$EXTRACTED_JDK" ]; then
    echo "Error: Could not find extracted JDK directory"
    exit 1
  fi

  ln -sfn "$EXTRACTED_JDK" "$JDK_DIR"
  rm -f "$JDK_TAR"
  echo "JDK 17 ready at $JDK_DIR"
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

# Set Android SDK path
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

echo "Using Java:"
java -version

echo ""
echo "ANDROID_HOME: $ANDROID_HOME"

echo "Building Android release APK..."
cd "$SCRIPT_DIR/android"
./gradlew assembleRelease

echo ""
echo "Build complete. APK located at:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
