export const appModes = [
  "DEMO",
  "LOCAL_DATABASE_DEV",
  "PRODUCTION_AUTHENTICATED",
] as const;
export type AppMode = (typeof appModes)[number];
export function safeRedirect(value: unknown, fallback = "/today") {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    !/^\/(?!\/)/.test(value) ||
    /[\\\x00-\x20\x7f]/.test(value) ||
    value.includes("%")
  )
    return fallback;
  const url = new URL(value, "https://redirect.invalid");
  if (
    url.origin !== "https://redirect.invalid" ||
    !/^\/(today|schedule|learn|review|progress|account|onboarding)(\/|$)/.test(
      url.pathname,
    )
  )
    return fallback;
  return url.pathname + url.search;
}
