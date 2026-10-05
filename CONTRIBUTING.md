# Contributing to CampusX

1. Never commit straight to `main`.
2. Always create a feature branch (`feat/`, `fix/`, `chore/`).
3. Follow the established directory structure. Do not place root config files for mobile in the root of the repository; they belong in `apps/mobile/`.
4. Ensure tests and typechecks pass before pushing (`npm run typecheck`, `npm run test`).
5. Verify changes locally on a device or emulator before requesting review.
6. Keep secrets out of the codebase. Use `.env` files locally, and secure variables in the deployment environment.
