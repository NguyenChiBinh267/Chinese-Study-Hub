# HSK1 learning path — local DRAFT checkpoint

This is a curriculum handoff, not the Master Plan task-status authority. Authorized baseline: `bbd8aa6b6a739e7f30bb3864e86e6b45b041d6d5`, branch `feat/hsk24-curriculum`. Verified `origin/main` remains `ad7f4c59442b89701e5e41cd6a120284532c1650`. No push, merge, deployment, paid service or publication is authorized here.

## Source and learning scope

See `hsk1-source-audit.json` for the pinned PDF and exact five-dimension denominators: vocabulary300, grammar70 physical rows, recognition246 glyphs, writing100 shared HSK1–2 glyphs, topics30 leaves and tasks15 heads/59 physical bullets. A source reference is not complete teaching, full-row practice, human review, publication or mastery.

`hsk1-learning-path-plan.json` partitions all292 missing official entries, without duplicates, into70 lessons in14 five-lesson groups. Eight existing entries stay in L001/L002. Every new teaching package must still be authored, validated, imported, tested and reviewed before the plan becomes delivered content. `hsk1-progress.json` is derived from actual current packages; it is the delivery checkpoint, not this plan's intended totals.

F01/F02 and L001/L002 remain immutable and reusable. F03–F05 add initials, finals, character-versus-word, basic sentence order, keyboard/answer entry and transition guidance. Existing31 pronunciation notes/26 diagrams and optional local browser TTS are reused. TTS is synthetic/unreviewed; no pronunciation mastery is claimed. F03–F05 are internal foundations, not official HSK vocabulary credit.

The course guide reads bounded curriculum metadata, orders by course/unit/lesson position and resumes an unfinished current-version session first. Finishing draft practice does not grant secure prerequisites. The guide does not import full packages into the client or change Today/FSRS priorities.

## Preservation and verification

The selected populated sandbox is `csh_hsk24_bf294b6506c1` on localhost5447. Baseline:522 packages,4540 attempts,1999 sessions,3228 cards. `scripts/hsk1-preserve.mjs` additionally hashes every baseline row of all19 private tables including owner-related settings/plans. Each after-check must preserve all historical row hashes; new test owners/rows are separate additions. Receipts remain under `.local-postgres/hsk24/hsk1-*`; no history reset or owner data deletion.

Delivered foundation SQL:7 PASS/0 FAIL/0 SKIP after fixing a test-only FOUNDATION/HSK0 fixture mismatch (original5 PASS/2 FAIL retained). First vocabulary group SQL:9 PASS/0 FAIL/0 SKIP. L103.v2 additive language-field cleanup SQL:5 PASS/0 FAIL/0 SKIP; L103.v1 stays immutable. Review-engine checks at this point use an existing HSK2 review fixture and do not establish HSK1-specific unit-review delivery.

Second vocabulary group L106–L110:25 new entries,58/300 cumulative; SQL9 PASS/0 FAIL/0 SKIP. Source verification rejected an unsupported grammar label before import; corrected it to the actual 数词 label. Preservation receipts after both groups confirm every baseline row unchanged. Milestone unit suite132 PASS/0 FAIL/0 SKIP, including ordered beginner navigation/resume and existing boundaries.

Third group L111–L115:22 new entries,80/300 cumulative; SQL9 PASS/0 FAIL/0 SKIP. Before publication/import, the authoring guard caught mismatched 他/她 plural examples and they were corrected to their actual source entries. Independent review led to additive L110.v2 clarifying iu/iou (SQL5 PASS/0 FAIL); v1 source-reference records and old attempts stay unchanged. All19 baseline-table checks still pass. The derived report now separates explicit single-glyph exercises from compound word concepts and labels topic references without claiming all are official leaves.

Fourth group L116–L120:20 new entries,100/300 cumulative; SQL9 PASS/0 FAIL/0 SKIP. Four real HSK1 unit reviews L181–L184 and sampled character diagnostic L196 add40 exercises with original written contexts and zero new vocabulary. Exact source concepts/hashes preserve FSRS card identity. The local origin-file allowlist now includes HSK1 while retaining manifest/hash/sense validation. First four review activities SQL8 PASS/0 FAIL; L184 SQL5 PASS/0 FAIL.

At the100-word checkpoint:22 HSK1 introduction lessons including the two existing base lessons,4 unit reviews,1 sampled diagnostic;27 activities/212 exercises. Foundation adds5 current lessons/38 exercises (32 total activities/250 exercises across Foundation and HSK1). Technical character references cover94 glyphs, but only20 explicit single-glyph practice targets exist; neither establishes handwriting or complete recognition. Twelve grammar physical-row IDs have partial references;3 legacy labels still need exact-row reconciliation. Eleven topic labels include a parent label;7 task-head labels do not establish complete scenarios or59-bullet modality coverage.

