Latest runtime continuation: [schedule/Today repair](hsk4-today-runtime-delivery.md), [verification](hsk4-today-runtime-verification.json). Warmed mobile functional tests pass; full-corpus planning and cold initialization remain open. HSK4 content stays504/1000.

Content milestone:  [HSK4 batches10–21](hsk4-continuous-delivery.md), [verification](hsk4-continuous-verification.json), [next checkpoint](hsk4-production-next-checkpoint.json). Previous reports are historical.

Current production evidence: [HSK4 batches2-9](hsk4-production-delivery.md), [verification](hsk4-production-verification.json), [five-dimensional matrix](hsk4-coverage.json), [instruction links](hsk4-instruction-evidence.json), [next exact checkpoint](hsk4-production-next-checkpoint.json). Earlier reports below are historical.

# HSK2–4 curriculum epic: local batch 1

For current instruction,counts and execution evidence,read [HSK3 completion + HSK4 start](hsk34-delivery.md),[verification](hsk34-verification.json),[current checkpoint](checkpoint.json),[HSK3 matrix](hsk3-coverage.json),[HSK4 matrix](hsk4-coverage.json) and[exact next checkpoint](hsk34-next-checkpoint.json). Earlier batch/completion/continuation reports below are historical.

Status: **HSK24_EPIC_PARTIAL**. Neither HSK2_CONTENT_COMPLETE, HSK3_CONTENT_COMPLETE nor HSK4_CONTENT_COMPLETE is met.

Development branch: `feat/hsk24-curriculum`, from clean complete local application `e6fb776`. `origin/main` was fetched and pinned to `0dc42253180ef38d1c43f1f87c9f0f675a851341`. The sanitized deployment branch and older foundation branch have different source/history; neither replaced the complete local application. No canonical backlog status, specification, Engineering Loop, main, cloud configuration or online allowlist was edited.

## Delivered content

| Level | New units / lessons in this batch | Concept-linked vocabulary | Scope |
| --- | --- | --- | --- |
| HSK1 audit | Existing L001/L002 preserved | 8/300 entries have draft teaching | 292 missing concept-linked teaching; five-dimension audit PARTIAL |
| HSK2 | school-shopping/L201; travel-choice/L202 | 8/200 new; cumulative target 500 | Original Vietnamese explanations, Chinese examples, pinyin, reading/dialogue and 16 exercises |
| HSK3 | 0 / 0 | 0/500 new; cumulative target 1000 | Existing course remains unreleased |
| HSK4 | 0 / 0 | 0/1000 new; cumulative target 2000 | Existing course remains unreleased |

HSK2 targets: 白色、本子、笔、长、车站、地铁、公交车、打车. Vocabulary entry and reading locators are checked against the exact pinned PDF. 笔 is restricted to the noun sense; 长 to cháng/long. Sense-level Vietnamese interpretations remain unreviewed. 支 is explicitly SUPPLEMENTARY with unverified level and excluded from target counts. Supporting words in examples are not automatically counted as taught.

Two grammar references: 比 comparison and 还是 alternative questions. Two task and two topic references; four character references. These are mappings, not complete dimension coverage. Character writing is not assessed. Grammar/character/topic/task denominators remain null pending complete enumeration. No listening/reference audio coverage or pronunciation mastery is claimed. Existing synthetic browser TTS remains in the private-preview player; new sandbox lessons currently expose text/pinyin, with TTS extension pending.

`coverage.json` enumerates 2000 vocabulary locator rows (300/200/500/1000 introduction entries) without reproducing the official word corpus. It distinguishes source mappings, concept-linked drafts, exercise references, provisional review eligibility, publication/review status, missing evidence and unknown user mastery. `entriesPracticed=null` means no owner usage claim; sandbox test attempts are not owner progress. `prerequisites.md` documents the incomplete HSK1 foundation matrix. A referenced entry or completed draft never grants mastery.

## Local operation

The optional sandbox is gated by `CSH_LOCAL_CURRICULUM=hsk24-batch1`, `CSH_LOCAL_DATABASE=1` and non-production execution. It accepts only dedicated `csh_hsk24_<12hex>` databases on local port 5447 with the runtime role. Production builds ignore expansion. Normal local and authenticated online catalogs retain their existing selection. Both import functions reject the owner's `csh_local` database when expansion is active.

To create a fresh disposable sandbox in this workspace, set the two flags above in PowerShell and run `node node_modules/tsx/dist/cli.mjs scripts/hsk24-sandbox.ts`. Each invocation creates a new database and preserves earlier sandboxes; no reset or migration rewrite occurs. It applies existing migrations, validates/imports immutable packages, checks runtime role/FORCE RLS, rejects unauthorized writes, tests cross-owner isolation and records a migration-bound technical proof only after checks pass. The selected private state and credentials remain ignored under `.local-postgres/hsk24/`.

Start the local preview with `node scripts/hsk24-preview.mjs`, then open `http://127.0.0.1:3024/learn/courses/HSK2` and select LOCAL DATABASE. This uses the existing **local development identity**, not Supabase login or authenticated human-owner proof. New source versions require a new manifest/hash and isolated import; do not overwrite immutable versions in an existing sandbox. See `checkpoint.json` for ordered remaining work.

Private answer keys are intentionally in local source packages, never browser projections/bundles. This branch inherits earlier sensitive local history. **Do not push this branch without the separately required history/secret/answer-material security review and sanitization.** No push is part of this delivery.

## Verification limits

The report in `verification.json` records actual test totals, not approval or readiness. Runtime exercises use the existing deterministic choice/pinyin/sequence/exact-Hanzi checkers, with explicit feedback; unrestricted free writing is not scored. Answer alternatives remain limited to the declared normalization contract. Existing F01/F02/L001/L002 hashes and cloud selection are unchanged.

New HSK2 lessons are playable in local PostgreSQL only. Grading is provisional; cards schedule recall, and independent mastery evidence remains zero. Full authenticated GoTrue testing for these new versions, Today-to-new-lesson browser selection, unit diagnostics/review, expanded pronunciation notes, large-corpus payload/planner benchmarks and backup/restore remain pending. Existing security/learning unit regressions cover shared code but do not substitute for those new runtime checks. No qualified human language, answer, audio or rights approval was fabricated.

No new SQL migration was needed. Existing learning databases and cloud data were not modified. No deployment or live Supabase write occurred, and the four-version cloud policy was not expanded. Full rollout requires a separately authorized version/hash policy extension and real owner-auth/security checks; this local batch is not publication-ready.
