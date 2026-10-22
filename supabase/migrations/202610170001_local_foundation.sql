-- Local-development footprint only. Run with the separate migration credential.
SET LOCAL ROLE csh_schema_owner;
CREATE SCHEMA app_private;
CREATE SCHEMA app_meta;
CREATE SCHEMA auth;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private, app_meta, auth FROM PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = pg_catalog AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private, app_meta, auth TO csh_runtime;
GRANT EXECUTE ON FUNCTION auth.uid() TO csh_runtime;

CREATE TABLE app_meta.runtime_proof (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  migration_digest text NOT NULL, database_oid oid NOT NULL, runtime_oid oid NOT NULL,
  evidence jsonb NOT NULL, verified_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON app_meta.runtime_proof TO csh_runtime;

CREATE TABLE app_private.time_preferences (
  user_id uuid PRIMARY KEY,
  weekly_minutes integer NOT NULL CHECK (weekly_minutes BETWEEN 30 AND 1260),
  available_days integer[] NOT NULL CHECK (cardinality(available_days) BETWEEN 1 AND 7 AND available_days <@ ARRAY[0,1,2,3,4,5,6]),
  daily_cap integer NOT NULL CHECK (daily_cap BETWEEN 10 AND 180),
  session_minutes integer NOT NULL CHECK (session_minutes IN (10,15,20,25) AND session_minutes <= daily_cap),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.lesson_sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, lesson_version_id text NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','completed')),
  started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(user_id,id), CHECK ((state='completed') = (completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_session ON app_private.lesson_sessions(user_id,lesson_version_id) WHERE state='active';
CREATE TABLE app_private.attempts (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, session_id uuid NOT NULL, exercise_version_id text NOT NULL,
  response jsonb NOT NULL, correct boolean NOT NULL, score_source text NOT NULL CHECK(score_source='local-fixture-v1'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,session_id,exercise_version_id),
  FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id)
);
CREATE INDEX attempts_owner_time ON app_private.attempts(user_id,occurred_at DESC);
CREATE TABLE app_private.learning_events (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, session_id uuid NOT NULL,
  owner_seq bigint NOT NULL CHECK(owner_seq>0), kind text NOT NULL CHECK(kind IN ('fixture_answer','fixture_complete')),
  payload_version integer NOT NULL DEFAULT 1 CHECK(payload_version=1), payload jsonb NOT NULL,
  engine_version text NOT NULL CHECK(engine_version='local-fixture-v1'), occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,owner_seq), FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id)
);
CREATE TABLE app_private.lesson_progress (
  user_id uuid NOT NULL, lesson_version_id text NOT NULL, completed_sessions integer NOT NULL DEFAULT 0 CHECK(completed_sessions>=0),
  last_session_id uuid NOT NULL, PRIMARY KEY(user_id,lesson_version_id),
  FOREIGN KEY(user_id,last_session_id) REFERENCES app_private.lesson_sessions(user_id,id)
);
CREATE TABLE app_private.api_idempotency (
  user_id uuid NOT NULL, endpoint text NOT NULL, key uuid NOT NULL, payload_hash text NOT NULL,
  response_json jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,endpoint,key)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['time_preferences','lesson_sessions','attempts','learning_events','lesson_progress','api_idempotency'] LOOP
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY owner_only ON app_private.%I TO csh_runtime USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())',t);
    EXECUTE format('GRANT SELECT,INSERT ON app_private.%I TO csh_runtime',t);
  END LOOP;
END $$;
GRANT UPDATE ON app_private.time_preferences, app_private.lesson_sessions, app_private.lesson_progress TO csh_runtime;
-- No UPDATE/DELETE/TRUNCATE on evidence or idempotency. No schema CREATE, role
-- membership, table ownership, answer-key read or SECURITY DEFINER shortcut.
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON TABLES FROM PUBLIC;
