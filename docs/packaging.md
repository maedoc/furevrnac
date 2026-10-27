# Packaging Furevrnac for Android & iOS

Furevrnac is a static web app, wrapped with [Capacitor](https://capacitorjs.com/)
for native distribution. Free, offline-first, no permissions beyond the local
asset server, no telemetry — store review should be minimal.

## One-time setup (already done in this repo)

- `capacitor.config.ts` — appId `app.furevrnac`, webDir `dist`
- `android/` and `ios/` native projects committed
- `npm run build:native` builds Vite with `base: "/"` (web build keeps
  `/furevrnac/` for GitHub Pages)
- App icons generated from `public/icon.svg` into Android mipmaps and
  `ios/App/App/Icon-1024.png`

## Android

```sh
npm run sync:android          # build web + copy into android/app/src/main/assets/public
cd android && ./gradlew assembleDebug     # installable debug APK
cd android && ./gradlew bundleRelease     # AAB for Play Store
```

Requirements: JDK 21, Android SDK (platform 35 / build-tools 35).

Artifacts land in `android/app/build/outputs/`.

### Signing (do once on your machine, never commit keys)

```sh
keytool -genkey -v -keystore furevrnac.keystore -alias furevrnac \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then add to `android/app/build.gradle` a signingConfig pointing at
`furevrnac.keystore` via `local.properties` (already gitignored), or set the
`KEYSTORE_PATH`/`KEYSTORE_PASSWORD` secrets and wire them into the
`native-release.yml` workflow. Play Store upload requires a signed AAB.

### Play Store checklist

- Create app in Play Console (one-time $25 fee)
- Upload signed AAB, fill store listing with icon/screenshots
- No data-safety declarations beyond "no data collected"
- Internal testing track → production

## iOS

```sh
npm run sync:ios
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -sdk iphoneos build
```

Or open `ios/App/App.xcworkspace` in Xcode: set your team, set the bundle ID
(currently `app.furevrnac`, change if needed), and archive.

Requirements: macOS with Xcode 15+ and CocoaPods (`pod install` inside
`ios/App`).

### App Store checklist

- Apple Developer Program membership (one-time $99/yr)
- App must be signed with a distribution certificate/profile
- Info.plist usage descriptions: none needed — the app requests no permissions
- TestFlight for testing, then App Store review

## CI

`.github/workflows/native-release.yml` builds the debug APK and unsigned AAB
on every `v*` tag and attaches them to the GitHub Release. Push a tag:

```sh
git tag v0.1.0 && git push origin v0.1.0
```
