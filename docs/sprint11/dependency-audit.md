# Dependency audit — 2026-10-20

Fresh `npm audit --omit=dev`: **0 findings**. Full audit: **5 high development-tree findings**, one underlying advisory propagated through `eslint-config-next@16.4.2 → @next/eslint-plugin-next@16.4.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) reports recursive brace-pattern stack exhaustion through version 3.0.3 and lists no patched version. `npm view braces version` returned 3.0.3 during this run. npm's proposed fix is a major downgrade to `eslint-config-next@14.2.35`, not a verified compatible patch for the installed Next 16 toolchain; no forced downgrade or unreviewed vendored patch was applied.

Installed `get-root-dirs.js` passes repository-controlled `context.settings.next.rootDir` globs to fast-glob. This project's ESLint config does not define `rootDir` or accept HTTP/user-provided lint patterns. The installed production dependency graph excludes this chain. These observations support a limited development/build exposure assessment, not a proof that all tooling call sites are unreachable or a waiver of the advisory.

Mitigation in this scope: keep tooling local, fixed repository-owned inputs, pinned lockfile and no public lint API; do not execute untrusted configuration/PR code. Retain the findings, recheck for an upstream compatible fix, and require an explicit release-risk review before online release. No owner acceptance or automatic dismissal is recorded. Private audit JSON and command evidence remain in `.local-postgres/sprint11/`.
