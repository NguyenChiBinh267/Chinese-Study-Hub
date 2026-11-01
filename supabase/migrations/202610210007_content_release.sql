-- Additive publication audit label; no rebinding or rewriting historical rows.
SET LOCAL ROLE csh_schema_owner;
ALTER TABLE app_private.content_attempt_bindings DROP CONSTRAINT content_attempt_bindings_review_status_check;
ALTER TABLE app_private.content_attempt_bindings ADD CONSTRAINT content_attempt_bindings_review_status_check
 CHECK(review_status IN('DRAFT_UNREVIEWED','HUMAN_REVIEWED','TECHNICAL_ONLY'));
ALTER TABLE app_private.mastery_evidence DROP CONSTRAINT mastery_evidence_eligibility_check;
ALTER TABLE app_private.mastery_evidence ADD CONSTRAINT mastery_evidence_eligibility_check CHECK(eligibility IN('unreviewed_fixture','reviewed_practice'));
DELETE FROM app_meta.runtime_proof;
