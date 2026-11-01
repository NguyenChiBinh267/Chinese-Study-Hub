-- Disposable-test rollback only. Never apply to acknowledged study history.
SET LOCAL ROLE csh_schema_owner;
DROP TABLE app_private.planned_blocks,app_private.weekly_plans,app_private.study_day_overrides,app_private.study_settings;
DELETE FROM app_meta.runtime_proof;
