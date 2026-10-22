-- Additive local Sprint5 tables; historical rows/content versions are untouched.
SET LOCAL ROLE csh_schema_owner;
CREATE TABLE app_private.study_settings(
 user_id uuid PRIMARY KEY REFERENCES app_private.time_preferences(user_id),
 preferences_version integer NOT NULL CHECK(preferences_version>0),
 day_caps integer[] NOT NULL CHECK(cardinality(day_caps)=7 AND 0<=ALL(day_caps) AND 180>=ALL(day_caps)),
 max_session_minutes integer NOT NULL CHECK(max_session_minutes BETWEEN 5 AND 45),
 paused boolean NOT NULL DEFAULT false, timezone text NOT NULL CHECK(length(timezone) BETWEEN 1 AND 80),
 starting_level text NOT NULL CHECK(starting_level IN('zero','some'))
);
CREATE TABLE app_private.study_day_overrides(
 user_id uuid NOT NULL,local_date date NOT NULL,cap_minutes integer NOT NULL CHECK(cap_minutes BETWEEN 0 AND 180),
 reason text NOT NULL CHECK(reason IN('SKIP_TODAY','TEN_MINUTES')),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,local_date)
);
CREATE TABLE app_private.weekly_plans(
 id uuid PRIMARY KEY,user_id uuid NOT NULL,week_start date NOT NULL,timezone_snapshot text NOT NULL,
 preferences_version integer NOT NULL,version integer NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN('active','superseded')),snapshot_hash text NOT NULL,
 planner_version text NOT NULL,reason text NOT NULL,document jsonb NOT NULL,as_of timestamptz NOT NULL,
 UNIQUE(user_id,id),UNIQUE(user_id,week_start,version)
);
CREATE UNIQUE INDEX one_active_weekly_plan ON app_private.weekly_plans(user_id,week_start) WHERE status='active';
CREATE TABLE app_private.planned_blocks(
 id uuid PRIMARY KEY,user_id uuid NOT NULL,plan_id uuid NOT NULL,local_date date NOT NULL,ordinal integer NOT NULL CHECK(ordinal>0),
 kind text NOT NULL CHECK(kind IN('review','resume','draft_lesson')),target text NOT NULL,target_ids jsonb NOT NULL,
 estimated_minutes integer NOT NULL CHECK(estimated_minutes BETWEEN 1 AND 45),
 status text NOT NULL CHECK(status IN('ready','tentative','in_progress','completed','skipped','superseded')),
 reason text NOT NULL,session_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,id),UNIQUE(plan_id,local_date,ordinal),
 FOREIGN KEY(user_id,plan_id) REFERENCES app_private.weekly_plans(user_id,id),
 FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id)
);
CREATE INDEX planned_owner_date ON app_private.planned_blocks(user_id,local_date,status);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['study_settings','study_day_overrides','weekly_plans','planned_blocks'] LOOP
 EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_only ON app_private.%I TO csh_runtime USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid())',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON app_private.%I TO csh_runtime',t);
 END LOOP;
END $$;
DELETE FROM app_meta.runtime_proof;
