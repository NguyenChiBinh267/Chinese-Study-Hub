# HSK2 vocabulary completion and curriculum checkpoint

Historical checkpoint through `2ca0b29`. For the subsequent HSK2 gap lessons and four HSK3 batches, read [current delivery](hsk23-delivery.md) and [current verification](hsk23-verification.json).

Status: **HSK2_VOCABULARY_COMPLETE / HSK2_CURRICULUM_PARTIAL**. Local delivery on `feat/hsk24-curriculum`, continued from `a60a4d4512fcbd1a0eac905a41bb97986deaeb88`. [Machine verification](completion-verification.json), [coverage](coverage.json), [five-dimensional audit](five-dimensions.json), and [exact next checkpoint](next-checkpoint.json) are the current evidence. Earlier continuation reports are historical.

## Delivered

Batches 6–9 add 96 official introduction entries in 16 new units/lessons. All 200 HSK2 introduction ordinals now have original draft teaching, a sense/reading mapping, tone-marked pinyin and concept-linked exercises. Two readings of 过 and the official homograph labels for 花 remain distinct. Homograph numbering is retained in source references and removed from learner Hanzi. HSK3/4 remain 0/500 and 0/1000.

Current HSK2 contains 34 introductions, 34 unit reviews, 16 diagnostic activities and one character bridge: **85 playable local draft activities, 680 exercises**. Nine older package versions remain for version-pinned history and are excluded from current counts. Reviews reuse taught sense identities and original FSRS templates. They do not add vocabulary; the daily new-card cap remains ten.

The review bank changes retrieval forms for every taught sense, adds character cloze items, and explicitly reuses selected taught reading/order contexts. Diagnostic activities sample taught material and provide deterministic feedback per item. They are assisted draft practice, without a proficiency score or an official mock-exam claim. The 留 bridge supplies concise original character instruction and explicitly avoids claiming that the word 留 is an official HSK2 vocabulary entry.

## Five dimensions

| Dimension | Source denominator | What is substantiated | Remaining limit |
| --- | --- | --- | --- |
| Vocabulary | 200 introduction entries | 200 taught with exercises and unit retrieval | Vietnamese senses/keys lack competent human approval |
| Grammar | 78 operational table body rows: 34+31+13 | 29 row mapping candidates with linked lessons | Multi-alternative rows are partial; 49 rows have no exact candidate; no row is declared fully accepted |
| Characters | 125 recognition characters | 125 have explicit constrained recognition items | 123 have introduction-package character refs; 交 is taught in 公交车, 留 has a bridge; handwriting is unassessed |
| Topics | 34 tertiary leaves, within 5/18/34 hierarchy | 22 exact leaf mappings | 12 unmapped leaves; mapped leaves still need complete situational acceptance |
| Tasks | 17 top-level communication tasks | 17 source references | Text practice does not prove every oral, listening, form or other subrequirement |

The grammar denominator is reproducible physical rows, not an official count of atomic patterns. Locator mapping, actual teaching, constrained practice, competent review, publication and owner mastery remain separate. The audit lists every missing/partial source row and topic leaf. Human-reviewed count is zero.

HSK1 still has only 8/300 introduction entries with draft teaching. [Prerequisite audit](prerequisite-audit.json) retains each introduction's refresher and declared supporting words. Local exploratory access preserves secure prerequisite rules and awards no HSK1 mastery. Declared support is not an exhaustive linguistic segmentation audit.

## Verification

- 118/118 unit tests.
- 89/89 PostgreSQL tests: every current HSK2 activity completes all its blocks/exercises, rejects malformed answers, persists attempts/cursor/progress, replays submissions idempotently, checks owner isolation and creates provisional FSRS cards without mastery.
- One additional PostgreSQL matrix checks all 85 activities reject a wrong package hash and resume the same saved session/cursor.
- Eight deep journeys cover L234, L274, L290 and L296 on desktop/360px, including reload, all supported answer forms, feedback, completion, layout and accessibility checks. Two additional journeys prove Today opens a saved unit review through its version-pinned link.
- Typecheck, lint and production build pass. Bounded scans of 32 production client artifacts and 73 local opt-in development client artifacts found none of 752 private key identifiers; public projection tests cover every package. This is not a formal leak proof.

Earlier failed runs are retained under `.local-postgres/hsk24/`; they are distinguished in machine verification. The first whole-unit run used inappropriate expansion flags in base-only suites; the intended-environment run passed all 118. Batch8's first desktop run exceeded the five-second cold-dev wait; a bounded fifteen-second wait passed both devices. Final matrix counts above have zero failures/skips.

Additive imports compare old package hashes and actual attempt/session/card rows before and after each import. Existing selected-sandbox histories and earlier sandboxes are retained; tests use new synthetic owners. Owner-local and cloud learning history were not modified. This is selected-table preservation evidence, not a complete backup/restore audit.

[Performance](performance.json) records the full 100-version server corpus. Three read-only lesson views use nine SQL statements each. A request-local card index avoids repeated full catalog validation; timings are local observations under concurrent checks, not a cloud latency promise. Current versions are unique and no migration was added.

## Use and resume

Preview: <http://127.0.0.1:3036/learn/courses/HSK2>. Choose local saved learning when prompted. To reopen after stopping it, start local PostgreSQL, set `CSH_HSK2_CHECK_BUILD=1` and `CSH_HSK24_PREVIEW_PORT=3036`, then run `node scripts/hsk24-preview.mjs`. The dedicated build directory avoids the existing private-preview build.

Resume from [next-checkpoint.json](next-checkpoint.json): no vocabulary ordinals remain. Next work is bounded original grammar/context instruction for the listed source rows, then every partial grammar alternative and topic/task subrequirement. Reviewed listening/speaking material, competent independent language/key review, rights/publication evidence and authenticated owner acceptance remain outstanding. No HSK3/4 work is implied by this checkpoint.

All new packages are **DRAFT / DRAFT_UNREVIEWED / BLOCKED**, with no human-review receipt. Technical review is not linguistic certification. No push, merge, deployment, paid service, cloud write, auth/RLS relaxation, canonical backlog update or mastery grant occurred.
