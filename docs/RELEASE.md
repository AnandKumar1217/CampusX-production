# CampusX Android Release Guide

This guide documents the safe high-level process used for CampusX Android releases. Private signing material and service credentials must never be committed to Git.

## 1. Version Source

The tracked Expo configuration is the source of truth:

- `apps/mobile/app.json`
  - `expo.version`
  - `expo.android.versionCode`

For the current release:

- version: `1.0.1`
- versionCode: `2`
- package: `com.campusx.mobile`

The local native Android project under `apps/mobile/android/` is intentionally gitignored. Before a release build, verify its generated/native `versionName` and `versionCode` match the tracked Expo configuration. Do not regenerate the native project destructively just to change release metadata.

## 2. Pre-Flight Validation

From the repository root:

```bash
npm run typecheck
npm run test --workspace @campusx/mobile
npm run test:integration:memory --workspace @campusx/backend
npm run build --workspace @campusx/backend
```

All checks must pass before building a release artifact.

## 3. Production Backend Check

Verify:

`https://campusx-production.onrender.com/api/health`

The production service and database should report healthy/connected status before release testing.

## 4. Production Mobile Environment

Before the Android release build, ensure the mobile build uses the production endpoints:

- `EXPO_PUBLIC_API_URL=https://campusx-production.onrender.com/api`
- `EXPO_PUBLIC_SOCKET_URL=https://campusx-production.onrender.com`

Do not embed private secrets in `EXPO_PUBLIC_*` variables.

## 5. Release Signing

Use the permanent CampusX release signing identity stored outside the repository.

Never:
- create a replacement key for an existing app update,
- commit a keystore,
- commit signing passwords,
- paste private key material into documentation.

Verify the release variant points to the expected signing identity before building.

## 6. Build

From the local native Android project:

```bash
cd apps/mobile/android
./gradlew clean
./gradlew assembleRelease
```

On Windows PowerShell use `./gradlew.bat` or `.\gradlew` as appropriate.

The standard output is:

`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## 7. Verify the APK

Use Android SDK tools to validate:

```bash
aapt dump badging app-release.apk
apksigner verify --print-certs app-release.apk
```

Confirm the expected:

- package name
- version name
- version code
- signing certificate

Do not distribute an artifact if any of these values are wrong.

## 8. Physical QA

Before broad distribution, test on real Android devices:

- update-install over the previous correctly signed version
- login/logout and core navigation
- friend request and chat push notifications
- notification tap routing
- silent on-demand location refresh
- Location Sharing OFF behavior
- offline/force-stopped location fallback
- support email
- mini-game result handling

Silent background delivery is best-effort on Android and can be restricted by force-stop, Doze, or OEM battery policies.

## 9. Distribution

APK/AAB files are release artifacts and are intentionally excluded from Git. Keep the source repository focused on source code, tests, configuration templates, and documentation.
