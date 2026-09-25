# MICA Learning Portal

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

- Username: roll number
- Password: first 2 letters of first name + first 2 letters of last name + last 4 digits of roll no.
  (e.g. Aakansha Johari, 20250132001 -> `AaJo2001`; letters are case-insensitive)
- The full list is in `credentials.md`. Students are defined in `src/data/students.ts`.

## Structure

- `/login` – sign in
- `/dashboard` – course cards: ABAMDL (active), GENAILLM (coming soon)
- `/courses/abamdl` – Session 1 activity card; Session 2 CRISP-DM Phase Mapping with Index 1–4 cases
- `/activity/[slug]` – shows the activity HTML in an iframe
- `content/*.html` – the activity files, served only to signed-in students via `/api/activity/[slug]`

To add an activity: drop the HTML in `content/` and register it in `src/lib/activities.ts`.
