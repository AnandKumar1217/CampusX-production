# CampusX Development Guide

## Prerequisites
- **Node.js:** v20+
- **npm:** v10+
- **Database:** MongoDB Atlas account or local MongoDB instance
- **Mobile Development:** Android Studio, Android SDK (for physical device or emulator testing)

## Installation
The project is structured as an npm workspace. From the root of the repository, run:
```bash
npm install
```

## Environment Setup
Never commit `.env` files. You must duplicate the provided example files and populate them locally.

1. **Backend:**
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```
   *Required variables: MongoDB URI, JWT Secret, third-party integration keys.*

2. **Mobile:**
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```
   *Required variables: `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` (point these to your local backend IP or production API).*

## Running the Project

### Starting the Backend
```bash
npm run backend
```
This starts the Express server with live reload (typically on port 3000).

### Starting the Mobile App
```bash
npm run mobile
```
This starts the Expo Metro bundler. From here, you can press `a` to launch on a connected Android device or emulator.
Alternatively:
```bash
npm run mobile:android
```

## Testing & Validation
We enforce strict typing and testing. Before committing, always run:

- **Typecheck:**
  ```bash
  npm run typecheck
  ```
- **Mobile Tests:**
  ```bash
  npm run test --workspace @campusx/mobile
  ```
- **Backend Memory Integration Tests:**
  ```bash
  npm run test:integration:memory --workspace @campusx/backend
  ```

## Safe Development Practices
- **Branches:** Always work on a new branch (`feature/...`, `fix/...`, `chore/...`) originating from `main`.
- **Commits:** Write clear, concise commit messages.
- **Secrets:** Never commit secrets, API keys, keystores, or service account files.
- **Dependencies:** Install dependencies at the workspace level when possible.
