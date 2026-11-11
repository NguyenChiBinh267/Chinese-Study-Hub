> Historical batches2–9 atff2b46c. Current: [batches10–21](hsk4-continuous-delivery.md), [verification](hsk4-continuous-verification.json).

# HSK4 production continuation — batches 2–9

**HSK4_PARTIAL / HSK24_EPIC_PARTIAL**. HSK4 has 216/1000 additional vocabulary entries with original draft instruction; 784 remain. All content remains DRAFT/DRAFT_UNREVIEWED, publication BLOCKED, no competent human review or mastery approval.

Branch `feat/hsk24-curriculum`; baseline `4fab1cc1d3697bdc1d58b843204e47f6415dcaf4`. Evidence source `094998b3ec0d72ca48be385824cd7b5f9aa49bd7`; app/content frozen at `094998b3ec0d72ca48be385824cd7b5f9aa49bd7`. Content bytes remain frozen at `558b83`. Later commits fix a proof type annotation, tests and a confirmed LOCAL foundation-library scaling defect; grading, immutable content and published/custom access behavior remain unchanged. The current final documentation HEAD is available through `git log -1 --format=%H`; it is not retroactively assigned to earlier runs.

## Actual new learning content

Eight new batches 2–9 add 32 units/introductions (L405–436), 192 vocabulary ordinals and 256 exercises. They begin with exactly the saved batch 2 ordinal order. Eight periodic activities (L481–488) add 64 exercises: four unit reviews and four sampled-character diagnostics, at batches 4/6/8/9. Total new content: 40 activities/320 exercises.

Current HSK4: 36 introduction units/lessons, 288 intro exercises, 8 review/diagnostic activities/64 exercises: 44 activities/352 exercises. Each new lesson includes original Vietnamese sense/usage notes, Chinese examples and Pinyin, an original written scene, bounded contextual responses, glyph practice, reading comprehension and constituent ordering. Durations 15–20 minutes are authoring estimates, not learner timing measurements. Synonyms/polyphones and form-specific tasks are explicitly bounded; free paraphrases and open writing are not objectively graded.

## Five dimensions

| Dimension | Current evidence | Limit |
| --- | --- | --- |
| Vocabulary |216/1000 draft-taught ordinals|784 missing; source entry/reading verification does not attest Vietnamese senses |
| Grammar |33/95 physical rows mapped; 31 have explicit partial teaching/practice|No row fully accepted; baseline L403/L404 two-chunk ordering excluded from meaningful grammar-practice counts |
| Recognition |108/441 referenced; 47 distinct glyphs practiced in 57 assisted items|32 new intro items+24 diagnostic items+1 reused unit review item; 57 items are not 57 unique glyphs |
| Topics |31/77 leaves linked to written scenes|Related subclauses/modalities remain partial |
| Communication |16/30 heads referenced; 139 physical bullets enumerated|Written reception/bounded response only; parent-head linkage does not accept the bullet or spoken task |
| Writing glyphs |150 listed|Handwriting unsupported |

Four of 36 introduction units have separate unit reviews. Diagnostics sample 24 distinct official glyphs with familiar meaning/Pinyin cues; they are not official exam papers or comprehensive recognition tests. Identified, mapped, taught, practiced, technically validated, human reviewed, published and learner mastered remain distinct. Explicit immutable block/exercise/hash links are in [hsk4-instruction-evidence.json](hsk4-instruction-evidence.json).

Listening, reviewed native audio, speaking assessment, handwriting and valid free-writing evaluation remain unsupported. Optional synthetic browser TTS, if used, is not listening/proficiency evidence. HSK1 remains 8/300 draft words; HSK2 remains 200/200 vocabulary but grammar/subrequirements partial; HSK3 remains 500/500 vocabulary with 55/96 grammar mappings (51 partial practice), 283/284 recognition references (60 practiced), 41/54 topics and 20/22 task heads. No prerequisite mastery was awarded.

## Source and substantive corrections

