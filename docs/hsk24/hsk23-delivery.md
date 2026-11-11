# HSK2 reconciliation and initial HSK3 curriculum

> Historical checkpoint at55870a2. Current delivery:[HSK3 completion + HSK4 start](hsk34-delivery.md). Counts below are not current.

Status: **HSK2_CURRICULUM_PARTIAL / HSK3_CURRICULUM_PARTIAL**. This local continuation starts at `2ca0b2907dcad06a49eaa063f6f65da98a40fef1` on `feat/hsk24-curriculum`. Current results are in [verification](hsk23-verification.json), [HSK2 matrix](hsk2-reconciliation.json), [HSK3 matrix](hsk3-coverage.json), and [exact next checkpoint](hsk23-next-checkpoint.json). Earlier completion/continuation reports describe earlier checkpoints.

## Instruction delivered

Six new HSK2 contextual lessons, L235–240, add **48 exercises and 24 targeted grammar applications** without adding vocabulary. Situations cover personal/study information, objects/events, dining habits, family travel, class activities and work. Existing partial teaching is linked to actual blocks/exercises rather than promoted from source IDs. The number+号 ordinal example is kept distinct from the HSK1 第 pattern; noun 包 is kept distinct from borrowed-measure 包. Multi-alternative source rows remain partial.

HSK3 batches1–4 add **16 units, 16 teaching lessons, 128 exercises and 96/500 additional vocabulary entries**. Themes include study methods/materials, travel and errands, health-language conversations, household tasks, plans, event information, time distinctions and cultural study. Each lesson contains original Vietnamese explanations, Mandarin examples, tone-marked pinyin, a reading/dialogue, explicit contextual choices, pinyin practice, bounded sentence construction and ordering. No official examination-format or certification claim is made.

Current expanded scope is **107 activities /856 exercises**: HSK2 has91/728; HSK3 has16/128. Four pre-existing foundation/HSK1 activities remain separate, giving111 current activities overall. Historical versions remain in the manifest and are excluded from current counts.

| Dimension | HSK2 | HSK3 |
| --- | --- | --- |
| Vocabulary introduction | 200/200; no new words in gap lessons | 96/500 new, 404 remain |
| Grammar | 78 source table rows;30 have explicit partial teaching/practice links,24 receive new context applications | 96 source table rows;15 mapped candidates |
| Topic leaves | 34/34 source leaves mapped after reconciliation;12 have new written scenes | 11/54 leaves mapped |
| Communication | 17 heads,76 physical bullet requirements identified | 9/22 heads referenced;109 physical bullet requirements identified |
| Recognition characters | 125 with explicit constrained recognition practice | 88/284 source character refs; not complete individual-character assessment |
| Writing characters | Separate combined HSK1–2 list100 | Separate list150 |
| Competent human review/publication | 0 /blocked | 0 /blocked |

Physical grammar rows and task bullets are operational source denominators, not counts of independently accepted atomic skills. Every task bullet has its own locator/hash and modality/state. Parent-task references do not accept each bullet. Listening, oral interaction and handwriting remain unsupported; typed construction is not handwriting. Optional labelled browser zh-CN TTS, where the existing UI exposes it, is synthetic reference only.

## Prerequisites, reviews and grading limits

HSK1 remains **8/300**, with no new mastery grant. [Targeted support](hsk1-targeted-support.json) provides39 source-checked glossary entries, concise original Vietnamese support and actual example/block occurrences across91 HSK2 activities. Occurrences are dependency candidates, not exhaustive segmentation: a character inside a compound does not prove its standalone grammatical use. Refresher-title detection is also non-exhaustive.

The existing34 unit reviews and16 diagnostics retain provisional FSRS identities and history. Their original scope is assisted sense/character retrieval and familiar-context practice. The six new HSK2 scenes add transfer questions; they do not turn the entire old diagnostic bank into a comprehensive proficiency test. Grammar responses never establish sense-specific vocabulary mastery. Secure prerequisite requirements and independent-evidence gates remain enforced.

Short Chinese grading accepts one explicit normalized semantic answer, including normalization of punctuation/spacing. Prompts constrain the expected construction. Valid broad paraphrases and free writing require further reviewed keys and remain provisional. They are not silently accepted by fuzzy matching.

## Runtime evidence and preservation

Machine verification records the final accepted groups and their actual-byte hashes:118 unit tests,95 HSK2 PostgreSQL tests,20 HSK3 PostgreSQL tests, an additional all107 version/hash/resume matrix, representative desktop/360px journeys, and Today continuation. Browser tests deliberately hold a dashboard snapshot response and verify the loaded player can continue after its own server acknowledgement. Optional dashboard reads are coalesced; grading and authoritative content reload remain awaited.

Failure logs remain distinct from accepted results. An earlier mixed browser run used Today with existing due cards; focused fresh-server groups separate those assumptions. An import preservation comparison refused equality while synthetic tests appended rows; a later quiescent comparison passed without weakening the check. An earlier browser wait exposed the optional-summary dependency; its regression also checks route-handler cleanup.

Existing package bytes, earlier sandboxes and owner/cloud history are retained. Current-version corrections use higher immutable versions and new isolated selected sandboxes. Old draft copies remain historical, including the refined recovery phrase and strengthened short prompts. Preservation checks compare old package hashes and full attempt/session/card rows in quiescent windows. This is not a full backup/restore proof.

See [performance](hsk23-performance.json) for the129-version corpus, bounded per-lesson query counts and measured local timings. These are local observations, not cloud guarantees. Production and opt-in-development client artifacts are scanned for private-key identifiers, alongside every-package public-projection checks. No migration or architecture rewrite was added.

## Continue locally

Preview: <http://127.0.0.1:3037/learn/courses/HSK3>. Choose local saved learning if prompted. Use `CSH_HSK3_CHECK_BUILD=1` and `CSH_HSK24_PREVIEW_PORT=3037` with `node scripts/hsk24-preview.mjs` to reopen it. Existing older local sandboxes remain retained; the dedicated build folder avoids the private-preview build.

Next is HSK3-batch5, L317–320:24 fixed source ordinals grouped around family, seasons, clothing and moving/neighbourhood. The [next checkpoint](hsk23-next-checkpoint.json) contains exact groups and all404 remaining ordinals. Continue reconciling HSK2 partial grammar alternatives and communication subrequirements alongside HSK3.

All new material remains **DRAFT /DRAFT_UNREVIEWED /publication BLOCKED**, with no human receipt. Technical desk/runtime review is not linguistic certification. No push, merge, deployment, live Supabase write, paid service, auth/RLS weakening, online content-allowlist extension or canonical backlog update occurred. The deployed owner preview was not changed.
