import { z } from "zod";
import { verifiedDatabaseOptions as verifiedPgOptions } from "../src/shared/db/tls";
export { verifiedPgOptions };
export function configuration(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  const ref = z
    .string()
    .regex(/^[a-z]{20}$/)
    .parse(env.CSH_PROJECT_REF);
  const owner = z.uuid().parse(env.OWNER_USER_ID);
  const origin = new URL(
    env.CSH_APP_ORIGIN ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : ""),
  );
  const provider = new URL(env.CSH_AUTH_URL!);
  const local =
    build === "development" &&
    env.NODE_ENV === "development" &&
    env.CSH_PROOF_LOCAL_TEST === "1" &&
    ["127.0.0.1", "localhost"].includes(origin.hostname);
  if (
    env.CSH_PROOF_MODE !== "cloud-benchmark-v1" ||
    (!local && origin.protocol !== "https:") ||
    (!local && env.CSH_PROOF_LOCAL_TEST) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    provider.origin !== `https://${ref}.supabase.co` ||
    provider.pathname !== "/" ||
    provider.search ||
    provider.hash
  )
    throw Error("UNSAFE_PROOF_CONFIGURATION");
  const u = new URL(env.DATABASE_URL!);
  if (
    u.protocol !== "postgresql:" ||
    u.username !== `csh_runtime.${ref}` ||
    !u.password ||
    u.hostname !== env.CSH_POOLER_HOST ||
    !/^aws-\d+-ap-southeast-1\.pooler\.supabase\.com$/.test(u.hostname) ||
    u.port !== "6543" ||
    u.pathname !== "/postgres" ||
    u.searchParams.toString() !== "sslmode=verify-full" ||
    ref === "mhhbetnwdpigljqnnthu"
  )
    throw Error("UNSAFE_PROOF_DATABASE");
  const key = env.CSH_AUTH_PUBLISHABLE_KEY ?? "";
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
  try {
    publicKey ||=
      key.split(".").length === 3 &&
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role === "anon";
  } catch {
    /* Invalid public key. */
  }
  if (
    !publicKey ||
    key.startsWith("sb_secret_") ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_ACCESS_TOKEN ||
    env.SUPABASE_DB_PASSWORD ||
    env.CSH_PRIVATE_OWNER_PREVIEW ||
    env.CSH_CONTENT_TEST_ROOT ||
    env.CSH_CONTENT_RELEASE ||
    env.CSH_LOCAL_DATABASE === "1" ||
    Object.keys(env).some(
      (k) =>
        k.startsWith("NEXT_PUBLIC_") &&
        /SECRET|PASSWORD|DATABASE|OWNER|TOKEN/.test(k),
    )
  )
    throw Error("UNEXPECTED_PROOF_CREDENTIAL_OR_CONTENT");
  verifiedPgOptions(u.href, env.CSH_DATABASE_CA_PEM ?? "");
  return {
    ref,
    owner,
    origin: origin.origin,
    provider: provider.origin,
    key,
    database: u.href,
    secure: !local,
  };
}
