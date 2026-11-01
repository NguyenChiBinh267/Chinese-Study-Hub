-- Only for disposable full-schema rollback tests. Never run against acknowledged Phase4 data.
SET LOCAL ROLE csh_schema_owner;
DROP TABLE app_private.content_attempt_bindings,app_private.duration_events,app_private.activity_leases,app_private.content_session_state;
DROP SCHEMA app_content CASCADE;
ALTER TABLE app_private.attempts DROP CONSTRAINT attempts_score_source_check;
ALTER TABLE app_private.attempts ADD CONSTRAINT attempts_score_source_check CHECK(score_source='local-fixture-v1');
ALTER TABLE app_private.learning_events DROP CONSTRAINT learning_events_kind_check;
ALTER TABLE app_private.learning_events ADD CONSTRAINT learning_events_kind_check CHECK(kind IN('fixture_answer','fixture_complete'));
ALTER TABLE app_private.learning_events DROP CONSTRAINT learning_events_engine_version_check;
ALTER TABLE app_private.learning_events ADD CONSTRAINT learning_events_engine_version_check CHECK(engine_version='local-fixture-v1');
DELETE FROM app_meta.runtime_proof;
