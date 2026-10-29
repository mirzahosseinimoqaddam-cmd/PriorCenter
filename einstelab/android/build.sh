#!/usr/bin/env bash
# Builds EinsteLab.apk with the plain Android build tools (no Gradle). Needs ANDROID_HOME and a JDK.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
JAR="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
rm -rf build && mkdir -p build/gen build/classes build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml -A assets --java build/gen build/res.zip \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "${VERSION_CODE:-1}" --version-name "${VERSION_NAME:-1.0}"
javac -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath "$JAR" -classpath "$JAR" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --min-api 26 --lib "$JAR" --output build/dex $(find build/classes -name '*.class')
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
# one fixed test key, so updates install over the old app and the phone id stays the same
"$BT/apksigner" sign --ks einstelab-test.jks --ks-pass pass:einstelab --key-pass pass:einstelab --out EinsteLab.apk build/aligned.apk
echo "Built $(pwd)/EinsteLab.apk"
