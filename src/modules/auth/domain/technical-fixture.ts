// Content eligibility for local acceptance only. This never authenticates a user.
export const TECHNICAL_FIXTURE = "csh-auth-technical-v1";
export function technicalFixtureConfiguration(
  env: NodeJS.ProcessEnv,
  build: string | undefined,
) {
  if (
    build !== "development" ||
    env.NODE_ENV !== "development" ||
    env.CSH_APP_MODE !== "PRODUCTION_AUTHENTICATED" ||
    env.CSH_AUTH_TECHNICAL_FIXTURE !== TECHNICAL_FIXTURE
  )
    return false;
  try {
    const db = new URL(env.DATABASE_URL!);
    return (
      ["127.0.0.1", "localhost", "[::1]"].includes(db.hostname) &&
      db.username === "csh_runtime" &&
      /^\/csh_auth_verify_[a-f0-9]{12}$/.test(db.pathname)
    );
  } catch {
    return false;
  }
}
