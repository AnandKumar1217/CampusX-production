# CampusX Android Release Guide

This document outlines the safe, standard procedure for building and validating a production Android release for CampusX.

## 1. Version Bump
Update the version strings in `apps/mobile/android/app/build.gradle`:
- `versionName` (e.g., `"1.0.2"`)
- `versionCode` (e.g., `3`)

## 2. Pre-Flight Checks
Ensure the codebase is stable and passes all validations:
```bash
npm run typecheck
npm run test --workspace @campusx/mobile
npm run test:integration:memory --workspace @campusx/backend
```

## 3. Backend Health Verification
Verify that the production environment is deployed and responding successfully:
- Hit `https://campusx-production.onrender.com/api/health` and ensure it returns `200 OK`.

## 4. Local Android Release Build
Ensure your signing keystore (`.jks` or `.keystore`) is placed securely in the location specified by your `build.gradle` (usually outside the repository directory or strictly gitignored). 
**NEVER COMMIT THE KEYSTORE OR PASSWORDS TO GIT.**

Clean previous builds and generate the APK:
```bash
cd apps/mobile/android
./gradlew clean
./gradlew assembleRelease
```
The output artifact will be generated at:
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## 5. APK Verification
Use Android SDK tools to verify the generated APK metadata and signature:
```bash
# Verify Package and Version
aapt dump badging apps/mobile/android/app/build/outputs/apk/release/app-release.apk

# Verify Signature
apksigner verify --print-certs apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 6. Device Smoke Tests
Before broad distribution, test the APK on physical devices:
1. **Push Test:** Verify FCM V1 background push notifications arrive reliably when the app is closed.
2. **Location Test:** Verify that the on-demand location refresh works seamlessly, updating the UI without triggering visible notifications on the target device.
3. **Core Flows:** Test Authentication, Chat, Feed, and Minigames.

## 7. Distribution
Once validated, the `app-release.apk` (or `.aab` for the Play Store) is ready for distribution. Remember that these binary artifacts are considered local outputs and should **never** be tracked in version control.
