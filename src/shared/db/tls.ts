import { createHash, X509Certificate } from "node:crypto";
// Official certificate linked by the project's Supabase Database Settings.
// Pin DER rather than PEM whitespace so secret stores may normalize newlines.
export const SUPABASE_CA_SHA256 =
  "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa";
export function verifiedDatabaseOptions(connectionString: string, ca: string) {
  const u = new URL(connectionString);
  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(ca);
  } catch {
    throw Error("VERIFIED_PROVIDER_CA_REQUIRED");
  }
  if (
    u.searchParams.toString() !== "sslmode=verify-full" ||
    !certificate.ca ||
    createHash("sha256").update(certificate.raw).digest("hex") !==
      SUPABASE_CA_SHA256
  )
    throw Error("VERIFIED_PROVIDER_CA_REQUIRED");
  // pg connection-string SSL parameters replace config.ssl, silently losing a
  // supplied CA. Validate first, then pass equivalent verify-full options.
  u.search = "";
  return {
    connectionString: u.href,
    ssl: { ca, rejectUnauthorized: true, servername: u.hostname },
  };
}
