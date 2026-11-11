> Historical milestone at4fab1cc. Current HSK4 production: [delivery](hsk4-production-delivery.md), [verification](hsk4-production-verification.json), [next checkpoint](hsk4-production-next-checkpoint.json).

# HSK3 vocabulary completion and HSK4 first teaching batch

Status: **HSK3_VOCABULARY_COMPLETE / HSK3_CURRICULUM_PARTIAL / HSK24_EPIC_PARTIAL**. All instructional content remains **DRAFT / DRAFT_UNREVIEWED / publication BLOCKED**, with no competent human language, answer or rights approval.

Branch: `feat/hsk24-curriculum`. This run starts at `55870a2962390df07c68cd3476f38c87fc80f0dd`. Frozen app/content candidate: `ceab4739be378ebe413a0b8b20d0620c5c09ac31`. Later documentation/technical-receipt commits are separate; resolve the current documentation HEAD with `git log -1 --format=%H -- docs/hsk24/hsk34-delivery.md`. No canonical backlog status was changed.

## Actual instruction

HSK3 now has **21 completed vocabulary batches**, including **17 new batches** in this run. Batch5 follows the saved L317–320 ordinal groups exactly. Successive batches add404 entries through batch21/L381–384. The result is **84 teaching units/lessons,672 exercises and500/500 distinct concept-linked source ordinals501–1000**. This run adds68 introductions/544 exercises. The final four lessons have five concepts each and a sixth explicit bounded sentence response; all retain eight exercises.

Each introduction has original Vietnamese usage/sense explanations, Mandarin examples and pinyin, prerequisites/glosses, a written dialogue/reading, contextual responses, feedback and ordering. The20-minute duration is an authoring estimate,not a measured learner completion guarantee. Some overlapping synonyms are tested only with an explicitly constrained word form. Typed short responses use declared exact normalization; unrestricted paraphrases/free writing are not objectively scored.

There are **15 additional HSK3 review/diagnostic activities and120 exercises**:4 unit reviews (4/84 units),1 condition-grammar diagnostic and10 sampled-character diagnostics covering60 distinct source-listed glyphs. They include familiar-context reading/ordering, altered retrieval modes and bounded typed responses. They are assisted practice,not official exam papers or independent proficiency evidence. Review activities reuse the registered original concept/sense and FSRS card identity for the selected source version.

HSK4 has **one actual batch,L401–404:4 units/lessons,24/1000 additional vocabulary entries and32 exercises**. Themes are registration/forms,travel/screening,office procedures and study/exam requirements. Grammar applications include按照,按时,在…方面 and不仅…还…. All four complete PostgreSQL initialization/grading/FSRS/progress checks. The course is locally PRACTICE_ONLY; this is not an empty course shell or an online release.

Current expansion totals: **194 activities/1,552 exercises**:HSK2=91/728,HSK3=99/792,HSK4=4/32. Four existing foundation/HSK1 activities remain separate (198 current overall). There are231 expansion manifest versions,including37 historical copies; with six base versions the server corpus has237 versions.

## Five-dimensional evidence

| Dimension | HSK3 | HSK4 |
| --- | --- | --- |
| Vocabulary draft instruction | 500/500 | 24/1000 |
| Physical grammar rows | 55/96 mapped;51 have explicit partial teaching/practice links from this continuation | 4/95 mapped with explicit partial lesson/order links |
| Recognition characters | 283/284 referenced;60 have dedicated assisted glyph practice | 10/441 referenced;no dedicated glyph diagnostic |
| Topic leaves | 41/54 referenced written scenes | 4/77 referenced written scenes |
| Communication heads | 20/22 referenced;109 physical bullets enumerated | 4/30 referenced;139 physical bullets enumerated |
| Writing-character lists |150 required;handwriting unsupported |150 required;handwriting unsupported |
| Competent human review / publication |0 /blocked |0 /blocked |

Mapped,TAUGHT,PRACTICED,TECHNICALLY_VALIDATED,HUMAN_REVIEWED,PUBLISHED andLEARNER_MASTERED are distinct. No physical grammar row or task bullet is fully accepted. Multialternative grammar rows and functional subclauses remain partial even when a row has a lesson. Explicit grammar links select the actual exercises,including e1/e2 forL377,e0 forL378 ande0/reading context forL384; ordering is not automatically treated as evidence for every grammar reference.

The missing HSK3 recognition mapping is饺 (ordinal106). Source references283/284 do not imply all283 characters have been individually assessed. Listening,oral interaction,handwriting,reviewed native audio and valid open-writing evaluation remain unsupported; any optional browser TTS is synthetic reference,not listening/proficiency evidence.

