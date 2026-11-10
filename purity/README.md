# Purity

A private messenger that keeps working when the internet doesn't. No account, no phone number, no server, no subscription.

Purity is an Android app built on [bitchat-android](https://github.com/permissionlesstech/bitchat-android) (see [NOTICE.md](NOTICE.md)). It talks to people in three ways and picks the best one that is available:

| Situation | What Purity uses | Cost |
|---|---|---|
| Network blackout, no signal, protest, disaster, flight, remote area | **Bluetooth LE mesh**. Phones relay messages for each other, up to 7 hops. **Wi-Fi Aware** on supported phones for faster transfers. | Free. No data plan needed. |
| Internet works | **Nostr relays** (public, free) for private messages and location channels. | Free. Uses a little mobile data. |
| Internet works but is watched or filtered | **Tor** (built-in Arti) | Free. |

## Features

- Private 1:1 chat, end-to-end encrypted with the Noise protocol (X25519, ChaCha20-Poly1305). Forward secrecy.
- Group channels (`/join #name`), optional password (Argon2id + AES-256-GCM).
- Location channels using geohash: talk to people near you over the internet.
- Voice messages, images and files over the mesh.
- Favorites. Messages to a favorite fall back to the internet if they are out of Bluetooth range, and queue and retry if they are unreachable.
- Share the Purity APK phone to phone with no internet (Wi-Fi hotspot), so it spreads even during a blackout.
- Emergency wipe: triple-tap the logo to erase everything.
- Translated into 40+ languages, including Persian.
- Wear OS companion module (`wear/`).

## Why this base

I compared the open-source messengers that can work off the grid:

| Project | Bluetooth | Works with no internet | No accounts or servers | Notes |
|---|---|---|---|---|
| **bitchat-android** | Yes (mesh, multi-hop) | Yes | Yes | Active, Kotlin/Compose, Noise E2EE, internet fallback (Nostr, Tor), file and voice. **Chosen.** |
| Briar | Yes | Yes (Bluetooth, Wi-Fi) | Yes | Strong security, but built around contacts you add first, not an open nearby mesh. |
| Berty | Yes (BLE) | Partly | Partly | Complex Go/libp2p stack, harder to maintain. |
| Meshtastic | No (needs LoRa radio) | Yes | Yes | Needs extra hardware (~$20-40 per person). |
| Signal, Matrix/Element, Session | No | No | No or partly | Need internet and servers. Signal needs a phone number. |

## Cost

Zero to run. There is no server to rent, no SMS, no per-user fee. Mesh mode uses no data at all. Internet mode uses free public relays.

## Build

Needs the Android SDK (API 37) and JDK 21.

```bash
cd purity
./gradlew :app:assembleRelease      # APKs in app/build/outputs/apk/release/
./gradlew test                      # unit tests
```

Or let GitHub build it: push to `main` and the **Purity APK** workflow publishes the download link in the repository README. You can also run it by hand from the Actions tab.

### Stable signing key

Android only installs an update over an existing app if both APKs were signed with the same key. Create the key once and store it as repository secrets:

```bash
keytool -genkeypair -keystore purity.jks -alias purity -keyalg RSA -keysize 4096 -validity 36500
base64 -w0 purity.jks     # paste into the PURITY_KEYSTORE_B64 secret
```

Secrets to add (Settings, Secrets and variables, Actions): `PURITY_KEYSTORE_B64`, `PURITY_KEYSTORE_PASSWORD`, `PURITY_KEY_ALIAS`. Keep `purity.jks` and its password private and backed up. Without these secrets the workflow still builds, but signs with a throw-away key.

## What differs from upstream

- Name, icon, strings (all languages), application id `app.purity.messenger`, version `1.0.0`.
- The in-app updater and "share the app" feature download Purity from this repository, not from upstream.
- Internal Kotlin packages are still `com.bitchat.android` to keep the diff to upstream small and merges easy.
- The Bluetooth service ids and packet format are unchanged, so Purity phones can also relay for, and chat with, bitchat phones.

## Known limits

- Android only (API 26+). iOS is not included.
- Bluetooth range is tens of metres per hop. Dense crowds work best.
- Android requires location permission for Bluetooth scanning. It is used for that, and for location channels only if you open them.
- Radio behaviour can only be tested on real phones. Test with at least three devices before relying on it.
- Not independently audited.
