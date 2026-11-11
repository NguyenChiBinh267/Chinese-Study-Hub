// Exact synthetic cohort created by this gate only. Never used by web runtime.
import fs from "node:fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  cloudUrl,
  targetSchema,
  verifiedPgOptions,
} from "./cloud-gates-policy";
async function main() {
  if (process.argv[2] !== "--cleanup")
    throw Error("EXPLICIT_TASK_CLEANUP_REQUIRED");
  const d = ".local-postgres/cloud-gates",
    read = (n: string) =>
      JSON.parse(fs.readFileSync(`${d}/${n}`, "utf8").replace(/^\uFEFF/, ""));
  const p = targetSchema.parse(read("project.json")),
    a = read("auth-test-accounts.json"),
    url = read("connection.json").adminUrl;
  if (
    p.projectRef !== "yartjbdapoyqcxfagsrj" ||
    a.projectRef !== p.projectRef ||
    a.nonowner.email !== "nonowner-cloud-gate@csh.invalid"
  )
    throw Error("EXACT_SYNTHETIC_COHORT_REQUIRED");
  cloudUrl(url, p, true);
  const db = new Client(
    verifiedPgOptions(url, fs.readFileSync(`${d}/supabase-ca.crt`, "utf8")),
  );
  await db.connect();
  let receipts = 0,
    profiles = 0;
  try {
    receipts =
      (
        await db.query(
          "DELETE FROM app_private.api_idempotency WHERE endpoint='cloud-gate-proof-v1' AND user_id=ANY($1::uuid[])",
          [[a.owner.id, a.nonowner.id]],
        )
      ).rowCount ?? 0;
    profiles =
      (
        await db.query(
          "DELETE FROM app_private.owner_profiles WHERE display_name='CLOUD_GATE_SYNTHETIC' AND user_id=ANY($1::uuid[])",
          [[a.owner.id, a.nonowner.id]],
        )
      ).rowCount ?? 0;
  } finally {
    await db.end();
  }
  const keys = read("api-keys.json"),
    service = keys.find(
      (k: { name: string }) => k.name === "service_role",
    )?.api_key;
  if (!service) throw Error("ADMIN_CLEANUP_KEY_REQUIRED");
  const admin = createClient(`https://${p.projectRef}.supabase.co`, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    found = await admin.auth.admin.getUserById(a.nonowner.id);
  if (found.error || found.data.user?.email !== a.nonowner.email)
    throw Error("NONOWNER_IDENTITY_RECONCILIATION_REQUIRED");
  const deletion = await admin.auth.admin.deleteUser(a.nonowner.id);
  if (deletion.error) throw Error("SYNTHETIC_NONOWNER_DELETE_FAILED");
  const remaining = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (
    remaining.error ||
    remaining.data.users.length !== 1 ||
    remaining.data.users[0].id !== a.owner.id
  )
    throw Error("OWNER_ONLY_READBACK_FAILED");
  fs.writeFileSync(
    `${d}/cloud-cohort-cleanup.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectRef: p.projectRef,
        syntheticReceiptsRemoved: receipts,
        syntheticProfilesRemoved: profiles,
        syntheticNonownerRemoved: true,
        remainingSyntheticOwner: 1,
        personalHistoryTouched: false,
        productionGateStamped: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS exact synthetic SQL cohort and nonowner removed; one technical owner retained.",
  );
}
main().catch((e: unknown) => {
  console.error(
    e instanceof Error && /^[A-Z_]+$/.test(e.message)
      ? e.message
      : "CLOUD_COHORT_CLEANUP_FAILED",
  );
  process.exitCode = 1;
});
