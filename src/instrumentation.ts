export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { registerAuth } = await import("./modules/auth/server/startup");
    await registerAuth();
  }
}
