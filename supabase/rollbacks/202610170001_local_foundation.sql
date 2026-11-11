-- Destructive development rollback: explicit CLI confirmation required. Export
-- acknowledged data before rollback. Roles/cluster are preserved.
SET LOCAL ROLE csh_schema_owner;
DROP SCHEMA app_private CASCADE;
DROP SCHEMA app_meta CASCADE;
DROP SCHEMA auth CASCADE;
