-- Additive Phase4 footprint. Old attempts, cards and review logs stay unchanged.
SET LOCAL ROLE csh_schema_owner;
CREATE SCHEMA app_content;
REVOKE ALL ON SCHEMA app_content FROM PUBLIC;
GRANT USAGE ON SCHEMA app_content TO csh_runtime;
CREATE TABLE app_content.packages(
 version_id text PRIMARY KEY, lesson_id text NOT NULL, release_id text NOT NULL,
 package_hash text NOT NULL CHECK(package_hash ~ '^[a-f0-9]{64}$'),
 manifest jsonb NOT NULL, state text NOT NULL CHECK(state IN('DRAFT','VALIDATED','REVIEW_PENDING','REVIEWED','PUBLISHED','RETIRED')),
 CHECK(manifest->>'packageHash'=package_hash), CHECK(manifest->'lesson'->>'versionId'=version_id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(version_id,package_hash)
);
CREATE TABLE app_content.exercise_versions(
 id text PRIMARY KEY, package_id text NOT NULL REFERENCES app_content.packages(version_id),
 key_version text NOT NULL, normalizer_version text NOT NULL, grading_version text NOT NULL,
 UNIQUE(id,package_id,key_version)
);
GRANT SELECT ON app_content.packages,app_content.exercise_versions TO csh_runtime;
-- Global content is not tenant data. Runtime has SELECT only; no publishing DML.
CREATE TABLE app_private.content_session_state(
 user_id uuid NOT NULL, session_id uuid NOT NULL, package_id text NOT NULL REFERENCES app_content.packages(version_id),
 package_hash text NOT NULL, cursor integer NOT NULL DEFAULT 0 CHECK(cursor>=0), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(user_id,session_id), FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id),
 FOREIGN KEY(package_id,package_hash) REFERENCES app_content.packages(version_id,package_hash)
);
CREATE TABLE app_private.activity_leases(
 user_id uuid PRIMARY KEY,session_id uuid NOT NULL,client_id uuid NOT NULL,lease_id uuid NOT NULL,
 issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id), CHECK(expires_at>issued_at)
);
CREATE TABLE app_private.duration_events(
 user_id uuid NOT NULL,event_id uuid NOT NULL,session_id uuid NOT NULL,lease_id uuid NOT NULL,
 observed_start timestamptz NOT NULL,observed_end timestamptz NOT NULL,last_interaction_at timestamptz NOT NULL,
 active_ms integer NOT NULL CHECK(active_ms BETWEEN 0 AND 15000),accepted_ms integer NOT NULL CHECK(accepted_ms BETWEEN 0 AND active_ms),
 server_received_at timestamptz NOT NULL, classification text NOT NULL CHECK(classification IN('VALIDATED_TELEMETRY','SUSPICIOUS_INVALID','MISSING_INSUFFICIENT')),
 reasons jsonb NOT NULL, payload_hash text NOT NULL, rule_version text NOT NULL,
 PRIMARY KEY(user_id,event_id), FOREIGN KEY(user_id,session_id) REFERENCES app_private.lesson_sessions(user_id,id),
 CHECK(observed_end>=observed_start)
);
CREATE INDEX duration_owner_interval ON app_private.duration_events(user_id,observed_start,observed_end);
CREATE TABLE app_private.content_attempt_bindings(
 user_id uuid NOT NULL,attempt_id uuid NOT NULL,package_id text NOT NULL,package_hash text NOT NULL,
 exercise_version_id text NOT NULL,key_version text NOT NULL,normalizer_version text NOT NULL,grading_version text NOT NULL,
 review_status text NOT NULL CHECK(review_status='DRAFT_UNREVIEWED'),
 duration_classification text NOT NULL CHECK(duration_classification IN('VALIDATED_TELEMETRY','SUSPICIOUS_INVALID','MISSING_INSUFFICIENT')),
 PRIMARY KEY(user_id,attempt_id),FOREIGN KEY(user_id,attempt_id) REFERENCES app_private.attempts(user_id,id),
 FOREIGN KEY(package_id,package_hash) REFERENCES app_content.packages(version_id,package_hash),
 FOREIGN KEY(exercise_version_id,package_id,key_version) REFERENCES app_content.exercise_versions(id,package_id,key_version)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['content_session_state','activity_leases','duration_events','content_attempt_bindings'] LOOP
 EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_only ON app_private.%I TO csh_runtime USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid())',t);
 EXECUTE format('GRANT SELECT,INSERT ON app_private.%I TO csh_runtime',t);
 END LOOP;
END $$;
GRANT UPDATE ON app_private.content_session_state,app_private.activity_leases TO csh_runtime;
ALTER TABLE app_private.attempts DROP CONSTRAINT attempts_score_source_check;
ALTER TABLE app_private.attempts ADD CONSTRAINT attempts_score_source_check CHECK(score_source IN('local-fixture-v1','local-content-v1'));
ALTER TABLE app_private.learning_events DROP CONSTRAINT learning_events_kind_check;
ALTER TABLE app_private.learning_events ADD CONSTRAINT learning_events_kind_check CHECK(kind IN('fixture_answer','fixture_complete','content_answer','content_complete'));
ALTER TABLE app_private.learning_events DROP CONSTRAINT learning_events_engine_version_check;
ALTER TABLE app_private.learning_events ADD CONSTRAINT learning_events_engine_version_check CHECK(engine_version IN('local-fixture-v1','local-content-v1'));
DELETE FROM app_meta.runtime_proof;
