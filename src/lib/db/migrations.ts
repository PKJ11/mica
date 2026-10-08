// Append-only list. Never edit a migration that has shipped; add a new one.
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
CREATE TABLE institutions (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  roll text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  mobile text,
  guest boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, roll)
);

-- Cohort = one course, one batch, one year.
CREATE TABLE cohorts (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  name text NOT NULL,
  course text NOT NULL,
  batch text,
  year text
);

CREATE TABLE enrolments (
  user_id text NOT NULL REFERENCES users(id),
  cohort_id text NOT NULL REFERENCES cohorts(id),
  role text NOT NULL CHECK (role IN ('student', 'instructor')),
  PRIMARY KEY (user_id, cohort_id)
);

CREATE TABLE consents (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  notice_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  parent_name text,
  parent_mobile text
);
CREATE INDEX consents_user ON consents (user_id, notice_version);

-- token_hash is sha256 of the cookie value; the raw token is never stored.
CREATE TABLE sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_input_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz,
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('logout', 'timeout', 'taken_over', 'closed', 'admin')),
  active_seconds integer NOT NULL DEFAULT 0,
  device_type text,
  browser text,
  user_agent text,
  ip text,
  city text
);
CREATE INDEX sessions_user ON sessions (user_id, started_at DESC);
CREATE INDEX sessions_open ON sessions (user_id) WHERE ended_at IS NULL;

-- Append-only. One row per event (EV-2, EV-10).
CREATE TABLE events (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  session_id text REFERENCES sessions(id),
  institution_id text,
  cohort_id text,
  module text,
  chapter text,
  element text,
  type text NOT NULL,
  client_ts timestamptz,
  server_ts timestamptz NOT NULL DEFAULT now(),
  page text,
  tab_id text,
  device_type text,
  content_version text,
  details jsonb
);
CREATE INDEX events_user_time ON events (user_id, server_ts);
CREATE INDEX events_session ON events (session_id, server_ts);
CREATE INDEX events_module_time ON events (module, server_ts);

-- Per student per module: the module's own saved state (what it used to keep in localStorage).
CREATE TABLE progress (
  user_id text NOT NULL REFERENCES users(id),
  module text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module)
);

CREATE TABLE audit_log (
  id text PRIMARY KEY,
  actor_id text REFERENCES users(id),
  action text NOT NULL,
  target text,
  details jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
`,
  },
];
