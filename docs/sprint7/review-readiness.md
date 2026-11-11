# Sprint 7 — pronunciation review preparation

All **31 notes** and **26 original schematic configurations** remain `DRAFT_UNREVIEWED`, `ORIGINAL_REVIEW_PENDING`, `LOCAL_DEVELOPMENT_ONLY`. There are no reviewer identities, decisions, audio approvals or publication receipts. Structural checks and a model's assessment are not qualified human review.

The pinned authoring source is `content/pronunciation/release.v1.json` with SHA-256 in `release-pin.json`. Original SVG rendering and place/manner configurations are in `src/modules/pronunciation/ui/articulation-guide.tsx` and the release JSON. These are original vectors, not traced/downloaded source images. Lip/tongue positions are approximate teaching schematics; no microphone measures a learner's anatomy here.

Run `npm.cmd run review:pronunciation`. Private output is `D:\Chinese-Study-Hub\.local-postgres\review-packets\sprint7\final\pronunciation-foundation-v1.json`, its README, and standalone SVG frames. The packet includes each target/Pinyin/version, anatomy claims, Vietnamese steps, common mistakes, corrections, self-check, source/rights/limitations and per-note/per-model reviewer fields. Existing findings are preserved; release or renderer drift fails instead of overwriting them. No import/publishing endpoint exists.

| Scope                                | Notes | Review emphasis                                                                                    |
| ------------------------------------ | ----: | -------------------------------------------------------------------------------------------------- |
| b/p, d/t, g/k                        |     6 | Aspiration versus voicing; correct closure/release at lips, denti-alveolar and velar places        |
| j/q/x, zh/ch/sh, z/c/s, r            |    10 | Tongue tip versus anterior body; affricate versus fricative; r variability, not a compulsory trill |
| u / ü                                |     2 | Both rounded; high back versus high front tongue body                                              |
| Four contrast pairs                  |     4 | Only the intended contrast changes; self-check does not certify accuracy                           |
| ju/qu/xu/yu spelling                 |     1 | Missing diaeresis does not change the vowel to back u                                              |
| Citation tones 1–4 and neutral tone  |     5 | Relative pitch, neutral duration/context; no fixed Hz or fake fifth lexical contour                |
| Connected third tone and 你好 sandhi |     2 | Low contextual realization versus isolated dip; lexical nǐ hǎo versus contextual ní hǎo            |
| Vietnamese spelling trap             |     1 | Memory aids are not exact cross-language equivalences or measured error-frequency claims           |

Primary references consulted on 2026-10-18:

- Lee & Zee (2003), [Standard Chinese (Beijing)](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/050A393AF2D3C325E3C6796FE8CA99A3/S0025100303001208a.pdf/standard-chinese-beijing.pdf), JIPA 33(1), 109–112: inventory, vowels and conventions, including speaker variability.
- Julian K. Wheatley, MIT OCW, [Sounds and symbols](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/01af9a25b804b7d58a26fa580691df4f_MITRES_21G_003S11_pinyin.pdf): §§2.2–2.3, 3.2, 4.4, 5.2 for aspiration, spelling and tone context.
- Huiqiang Zheng, University of Iowa, [lesson 1](https://pressbooks.uiowa.edu/zheng/chapter/interactive-pinyin-exercise/) and [lesson 2](https://pressbooks.uiowa.edu/zheng/chapter/lesson-2/): selected vowel and consonant teaching facts only, cross-checked against the IPA description. This is not blanket endorsement of those pages: for example, lesson 1's unrelated description of m as unvoiced was not adopted; m is outside this note set.

No source teaching text, diagram, recording or proprietary corpus is redistributed. These references support selected phonetic facts; they do not certify the new Vietnamese wording, complete SVG anatomy or publication rights. HSK's exam syllabus is not used as an articulation authority.

Review every closure/contact region, tongue contour, jaw/lip simplification, aspiration arrow and tone plot. The r model and third-tone context especially need competent evaluation of variation. There is no approved reference audio. Verify source pronunciation, Vietnamese comprehension with actual beginners, diagram/text consistency and rights before any release. Return corrections as a new pinned draft version; retain old packets/findings and all original lesson/attempt versions.

Earlier unreviewed working packets remain in the parent folder; `final/` binds the final source/renderer hashes. No existing findings or packet was overwritten.
