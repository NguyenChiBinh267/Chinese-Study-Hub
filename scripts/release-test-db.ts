import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { adminConfig, migrate } from "./local-db.mjs";
import { seedContent } from "./seed-content";
import { seedCurriculum } from "./seed-curriculum";
import { syntheticRelease } from "../tests/fixtures/content-release";
import { digest } from "../src/modules/content/domain/release";
import { installRelease } from "./content-release";
const dir = ".local-postgres/sprint12";
export function releaseState() {
  const s = JSON.parse(fs.readFileSync(dir + "/database.json", "utf8"));
  const u = new URL(s.runtimeUrl);
  if (
    !/^csh_release_verify_[a-f0-9]{12}$/.test(s.database) ||
    u.hostname !== "127.0.0.1" ||
    u.port !== "5447" ||
    u.username !== "csh_runtime" ||
    u.pathname !== "/" + s.database
  )
    throw Error("Isolated release database required");
  return s as {
    database: string;
    runtimeUrl: string;
    ownerId: string;
    root: string;
    releaseId: string;
    versionId: string;
    previousReleaseId: string;
    previousVersionId: string;
    mediaId: string;
  };
}
export async function setupReleaseTest() {
  fs.mkdirSync(dir, { recursive: true });
  const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  );
  let s;
  if (fs.existsSync(dir + "/database.json")) s = releaseState();
  else {
    const database = "csh_release_verify_" + randomBytes(6).toString("hex"),
      secrets = JSON.parse(
        fs.readFileSync(".local-postgres/credentials.json", "utf8"),
      );
    const c = new pg.Client(adminConfig("postgres"));
    await c.connect();
    try {
      await c.query(`CREATE DATABASE ${database}`);
      await c.query(`GRANT CREATE ON DATABASE ${database} TO csh_schema_owner`);
    } finally {
      await c.end();
    }
    s = {
      database,
      runtimeUrl: `postgresql://csh_runtime:${encodeURIComponent(secrets.runtime)}@127.0.0.1:5447/${database}`,
      ownerId: auth.owner.id,
    };
    fs.writeFileSync(dir + "/database.json", JSON.stringify(s), {
      mode: 0o600,
    });
  }
  if (s.ownerId !== auth.owner.id)
    throw Error("Preserve existing identity-bound test database");
  await migrate(s.database);
  await migrate(s.database);
  const inspect = new pg.Client(adminConfig(s.database));
  await inspect.connect();
  const count = Number(
    (await inspect.query("SELECT count(*) FROM app_content.courses")).rows[0]
      .count,
  );
  await inspect.end();
  if (count === 0) {
    await seedContent(s.database);
    await seedCurriculum(s.database);
  } else if (count !== 5)
    throw Error("Preserve unexpected curriculum footprint");
  // Append new fixture versions; never truncate/reset prior test learning records.
  const run = randomBytes(3).toString("hex"),
    root = path.resolve(dir + "/releases-" + run),
    version = 1000000 + Math.floor(Math.random() * 1000000000);
  const a = syntheticRelease(root, run + "a", version),
    b = syntheticRelease(root, run + "b", version + 1);
  fs.writeFileSync(
    path.join(root, "trusted.json"),
    JSON.stringify({
      schemaVersion: 1,
      releases: [a.entry, b.entry],
      reviewHashes: [
        digest(JSON.stringify(a.review)),
        digest(JSON.stringify(b.review)),
      ],
    }),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    CSH_CONTENT_TEST_ROOT: root,
    CSH_CONTENT_RELEASE: a.entry.id,
    DATABASE_URL: s.runtimeUrl,
  };
  await installRelease(s.database, env);
  s = {
    ...s,
    root,
    releaseId: a.entry.id,
    versionId: a.p.lesson.versionId,
    previousReleaseId: b.entry.id,
    previousVersionId: b.p.lesson.versionId,
    mediaId: a.manifest.audio[0].id,
  };
  fs.writeFileSync(dir + "/database.json", JSON.stringify(s, null, 2), {
    mode: 0o600,
  });
  console.log(
    "PASS isolated release fixture installed; previous history untouched; synthetic approvals cannot authorize production.",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  void setupReleaseTest().catch((e) => {
    console.error(
      e instanceof Error ? e.message : "Release fixture setup failed",
    );
    process.exitCode = 1;
  });
