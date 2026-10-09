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
- **Content catalogue** (`src/data/catalogue/vnit.json`): every module's chapters and every quick-check and quiz
  question (options, correct answer, chapter), read from the module files by `node scripts/build-catalogue.mjs`.
  **Run that script after changing a module file.** It is loaded into the `modules`, `chapters`, `elements` and
  `assignments` tables on start. Quiz questions the module itself does not tag to a chapter (Data Engineering's
  final quiz, the Market Basket quiz) carry proposed tags, set in the script and marked `"proposed"`.
- **Question events**: each module marks its question boxes with `data-trk-q` and calls `__trk.answer()` when one
  is answered, so the tracker records `question_shown`, `answer_submitted` (option, right or wrong, seconds since
  shown), `quiz_started`, `quiz_submitted`, `quiz_retaken` and `question_retry`.
- **Summaries** (`src/lib/summaries.ts`): `activity_summary` (active seconds per student, IST day, session, module and
  chapter), `question_results` (every answer with its attempt number) and `chapter_status` (opened, read to, completed),
  rebuilt from the events. Staff screens read only these. A refresh recomputes just the students with new events, in
  one transaction. It runs on its own while students are active (checked after event batches, at most every 15
  minutes), when a staff page finds the figures over 15 minutes old, and from **Refresh now**. For a scheduler, set
  `CRON_SECRET` and call `GET /api/summaries/refresh` with `Authorization: Bearer <secret>`; `?full=1` rebuilds
  everything, and `?verify=1` checks the stored figures against a full rebuild without changing anything.
- **A second dev server**: `NEXT_DIST_DIR=.next-test` gives it its own build folder, so automated tests can run beside
  `npm run dev`. Next adds that folder to `tsconfig.json` while it runs; don't commit that change.
- **Instructor screens** (`/vnit/admin`, staff only; every view is written to `audit_log`). A cohort and period bar
  scopes every screen and is remembered in the `vnit_filters` cookie.
  - **Overview**: students, active in the last 7 days, median time and score, students by total time (select a bar
    for the list), time by module, and "needs attention" links.
  - **Time**: minimum, quartiles, median, maximum, total and "not opened" per module, chapter or content type; the
    selected row's histogram and its chapters ranked by time.
  - **Questions**: per module, each learning question's attempts, % right first time, most common wrong answer and
    median time; every option's count with the students behind each wrong answer; % right by chapter and type.
  - **Students**: search and filters (not signed in for N days, time below, score below, time band); each student
    has Summary, Time, Sessions (sign-ins per week, session table, event time line) and Questions tabs.
  - Score bands: strong from 80 %, developing from 50 %, none under 3 questions (`BANDS` in `src/lib/settings.ts`).
  - Queries live in `src/lib/analytics/`; charts are plain HTML in `src/components/charts.tsx`.
