# Launching NEON on Google Play

Everything here is built and checked by GitHub Actions on every push to `neon/**`
(all games played headless, APK signature verified, package `com.priorcenter.neon`, target SDK 35, no Internet
permission, AAB validated with bundletool):

- APK (install on any Android phone): https://github.com/mirzahosseinimoqaddam-cmd/PriorCenter/releases/download/neon-latest/Neon.apk
- AAB (upload to Google Play): https://github.com/mirzahosseinimoqaddam-cmd/PriorCenter/releases/download/neon-latest/Neon.aab

**Before the first Play Store upload, do step 1–2 below.** Until then both files are signed with the test key that is
public in this repo; Google Play would accept it as your upload key, but anyone could then sign updates as you.

## 1. Make your release key (once, keep it forever)

```bash
keytool -genkeypair -v -keystore neon-release.jks -alias neon -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 neon-release.jks > neon-release.b64
```

Back up `neon-release.jks` and its password somewhere safe. If you lose it you can never update the app.
Never commit it.

## 2. Give it to GitHub

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `NEON_KEYSTORE_B64` | the contents of `neon-release.b64` |
| `NEON_KEY_PASS` | the keystore password |
| `NEON_KEY_ALIAS` | `neon` |

The next build signs the APK and the AAB with your key (the log says "Signing with the release key").
Note: phones that installed the test-key APK must uninstall it once before installing the release-key one.

## 3. Play Console

1. Create the app: name **NEON**, game, free.
2. Upload `Neon.aab` to Internal testing first, then Production.
3. Store listing: text from `listing.md`, images from `screens/` (8 phone screenshots + `feature-graphic.png`), icon `../web/icon.png`.
4. Privacy policy: publish `../PRIVACY.md` (for example as a GitHub page) and paste its link.
5. Data safety: **no data collected, no data shared**. Content rating questionnaire: no violence beyond abstract shapes, no user content, no ads.
6. Target audience: everyone (13+ is the safe choice unless you go through the Families programme).

## Regenerating screenshots

`node neon/store/shots.js` (uses demo progress so the profile screens are filled in).
