#!/usr/bin/env bash
# Builds Neon.apk (and Neon.aab for Google Play with --aab) with the plain Android build tools, no Gradle.
# Needs ANDROID_HOME and a JDK. The app page comes from ../web.
# Signing: set NEON_KEYSTORE_B64 (base64 of a .jks), NEON_KEY_PASS and NEON_KEY_ALIAS to sign with your release key;
# without them the committed test key is used (fine for sideloading, not for the Play Store).
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
JAR="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
rm -rf build assets && mkdir -p build/gen build/classes build/dex assets
cp ../web/*.js ../web/index.html ../web/icon.png assets/ && rm assets/test.js assets/sw.js
LINK=(-I "$JAR" --manifest AndroidManifest.xml -A assets --min-sdk-version 26 --target-sdk-version 35 --version-code "${VERSION_CODE:-1}" --version-name "${VERSION_NAME:-1.0}")
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk "${LINK[@]}" --java build/gen build/res.zip
javac -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath "$JAR" -classpath "$JAR" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --min-api 26 --lib "$JAR" --output build/dex $(find build/classes -name '*.class')

if [ -n "${NEON_KEYSTORE_B64:-}" ]; then
  echo "$NEON_KEYSTORE_B64" | base64 -d > build/release.jks; KS=build/release.jks; PASS="$NEON_KEY_PASS"; ALIAS="${NEON_KEY_ALIAS:-neon}"; echo "Signing with the release key"
else
  KS=neon-test.jks; PASS=neon-test; ALIAS=neon; echo "Signing with the TEST key (not for Google Play)"
fi

cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --ks-key-alias "$ALIAS" --out Neon.apk build/aligned.apk
"$BT/apksigner" verify Neon.apk
# launch checks: right package and Android version, and no internet access at all
B="$("$BT/aapt2" dump badging Neon.apk)"
echo "$B" | grep -E "^package:|^sdkVersion|^targetSdkVersion|^uses-permission"
echo "$B" | grep -q "name='com.priorcenter.neon'" && echo "$B" | grep -q "targetSdkVersion:'35'" && ! echo "$B" | grep -q "android.permission.INTERNET" || { echo "APK launch check failed"; exit 1; }
echo "Built $(pwd)/Neon.apk"

if [ "${1:-}" = "--aab" ]; then
  # Play Store bundle: same app linked in protobuf format, laid out as a bundletool base module
  BUNDLETOOL="${BUNDLETOOL:-build/bundletool.jar}"
  [ -f "$BUNDLETOOL" ] || curl -sSL -o "$BUNDLETOOL" https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar
  "$BT/aapt2" link --proto-format -o build/proto.apk "${LINK[@]}" build/res.zip
  rm -rf build/module && mkdir -p build/module/manifest build/module/dex && (cd build/module && unzip -q ../proto.apk)
  mv build/module/AndroidManifest.xml build/module/manifest/ && cp build/dex/classes.dex build/module/dex/
  (cd build/module && zip -qr ../base.zip .)
  rm -f Neon.aab && java -jar "$BUNDLETOOL" build-bundle --modules=build/base.zip --output=Neon.aab
  jarsigner -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -sigalg SHA256withRSA -digestalg SHA-256 Neon.aab "$ALIAS" >/dev/null
  java -jar "$BUNDLETOOL" validate --bundle=Neon.aab >/dev/null && echo "bundletool: Neon.aab is valid"
  java -jar "$BUNDLETOOL" dump manifest --bundle=Neon.aab | grep -E "package=|targetSdkVersion|uses-permission"
  echo "Built $(pwd)/Neon.aab"
fi
