import { z } from "zod";
import { appModes, type AppMode } from "../domain/mode";
import { technicalFixtureConfiguration } from "../domain/technical-fixture";
import { contentTestAllowed } from "@/modules/content/application/releases";
import { privatePreviewAllowed } from "@/modules/content/application/private-preview";
export class AuthConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(`Cấu hình xác thực chưa an toàn: ${code}`);
  }
}
export function appMode(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
): AppMode {
  if (env.CSH_APP_MODE) {
    if (
      build === "production" &&
      env.CSH_APP_MODE !== "PRODUCTION_AUTHENTICATED"
    )
      throw new AuthConfigurationError("DEVELOPMENT_MODE_IN_PRODUCTION");
    if (!appModes.includes(env.CSH_APP_MODE as AppMode))
      throw new AuthConfigurationError("INVALID_APP_MODE");
    if (
      env.CSH_APP_MODE === "LOCAL_DATABASE_DEV" &&
      (build !== "development" || env.NODE_ENV !== "development")
    )
      throw new AuthConfigurationError("DEVELOPMENT_MODE_IN_PRODUCTION");
    return env.CSH_APP_MODE as AppMode;
  }
  if (build === "production") return "PRODUCTION_AUTHENTICATED";
  return env.CSH_LOCAL_DATABASE === "1" ? "LOCAL_DATABASE_DEV" : "DEMO";
}
export function authConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  const fail = (code: string): never => {
    throw new AuthConfigurationError(code);
  };
  if (appMode(env, build) !== "PRODUCTION_AUTHENTICATED")
    return fail("AUTHENTICATED_MODE_REQUIRED");
  if (env.CSH_PRIVATE_OWNER_PREVIEW && !privatePreviewAllowed(env, build))
    return fail("PRIVATE_PREVIEW_LOCAL_ONLY");
  if (env.CSH_CONTENT_TEST_ROOT && !contentTestAllowed(env, build))
    return fail("CONTENT_TEST_FORBIDDEN");
  const owner = z.uuid().safeParse(env.OWNER_USER_ID);
  if (!owner.success) return fail("OWNER_USER_ID_REQUIRED");
  if (
    env.CSH_AUTH_TECHNICAL_FIXTURE &&
    !technicalFixtureConfiguration(env, build)
  )
    return fail("TECHNICAL_FIXTURE_FORBIDDEN");
  let origin: URL, provider: URL;
  try {
    origin = new URL(env.CSH_APP_ORIGIN!);
    provider = new URL(env.CSH_AUTH_URL!);
  } catch {
    return fail("ORIGIN_AND_AUTH_URL_REQUIRED");
  }
  const loopback = (u: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  for (const u of [origin, provider]) {
    if (u.username || u.password || u.search || u.hash || u.pathname !== "/")
      return fail("CANONICAL_URL_REQUIRED");
    if (
      u.protocol !== "https:" &&
      !(
        build === "development" &&
        env.NODE_ENV === "development" &&
        loopback(u) &&
        u.protocol === "http:"
      )
    )
      return fail("HTTPS_REQUIRED");
  }
  if (build === "production") {
    if (
      env.CSH_LOCAL_DATABASE === "1" ||
      env.CSH_LOCAL_OWNER_ID ||
      env.CSH_LOCAL_SESSION_SECRET
    )
      return fail("DEVELOPMENT_FLAGS_PRESENT");
    if (loopback(provider) || loopback(origin))
      return fail("PRODUCTION_ORIGIN_REQUIRED");
  }
  const key = env.CSH_AUTH_PUBLISHABLE_KEY ?? "";
  let anon = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
  if (!anon) {
    try {
      const parsed = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      anon = parsed.role === "anon" && key.split(".").length === 3;
    } catch {
      /* Invalid public key. */
    }
  }
  if (!anon || key.startsWith("sb_secret_"))
    return fail("PUBLISHABLE_OR_ANON_KEY_REQUIRED");
  if (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.OPENAI_API_KEY ||
    env.AZURE_OPENAI_API_KEY ||
    env.GEMINI_API_KEY
  )
    return fail("UNEXPECTED_PROVIDER_CREDENTIAL");
  if (
    Object.keys(env).some(
      (k) =>
        k.startsWith("NEXT_PUBLIC_") &&
        /SECRET|PASSWORD|DATABASE|SERVICE_ROLE|ADMIN|OWNER_USER_ID|PACKAGE_BUNDLE/.test(
          k,
        ),
    )
  )
    return fail("SERVER_VALUE_MARKED_PUBLIC");
  const database = env.DATABASE_URL;
  if (!database) return fail("DATABASE_URL_REQUIRED");
  try {
    const db = new URL(database);
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !/^csh_runtime(?:\.[a-z0-9]+)?$/.test(db.username) ||
      !db.password
    )
      return fail("LEAST_PRIVILEGE_DATABASE_ROLE_REQUIRED");
    if (
      build === "production" &&
      (loopback(db) || db.searchParams.get("sslmode") !== "verify-full")
    )
      return fail("VERIFIED_DATABASE_TLS_REQUIRED");
  } catch (e) {
    if (e instanceof AuthConfigurationError) throw e;
    return fail("INVALID_DATABASE_URL");
  }
  return {
    ownerId: owner.data,
    origin: origin.origin,
    providerUrl: provider.origin,
    publishableKey: key,
    databaseUrl: database,
    secure: origin.protocol === "https:",
    technicalFixture: technicalFixtureConfiguration(env, build),
  };
}