The100-word checkpoint next step was batch5 L121–L125. Its frozen source/evidence record is `hsk1-checkpoint-100.json`. The plan is partitioned through L170, but a plan is not delivered content. Continue additive batch validation/import/SQL/preservation/commit. Do not report vocabulary complete or content complete before the actual package evidence supports it.

## Continuous production after checkpoint100

Batch5 L121–L125:20 new official entries,120/300 cumulative. Learning/class/speaking-listening vocabulary, modal ability/permission, wants and negative possession; the written scene does not assess actual listening. Unit review L185 uses six existing senses in original contexts and adds no vocabulary. Intro SQL9/9 and review SQL5/5 passed with0 FAIL/0 SKIP; all original rows in19 private tables and522 package hashes remain unchanged. Additional review descriptors are bounded to HSK1 IDs and exact HSK1 origin concepts.

Batch6 L126–L130:20 new official entries,140/300 cumulative. Unit review L186 and sampled diagnostic L197 add16 exercises, zero new words. Intro SQL9/9 and review/diagnostic SQL6/6 passed, no failures/skips; all original19-table rows preserved. Source check retains the PDF's literal row27 label 所处+是+名词 while explaining its place-identification example. Diagnostic placement follows its last source lesson so future words are not shown in an earlier unit.

Batch7 L131–L135:20 new official entries,160/300 cumulative; unit review L187. Intro SQL9/9 and review SQL5/5 passed, all original rows preserved. L131.v2 translates the grammar explanation into Vietnamese for zero-beginners while retaining imported v1; focused SQL5/5 passed. No medical advice or oral assessment is inferred from the doctor/hospital vocabulary.

Batch8 L136–L140:20 new official entries,180/300 cumulative; unit review L188. Intro SQL9/9 and review SQL5/5 passed with0 FAIL/0 SKIP and original19-table preservation. Telephone/media/health examples remain fictional written practice, not actual calls, listening assessment or medical guidance.

Batch9 L141–L145:20 new official entries,200/300 cumulative; unit review L189. Intro SQL9/9 and review SQL5/5 passed with0 FAIL/0 SKIP; original19-table rows remain unchanged. Song/weather comments are written fictional statements, not audio assessment or a real forecast. New review ordering prompts explicitly fix the first fragment so alternative time/place topicalizations are not silently judged as language errors.

The independent200-word review requested clearer boundaries for 学/学习, 会/能, 想/要 and 去/到. Additive L121/L124/L125/L132.v2 now explicitly name the requested form/reading and retain valid alternate sentences outside that scope. L185/L187/L197.v2 move their exact source origins/prerequisites to the current introductions; all old review aliases/packages remain available. Focused SQL11/11 and current/historical-alias unit2/2 pass; original19-table preservation passes. New cloze authoring names the requested dictionary reading rather than pretending to grade unrestricted paraphrases.

Batch10 L146–L150:20 new official entries,220/300 cumulative; unit review L190 and sampled diagnostic L198. Intro SQL9/9 and review/diagnostic SQL6/6 passed with0 FAIL/0 SKIP, original19-table preservation. Sunday/date/morning alternatives are explicitly form-scoped; calendar examples are fictional, not the machine's current date. The200-word repair received independent technical PASS at2ee022ff7284203e4eba7158bad41cba38d06ff6 (not qualified human approval).

Batch11 L151–L155:20 new official entries,240/300 cumulative; unit review L191. Intro SQL9/9 and review SQL5/5 passed,0 FAIL/0 SKIP; original19-table rows unchanged. Clock points are distinguished from duration, 睡/睡觉 are form-scoped, and source 面条儿 retains its explicit erhua form without declaring 面条 invalid outside the item.

Batch12 L156–L160:20 new official entries,260/300 cumulative; unit review L192. Intro SQL9/9 and review SQL5/5 passed,0 FAIL/0 SKIP; original19-table rows unchanged. Source guard replaced unsupported recognition target 店 with source-listed 商; vocabulary and character denominators are separate. Money examples are fictional, 元/块 and near-synonyms are scoped by the requested reading; source row9 is literally 钱数表示法.

Batch13 L161–L165:20 new official entries,280/300 cumulative; unit review L193. Intro SQL9/9 and review SQL5/5 passed,0 FAIL/0 SKIP; all original19-table rows unchanged. Quantity approximations and transport examples are form-scoped; no fixed boundary of ten is invented for 几. Batch14 L166–L170:20 new official entries,300/300 cumulative; unit review L194 and cross-unit sampled diagnostic L199. Intro SQL9/9 and review/diagnostic SQL6/6 passed,0 FAIL/0 SKIP; original19-table preservation passes. Diagnostic source selection initially referenced rain in L143; the pre-import builder rejected it, then the descriptor was corrected to its actual source L144. Nothing from the rejected diagnostic was imported. Current HSK1:72 introductions including L001/L002,14 unit reviews,4 sampled diagnostics,90 activities/716 exercises. Status: HSK1_VOCABULARY_COMPLETE / HSK1_CURRICULUM_PARTIAL. Current counts are derived in `hsk1-progress.json`; the100-word snapshot above is historical.