The pinned 406-page November 2025 `hsk-exam-2025-11` PDF SHA 256 is `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. All 1784 bounded references and 2000 vocabulary locators pass the source audit. The independent source reviewer checked all 366 new references directly against the actual PDF. No 2021/older syllabus or textbook lesson was substituted; the private PDF is not redistributed with the original lessons.

Readings include等2(děng, enumeration), 乘1(chéng, transport), 待 dāi, 戴 dài, 大夫 dàifu, 护士 hùshi, 胳膊 gēbo and差点儿 chàdiǎnr. Source numeric disambiguators are removed from learner Hanzi. Corrections use 18 higher immutable versions across 17 lessons: clearer form constraints, meaningful ordering, explicit base-price comparison, a natural Mandarin predicate, better task alignment and five recognition-skill tags. Original versions and pinned attempts remain intact. Mandarin/Vietnamese checks are preliminary AIQA, never competent human approval.

## Actual accepted checks

| Group | PASS | FAIL | SKIPPED |
| --- | ---: | ---: | ---: |
| unit | 120 | 0 | 0 |
| all 44 HSK4 Activities Plus Shared SQL | 48 | 0 | 0 |
| bounded Foundation Library SQL | 3 | 0 | 0 |
| post Library HSK4 Regression SQL | 6 | 0 | 0 |
| HSK2 Regression SQL | 8 | 0 | 0 |
| HSK3 Regression SQL | 8 | 0 | 0 |
| all 234 Manifest Resume SQL | 1 | 0 | 0 |
| journey Desktop And 360 | 10 | 0 | 0 |
| Today Desktop And 360 | 2 | 0 | 0 |
| course Unit Navigation Desktop And 360 | 4 | 0 | 0 |

Eight per-batch SQL groups add 70 PASS; periodic-review/refinement groups add 39 PASS. With the clean milestone 48+8+8+1 groups plus 3 library-bound/security checks and 6 post-library grading regressions, this is 183 accepted SQL executions, including repeated shared cases. All 44 current HSK4 activities are exercised in the clean 48-case run. Unit total 120; browser total 16, desktop and 360 px Windows Chromium emulation, not physical Android UAT. Choice, Pinyin, bounded Chinese, recognition, keyboard ordering, resume/reload, completion, FSRS, Progress, Today, unit links, invalid submissions and owner isolation are covered. Typecheck, lint and production build exit 0; six local-pointer guard/rollback assertions pass separately.

Intermediate evidence is retained separately: the initial full SQL group has 47 PASS/1 FAIL/0 SKIP because the harness searched only current versions and missed a deliberately retained review origin. The fixed harness resolves the exact historical version; the complete 48-case rerun passes. That full run used `0a0beb9`. The later library-only change at `094998b` is covered by three dedicated bounds/security cases, six focused grading cases and four real navigation cases; the independent reviewer found no reason to repeat all 44 unchanged lesson paths a third time. Sources are not relabelled. Initial typecheck exited 2/build 1 on a proof-helper literal type; `as const` fixes it without runtime/content mutation. The first additional navigation run also failed with 503 responses and advisory-lock timeouts; its raw report/traces are retained separately. The confirmed cause was the local foundation library looping through all 238 current packages and revalidating the 295-version catalog for each while holding the owner transaction. The LOCAL default library now returns only four base packages and reuses validation within the request. Rerun uses the original test server command, without increasing timeouts or weakening Auth/RLS; published/custom access is unchanged. Early descriptor/import failures are documented in the execution transcript; overwritten early logs are not falsely described as retained artifacts.

## Selected database and history

All work uses the same selected local database `csh_hsk24_bf294b6506c1` on 127.0.0.1:5447. No new sandbox, reset, database switch or cross-identity history merge occurred. Before the run it contained 237 packages, 110 attempts, 218 sessions and 67 cards. After tests it contains{'packages': 295, 'attempts': 1453, 'sessions': 706, 'cards': 1013}; all recorded original row hashes remain unchanged. Additive imports compare full existing package-hash/attempt/session/card rows before/after, not just counts. New test owners deliberately add synthetic rows. This proves the recorded table families, not a full backup/restore or comparison of every private table.

There are 295 server package versions: 289 expansion versions, 234 current and 55 historical, plus 6 base versions. All 231 baseline expansion package bindings/Git-normalized bytes and 1418 baseline source references are unchanged. An explicit local-only import option advances a lesson pointer only to a higher HSK4 DRAFT/BLOCKED version with identical concept bytes; metadata conflicts roll the transaction back. Old associations remain pinned. Review aliases reuse their exact source-version card identity; global card deduplication/migration across all versions is not claimed.

## Loading, confidentiality and scope

Production scans 32 artifacts/966566 bytes; development scans 118 artifacts/31956614 bytes. Both check 2312 private-key identifiers with 0 hits, alongside per-package public-projection tests. Artifact totals include maps/all scanned files, not initial-page payload, and are not a formal leak proof.

The server corpus is 6183463 bytes; max public package 43461 bytes. Local catalog p50 about 269 ms; three level 2/3/4 views issue 9 SQL statements each. Measurements are local under concurrent tests, not a cloud SLA. Native read-only checks confirm the repaired foundation library makes four package lookups, returns 41,151 public bytes and permits concurrent same-owner course metadata; tampered hashes/revoked permissions still fail. Course pages read metadata and individual version-pinned public lessons; the entire HSK4 private corpus is not sent to the first page. Full corpus validation still has server cost; the existing 40-card request-local index is measured, while the newly fixed foundation-library request reuse is a separate bounded optimization.

No push, merge, deploy, cloud Supabasewrite, productionallowlist change, paid dependency, Auth/RLS weakening, private-key client exposure orcanonical task-status update occurred. The online Private Learning Preview is unchanged.

## Review boundary and exact continuation

The separate content reviewer returned preliminary QA PASS for every new batch, repair and actual bytes. The fresh read-only final reviewer returned **TECHNICAL_PASS** for runtime `094998b3ec0d72ca48be385824cd7b5f9aa49bd7` and documentation `ed5ab37c05b052cea55270bec5f9b87abd3225e5`, after checking actual raw evidence, source matrices, client artifacts and preservation. The [technical review receipt](hsk4-production-technical-review.json) records that verdict. Subsequent changes add only the receipt, review-status fields and this link. Competent human language, rights, publication and mastery approvals remain absent.

Next: HSK4 batch 10, L437–440, descriptor `content/hsk24/batch40.authoring.json`. [Exact checkpoint](hsk4-production-next-checkpoint.json) records the next 24 selected ordinals and all 784 missing ordinals. Reconcile ID allocation before L481, already occupied by reviews; the current three-digit convention cannot hold all 1000 entries at six per intro. Next L437–440 are valid. Do not restart HSK1–3 or silently replace the selected database.

Preview: [localHSK4](http://127.0.0.1:3037/learn/courses/HSK4). Reopen with `CSH_HSK3_CHECK_BUILD=1`, `CSH_HSK24_PREVIEW_PORT=3037`, `node scripts/hsk24-preview.mjs`; it uses a local development identity, not authenticated human-owner proof. [Machine verification](hsk4-production-verification.json) pins actual raw-evidence hashes. Documentation/receipt commits after the frozen source do not relabel earlier checks.
