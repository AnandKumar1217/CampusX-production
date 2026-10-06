<div align="center">
  <img src="apps/mobile/assets/branding/campusx-logo-new-transparent.png" alt="CampusX Logo" width="120" />
</div>

# CampusX

**A full-stack mobile campus ecosystem that connects students, communities, communication, discovery, utilities and AI in one application.**

CampusX is a mobile-first campus platform designed to bring common student activities into one application. By integrating social networking, real-time communication, campus utilities, and on-demand location discovery, CampusX offers a unified experience tailored specifically for student life.

## Overview
CampusX eliminates the need for multiple fragmented apps by providing a seamless, all-in-one ecosystem. Whether you are checking your timetable, messaging a friend, discovering what's happening on campus, or finding where your friends are, CampusX brings it all together with a beautiful, fast, and reliable mobile experience.

## Core Features

### Social & Community
- **Campus Feed:** Stay updated with what's happening around you.
- **Posts & Stories:** Share moments and thoughts with your campus.
- **User Profiles:** Build your identity and discover others.
- **Friends & Networking:** Send friend requests, accept suggestions, and manage your network.
- **Saved Content:** Bookmark important posts and events.
- **Groups / Clubs:** Connect with like-minded students and campus organizations.

### Communication
- **One-to-One Chat:** Fast, reliable messaging.
- **Real-Time Communication:** Powered by Socket.IO for instant delivery.
- **Notification Center:** Keep track of your activities and alerts.
- **Push Notifications:** Production-ready background notifications ensure you never miss a message.

### Discover & Location
- **Campus Map:** Navigate your campus effortlessly.
- **Friend Location Display:** See where your friends are on demand.
- **Cached Location:** View the last known shared location instantly.
- **Location Sharing Toggle:** Privacy first—easily turn your location sharing ON or OFF.
- **On-Demand Refresh:** Request fresh locations natively without draining battery.
- **Silent Background Sync:** Utilizes FCM V1 for silent data pushes to update locations securely.

*Note: CampusX intentionally avoids constant 60-second GPS polling to preserve battery life and prioritize user privacy. Continuous 24/7 live tracking and Ghost Mode are not features of this product.*

### Campus Utilities
- **Events & Calendar:** Keep track of campus events.
- **Marketplace:** Buy and sell items within your campus.
- **Timetable:** Manage your daily classes.
- **Weather:** Get real-time campus weather updates.
- **Search:** Find people, posts, and groups easily.
- **QR Sharing:** Share and scan profiles quickly.

### AI (CampusAI)
CampusX integrates intelligent AI assistance tailored for student needs, providing helpful insights and dynamic content moderation while keeping interactions safe and responsive.

### Entertainment
- **Mini-Games:** Play quick games like Tic-Tac-Toe with friends directly within the app.

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
        |
        +---- Expo Push / FCM V1
        |
        +---- Cloud / Email / AI Integrations
```

- **Mobile:** Built with Expo SDK 54, React Native, TypeScript, React Navigation, Zustand, and TanStack Query.
- **Backend:** Powered by Node.js, Express, and TypeScript.
- **Database:** MongoDB Atlas for scalable, managed data storage.
- **Realtime:** Socket.IO for chat and instant location syncing.
- **Push:** Expo Push Notifications and FCM V1 for reliable Android production delivery.
- **Hosting:** Backend deployed securely on Render.

## On-Demand Friend Location
- Location Sharing has only ON/OFF states.
- Last shared location is cached for immediate viewing.
- A friend can request a fresh location intentionally by viewing a profile or the map.
- If the target app is active, Socket.IO delivers the refresh request instantly.
- If background delivery is supported, CampusX uses a silent data push to wake the device.
- The target requests a single GPS fix for that specific request.
- `requestId` deduplication prevents the same socket + push request from causing duplicate refreshes.
- If sharing is OFF, no new GPS refresh occurs.
- If the refresh fails (offline or force-stopped), the old cached location remains visible.
- Android battery restrictions and force-stops may prevent background delivery.
- No constant 60-second foreground or background polling is used, maximizing battery efficiency.

## Push Notifications
- Utilizes Expo push tokens and FCM V1 for Android.
- Handles token registration, visible notifications, and deep-link routing on tap.
- Robust device-token lifecycle management across logouts and logins.
- Employs data-only notifications for appropriate background tasks like on-demand location fetching.

## Getting Started

### Prerequisites
- Node.js 20+
- npm
- Android Studio / Android SDK (for native Android development)
- MongoDB instance (Atlas or local)
- Configured third-party services (Cloudinary, Brevo, AI Provider)

### Installation
Clone the repository and install dependencies from the root:
```bash
npm install
```

### Environment Setup
**Backend:**
Copy the example environment file and configure it:
```bash
cp apps/backend/.env.example apps/backend/.env
```
**Mobile:**
Copy the example environment file and configure public variables:
```bash
cp apps/mobile/.env.example apps/mobile/.env
```
*(Do NOT include real secret values in `.env.example` or commit `.env` to source control).*

## Environment Variables
- **Backend:** Requires configuration for MongoDB connection strings, JWT secrets, email providers (Brevo), AI providers, Cloudinary, and production frontend/app URLs.
- **Mobile:** Requires public endpoints like `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL`. *Note: EXPO_PUBLIC values must never contain private server secrets.*

## Development Commands
From the repository root, you can run:
- `npm run backend` - Start the backend development server.
- `npm run mobile` - Start the Expo mobile bundler.
- `npm run mobile:android` - Run the mobile app on an Android emulator/device.
- `npm run typecheck` - Run TypeScript validation across the workspace.
- `npm run test` - Run tests across the workspace.

## Testing
- **Mobile Unit/Contract Tests:** `npm run test --workspace @campusx/mobile`
- **Backend Integration Tests (In-Memory):** `npm run test:integration:memory --workspace @campusx/backend`
- **TypeScript Validation:** `npm run typecheck`
- **Backend Production Build:** `npm run build --workspace @campusx/backend`

## Production

**Public Endpoints:**
- **Backend URL:** https://campusx-production.onrender.com
- **API URL:** https://campusx-production.onrender.com/api
- **Health Check:** https://campusx-production.onrender.com/api/health

Private credentials are configured using Render deployment environment variables and are never committed to source control.

## Android Release
- **Current Version:** CampusX v1.0.1
- **Android Package:** `com.campusx.mobile`
- **Version Code:** 2

Production Android releases are signed using the permanent CampusX signing identity stored securely outside Git. *APK files are local release artifacts and are NOT committed to Git.*

## Security & Privacy
- Sensitive secrets, database credentials, and signing identities are strictly excluded from source control.
- Authentication relies on secure, HttpOnly-capable (or secure token) JWT flows.
- Strict friendship boundaries control who can request or view friend locations.
- Location sharing can be explicitly disabled at any time, returning only cached data.
- Private signing credentials and service accounts remain external to Git.

## Documentation
For more detailed information, please refer to our internal documentation index:
- [Documentation Index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Release Guide](docs/RELEASE.md)

## Current Status
- **Current release:** CampusX v1.0.1
- **Production backend:** Deployed
- **Android APK:** Release build validated
