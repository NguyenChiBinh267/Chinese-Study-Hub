SET LOCAL ROLE csh_schema_owner;
DROP TABLE app_private.review_logs,app_private.cards,app_private.skill_mastery,app_private.mastery_evidence;
ALTER TABLE app_private.attempts DROP CONSTRAINT attempts_owner_id;
DELETE FROM app_meta.runtime_proof;
