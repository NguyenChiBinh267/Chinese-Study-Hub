import "server-only";
import { exit } from "node:process";
export async function registerAuth() {
  const { appMode, authConfiguration, AuthConfigurationError } =
    await import("./config");
  try {
    const mode = appMode();
    if (mode === "PRODUCTION_AUTHENTICATED") {
      const cfg = authConfiguration();
      if (process.env.NODE_ENV === "production") {
        const { loadContentRelease } =
          await import("@/modules/content/application/releases");
        loadContentRelease();
        const { loadPrivateOwnerPreview } =
          await import("@/modules/content/application/private-preview");
        loadPrivateOwnerPreview();
        const { assertProductionDatabase } = await import("./repositories");
        await assertProductionDatabase();
        const response = await fetch(`${cfg.providerUrl}/auth/v1/settings`, {
          headers: { apikey: cfg.publishableKey },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok || (await response.json()).disable_signup !== true)
          throw new Error("AUTH_PROVIDER_SIGNUP_NOT_DISABLED");
      }
    }
  } catch (error) {
    const code =
      error instanceof AuthConfigurationError
        ? error.code
        : error instanceof Error && /^[A-Z][A-Z0-9_]{3,80}$/.test(error.message)
          ? error.message
          : "AUTH_PREFLIGHT_UNAVAILABLE";
    // Next can leave a failed instrumentation server waiting on its listening
    // socket. Refuse the production process explicitly instead of hanging.
    console.error("CSH_STARTUP_REFUSED:" + code);
    if (process.env.NODE_ENV === "production") exit(1);
    throw new Error("CSH_STARTUP_REFUSED:" + code);
  }
}
