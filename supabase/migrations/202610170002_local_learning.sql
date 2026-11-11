-- Additive only: historical attempts/events remain unchanged and ineligible.
SET LOCAL ROLE csh_schema_owner;
ALTER TABLE app_private.attempts ADD CONSTRAINT attempts_owner_id UNIQUE(user_id,id);
CREATE TABLE app_private.mastery_evidence (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, attempt_id uuid NOT NULL,
  concept_id text NOT NULL, skill text NOT NULL, exercise_version_id text NOT NULL,
  score double precision NOT NULL CHECK(score BETWEEN 0 AND 1),
  eligibility text NOT NULL CHECK(eligibility IN ('unreviewed_fixture')),
  assisted boolean NOT NULL, occurred_at timestamptz NOT NULL,
  engine_version text NOT NULL, UNIQUE(user_id,attempt_id),
  FOREIGN KEY(user_id,attempt_id) REFERENCES app_private.attempts(user_id,id)
);
CREATE TABLE app_private.skill_mastery (
  user_id uuid NOT NULL, concept_id text NOT NULL, skill text NOT NULL,
  projection jsonb NOT NULL, engine_version text NOT NULL, version integer NOT NULL CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,concept_id,skill)
);
CREATE TABLE app_private.cards (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, template_version_id text NOT NULL,
  source_attempt_id uuid NOT NULL, scheduler_card jsonb NOT NULL,
  algorithm text NOT NULL, scheduler_config jsonb NOT NULL,
  due_at timestamptz NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  revealed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,id), UNIQUE(user_id,template_version_id),
  FOREIGN KEY(user_id,source_attempt_id) REFERENCES app_private.attempts(user_id,id)
);
CREATE INDEX cards_owner_due ON app_private.cards(user_id,due_at,id);
CREATE TABLE app_private.review_logs (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, card_id uuid NOT NULL,
  card_version integer NOT NULL CHECK(card_version>0), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 4),
  before_card jsonb NOT NULL, after_card jsonb NOT NULL, scheduler_log jsonb NOT NULL,
  algorithm text NOT NULL, scheduler_config jsonb NOT NULL,
  revealed_at timestamptz NOT NULL, occurred_at timestamptz NOT NULL,
  UNIQUE(user_id,card_id,card_version),
  FOREIGN KEY(user_id,card_id) REFERENCES app_private.cards(user_id,id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mastery_evidence','skill_mastery','cards','review_logs'] LOOP
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY owner_only ON app_private.%I TO csh_runtime USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())',t);
    EXECUTE format('GRANT SELECT,INSERT ON app_private.%I TO csh_runtime',t);
  END LOOP;
END $$;
GRANT UPDATE ON app_private.cards,app_private.skill_mastery TO csh_runtime;
-- No key table exposed to runtime/client, no mutation of historical evidence.
DELETE FROM app_meta.runtime_proof;
