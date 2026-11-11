// Fail-closed checks; outputs names/codes only, never credential values.
import {
  appMode,
  authConfiguration,
  AuthConfigurationError,
} from "../src/modules/auth/server/config";
async function main() {
  if (appMode(process.env, "production") !== "PRODUCTION_AUTHENTICATED")
    throw new AuthConfigurationError("PRODUCTION_AUTHENTICATED_REQUIRED");
  const cfg = authConfiguration(process.env, "production");
  const {loadContentRelease}=await import("../src/modules/content/application/releases");
  loadContentRelease(process.env,"production");
  if (process.argv.includes("--config-only")) {
    console.log(
      "PASS syntax/policy checks only; provider, account eligibility, TLS and production RLS remain UNVERIFIED.",
    );
    return;
  }
  const { assertProductionDatabase } =
    await import("../src/modules/auth/server/repositories");
  await assertProductionDatabase();
  const r = await fetch(cfg.providerUrl + "/auth/v1/settings", {
    headers: { apikey: cfg.publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok || (await r.json()).disable_signup !== true)
    throw new AuthConfigurationError("PROVIDER_SIGNUP_NOT_DISABLED");
  console.log(
    "PASS live runtime proof and provider signup check; owner account/free eligibility/content approval still require their separate evidence.",
  );
}
void main().catch((e) => {
  console.error(
    e instanceof AuthConfigurationError ? e.code : "LIVE_PREFLIGHT_FAILED",
  );
  process.exitCode = 1;
});
