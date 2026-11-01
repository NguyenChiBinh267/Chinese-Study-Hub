import fs from "node:fs";
import { spawn } from "node:child_process";
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const url = new URL(state.runtimeUrl);
const port = process.env.CSH_HSK24_PREVIEW_PORT ?? "3024";
if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw Error("INVALID_LOCAL_PORT");
if (
  !/^csh_hsk24_[a-f0-9]{12}$/.test(state.database) ||
  url.hostname !== "127.0.0.1" ||
  url.pathname !== "/" + state.database ||
  url.port !== "5447" ||
  url.username !== "csh_runtime"
)
  throw Error("ISOLATED_LOCAL_DATABASE_REQUIRED");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    ...(process.env.CSH_HSK24_PREVIEW_WEBPACK === "1" ? ["--webpack"] : []),
    "--no-server-fast-refresh",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      CSH_APP_MODE: "LOCAL_DATABASE_DEV",
      CSH_LOCAL_CURRICULUM: "hsk24-batch1",
      CSH_LOCAL_DATABASE: "1",
      CSH_APP_ORIGIN: `http://127.0.0.1:${port}`,
      CSH_LOCAL_OWNER_ID: state.ownerId,
      DATABASE_URL: state.runtimeUrl,
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
