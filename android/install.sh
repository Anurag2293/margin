#!/usr/bin/env bash
# Build the signed release APK and install it on the phone over adb.
#   ./install.sh            uses the first adb device that is not an emulator
#   ./install.sh SERIAL     uses that device
set -euo pipefail
cd "$(dirname "$0")"
./gradlew testDebugUnitTest assembleRelease --console=plain -q
serial="${1:-$(adb devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')}"
[[ -n "$serial" ]] || { echo "no phone on adb; run: ferry adb connect" >&2; exit 1; }
adb -s "$serial" install -r app/build/outputs/apk/release/app-release.apk
for host in margin-eight-fawn.vercel.app margin-anurag2293s-projects.vercel.app; do
  adb -s "$serial" shell pm set-app-links-user-selection --user cur --package com.anurag.margin true "$host"
done
echo "installed on $serial"
