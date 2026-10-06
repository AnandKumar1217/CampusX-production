<div align="center">
  <img src="apps/mobile/assets/branding/campusx-logo-new-transparent.png" alt="CampusX Logo" width="120" />
</div>

# CampusX

**A full-stack mobile campus ecosystem for student communities, communication, discovery, utilities, and AI assistance.**

CampusX is a mobile-first platform that brings common campus activities into one application: social networking, messaging, groups, events, marketplace, timetable tools, campus discovery, on-demand friend location, notifications, mini-games, and CampusAI.

## Core Features

### Social & Community
- Campus feed, posts, and stories
- Student profiles, friends, requests, and suggestions
- Saved content
- Groups and clubs

### Communication
- One-to-one chat
- Real-time Socket.IO updates
- Notification center
- Production Android push notifications

### Discover & Location
- Campus map and friend location display
- Cached last-shared location
- Location Sharing ON / OFF
- Explicit on-demand friend location refresh
- Socket fast-path plus silent data push where Android allows background delivery
- Cached fallback when the target device is unavailable

CampusX intentionally avoids constant 60-second GPS polling. Continuous 24/7 tracking and Ghost Mode are not product features.

### Campus Utilities
- Events and calendar
- Marketplace
- Timetable
- Weather
- Search
- QR profile sharing/scanning

### CampusAI
CampusAI provides an in-app AI assistant through the backend AI provider abstraction. Provider credentials remain server-side.

### Entertainment
CampusX includes local mini-games for lightweight in-app play.

## Architecture

```text
CampusX Mobile
(Expo React Native + TypeScript)
        |
        | REST API + Socket.IO
        v
CampusX Backend
(Node.js + Express + TypeScript)
        |
        +---- MongoDB Atlas
        +---- Expo Push / FCM V1
        +---- Media / Email / AI integrations
```

- **Mobile:** Expo SDK 54, React Native, TypeScript, React Navigation, Zustand, TanStack Query
- **Backend:** Node.js, Express, TypeScript, Mongoose
- **Database:** MongoDB Atlas
- **Realtime:** Socket.IO
- **Push:** Expo push tokens with FCM V1 delivery on Android
- **Hosting:** Render

## Repository Structure

```text
CampusX-production/
├── apps/
│   ├── mobile/
│   │   ├── assets/
│   │   ├── scripts/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── app.json
│   │   ├── app.config.js
│   │   └── package.json
│   └── backend/
│       ├── scripts/
│       ├── src/
│       ├── tests/
│       └── package.json
├── assets-reference/
│   └── original/
├── docs/
├── package.json
├── package-lock.json
├── render.yaml
└── README.md
```

`assets-reference/original/` contains canonical design references used for implementation and visual QA; they are not runtime screens.

## On-Demand Friend Location

- Location Sharing has only ON / OFF states.
- The last shared friend location remains cached for immediate viewing.
- Viewing a friend on the map/profile can request one fresh location.
- Active target devices can receive the refresh request through Socket.IO.
- Background devices can receive a silent data push where the OS permits delivery.
- The target requests one GPS fix and posts it with `source: "on_demand"`.
- `requestId` deduplication prevents the same socket + push request from intentionally causing duplicate refreshes.
- If sharing is OFF, no new GPS refresh occurs.
- If refresh fails, the previous cached location stays visible.
- Android force-stop, Doze, and battery restrictions can delay or prevent background delivery.

## Push Notifications

CampusX uses Expo push tokens with FCM V1 for Android production delivery. The app supports token registration, visible notifications, notification-tap routing, logout/login token lifecycle handling, and silent data-only messages for the on-demand location workflow.

## Getting Started

### Prerequisites
- Node.js 20+
- npm
- Android Studio / Android SDK for Android development
- MongoDB instance
- Required third-party service credentials for the features you enable

### Install

```bash
npm install
```

### Environment Setup

Backend:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Mobile:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Never commit real `.env` files or private credentials.

## Environment Variables

Backend configuration covers categories such as MongoDB, JWT, email, AI providers, media storage, and other server integrations documented in `apps/backend/.env.example`.

Mobile public configuration includes:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

`EXPO_PUBLIC_*` values are bundled into the client and must never contain private server secrets.

## Development Commands

```bash
npm run backend
npm run mobile
npm run mobile:android
npm run typecheck
npm run test
```

## Testing

```bash
npm run typecheck
npm run test --workspace @campusx/mobile
npm run test:integration:memory --workspace @campusx/backend
npm run build --workspace @campusx/backend
```

These commands cover TypeScript validation, mobile unit/contract tests, backend in-memory integration tests, and the backend production build.

## Production

- **Backend:** https://campusx-production.onrender.com
- **API:** https://campusx-production.onrender.com/api
- **Health:** https://campusx-production.onrender.com/api/health

Private deployment credentials are configured outside source control.

## Android Release

- **Current version:** CampusX v1.0.1
- **Package:** `com.campusx.mobile`
- **Version code:** `2`

Production Android releases must use the permanent CampusX signing identity stored outside Git. APK/AAB binaries and signing material are not committed to this repository.

See [docs/RELEASE.md](docs/RELEASE.md) for the release checklist.

## Security & Privacy

- Secrets and signing material are excluded from source control.
- Database credentials remain backend-side.
- Mobile authentication uses JWT-based sessions with tokens stored using `expo-secure-store`.
- Accepted friendship is the access boundary for friend-location requests.
- Location Sharing can be disabled at any time.
- Sensitive service credentials remain in server/deployment environments.

## Documentation

Start with the [documentation index](docs/README.md).

Key references:
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Release Guide](docs/RELEASE.md)
- [API Matrix](docs/API_MATRIX.md)
- [Navigation Map](docs/NAVIGATION_MAP.md)
- [Project Status](docs/PROJECT_STATUS.md)
- [QA Report](docs/QA_REPORT.md)

## Current Status

- **Current release:** CampusX v1.0.1
- **Production backend:** Deployed
- **Android APK:** Release build metadata and signature validated
- **Physical push/on-demand-location QA:** Pending final two-device verification unless completed separately
