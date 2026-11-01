-- Additive profile only. No ownership transfer or changes to historical evidence.
SET LOCAL ROLE csh_schema_owner;
CREATE TABLE app_private.owner_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Người học' CHECK(length(display_name) BETWEEN 1 AND 80),
  text_size text NOT NULL DEFAULT 'normal' CHECK(text_size IN ('normal','large')),
  timezone text NOT NULL DEFAULT 'Asia/Saigon' CHECK(length(timezone) BETWEEN 1 AND 80),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.owner_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON app_private.owner_profiles TO csh_runtime
  USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE ON app_private.owner_profiles TO csh_runtime;
-- New migration requires a fresh native RLS proof before learning writes.
DELETE FROM app_meta.runtime_proof;
