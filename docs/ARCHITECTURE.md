# CampusX Architecture

## Monorepo Structure

CampusX uses npm workspaces with two primary applications:

- `apps/mobile` — Expo React Native mobile application
- `apps/backend` — Node.js/Express API and Socket.IO server

The root workspace owns the canonical dependency lockfile and shared development commands.

## Mobile Architecture

- **Framework:** Expo SDK 54 / React Native 0.81
- **Language:** TypeScript
- **Navigation:** React Navigation
- **State:** Zustand
- **Server state/data fetching:** TanStack Query
- **Forms/validation:** React Hook Form and Zod where used
- **UI:** React Native components and shared `StyleSheet`-based design primitives
- **Secure local token storage:** `expo-secure-store`

The mobile app communicates with the backend over REST and Socket.IO. It does not connect directly to MongoDB Atlas.

## Backend Architecture

- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Database layer:** Mongoose
- **Database:** MongoDB Atlas in production
- **Realtime:** Socket.IO
- **Push:** Expo push service with FCM V1 credentials configured for Android production delivery

## Authentication

CampusX uses email/password authentication backed by JWT-based sessions. The mobile client stores session material securely and sends the access token with authenticated API requests.

No OAuth flow is documented as part of the current v1.0.1 product.

## Communication Flow

```text
Mobile app
   |
   | REST API
   | Socket.IO
   v
Backend
   |
   +--> MongoDB Atlas
   +--> Expo Push / FCM V1
   +--> Email / media / AI provider integrations
```

REST is used for authenticated API operations and initial data loading. Socket.IO handles realtime events such as chat, presence, notifications, and location updates.

## On-Demand Friend Location

1. User A intentionally requests User B's location from the map or profile.
2. The backend validates that A and B are accepted friends.
3. If User B has Location Sharing OFF, no refresh request is sent and the last shared location can remain visible.
4. If sharing is ON, the backend creates a unique `requestId`.
5. The request is delivered over Socket.IO and also through a silent data push for background delivery where supported.
6. The target device deduplicates the request so the same `requestId` is processed once.
7. The target requests a single GPS fix and posts it with `source: "on_demand"`.
8. The backend saves the new point and emits the update to friends, including the `requestId`.
9. The requester correlates that response to the pending refresh and updates the UI.

The last shared location remains available as a fallback. Android force-stop, Doze, OEM battery controls, or network loss can delay or prevent silent background delivery. CampusX v1.0.1 does not use constant 60-second friend-location polling.

## Push Notifications

The mobile app registers Expo push tokens with the backend. The backend sends normal visible notifications through Expo's push service, which uses FCM V1 for Android delivery. Silent data-only notifications are used for the on-demand location refresh workflow.

Token lifecycle handling includes login/registration reconciliation and logout cleanup.

## Deployment

- **Backend:** Render
- **Database:** MongoDB Atlas
- **Android app:** locally built and signed for the current v1.0.1 direct APK release
- **Public API:** `https://campusx-production.onrender.com/api`

Release signing material and private deployment credentials are kept outside source control.