The pinned406-page November2025 PDF has SHA256 `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. Official entry,reading,category and locator checks are separate from original Vietnamese sense/teaching interpretation. HSK4 boundaries are tasksPDF20–30,topics65–67,vocabulary104–128,recognition360–362 andgrammar394–396;writing is separatelyPDF378. The strict adapter rejects foreign-level and writing-page locators even with a forged matching evidence tuple. Source apostrophe/hyphen boundaries are normalized only for matching; tone differences are retained and a wrong-tone source query is rejected.

See [HSK3 matrix](hsk3-coverage.json),[explicit instruction links](hsk3-instruction-evidence.json),[HSK4 matrix](hsk4-coverage.json) and[all-level coverage](coverage.json). Existing text scenes should be checked before authoring duplicate gap lessons; a missing leaf reference is not automatically proof that no related scene exists.

## Tests actually accepted

| Group | PASS | FAIL | SKIPPED |
| --- | ---: | ---: | ---: |
| unit | 119 | 0 | 0 |
| HSK3NewAndRefinedActivitiesSQL | 87 | 0 | 0 |
| HSK4SQL | 8 | 0 | 0 |
| HSK3PostAdapterSQL | 9 | 0 | 0 |
| HSK2RegressionSQL | 8 | 0 | 0 |
| all194ManifestResumeSQL | 1 | 0 | 0 |
| HSK3BrowserDesktopAnd360 | 8 | 0 | 0 |
| HSK4BrowserDesktopAnd360 | 4 | 0 | 0 |
| HSK4TodayDesktopAnd360 | 2 | 0 | 0 |

That is119 unit cases,113 SQL cases (the single manifest case iterates all194 current expansion packages),and14 browser cases. Browser coverage includes desktop/360px,choice,pinyin,short,keyboard ordering,resume/reload,completion/progress,accessibility andToday reopening pinnedL404. It is Windows Chromium with mobile emulation,not physical Android UAT. Typecheck,lint and isolated production build each exit0.

The87-case HSK3 SQL run and8 HSK3 browser cases used frozen HSK3 source `d284063a0b01b7c105b1f2366499bcff03dc398c`. The later domain change adds only bounded HSK4 page support; current all-package unit validation and9 additional HSK3 SQL cases cover the unchanged HSK1–3 paths. HSK4 runtime/build checks use the final candidate. This source distinction is recorded rather than relabelling older logs as runs at a newer SHA.

One intermediate group reports35 PASS/1 FAIL/0 SKIPPED:all32 lesson cases passed,but source authoring had advanced to56 activities while the installed snapshot still had48. Catalog equality correctly rejected the mismatch. The final frozen87-case run passes without weakening that assertion;the failed log remains separate. The first HSK4 authoring attempt also failed closed before writes until the checked adapter gained the verified HSK4 bounds.

Production scanning checks1,848 private-key identifiers across32 client artifacts/966,566 bytes with0 hits. Development scanning checks the same identifiers across114 artifacts/31,904,131 bytes with0 hits. These totals include all scanned artifacts/maps,not the initial downloaded payload,and are not a formal leak proof. Every package's public projection is tested. [Local performance](hsk34-performance.json) records a237-version/server corpus of4,989,975 bytes,max public package43,461 bytes,catalog p50 about510ms,and9 SQL statements in each sampled level2/3/4 view. Timings are local under concurrent work,not a cloud SLA.

## Preservation and limits

All123 baseline expansion packages and650 source references remain unchanged. Version corrections are additive higher versions;original copies and attempts stay pinned. Current source/package hashes,private keys,owner isolation,secure prerequisites and no-independent-mastery behavior remain enforced.

Full serialized package-hash/attempt/session/card digests of these retained databases are unchanged between the before/after snapshots:

| Retained database | Packages | Attempts | Sessions | Cards |
| --- | ---: | ---: | ---: | ---: |
| `csh_hsk24_b886f8707776` | 141 | 353 | 167 | 204 |
| `csh_hsk24_caa07f671ad4` | 209 | 562 | 98 | 416 |

The HSK3-stage database and other earlier sandboxes also remain retained. The final quiescent import preserves237 packages,78 attempts,213 sessions and57 cards in the new selected database before later representative browser writes. Import comparisons use full rows,not just counts. This is not a full backup/restore test. A fresh selected sandbox preserves old databases rather than merging their owner histories;review aliases reuse identities within their pinned source version,not a claimed global card/history migration between all versions.

HSK1 remains8/300 draft-taught entries,with292 missing andno prerequisite mastery granted. HSK2 remains200/200 vocabulary butcurriculum PARTIAL:30/78 grammar rows have explicit partial evidence,34 topic leaves are referenced,17 communication heads/76 physical bullets remain incomplete. This run does not restart HSK1/HSK2. Supporting glosses and references allow local exploratory practice while formal secure/mastery requirements remain unmet.

## Exact continuation

Next is **HSK4-batch2,L405–408**,descriptor `content/hsk24/batch32.authoring.json`. [Exact next checkpoint](hsk34-next-checkpoint.json) contains the next24 selected ordinals,the complete976 missing HSK4 ordinals,empty HSK3 missing-vocabulary set,and remaining HSK3 grammar/topic/recognition andHSK2 gaps. Check actual existing evidence before duplicate lessons. Future authoring must also reconcile the currentL4xx ID convention before that namespace is exhausted;the first four lessons do not prove capacity for all1,000 words under that convention.

Preview:[HSK4 local learning](http://127.0.0.1:3037/learn/courses/HSK4). Choose local saved learning if prompted. Reopen with `CSH_HSK3_CHECK_BUILD=1`,`CSH_HSK24_PREVIEW_PORT=3037` and `node scripts/hsk24-preview.mjs`. It uses an isolated local development identity/database,not authenticated human-owner proof or the hosted private preview.

No push,merge,deployment,live Supabase write,paid service,auth/RLS weakening,online allowlist extension,canonical task-status update or private answer-key client exposure occurred. The online Private Learning Preview remains unchanged. [Machine verification](hsk34-verification.json) contains actual raw-evidence hashes. The fresh read-only reviewer returned **TECHNICAL_PASS** for source `ceab4739be378ebe413a0b8b20d0620c5c09ac31` and documentation `8c2d06862999a908d838cade2d29e134d78ba9a7`; the [independent technical receipt](hsk34-technical-review.json) records that audit. Subsequent changes add only this receipt, its link and review-status fields. Technical review is never competent language or publication approval.