The user's marked UI fixes raise brand/navigation/breadcrumb/owner labels to14px, sidebar note prose to16px and auth/data prose to16px with65ch measure. Local desktop1440/360px computed metrics show no horizontal overflow. First visual captures are DEMO-mode shell checks, not evidence of hosted owner authentication or deployment.

Final native matrix at the100-word milestone: Foundation9/9, HSK1 31/31, HSK2 representatives6/6, HSK3 representative5/5, HSK4 representative5/5 (56 PASS/0 FAIL/0 SKIP total). F01 exposed a test fixture's incorrect minimum-four-cards assumption; the fixture now asserts the exact number of distinct eligible recall identities for each package, retaining the first8 PASS/1 FAIL run. All19-table preservation still passes after the complete matrix. Unit suite132/132 with its intended default environment; an accidental globally enabled expansion run128 PASS/4 FAIL is retained separately rather than misclassified as a source regression.

Browser checks remain separately recorded. Initial beginner test skipped a not-yet-rendered start button; a second run observed a real cold start POST aborted near14.99 seconds. Explicit read-only route initialization allowed starting and advancing F03; a stale status-selector assertion was corrected to verify saved cursor before/after reload. The next run proved saved resume/guide but exposed contrast on the new breadcrumb wrapper; its text now inherits the readable parent color. These runs and traces stay preserved; no API timeout was raised and no automatic retries enabled. Cold transport is not declared closed by warmed functional checks.

The corrected beginner case passes on desktop and360px, including saved cursor after reload, guide resume, visible current breadcrumb and Axe checks. A broader20-case run reached4 PASS/1 FAIL/15 not-run: L4083 encountered HTTP503 `LOCAL_DB_UNAVAILABLE` on one view GET while neighboring GETs returned200. The old cursor dereference hid that HTTP failure; the browser test now asserts response success before reading its session. This is observed transport failure, not evidence that persisted cursor data was lost; underlying cause remains open.

Source precision repair: L182.v2 accepts both shéi/shuí for 谁. The domain's tone-ambiguity rule allows only that explicit pair when bound to the exact pinned HSK1 ordinal181/PDF83; wrong tones, other words and unpinned variants remain rejected. Historical L182.v1 package and review-alias registry entry stay intact. New unit tests cover canonical/numeric variants, wrong tones, missing pin and same old/current card identity; server SQL accepts shui2 without a second card. Results:133/133 unit and6/6 focused SQL, original19-table baseline unchanged.

## Remaining gates

All300 vocabulary entries now have current DRAFT teaching and practice; no vocabulary ordinal remains. Finish final technical review and source-to-teaching/practice matrices without turning tags into completion. Recognition needs explicit glyph teaching/practice; handwriting, oral/listening tasks and qualified human approval remain separate open gates.

Old HSK4 browser aggregate18 PASS/2 FAIL/9 not-run remains historical evidence. One Today transition timed out while still on schedule; a later resume check ran with DB unavailable. Neither is erased or claimed resolved by new content SQL. Reproduce current representative Today/resume/course/mobile flows, record cold transport behavior separately, and report actual failures without blanket timeout increases or hidden retries.

## Final 300-word technical checkpoint

See `hsk1-vocabulary-completion-report.md` and its JSON/hash manifest for the final19-item delivery. Core content reviewed at fc3d7ad6ca443c331bf755c948be6225511082a2; final acknowledged-onboarding browser repair reviewed at3c3a8089eb72e306537049951248ae8ac1ec47d1. No app/content source changed after the production build. Unit134/134; native SQL120/120 across Foundation/HSK1/HSK2–4 representatives.

Final browser attempts remain distinct: mixed matrix5PASS/1FAIL/10not-run; initial mobile0PASS/1FAIL/2not-run; corrected mobile HSK1 journeys3/3, navigation/schedule/Today8/8, beginner typography/resume2/2 and HSK4 mobile1/1. The mobile trace exposed navigation7.7ms after onboarding click before mode acknowledgement. Tests now await the real schedule navigation; read-only development initialization is recorded separately. No retries or client-timeout increase. Earlier GET timeouts/503 and aborted-request server messages remain an OPEN transport gate.

Final baseline comparison preserves all original rows in19 private tables and all522 prior package bindings;624 bindings now exist through additive imports. Frozen100-word evidence/screenshots stay intact. Final UI screenshots are isolated per test run and copied to `.local-postgres/hsk24/hsk1-300-ui-{desktop,mobile360}.png`.

Next content checkpoint: no missing vocabulary ordinal. Audit25unreferenced grammar physical rows plus remaining alternatives and3legacy labels;163glyphs without explicit target practice;3topic leaves; all59communication bullets/modalities; shared100glyph handwriting and competent review/publication. Full curriculum and cold-transport completion are not claimed.
