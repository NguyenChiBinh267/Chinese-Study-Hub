-- Safe only before any approved-content writes. Never relabel historical rows.
SET LOCAL ROLE csh_schema_owner;
-- FORCE RLS also applies to the table owner. Use constraint validation, which
-- checks the entire table, rather than an owner SELECT that would see no rows.
DO $$ BEGIN
 ALTER TABLE app_private.content_attempt_bindings ADD CONSTRAINT rollback_draft_only CHECK(review_status='DRAFT_UNREVIEWED');
EXCEPTION WHEN check_violation THEN
 RAISE EXCEPTION 'Keep forward schema: publication-bound history exists';
END $$;
ALTER TABLE app_private.content_attempt_bindings DROP CONSTRAINT content_attempt_bindings_review_status_check;
ALTER TABLE app_private.content_attempt_bindings RENAME CONSTRAINT rollback_draft_only TO content_attempt_bindings_review_status_check;
ALTER TABLE app_private.mastery_evidence DROP CONSTRAINT mastery_evidence_eligibility_check;
ALTER TABLE app_private.mastery_evidence ADD CONSTRAINT mastery_evidence_eligibility_check CHECK(eligibility='unreviewed_fixture');
DELETE FROM app_meta.runtime_proof;
