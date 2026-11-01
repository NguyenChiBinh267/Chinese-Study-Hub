// Isolated native database for real Auth acceptance. Never alters csh_local data.
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { adminConfig, migrate } from "./local-db.mjs";
const requestedDirectory = process.env.CSH_AUTH_FIXTURE_STATE_DIR;
if (
  requestedDirectory &&
  !/^\.local-postgres\/sprint12\/(auth|token-desktop|token-mobile)-[a-f0-9]{6}$/.test(
    requestedDirectory,
  )
)
  throw Error("Unexpected Auth fixture state directory");
export const technicalDirectory =
  requestedDirectory ?? ".local-postgres/sprint11";
export function technicalState() {
  const state = JSON.parse(
    fs.readFileSync(technicalDirectory + "/database.json", "utf8"),
  );
  if (!/^csh_auth_verify_[a-f0-9]{12}$/.test(state.database))
    throw Error("Unexpected test database");
  const url = new URL(state.runtimeUrl);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5447" ||
    url.username !== "csh_runtime" ||
    url.pathname !== "/" + state.database
  )
    throw Error("Test runtime URL does not match the isolated database");
  return state;
}
export async function resetTechnicalRows() {
  const state = technicalState(),
    c = new pg.Client(adminConfig(state.database));
  await c.connect();
  try {
    const marker = (
      await c.query(
        "SELECT evidence FROM app_meta.runtime_proof WHERE singleton",
      )
    ).rows[0]?.evidence?.technicalFixture;
    if (
      marker?.id !== "csh-auth-technical-v1" ||
      marker?.ownerId !== state.ownerId
    )
      throw Error("Verified fixture database required");
    const mixed = (
      await c.query(
        "SELECT EXISTS(SELECT 1 FROM app_private.lesson_sessions WHERE lesson_version_id<>'local-foundation-v1') OR EXISTS(SELECT 1 FROM app_private.cards WHERE template_version_id NOT IN ('local-recall-v1-0','local-recall-v1-1')) OR EXISTS(SELECT 1 FROM app_content.packages) AS mixed",
      )
    ).rows[0].mixed;
    if (mixed) throw Error("Refuse reset: non-technical content/history found");
    const tables = (
      await c.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='app_private'",
      )
    ).rows.map((r) => r.tablename);
    if (tables.length !== 19 || !tables.every((t) => /^[a-z_]+$/.test(t)))
      throw Error("Unexpected fixture footprint");
    await c.query(
      "TRUNCATE " +
        tables.map((t) => "app_private." + t).join(",") +
        " CASCADE",
    );
  } finally {
    await c.end();
  }
}
export async function setupTechnicalDatabase() {
  fs.mkdirSync(technicalDirectory, { recursive: true });
  const file = technicalDirectory + "/database.json";
  const owner = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  ).owner;
  const credentials = JSON.parse(
    fs.readFileSync(".local-postgres/credentials.json", "utf8"),
  );
  let state;
  if (fs.existsSync(file)) {
    state = technicalState();
    if (state.ownerId !== owner.id)
      throw Error("Test identity changed; preserve existing database");
  } else {
    const database = "csh_auth_verify_" + randomBytes(6).toString("hex");
    state = {
      database,
      ownerId: owner.id,
      runtimeUrl: `postgresql://csh_runtime:${encodeURIComponent(credentials.runtime)}@127.0.0.1:5447/${database}`,
    };
    const c = new pg.Client(adminConfig("postgres"));
    await c.connect();
    try {
      await c.query(`CREATE DATABASE ${database}`);
      await c.query(`GRANT CREATE ON DATABASE ${database} TO csh_schema_owner`);
    } finally {
      await c.end();
    }
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  await migrate(state.database);
  await migrate(state.database); // Checksums/idempotent upgrade, no recreation.
  console.log(
    "Isolated technical database ready; no local history transferred and no credentials printed.",
  );
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/auth-technical-db.mjs")) {
  setupTechnicalDatabase().catch(() => {
    console.error(
      "Technical database setup failed; preserve existing data and inspect local configuration.",
    );
    process.exitCode = 1;
  });
}
