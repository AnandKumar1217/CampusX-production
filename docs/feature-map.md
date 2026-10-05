# CampusX Feature Map

This document helps you quickly locate the code for any feature in the app.

## Authentication
- **Mobile**: `apps/mobile/src/screens/auth/`
- **Backend Routes**: `apps/backend/src/routes/authRoutes.ts`
- **Backend Service**: `apps/backend/src/services/authService.ts`
- **Model**: `apps/backend/src/models/User.ts`

## Events
- **Mobile**: `apps/mobile/src/screens/events/`
- **Backend Routes**: `apps/backend/src/routes/commerceRoutes.ts` (Note: Events are part of Commerce)
- **Model**: `apps/backend/src/models/Commerce.ts`

## Chats
- **Mobile**: `apps/mobile/src/screens/chat/`
- **Mobile Service**: `apps/mobile/src/services/socket.ts`
- **Backend Routes**: `apps/backend/src/routes/chatRoutes.ts`
- **Backend Sockets**: `apps/backend/src/sockets/`
- **Model**: `apps/backend/src/models/Chat.ts`

## Marketplace
- **Mobile**: `apps/mobile/src/screens/commerce/`
- **Backend Routes**: `apps/backend/src/routes/commerceRoutes.ts`
- **Model**: `apps/backend/src/models/Commerce.ts`

## Timetable / Utilities
- **Mobile**: `apps/mobile/src/screens/utilities/`

## Games
- **Mobile**: `apps/mobile/src/features/games/`

## Trips
- **Mobile**: `apps/mobile/src/screens/trips/`
- **Backend Routes**: `apps/backend/src/routes/tripRoutes.ts`
- **Model**: `apps/backend/src/models/Trip.ts`

## Groups
- **Mobile**: `apps/mobile/src/screens/groups/`
- **Backend Routes**: `apps/backend/src/routes/groupRoutes.ts`
- **Model**: `apps/backend/src/models/Group.ts`

## Maps/Location
- **Mobile**: `apps/mobile/src/screens/main/DiscoverScreen.tsx`
- **Map Component**: `apps/mobile/src/components/map/`
- **Backend Routing/Socket**: Used via user presence in Websockets and generic user models.
