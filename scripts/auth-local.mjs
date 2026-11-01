// Disposable, real Supabase Auth (GoTrue) integration. No cloud account or billing.
// Secrets are generated only into the ignored local evidence directory.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(".local-postgres/sprint10/auth-local");
fs.mkdirSync(root, { recursive: true });
const file = path.join(root, "credentials.json");
const docker = (args, timeout = 120000) =>
  execFileSync("docker", args, {
    windowsHide: true,
    stdio: "pipe",
    timeout,
    encoding: "utf8",
  });
let cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
const action = process.argv[2];
function token(role, secret) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url"),
    payload = encode({
      iss: "csh-disposable-local-auth",
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    }),
    header = encode({ alg: "HS256", typ: "JWT" }),
    body = header + "." + payload;
  return (
    body + "." + createHmac("sha256", secret).update(body).digest("base64url")
  );
}
function save() {
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
async function wait(url, headers) {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(1500),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error("Local Auth health timed out");
}
try {
  if (action === "start") {
    if (!cfg) {
      const id = randomUUID().replaceAll("-", "").slice(0, 12),
        secret = randomBytes(48).toString("hex");
      cfg = {
        id,
        network: "csh-auth10-" + id,
        db: "csh-auth10-db-" + id,
        auth: "csh-auth10-server-" + id,
        dbPassword: randomBytes(32).toString("hex"),
        authDbPassword: randomBytes(32).toString("hex"),
        jwtSecret: secret,
        anonKey: token("anon", secret),
        adminKey: token("service_role", secret),
        owner: {
          id: randomUUID(),
          email: "owner@csh.invalid",
          password: randomBytes(32).toString("hex"),
        },
        other: {
          id: randomUUID(),
          email: "other@csh.invalid",
          password: randomBytes(32).toString("hex"),
        },
      };
      save();
    }
    // Renew only disposable API/admin JWTs; preserve signing key, user IDs and data.
    cfg.anonKey = token("anon", cfg.jwtSecret);
    cfg.adminKey = token("service_role", cfg.jwtSecret);
    save();
    for (const value of [cfg.network, cfg.db, cfg.auth])
      if (!/^csh-auth10-[a-z0-9-]+$/.test(value))
        throw Error("Invalid managed resource name");
    const exists = (name) => {
      try {
        docker(["inspect", name], 10000);
        return true;
      } catch {
        return false;
      }
    };
    if (!exists(cfg.network))
      docker(["network", "create", "--label", "csh.sprint=10", cfg.network]);
    const pgEnv = path.join(root, "pg.env"),
      authEnv = path.join(root, "auth.env"),
      init = path.join(root, "init.sql");
    fs.writeFileSync(pgEnv, `POSTGRES_PASSWORD=${cfg.dbPassword}\n`, {
      mode: 0o600,
    });
    fs.writeFileSync(
      init,
      `CREATE EXTENSION IF NOT EXISTS pgcrypto;\nCREATE ROLE supabase_auth_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${cfg.authDbPassword}';\nCREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;\nGRANT CREATE ON DATABASE postgres TO supabase_auth_admin;\nALTER ROLE supabase_auth_admin SET search_path=auth,public;\n`,
      { mode: 0o600 },
    );
    if (!exists(cfg.db)) {
      docker(["pull", "postgres:16-alpine"]);
      docker([
        "run",
        "-d",
        "--name",
        cfg.db,
        "--label",
        "csh.sprint=10",
        "--network",
        cfg.network,
        "--env-file",
        pgEnv,
        "--mount",
        `type=bind,source=${init},target=/docker-entrypoint-initdb.d/01-auth.sql,readonly`,
        "postgres:16-alpine",
      ]);
    } else docker(["start", cfg.db]);
    for (let i = 0; i < 40; i++) {
      try {
        docker(["exec", cfg.db, "pg_isready", "-U", "postgres"], 5000);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    const values = {
      GOTRUE_API_HOST: "0.0.0.0",
      GOTRUE_API_PORT: "9999",
      API_EXTERNAL_URL: "http://127.0.0.1:54390/auth/v1",
      GOTRUE_SITE_URL: "http://127.0.0.1:3021",
      GOTRUE_DB_DRIVER: "postgres",
      GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${cfg.authDbPassword}@${cfg.db}:5432/postgres?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_DISABLE_SIGNUP: "true",
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_JWT_EXP: "3600",
      GOTRUE_JWT_SECRET: cfg.jwtSecret,
      GOTRUE_JWT_ISSUER: "http://127.0.0.1:54390/auth/v1",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false",
      GOTRUE_MAILER_AUTOCONFIRM: "true",
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
      GOTRUE_LOG_LEVEL: "error",
    };
    fs.writeFileSync(
      authEnv,
      Object.entries(values)
        .map(([k, v]) => k + "=" + v)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    if (!exists(cfg.auth)) {
      docker(["pull", "supabase/gotrue:v2.197.0"]);
      docker([
        "run",
        "-d",
        "--name",
        cfg.auth,
        "--label",
        "csh.sprint=10",
        "--network",
        cfg.network,
        "--env-file",
        authEnv,
        "-p",
        "127.0.0.1:54391:9999",
        "supabase/gotrue:v2.197.0",
      ]);
    } else docker(["start", cfg.auth]);
    await wait("http://127.0.0.1:54391/health");
    for (const key of ["owner", "other"]) {
      const u = cfg[key],
        r = await fetch("http://127.0.0.1:54391/admin/users", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + cfg.adminKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: u.id,
            email: u.email,
            password: u.password,
            email_confirm: true,
          }),
        });
      if (r.ok) {
        const result = await r.json();
        u.id = result.id;
        save();
      } else if (r.status !== 422)
        throw Error("Local fixture user creation failed");
    }
    fs.writeFileSync(
      path.join(root, "runtime.env"),
      `CSH_APP_MODE=PRODUCTION_AUTHENTICATED\nCSH_APP_ORIGIN=http://127.0.0.1:3021\nCSH_AUTH_URL=http://127.0.0.1:54390\nCSH_AUTH_PUBLISHABLE_KEY=${cfg.anonKey}\nOWNER_USER_ID=${cfg.owner.id}\n`,
      { mode: 0o600 },
    );
    const images = [cfg.db, cfg.auth]
      .map((name) => JSON.parse(docker(["inspect", name]))[0])
      .map((c) => ({
        name: c.Name.replace(/^\//, ""),
        image: c.Config.Image,
        imageId: c.Image,
        loopbackOnly: c.HostConfig.PortBindings,
      }));
    fs.writeFileSync(
      path.join(root, "provider-evidence.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          kind: "REAL_LOCAL_GOTRUE_NOT_CLOUD",
          version: "v2.197.0",
          signupDisabled: true,
          images,
          cloudAccountVerified: false,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(root, "owner-login.txt"),
      `LOCAL TEST ACCOUNT ONLY — not your future production identity.\nEmail: ${cfg.owner.email}\nPassword: ${cfg.owner.password}\n`,
      { mode: 0o600 },
    );
    console.log(
      "PASS real local GoTrue ready; two disposable test users; random secrets kept private.",
    );
  } else if (action === "stop") {
    if (!cfg) throw Error("No managed local resources");
    for (const name of [cfg.auth, cfg.db]) {
      const meta = JSON.parse(docker(["inspect", name]))[0];
      if (meta.Config.Labels?.["csh.sprint"] !== "10")
        throw Error("Not a managed test container");
      docker(["stop", name]);
    }
    console.log(
      "Stopped only Sprint10-managed Auth containers; data retained.",
    );
  } else throw Error("Use start | stop");
} catch (e) {
  fs.writeFileSync(path.join(root, "setup-error.log"), String(e.message));
  console.error(
    "Local Auth setup failed; inspect the private setup log. No secrets printed.",
  );
  process.exitCode = 1;
}
