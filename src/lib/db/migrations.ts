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
  {
    // Content catalogue (CT-1 to CT-3): institution → module → chapter → element, and which cohorts get which modules.
    version: 2,
    sql: `
CREATE TABLE modules (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('module', 'dashboard', 'game_set')),
  position integer NOT NULL,
  version text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- kind: intro, chapter, practice, quiz or summary. Reports use "chapter" as the topic.
CREATE TABLE chapters (
  module_id text NOT NULL REFERENCES modules(id),
  id text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL,
  position integer NOT NULL,
  retired boolean NOT NULL DEFAULT false,
  PRIMARY KEY (module_id, id)
);

-- Interactive elements. Learning questions (type quick_check or final_quiz) keep their text, options,
-- correct answer and explanation in data. Retired elements stay so past events still resolve.
CREATE TABLE elements (
  module_id text NOT NULL REFERENCES modules(id),
  id text NOT NULL,
  chapter_id text,
  type text NOT NULL,
  title text,
  position integer NOT NULL,
  version text,
  data jsonb,
  retired boolean NOT NULL DEFAULT false,
  PRIMARY KEY (module_id, id)
);

-- "Not attempted" versus "not assigned" (CT-3).
CREATE TABLE assignments (
  cohort_id text NOT NULL REFERENCES cohorts(id),
  module_id text NOT NULL REFERENCES modules(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, module_id)
);

CREATE INDEX events_answers ON events (module, element, server_ts) WHERE type = 'answer_submitted';
`,
  },
  {
    // Summaries (section 5): rebuilt from events by src/lib/summaries.ts, never edited by hand.
    // Each row keeps a pointer back to its events (session_id, event_id) so every figure is traceable (NF-8).
    version: 3,
    sql: `
-- Active time: 15 s per heartbeat, one per session per 15-second window, so two visible tabs count once.
-- module and chapter are '' for time outside a module (portal pages). day is the IST calendar day.
CREATE TABLE activity_summary (
  user_id text NOT NULL,
  day date NOT NULL,
  session_id text NOT NULL,
  module text NOT NULL,
  chapter text NOT NULL,
  active_seconds integer NOT NULL,
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, day, session_id, module, chapter)
);
CREATE INDEX activity_summary_module ON activity_summary (module, day);
CREATE INDEX activity_summary_session ON activity_summary (session_id);

-- One row per learning answer. attempt 1 is the first answer to that question by that student.
CREATE TABLE question_results (
  event_id text PRIMARY KEY,
  user_id text NOT NULL,
  session_id text,
  module text NOT NULL,
  question_id text NOT NULL,
  chapter text,
  kind text,
  option text,
  correct boolean NOT NULL,
  seconds integer,
  attempt integer NOT NULL,
  answered_at timestamptz NOT NULL
);
CREATE INDEX question_results_user ON question_results (user_id, module, question_id);
CREATE INDEX question_results_first ON question_results (module, question_id) WHERE attempt = 1;

-- Per student per chapter: opened, how far read, and when completed (IA-8).
CREATE TABLE chapter_status (
  user_id text NOT NULL,
  module text NOT NULL,
  chapter text NOT NULL,
  opens integer NOT NULL,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  max_scroll integer,
  completed_at timestamptz,
  PRIMARY KEY (user_id, module, chapter)
);

-- One row: how far the summaries have read the events.
CREATE TABLE summary_state (
  id text PRIMARY KEY,
  watermark timestamptz,
  refreshed_at timestamptz,
  duration_ms integer,
  students integer
);
`,
  },
];
