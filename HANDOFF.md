# CampusX Handoff Guide

Welcome to CampusX! This document is written for any new developer inheriting this project.

## High-Level Architecture
CampusX is a monorepo containing:
1. `apps/mobile`: The frontend React Native application built with Expo.
2. `apps/backend`: The backend Node.js API built with Express and Socket.io.

## Where things are
- If you need to fix a UI bug, go to `apps/mobile/src/screens/` or `apps/mobile/src/components/`. Check the `docs/feature-map.md` to pinpoint exactly where each feature lives.
- If you need to add an API endpoint, go to `apps/backend/src/routes/` and implement the business logic in `apps/backend/src/services/`.
- If you need to add a database field, go to `apps/backend/src/models/` and update the Mongoose schemas.
- If you need to look at Websocket events (like chat or location updates), look into `apps/backend/src/sockets/` and `apps/mobile/src/services/socket.ts`.

## Data Storage
- We use MongoDB for data storage.
- Active data is handled by Mongoose.
- Media (images) is processed and uploaded to cloud storage.

## How to get help
If you are stuck, please refer to the `docs/` folder. It contains detailed guides on getting started, architecture, database setup, environment configuration, testing, deployment, and troubleshooting.
