# Independent AI reference audit — 2026-10-22

Scope: original F01.v1, F02.v1, L001.v2 and L002.v2, including every concept,
teaching block, exercise, distractor, translation and private answer key. This
is an independent pass against references, not acceptance of earlier author
claims. **It is not qualified human review.** No HSK exam/competence claim.

## Sources actually inspected

| ID    | Primary source and locator                                                                                                                                                                                                                                                                                                                                                                                                         | What it supports                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HSK   | [Pinned HSK syllabus](https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf), source-pin.json                                                                                                                                                                                                                                                                                                                                  | Local exact 4,636,209-byte, 406-page PDF SHA256 `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. Cover and all 26 bounded locators rechecked with `scripts/verify-hsk-source.py`. The remote URL timed out this session; this is verification of the retained pinned bytes, not a new syllabus revision check. |
| PIN   | [MIT Pinyin spelling rules](https://web.mit.edu/~jinzhang/www/pinyin/spellingrules/index.html), §§1,2,3,5                                                                                                                                                                                                                                                                                                                          | Tone placement, initial/rhyme spelling, ü exceptions and connected word/capitalization convention.                                                                                                                                                                                                                                |
| SOUND | [Wheatley/MIT, Sounds and symbols](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/01af9a25b804b7d58a26fa580691df4f_MITRES_21G_003S11_pinyin.pdf), PDF pp.2–5,13–16                                                                                                                                                                                                           | Symbol vs pronunciation, four tones/light syllables, n/l ü distinction and j/q/x spelling; tone shifts.                                                                                                                                                                                                                           |
| NAME  | [Open University, Introducing oneself](https://www.open.edu/openlearn/mod/oucontent/view.php?id=106502&section=5), language notes and Activity 7                                                                                                                                                                                                                                                                                   | 我叫… and 你呢 in a name exchange.                                                                                                                                                                                                                                                                                                |
| NE    | [Wheatley/MIT Unit 1](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/e997e90bb0ac79ea7d75c3d2f5fcf8b7_MITRES_21G_003S11_unit01.pdf), §1.6.2, PDF pp.10–11                                                                                                                                                                                                                    | 呢 as a context-dependent follow-up question; not an unconditional yes/no question word.                                                                                                                                                                                                                                          |
| LIKE  | [Wheatley/MIT Unit 5](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/4b76c3d5e014f4833ef5efa2642b58ae_MITRES_21G_003S11_unit05.pdf), §§5.2.1–2,5.7.2, PDF pp.2–3,18; [Unit 7](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/9ac5a3ef1007db50644516dee9a1d249_MITRES_21G_003S11_unit07.pdf), §§7.4.1,7.5, PDF pp.14–15 | 喜欢 with noun/activity, tea/drink readings and connected xǐhuan. The HSK pin determines the chosen neutral huan; region/register variants do not justify replacing it with huān.                                                                                                                                                 |

Sources are reference-only: no textbook dialogue/audio was imported. New prose
and exercises remain project-original drafts with rights decision pending.

## Findings and decisions

Supplementary dictionary cross-checks: Taiwan MOE Mandarin entries
[媽](https://dict.concised.moe.edu.tw/dictView.jsp?ID=3518&la=0&powerMode=0),
[麻](https://dict.variants.moe.edu.tw/dictView.jsp?ID=-53073&la=1),
[馬](https://dict.variants.moe.edu.tw/dictView.jsp?ID=-51239&la=1),
[罵](https://dict.concised.moe.edu.tw/dictView.jsp?ID=3595&la=0&powerMode=0),
and [嗎](https://dict.mini.moe.edu.tw/SearchIndex/word_detail?breadcrumbs=Search_%E5%97%8E_one&dictSearchField=%E5%97%8E&wordID=D0001556).
Their mā/má/mǎ/mà/ma readings and selected mother/hemp/horse/scold/question
particle senses corroborate F01/F02; traditional character forms are cross-checks,
not a reason to change the simplified app text. They do not establish HSK mapping
or validate all regional pronunciation variants.

F01: mā/妈 “mẹ”, nǐ/你 “bạn”, nǚ/女 “nữ”; m+a and n+i are correct written
analyses (PIN/SOUND). The six intended keys remain m; a; n+i; mā; nǐ; nǚ.
`nv3` is an application input convention, not Mandarin orthography. No
demonstrable semantic/key error found. New F01.v2 preserves the teaching meanings and
keys, adds the checked source pin and stays DRAFT. No listening inference.

F02: retain mā/má/mǎ/mà/ma and meanings mẹ/gai/ngựa/mắng/question particle;
neutral ma is not a fixed fifth pitch contour (SOUND). The eight keys remain
tones 1/2/3/4; light tone; nǚ; nǚ; mǎ. **Correct b9:** the old blanket advice to
keep ü's dots omitted the j/q/x/yu spelling exceptions. New F02.v2 states those
exceptions and makes a > o/e and iu/ui tone placement explicit (PIN/SOUND).
The examples hǎo/liú/guì/nǚ were already correct. Foundations stay
FOUNDATION_INTERNAL / NOT_APPLICABLE, without official HSK unit mapping.

L001v2: Chinese and Vietnamese meanings of 你好, 我叫安, 你呢 are consistent
with NAME/NE. The six keys remain greeting; order 我+叫+安; 我叫安; wǒ;
“Còn bạn thì sao?”; order 你+呢. Sentence-initial Pinyin is normalized where
changed in L001.v4. 安 is an illustrative foreign name “An”, not evidence for
Chinese naming norms or official HSK coverage; its supplementary mapping stays
as such. MIT Unit 2 §2.6.3 favors multi-syllable Chinese names: this is a useful
pedagogical limitation for human review, not sufficient evidence to declare all
foreign one-syllable names ungrammatical. Keep dictionary nǐ hǎo while explaining
that spoken third-tone sandhi is not assessed here.

L002v2: 我喜欢茶 “Tôi thích trà”, 我喜欢喝茶 “Tôi thích uống trà”, and contextual
你呢 are supported by LIKE/NE. New L002.v4 uses connected **xǐhuan** in
teaching Pinyin (PIN/LIKE); per-syllable `xǐ huan` remains in the structured
dictionary field for the existing tone-aware normalizer. This spacing is a
declared representation convention, not a different pronunciation. The six
keys remain tea preference; 我+喜欢+茶; 我喜欢茶; 我+喜欢+喝+茶; 你呢; chá.
No demonstrable Chinese/translation/key error found. Exact-template short
answers deliberately reject alternatives; that is not a claim that all other
Mandarin formulations are wrong.

All 26 semantic keys were checked independently of the authoring generator;
`tests/fixtures/private-preview.ts` lists the intended meanings/order, and
unit/database/browser tests verify actual grading. The audit found no basis to
change a key or to claim qualified accuracy. Written choices measure recall of
these examples, not listening/speaking, general grammar mastery or HSK level.

HSK recheck: entries/readings/levels for 你好/我/你/叫/呢/喜欢/茶/喝 and the
bounded character/task/topic/general-grammar locators match the pinned PDF.
The general verb/object entries do **not** verify the specific 我叫+name or
喜欢+object/activity exam mappings. `g-jiao-pattern` and `g-like-pattern` stay
UNVERIFIED; L001/L002 alignment remains PARTIAL. Vietnamese glosses, sense IDs,
coverage, rights and teaching quality are not approved by an entry match.

`content/private-preview/selection.json` pins the four resulting hashes. Original
files, old key IDs, native catalog current pointers and prior attempts remain
unchanged. New exercise/key/session bindings use new version IDs.
