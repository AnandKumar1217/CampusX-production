# CampusX

CampusX is a production-oriented campus community mobile application rebuilt from 74 approved visual references. All 74 semantic screens are implemented as React Native components and registered in typed navigation. The screenshots in `assets-reference/original/` remain QA references only; they are never rendered as full-screen runtime UI.

## Stack

- Expo SDK 54, React Native 0.81, React 19.1, TypeScript
- React Navigation, TanStack Query, Zustand, React Hook Form, Zod
- Node.js, Express, TypeScript, Mongoose, Socket.IO
- MongoDB Atlas through the backend only

## Workspace

```text
apps/mobile   Expo application
apps/backend  REST and Socket.IO API
docs          design, navigation, API, QA, and status documents
assets-reference/original  immutable canonical screenshots
```

## Local setup

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/mobile/.env.example apps/mobile/.env
npm run backend
npm run mobile
```

Set `MONGODB_URI` only in `apps/backend/.env`. Never put an Atlas URI in the mobile environment.

## Verification

```bash
npm run typecheck
npm test
npm run build --workspace @campusx/backend
cd apps/mobile && npx expo-doctor
cd apps/mobile && npx expo export --platform android --output-dir dist-check
```

The delivered verification run passed mobile and backend TypeScript, the backend health test, backend production compilation, Expo Doctor 18/18, and an Android Metro export.

## Design handoff

The editable Figma handoff contains a production cover, code-aligned color/layout variables, a foundations page, and four core native screen templates:

- [CampusX — Editable Production UI](https://www.figma.com/design/eXAsT6byYx8TvDkzQQuzUt)

## Current delivery status

See `docs/PROJECT_STATUS.md`, `docs/QA_REPORT.md`, and `docs/SCREEN_IMPLEMENTATION_MATRIX.md`. Implementation/build gates are complete. Full device-matrix screenshot comparison and live third-party production credentials remain explicit release gates.
