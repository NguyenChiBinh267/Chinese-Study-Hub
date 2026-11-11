import { createHash } from "node:crypto";
import { z } from "zod";

export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export {
  SUPABASE_CA_SHA256,
  verifiedDatabaseOptions as verifiedPgOptions,
} from "../src/shared/db/tls";

export const targetSchema = z.strictObject({
  projectRef: z.string().regex(/^[a-z]{20}$/),
  organization: z.literal("mcqypdwzlglhrosegrli"),
  name: z.literal("chinese-study-hub"),
  region: z.literal("ap-southeast-1"),
  plan: z.literal("Free"),
  observedAt: z.iso.datetime(),
  poolerHost: z
    .string()
    .regex(/^aws-\d+-ap-southeast-1\.pooler\.supabase\.com$/),
  ownerConfirmedNewIsolatedProject: z.literal(true),
});
export type CloudTarget = z.infer<typeof targetSchema>;
export function cloudUrl(value: string, target: CloudTarget, admin = false) {
  const u = new URL(value);
  if (
    target.projectRef === "mhhbetnwdpigljqnnthu" ||
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    u.hostname !== target.poolerHost ||
    u.pathname !== "/postgres" ||
    u.username !==
      `${admin ? "postgres" : "csh_runtime"}.${target.projectRef}` ||
    !u.password ||
    u.port !== (admin ? "5432" : "6543") ||
    u.searchParams.get("sslmode") !== "verify-full" ||
    [...u.searchParams.keys()].some((k) => k !== "sslmode") ||
    u.hash
  )
    throw Error("UNRECOGNIZED_OR_UNSAFE_CLOUD_TARGET");
  return u;
}

// Preserve the seven applied local migration files byte-for-byte. On managed
// Supabase only the local auth shim is omitted; managed auth.uid() is retained.
const shim = `CREATE SCHEMA auth;\nREVOKE ALL ON SCHEMA public FROM PUBLIC;\nREVOKE ALL ON SCHEMA app_private, app_meta, auth FROM PUBLIC;\nCREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER\n  SET search_path = pg_catalog AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;\nREVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;\nGRANT USAGE ON SCHEMA app_private, app_meta, auth TO csh_runtime;\nGRANT EXECUTE ON FUNCTION auth.uid() TO csh_runtime;`;
export function managedFoundation(sql: string) {
  const input = sql.replace(/\r\n/g, "\n");
  if (input.split(shim).length !== 2)
    throw Error("MANAGED_BASELINE_SOURCE_DRIFT");
  return input.replace(
    shim,
    `REVOKE ALL ON SCHEMA app_private, app_meta FROM PUBLIC;\nGRANT USAGE ON SCHEMA app_private, app_meta TO csh_runtime;`,
  );
}

// Hosted Supabase reserves auth schema ACLs. Compile unchanged policy expressions
// as the migration administrator, then return to the NOLOGIN object owner.
// Runtime gains no role membership, managed-schema grant or definer function.
export function managedPolicyCompilation(sql: string) {
  return sql
    .replace(/DO \$\$[\s\S]*?END \$\$;/g, (block) =>
      block.includes("CREATE POLICY") && block.includes("auth.uid()")
        ? `RESET ROLE;\n${block}\nSET LOCAL ROLE csh_schema_owner;`
        : block,
    )
    .replace(
      /CREATE POLICY owner_only ON app_private\.owner_profiles TO csh_runtime\s+USING\(user_id=auth\.uid\(\)\) WITH CHECK\(user_id=auth\.uid\(\)\);/g,
      (statement) =>
        `RESET ROLE;\n${statement}\nSET LOCAL ROLE csh_schema_owner;`,
    );
}
