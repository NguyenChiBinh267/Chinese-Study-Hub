# HSK1 local runtime stabilization — partial technical closure

Baseline `9c10241001d47013662c3556c62021be1076f123`, original checkout `D:\Chinese-Study-Hub` / `feat/hsk24-curriculum`. Work continues in the same worktree on `fix/hsk1-catalog-stability`; runtime reviewed after repair1 at `57aa693410ac4da4ba17a8f753e1515522a95a02`. Final documentation SHA/worktree and preview health are recorded in the local handoff receipt to avoid a self-referential commit hash.

## What is established

| Evidence | Finding | Limit |
|---|---|---|
| Historical failed L1152 navigation trace | Curriculum GET canceled at14997.213ms; no response503 observed; target course/unit not reached | Does not identify a backend/network/DB root cause |
| First current UI probe | Onboarding did not reach schedule within the test's15s assertion | Different stopping point; pending requests were not fully recorded by its initial telemetry |
| Minimal API setup then catalog; UI setup then catalog; empty-cache UI setup | Each later probe completed first and warm catalog loads | Diagnostic samples, not proof that the intermittent failure disappeared |
| Development server timing | One mode POST took about10.0s, with9.9s attributed to Next compilation and102ms handler time | Explains that mode delay only; does not prove the old catalog timeout's cause |
| Red client/browser503 tests and inspection of the old hook | HTTP status was lost; the hook retained its old error until a successful response | Confirmed client defects, separate from the unknown old latency root cause |
| Independent review REWORK | A503 header could be lost if body reading failed | Reproduced, covered by a red test, then repaired and independently passed |
| Real absent-database native/HTTP controls | PostgreSQL failure reaches the serializer/wire as503, without an empty successful catalog | Deliberate local negative control; not a replay of the historical outage |

**Historical cold/503 root-cause gate: OPEN.** Server logs can contain aborted/ECONNRESET while navigation is changing; their presence alone is not proof of a database outage. New local catalog responses include handler duration in `Server-Timing`; total time outside that duration cannot automatically be labeled network or compilation without correlated evidence.

## Actual changes

- Preserve response status and error code, including503 with HTML, truncated or slow error bodies. Distinguish failure before headers from known HTTP responses. Unknown application/authentication exceptions retain their existing handling.
- Keep the existing15000ms request deadline and20000ms local mode deadline. No automatic retries, false saved state, replacement DEMO success or error-to-empty-catalog fallback.
- Catalog results are bound to their request key. Manual retry immediately shows loading; obsolete reads are aborted and cannot replace the current result.
- Add scoped HTTP timing, native/HTTP negative controls, unit and desktop/360px browser regression coverage. No new learning content or DB schema.

## Verification

Per-run counts, raw evidence hashes and exact boundaries are in [the machine report](hsk1-stability-report.json). The initial red results, first onboarding failure, initial lint/type errors and manual review REWORK remain visible. Final checks are reported independently rather than combining reruns into a clean historical suite.

| Final check | Actual result |
|---|---|
| Unit after repair1 | **141 PASS /0 FAIL /0 SKIP**, including the4request regressions |
| SQL across 6 selected runs | **35 PASS /0 FAIL /0 SKIP**: native 2; HSK1 11; Foundation 6; HSK2 6; HSK3 5; HSK4 5 |
| Browser after repair1 | **14 PASS /0 FAIL /0 SKIP**, retries0;7desktop+7mobile360 |
| Typecheck, lint, supplemental script lint, production build | **PASS** |
| Original/pre-task preservation | **76293 /81726 rows+bindings unchanged**,667immutable bindings retained |

The final browser process began with an empty preserved-and-replaced compilation-cache directory. Its first desktop flow exercises cold onboarding/catalog; later flows use a warm server. Mobile uses a fresh browser context against that same server. This is not a cold machine/OS/PostgreSQL-cache benchmark. The14cases include catalog/error/manual retry, actual L1152 grading/resume/completion/accessibility, the originally failing course/unit navigation, and Today/FSRS continuation at both widths. Earlier separate browser runs remain4PASS and8PASS; diagnostic pre-fix runs remain1FAIL/1PASS/1PASS/1PASS/1FAIL, with their different purposes identified in JSON.

The actual native SQL regression covers the selected Foundation/HSK1–4 flows, grading/idempotency/owner isolation, FSRS/progress/Today and no verified unlock. Browser negative controls inject faults explicitly; normal navigation/grading/Today use the real local backend. Native and HTTP timing samples do not establish a hosted latency SLA.

## Source, data and review boundaries

Pinned GitHub main is `ad7f4c59442b89701e5e41cd6a120284532c1650`. Its plan/status/manifest were read from exact Git blobs and `ssot-status` returned `VERIFIED_READ` (70tasks,34active). PR3 is merged; old handoff prose saying main lacks SSOT is stale and was not edited as part of this task.

The owner `AGENTS.md` edit is preserved byte-for-byte; content, protected Git SSOT, controller tooling and existing package versions are unchanged against9c. Both the original76293-row/binding baseline and the81726-row/binding pre-task snapshot are compared by row hash after testing. New test writes use new synthetic owners; no learner history, cards or packages are reset/regraded.

Graphify was used to locate catalog/request/repository/planning paths, then actual source files were inspected. The refreshed local graph indexes152AST files under `src` only:844nodes/2631edges/90communities, backend`none`, zero provider tokens. CSS, scripts/tests/docs/content and external implementation bodies are outside that AST scope. No graph artifacts are committed and no hook/watch daemon is enabled.

Manual independent review: initial `b09cf35` REWORK for the lost503 body failure; repair1 `57aa6934` PASS. This is a separate read-only technical review, not competent language approval, a real Loop verdict, taskDONE, merge authorization or full cold/503 closure.

## Engineering Loop and PR state

Actual flags remain `liveEnabled=false`, `authorizedTasks=[]`, `autoMerge=false`, `ssotAllowStatusWrites=false`, `control.stop=true`. The configured policies cover only T004/T005/T068; historical synthetic D004 `DONE` is not this work. No real Loop run was started or simulated.

SSOT mapping: this bounded runtime/security/UX regression belongs most closely to **T052** (depsT026/T009 pending); T012/T013/T015/T017/T021/T025 are interface traceability, not completed tasks. Existing HSK1 authoring maps to M1T043/T044 and teaching evidence toT045; these remain pending and outside this stabilization scope. Hosted/free-host proof remainsT069/T053.

[Prepared PR draft](hsk1-stability-pr-draft.md) reviews only the delta from9c. No GitHub draft was opened: main lacks the app, and publishing the unpublished baseline would expand this small fix into154commits/1380files. Integration must retain newer main Loop modules and reconcile the app baseline, task/dependency scope and acceptance policy. This local draft/proposal is not an activated controller packet.

Next checkpoint: agree the PR base/integration scope; reproduce any remaining slow catalog case with correlated HTTP/handler/DB timing; activate an explicitly bounded Loop policy/grant only through its authorized workflow. Keep DRAFT/publication/mastery gates intact. No push/merge/deploy/cloud write or paid service occurred.
