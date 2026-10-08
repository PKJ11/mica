# MICA Portal

Next.js (App Router, TypeScript) portal for the Business Analytics & AI class.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
# or production
npm run build && npm start
```

Set `AUTH_SECRET` (any long random string) in the environment for production.

## Login

- Username: pick your roll number from the searchable dropdown (search by name or roll no.)
- Password: first 2 letters of first name + first 2 letters of last name + last 4 digits of roll no.
  (e.g. Aakansha Johari, 20250132001 -> `AaJo2001`; letters are case-insensitive)
- Anyone not on the list picks **Others** and uses the password `KaVy2026`.
- The full list is in `credentials.md`. Students are defined in `src/data/students.ts`.

## Structure

- `/home` – public welcome page (`/` redirects here). MICA → login; VNIT and JIT show “available on 1st October 2026”. Rebuilt from the design export `content/welcomepage.html`; images are in `public/home/`.
- `/login` – sign in (log out returns to `/home`)
- `/dashboard` – course cards: ABAMDL and GENAILLM
- `/courses/abamdl` – Session 1 activity card; Session 2 CRISP-DM Phase Mapping with Index 1–4 cases
- `/courses/genaillm` – Session 1 (deck + Software Application Design PDF), Session 2 (Anatomy deck), Session 3 locked. Other files in `content/Genaiml/` are registered with `hidden: true` in `src/lib/activities.ts` — remove that flag and add them to a session to publish.
- `/activity/[slug]` – shows the activity HTML in an iframe
- `content/*.html` – the activity files, served only to signed-in students via `/api/activity/[slug]`

To add an activity: drop the HTML in `content/` and register it in `src/lib/activities.ts`.

## VNIT: per-student sessions and activity tracking (phase 1)

VNIT pages use the Neon Postgres database: `DATABASE_URL` from `.env` (not committed), falling back to the connection
string in `src/lib/db/index.ts`. For local test runs that must not touch Neon, set `USE_PGLITE=1` to use an embedded
Postgres in `.data/pglite` instead. Tables are created on first use (`src/lib/db/migrations.ts`), and the roster in
`src/data/vnitStudents.ts` is synced into `users` on every start (`src/lib/db/seed.ts`). `kartik-vyas` is the admin.

- **Sessions** (`src/lib/session.ts`): the cookie holds a random token; only its hash is stored. One open session per
  student: signing in elsewhere ends the older one, and that device shows "signed out … another device".
- **Consent** (`/vnit/consent`): asked on first sign-in and again whenever `NOTICE_VERSION` changes. No content
  (and so no tracking) loads until it is agreed.
- **Tracker** (`public/tracker.js`): loaded in the outer page and injected by `/api/activity/[slug]` into every VNIT
  content file. It sends batched events to `/api/events`, a heartbeat every 15 s while the tab is visible and used,
  clicks, widget changes, chapters (`#hash`), scroll depth and tab focus. Content never needs its own tracking code.
- **Inactivity**: a warning at 5 min, a countdown at 6 min, sign-out at 7 min, shared across tabs and the iframe.
  The session ends at the last input. Thresholds are in `src/lib/settings.ts`; for testing, override them with
  `IDLE_WARN_MS`, `IDLE_FINAL_MS`, `IDLE_LOGOUT_MS`, `SERVER_GRACE_MS`.
- **Progress**: each module's `localStorage` is replaced, inside its iframe, by a per-student store saved to
  `/api/progress`, so a student's place follows them across devices.
- **Staff view**: `/vnit/admin` lists students with sign-ins, sessions, active time and events. Each student page
  shows sessions, and each session's time line of events. Views are written to `audit_log`.
