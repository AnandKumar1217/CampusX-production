# CampusX Architecture

## Monorepo Structure
The project uses npm workspaces to manage a monorepo consisting of:
- `apps/mobile`: The React Native Expo frontend application.
- `apps/backend`: The Node.js/Express backend API.

## Mobile Architecture (Frontend)
- **Framework:** Expo SDK 54 / React Native
- **Language:** TypeScript
- **Navigation:** React Navigation (Stack & Tabs)
- **State Management:** Zustand (for global application state, authentication, location preferences)
- **Data Fetching:** TanStack Query (for REST API caching, fetching, and mutations)
- **Styling:** NativeWind (Tailwind CSS) / StyleSheet

## Backend Architecture
- **Framework:** Node.js + Express
- **Language:** TypeScript
- **Database:** MongoDB Atlas via Mongoose ODM
- **Real-Time Engine:** Socket.IO

## Communication Protocols
- **REST API:** Handles authentication, CRUD operations (posts, friends, events), and initial data hydration.
- **Socket.IO:** A persistent WebSocket connection for real-time one-to-one chat and instant location updates.
- **Push Notifications:** Firebase Cloud Messaging (FCM V1) integrated via Expo Push APIs for offline alerts and background data syncing.

## Authentication Flow
1. User authenticates via email/password or OAuth (where supported).
2. Backend validates credentials and issues a secure JWT.
3. Mobile stores the JWT securely (using `expo-secure-store`).
4. Subsequent API requests pass the JWT in the `Authorization: Bearer <token>` header.

## Location Refresh System (On-Demand)
1. **Trigger:** User A views User B's profile or the map.
2. **Action:** Mobile app checks cached timestamp. If stale, sends an intentional refresh request via POST to `/api/location/friends/:friendId/refresh`.
3. **Backend Processing:** 
   - Backend verifies friendship and that User B has Location Sharing enabled.
   - If User B is actively connected via Socket.IO, an event is emitted.
   - If User B is disconnected or backgrounded, a silent FCM data push is sent to wake the device.
4. **Resolution:** User B fetches a fresh GPS coordinate and POSTs it back as `source: "on_demand"` along with the `requestId`.
5. **Update:** Backend saves the new location and broadcasts it back to User A via Socket.IO.

## Deployment Architecture
- **Backend Hosting:** Deployed on Render as a Node.js web service.
- **Database:** Managed MongoDB Atlas cluster.
- **Mobile Builds:** Built locally or via EAS Build, generating standalone `.apk` or `.aab` packages for Android.
