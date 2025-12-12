# Repository Guidelines

## Project Structure & Modules
- `src/main`: Electron main process, IPC handlers, database layer (`database/`, `repositories/`, `services/`, `preload.ts`, `main.ts`); keep crypto, filesystem, and SQLite writes here.
- `src/renderer`: React UI (components, hooks, styles, columns, services, utils); entry `index.tsx`, HTML template `index.html`.
- `src/shared` / `src/types`: cross-process types; extend here instead of duplicating shapes.
- `docs/`: architecture, requirements, and design notes; update when platform behavior changes.
- `scripts/`: helper scripts for starting Electron; review before changing launch flow.
- `dist/` / `release/`: build and installer artifacts; do not edit manually.

## Build, Test, and Development Commands
- `npm run dev`: run renderer dev-server and main-process watcher concurrently.
- `npm start`: start Electron pointing to local dev assets.
- `npm run build` (`build:renderer`, `build:main`): production bundles for renderer/main.
- `npm run dist`, `dist:mac|win|linux`: electron-builder packages for each platform.
- `npm run test` / `test:watch`: Jest + ts-jest in a jsdom environment.
- `npm run lint`, `lint:fix`, `npm run format`: ESLint and Prettier enforcement/fix.
- Before running `npm run lint` and `npm run build`, you may run `nvm use 20` to ensure the expected Node version.
- After completing tasks, run `npm run lint` and `npm run build` and resolve any issues found.

## Coding Style & Naming Conventions
- TypeScript-first; 2-space indent, single quotes, trailing commas where reasonable. Run lint + format before pushing.
- React uses functional components and hooks; components in PascalCase, utilities/hooks in camelCase (e.g., `usePasswords.ts`), CSS in kebab-case.
- IPC boundary: renderer calls only `window.electronAPI` exposed by `preload.ts`; no direct Node imports in renderer.
- Keep encryption and database writes in `src/main`; renderer must not hold secrets.
- Shared types live in `src/shared`/`src/types`; avoid redefining in main/renderer.

## Testing Guidelines
- Place tests in `src/**/__tests__` or `*.test.ts(x)`; favor jsdom-friendly component tests and mocked service/IPC contract tests.
- Coverage excludes `src/main` by default; still add targeted tests for critical main-process logic using mocks or integration fakes.
- Use fixtures for passwords/groups; stub `window.electronAPI` when exercising renderer logic.
- If you change Jest config or global setup, verify compatibility with `src/setupTests.ts`.

## Commit & Pull Request Guidelines
- Follow conventional prefixes with scopes (e.g., `feat(密码管理): ...`, `chore: ...`); keep verbs imperative and concise, Chinese scopes are fine.
- PRs: include a clear summary, linked issue if any, screenshots/GIFs for UI-visible changes, and notes on security/storage impact; state which lint/test commands were run.

## Security & Configuration Tips
- Keep `contextIsolation` on and `nodeIntegration` off; expose only minimal preload APIs.
- Validate all IPC inputs, sanitize SQL, and avoid logging sensitive data.
- When changing persistence shapes, update migrations in `src/main/database` and document in `docs/`.
- Before release, re-check dependency licenses and electron-builder settings (appId, icons, publish target).
