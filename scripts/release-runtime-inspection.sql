-- Future authorized runtime probe. Nothing is committed; never use admin/service_role.
\set ON_ERROR_STOP on
SELECT current_user, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb
 FROM pg_roles r WHERE r.rolname=current_user;
DO $$ BEGIN
 IF current_user<>'csh_runtime' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user))
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)))
 OR (SELECT count(*) FROM pg_tables WHERE schemaname='app_private')<>19
 THEN RAISE EXCEPTION 'RUNTIME_ROLE_OR_FORCE_RLS_FAILED'; END IF;
END $$;
BEGIN;
SELECT set_config('csh.audit_owner_a', :'owner_a', true),set_config('csh.audit_owner_b', :'owner_b', true);
SELECT set_config('request.jwt.claim.sub', :'owner_a', true);
DO $$ BEGIN
 IF auth.uid()<>current_setting('csh.audit_owner_a')::uuid THEN RAISE EXCEPTION 'OWNER_CLAIM_FAILED'; END IF;
 INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES(auth.uid(),'ROLLBACK_ONLY_PROBE') ON CONFLICT(user_id) DO NOTHING;
END $$;
SELECT set_config('request.jwt.claim.sub', :'owner_b', true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM app_private.owner_profiles WHERE user_id=current_setting('csh.audit_owner_a')::uuid) THEN RAISE EXCEPTION 'CROSS_OWNER_READ'; END IF;
 BEGIN
  INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES(current_setting('csh.audit_owner_a')::uuid,'MUST_BE_REJECTED');
  RAISE EXCEPTION 'WITH_CHECK_BYPASS';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
DO $$ BEGIN IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'IDENTITY_RETAINED_AFTER_ROLLBACK'; END IF; END $$;
SELECT 'PASS single-connection rollback probe only; managed pool/Auth/content tests remain separate' AS result;
