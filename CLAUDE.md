# CLAUDE.md — Agile Tracker

## Project overview

Kanban-based story tracker. Users create, edit, drag, and comment on user stories across three columns (Todo / Backlog, Doing, Done).

**Stack:**
- Frontend: Vanilla JS ES modules + Vite bundler (`src/main.js`, `src/styles.css`, `index.html`)
- Backend: Node.js + Express 5 REST API (`server/app.js`, `server/index.js`)
- Business logic: `server/storyStore.js` — all story validation, sorting, and mutation lives here
- Data: `data/stories.json` — single JSON file, read and written on every request

**Critical files:**
- `server/storyStore.js` — changing validation logic here affects every API endpoint
- `data/stories.json` — live data; tests restore it automatically, but never delete or corrupt it manually
- `server/app.js` — route definitions; keep route paths in sync with frontend's `API_BASE` calls in `src/main.js`

Valid story statuses are exactly: `"todo"`, `"doing"`, `"done"`. Any other value will cause a 400 error from `updateStoryStatus` and `validateStoryPayload`.

---

## Development commands

```bash
npm install                  # install dependencies
npm run dev                  # start frontend (port 5173) + backend (port 3000) together
npm run dev:server           # backend only
npm run dev:client           # frontend (Vite) only
npm test                     # run all API tests (Node built-in runner + supertest)
npm run build                # Vite production build → dist/
npm start                    # production server (serves pre-built dist/ via Express)
```

There is no lint script. Do not invent one or add ESLint unless explicitly asked.

---

## Code style

- Plain JavaScript ES modules (`"type": "module"` in package.json). Do not introduce TypeScript.
- Do not use `any` type annotations or JSDoc type casts that obscure intent.
- Keep functions small and focused. `server/storyStore.js` exports pure functions — keep them pure (no side effects beyond reading/writing the file in `readStories`/`saveStories`).
- Throw errors using `validationError(message)` from `storyStore.js` for user-facing 400 errors. Do not throw plain `Error` objects for validation cases.
- Follow the existing folder structure: server logic in `server/`, frontend logic in `src/`, tests in `tests/`, built output in `dist/`.
- Do not add CSS frameworks or UI libraries without explicit instruction.

---

## Testing rules

- Run `npm test` before marking any task complete. If tests fail, identify the cause and fix it — do not mark the task done.
- New API endpoints or changes to existing route behavior must include or update a test in `tests/api.test.js`.
- Bug fixes must include a regression test: write a test that fails before the fix and passes after.
- The test file saves and restores `data/stories.json` automatically via `before`/`after` hooks. Do not break this mechanism.
- Do not delete or skip existing tests unless they are provably obsolete and you explain why in the PR description.
- Tests run sequentially (`concurrency: false`). Do not make tests parallel — they share the JSON data file.

---

## Git workflow

- Never commit directly to `main`. Create a feature branch for every change.
- Branch names should describe the work: `fix/delete-comment-404`, `feat/filter-by-points`.
- Keep pull requests small and focused on one thing.
- Do not open a PR if `npm test` fails.
- List every file changed in the PR description and explain why each was modified.
- Do not merge your own PR. Leave it for review.

---

## Scope control

- Only modify files directly related to the task.
- Do not refactor unrelated code, rename existing functions, or reorganize imports in files you are not changing for a functional reason.
- Do not rename API route paths (e.g. `/api/stories/:id`), story field names (`title`, `points`, `acceptanceCriteria`), or status values (`todo`, `doing`, `done`) unless the task explicitly requires it — these are part of the public API contract.
- If a task requires touching more than 5 files, stop and explain why before making changes.
- Do not move files between directories without explicit instruction.

---

## Security rules

- Never commit secrets, API keys, tokens, or credentials. The project has no auth today, but do not add fake credentials as placeholders.
- Do not log request bodies that may contain user data (`console.log(req.body)` in production paths is forbidden).
- Validate all user input on the server side in `validateStoryPayload` or equivalent. Do not trust frontend-only validation.
- Do not disable CORS (`app.use(cors())`) or remove the existing error handler middleware.
- `data/stories.json` is not a secret file, but do not add real personal data to it in commits.

---

## Dependency rules

- Do not add new production dependencies without explaining why the existing stack cannot solve the problem.
- Do not add a package that duplicates something already available: `node:fs/promises` for file I/O, `node:assert` for assertions, `supertest` for HTTP testing.
- Check `package.json` before proposing a new package.
- Dev dependencies (test helpers, build tools) are lower risk but still need justification.

---

## Completion checklist

Before saying a task is complete, verify all of the following:

- [ ] `npm test` passes with no failures
- [ ] `npm run build` succeeds (catches import errors and missing files)
- [ ] No unrelated files were modified
- [ ] No `console.log` debug statements were left in server code
- [ ] No secrets or credentials were added
- [ ] Every changed file is listed and explained in the summary
- [ ] New or changed API behavior has a corresponding test

---

## When unsure

- Ask before changing: the data schema in `stories.json`, route paths, validation rules in `storyStore.js`, or the `before`/`after` hooks in `tests/api.test.js`.
- If a requirement is ambiguous, write a short plan (which files change and why) and wait for confirmation before editing code.
- If `npm test` fails and the root cause is not immediately clear, report the exact failure output and your hypothesis — do not guess-fix by commenting out assertions.
- If a change could break drag-and-drop ordering (the `priority` field and `reorderStoriesByStatus`), flag it explicitly before proceeding.
