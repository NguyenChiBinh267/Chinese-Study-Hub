"""Derived curriculum inventory, not Master Plan status or permission to rewrite HSK1."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def read(name):
    return json.loads((ROOT / name).read_text('utf-8'))
def write(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

coverage = read('docs/hsk24/coverage.json')
h2 = read('docs/hsk24/five-dimensions.json')
h3 = read('docs/hsk24/hsk3-coverage.json')
h4 = read('docs/hsk24/hsk4-coverage.json')
assert h4['vocabulary']['taught'] == 1000
assert not h4['vocabulary']['remainingOrdinals']
assert len(coverage['vocabulary']) == 2000
levels = []
for n in range(1, 5):
    rows = [r for r in coverage['vocabulary'] if r['introductionLevel'] == n]
    levels.append({
        'level': n, 'vocabularyDenominator': len(rows),
        'entriesWithDraftTeaching': sum(r['status'] == 'CONTENT_DRAFT' for r in rows),
        'missingVocabularyOrdinals': [r['ordinal'] for r in rows if r['status'] != 'CONTENT_DRAFT'],
        'competentlyReviewed': 0, 'published': 0, 'mastery': None,
        'fiveDimensionEvidence': None if n == 1 else {
            'file': f'docs/hsk24/{"five-dimensions" if n == 2 else "hsk" + str(n) + "-coverage"}.json',
            'denominators': {2:h2, 3:h3, 4:h4}[n]['denominators'],
            'summary': {2:h2, 3:h3, 4:h4}[n]['summary'],
        },
    })
assert [x['entriesWithDraftTeaching'] for x in levels] == [8, 200, 500, 1000]

backlog = [
    {'id':'GAP-H14-001', 'priority':1, 'scope':'HSK1 prerequisite inventory',
     'remainingVocabularyOrdinals':levels[0]['missingVocabularyOrdinals'],
     'target':'Enumerate all five HSK1 dimensions and trace existing 8/300 words to actual teaching and assessment before proposing a rewrite.',
     'acceptance':'Pinned source rows, exact missing ordinals and dimension denominators, reuse map, bounded proposal; no rewrite or prerequisite bypass authorized.'},
    {'id':'GAP-H14-002', 'priority':1, 'scope':'Qualified language and answer review, all levels',
     'target':'Review current immutable lessons, source-note errata, naturalness, tones, alternate answers and distractor quality.',
     'acceptance':'Competent independent human receipts bound to package hashes; unresolved items remain DRAFT_UNREVIEWED. Technical PASS cannot replace these receipts.'},
    {'id':'GAP-H14-003', 'priority':2, 'scope':'HSK2 grammar/topic/task closure',
     'target':'Audit 78 physical grammar body rows and all alternatives; 29 mapped candidates and zero fully substantiated rows. Expand 22/34 topic leaves and audit functional subrequirements of 17 referenced task heads.',
     'acceptance':'Atomic source alternatives and task clauses separately enumerated, taught and assessed; physical-row counts are not atomic pattern counts.'},
    {'id':'GAP-H14-004', 'priority':2, 'scope':'HSK3 five-dimensional gaps',
     'target':'Close source row and actual practice gaps listed in hsk3-coverage.json; references alone do not count as instruction.',
     'acceptance':'96 grammar rows,54 topic leaves,22 task heads/109 physical bullets,284 recognition and150 writing characters each tracked through actual instruction, practice and competent review.'},
    {'id':'GAP-H14-005', 'priority':2, 'scope':'HSK4 grammar alternatives and task functions',
     'grammarRowsWithoutExplicitPartialPractice':[r['id'] for r in h4['grammar'] if not any(e.get('practiceExerciseIds') for e in r['instructionEvidence'])],
     'unmappedTopicRows':[r for r in h4['topics'] if not r.get('writtenSceneEvidence')],
     'target':'Enumerate every alternative within95 physical grammar rows and every functional/modal clause within139 task bullets. Current written parent-head scenes remain partial.',
     'acceptance':'Source-locator and taught/practiced evidence per alternative/functional clause; zero rows or task bullets fully accepted until review. Retain L424 personal-pronoun slot gap.'},
    {'id':'GAP-H14-006', 'priority':2, 'scope':'Recognition versus independent recall and writing',
     'hsk4RecognitionWithoutDedicatedPractice':[r['ordinal'] for r in h4['recognition'] if not r.get('dedicatedPractice')],
     'target':'Add independent recall/recognition probes and handwriting where authorized; current recognition includes meaning/pinyin assistance. Audit retained baseline compound context masks in L424,L492,L4013,L4024 and similar old items; only new continuation scope4025–4084 was repaired. Review sampled diagnostic distractors (including L49008/L49012).',
     'acceptance':'Explicit stimulus, confusable alternatives and modality evidence; assisted multiple choice never certifies handwriting or independent recall.'},
    {'id':'GAP-H14-007', 'priority':2, 'scope':'Listening, speaking and reviewed media',
     'target':'Create original zero-fee media only after rights and competent-review gates; current text does not test hearing or pronunciation.',
     'acceptance':'Actual free rights, audio bytes/transcripts, competent answer/audio review and modality-specific acceptance; no automatic publication.'},
    {'id':'GAP-H14-008', 'priority':1, 'scope':'Runtime reliability at complete vocabulary size',
     'target':'Retain zero ordinary Today full-package reads; investigate corpus-sized metadata parsing, rejected-page work, reused development cache/transport and cold compile budgets. Audit baseline e6/e7 lexical attribution and stage additive CONTEXT_ONLY versions where appropriate; absent evidenceScope intentionally retains legacy behavior. Preserve all old hashes and history.',
     'acceptance':'Fresh exact-source measurements, reproducible transport observations and existing product budgets. Earlier warm timing is not a cold-start SLA.'},
    {'id':'GAP-H14-009', 'priority':1, 'scope':'Rights, publication and secure mastery',
     'target':'Keep all new activities private DRAFT; no verified mastery, publication, hosted deployment or paid dependencies.',
     'acceptance':'Owner/legal/competent-language evidence and reviewed release task authorization; preserve existing RLS, source hashes, attempt history and prerequisite rules.'},
]
report = {
    'status':'HSK4_VOCABULARY_COMPLETE / HSK4_CURRICULUM_PARTIAL / HSK24_EPIC_PARTIAL',
    'sourceSha256':coverage['source']['sha256'],
    'method':'Current introductions only; unique official ordinal plus sense/reading, actual teaching and first-six word practices. Reviews add zero vocabulary. Mapping, instruction, practice, review, publication and mastery are separate.',
    'levels':levels, 'totalDraftVocabulary':1708, 'cumulativeDenominator':2000,
    'notAuthorized':'No HSK1 rewrite or further implementation is started by this inventory. These GAP IDs are a local derived backlog, not mutable Master Plan Task IDs.',
    'nextCheckpoint':{'id':'GAP-H14-001','action':'Evidence-only HSK1 prerequisite/five-dimension audit before a separately scoped implementation proposal.'},
    'backlog':backlog,
}
write('docs/hsk24/hsk14-gap-audit.json',report)
lines=['# HSK1–4 gap audit after the HSK4 vocabulary milestone','',
       'Current draft vocabulary: **1708/2000**. HSK4: **1000/1000**; HSK2:200/200; HSK3:500/500; HSK1:8/300. These are original draft teaching counts, not human approval, publication or learner mastery.','',
       'All detailed missing ordinals and source-row lists are in `hsk14-gap-audit.json`. Historical versions and review activities are excluded from introduction counts.','',
       '| Level | Draft words | Grammar / topics / tasks / characters |','|---|---:|---|',
       '| HSK1 | 8/300 | Five-dimensional prerequisite inventory still required;292 vocabulary ordinals missing. |',
       f'| HSK2 | 200/200 | {h2["summary"]["grammarRowsMappedCandidates"]}/78 physical grammar rows mapped;{h2["summary"]["topicLeavesMapped"]}/34 topic leaves;17/17 task heads referenced;125/125 assisted recognition characters practiced. Full grammar/task acceptance0. |',
       f'| HSK3 | 500/500 | {h3["summary"]["grammarRowsWithExplicitPartialPractice"]}/96 rows with explicit partial practice;{h3["summary"]["topicLeavesMapped"]}/54 topic leaves;{h3["summary"]["taskHeadsReferenced"]}/22 task heads referenced;{h3["summary"]["recognitionCharactersExplicitlyPracticed"]}/284 recognition characters practiced. |',
       f'| HSK4 | 1000/1000 | {h4["summary"]["grammarRowsWithExplicitPartialPractice"]}/95 rows with explicit partial practice;{h4["summary"]["topicLeavesMapped"]}/77 topic leaves;{h4["summary"]["taskHeadsReferenced"]}/30 task heads referenced;{h4["summary"]["recognitionCharactersExplicitlyPracticed"]}/441 assisted recognition characters practiced. |','',
       'Physical grammar rows contain multiple alternatives. Referencing a task head does not accept its139 HSK4 physical bullets or their oral/functional subclauses. All writing, listening/speaking, rights and competent-review gaps remain separate.','',
       '## Measurable next work','']
for item in backlog:
    lines += [f'- **{item["id"]} — {item["scope"]}.** {item["target"]} Acceptance: {item["acceptance"]}']
lines += ['', 'Next checkpoint: **GAP-H14-001**, evidence inventory only. This report does not start an HSK1 rewrite, change Master Plan task status, authorize publishing or infer mastery.','']
(ROOT/'docs/hsk24/hsk14-gap-audit.md').write_text('\n'.join(lines),encoding='utf-8')
print('PASS HSK1–4 derived gap audit;1708/2000 draft vocabulary; no HSK1 rewrite or human approval.')
