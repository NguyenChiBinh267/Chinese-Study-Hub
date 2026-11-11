// Read-only preservation of the selected populated cluster, including owner rows.
import fs from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
const mode = process.argv[2],
  tag = process.argv[3];
assert(["before", "after"].includes(mode));
assert(/^hsk1-[a-z0-9-]+$/.test(tag));
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const state = read(read(".local-postgres/hsk24/current.json").stateFile);
const u = new URL(state.runtimeUrl);
assert.equal(state.database, "csh_hsk24_bf294b6506c1");
assert.equal(u.hostname, "127.0.0.1");
assert.equal(u.port, "5447");
assert.equal(u.username, "csh_runtime");
assert.equal(u.pathname, "/" + state.database);
const base = `.local-postgres/hsk24/${tag}-before.json`;
if (mode === "before") assert(!fs.existsSync(base));
const old = mode === "after" ? read(base) : null;
const c = new Client(adminConfig(state.database));
await c.connect();
try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const definitions = (
    await c.query(
      "SELECT c.relname,json_agg(a.attname ORDER BY x.n) AS keys FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indrelid=c.oid AND i.indisprimary JOIN LATERAL unnest(i.indkey) WITH ORDINALITY x(attnum,n) ON true JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.attnum WHERE n.nspname='app_private' AND c.relkind='r' GROUP BY c.relname ORDER BY c.relname",
    )
  ).rows;
  assert.equal(definitions.length, 19);
  const tables = {};
  const digest = (row) =>
    createHash("sha256").update(JSON.stringify(row)).digest("hex");
  const packages = (
    await c.query(
      "SELECT version_id,package_hash FROM app_content.packages ORDER BY version_id",
    )
  ).rows;
  tables.packages = Object.fromEntries(
    packages.map((r) => [r.version_id, digest(r)]),
  );
  for (const { relname, keys } of definitions) {
    assert(/^[a-z_]+$/.test(relname));
    assert(keys.every((k) => /^[a-z_]+$/.test(k)));
    const rows = (
      await c.query(
        `SELECT * FROM app_private.${relname} ORDER BY ${keys.join(",")}`,
      )
    ).rows;
    tables[relname] = Object.fromEntries(
      rows.map((r) => [JSON.stringify(keys.map((k) => r[k])), digest(r)]),
    );
  }
  if (old) {
    assert.equal(old.database, state.database);
    for (const [table, rows] of Object.entries(old.tables))
      for (const [id, hash] of Object.entries(rows))
        assert.equal(
          tables[table][id],
          hash,
          `HISTORICAL_ROW_CHANGED:${table}:${id}`,
        );
  }
  await c.query("COMMIT");
  const result = {
    database: state.database,
    checkedAt: new Date().toISOString(),
    readOnly: true,
    privateTables: definitions,
    tables,
  };
  fs.writeFileSync(
    mode === "before" ? base : `.local-postgres/hsk24/${tag}-after.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      database: state.database,
      privateTableCount: definitions.length,
      rows: Object.fromEntries(
        Object.entries(tables).map(([k, v]) => [k, Object.keys(v).length]),
      ),
      allPreviousRowsUnchanged: old ? true : null,
    }),
  );
} finally {
  await c.end();
}
