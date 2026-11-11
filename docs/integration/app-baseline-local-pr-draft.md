# Draft: integrate the existing app baseline while preserving main's governance

Main has no application baseline. This candidate imports the existing Chinese Study Hub app from source6be onto pinned mainad7f, retaining all newer Engineering Loop/SSOT files. It does not merge/rebase157 source commits or overwrite main with the source tree.

**Local draft only: no GitHub branch/PR publication, merge or deployment.**

## Review scope

- Base: `ad7f4c59442b89701e5e41cd6a120284532c1650`.
- Candidate branch: `integration/app-baseline-main-20261101`.
- Source provenance: `6be987aac67617396f83836d5570c7b8fada6263` and the157-commit history recorded in the manifest.
- Initial runtime candidate: `872d03fc1ad14bb755345331208f704853f2347f`, direct child of main.
- Import1384 source files:1379 exact,5 adjusted for reproducible local preparation, protected AGENTS and isolated test origin. Main86 exact files+2 append-only configurations retained;31 main-only files survive.
- New integration verifiers/test/manifest plus final report/draft/takeover documentation. No new HSK1 feature, teaching activity, vocabulary entry, migration or source-content rewrite.

[Detailed integration report](app-baseline-integration-report.md) · [Machine evidence](app-baseline-integration-report.json) · [Per-file manifest](app-baseline-import-manifest.json)

## Validation

Use the machine report's final per-run results. They come from fresh candidate dependencies/checks and distinguish source history, initial failed clean preparation, simulated browser faults, native SQL and actual HTTP controls. Raw local traces/configuration/snapshots are not attached publicly because they can contain private session details.

Fresh candidate:142unit/35selectedSQL/14browser PASS,0FAIL/0SKIP in final runs; typecheck/lint/build PASS. Earlier clean-preparation failures are preserved. Serverabort logs and the historical cold/503 uncertainty remain visible. Readback preserves83308 pre-task private rows/bindings (including76293original), all11380content/meta rows,7appliedmigration checksums and the application-schema fingerprint.

The existing populated DB is preserved through row/binding checksums and complete content/meta row fingerprints, with migration history/schema readback. No migration was applied to make tests pass. Manual independent review is separate from a dormant Loop verdict.

## Blockers/conditions before merge

1. Owner/reviewer acceptance of this broad baseline import and exact candidate; a runtime test PASS does not accept all source learning content, releases or historical task claims.
2. Actual final acceptance results and limits must remain visible, including any failed/unrun cases. Historical intermittent cold/503 remains open; local acceptance does not establish a hosted SLA or production-authenticated wrapper proof.
3. T009/T026/T052 and other canonical task gates stay pending. Rights, competent language/audio review, free-account/hosting evidence and unpublished-content restrictions are unchanged.
4. Keep latest main Loop safeguards. Its current readiness/telemetry/full-candidate bootstrap limitations must be resolved through the existing authorized workflow before live activation. This manual review is not a bootstrap PASS.
5. Source/branch/main/policy fingerprints must be rechecked at a later authorized merge. No automatic merge, status write, cloud setup, provider call or paid fallback is authorized by this draft.

After baseline acceptance, [the proposed takeover](engineering-loop-takeover.md) uses one bounded initial authorization and dependency-based task selection, rather than asking the owner to assign each next task. It does not activate that process now.
