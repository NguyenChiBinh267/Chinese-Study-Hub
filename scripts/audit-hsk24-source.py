"""Check exact PDF and produce locator-only gap matrix; never export the corpus."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader
from functools import lru_cache

root = Path(__file__).resolve().parent.parent
pdf = root / '.local-postgres/source-research/hsk-2025-11.pdf'
digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
assert digest == 'ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941'
r = PdfReader(pdf)
@lru_cache(maxsize=None)
def page_text(index):
    return r.pages[index].extract_text()
assert len(r.pages) == 406
extra = json.loads((root / 'content/hsk24/evidence.json').read_text('utf-8'))
for ref in extra['references']:
    loc = ref['sourceLocator']
    page = page_text(loc['pdfIndex'])
    assert loc['physicalPage'] == loc['pdfIndex'] + 1
    assert loc['printedPage'] == loc['pdfIndex'] - 2
    if ref['kind'] == 'vocabulary':
        line = next(x for x in page.splitlines() if re.match(rf"^\s*{ref['ordinal']}\s+{ref['officialLevel']}(?:（|\s)", x))
        assert ref['written'] in line and ref['pinyin'].replace(' ', '') in line.replace(' ', ''), ref['id']
    elif ref['kind'] == 'character':
        assert re.search(rf"\b{ref['ordinal']}\.\s*{ref['written']}", page), ref['id']
    else:
        assert ''.join(ref['written'].split()) in ''.join(page.split()), ref['id']

selection = json.loads((root / 'content/hsk24/catalog.json').read_text('utf-8'))
current = {l['currentVersion'] for l in selection['lessons']}
packages = [v for p in (root / 'content/hsk24').glob('L*.json') if (v := json.loads(p.read_text('utf-8')))['lesson']['versionId'] in current]
review_file = root / 'content/hsk24/reviews.json'
activities = json.loads(review_file.read_text('utf-8'))['activities'] if review_file.exists() else []
activities = [a for a in activities if a['versionId'] in current]
activity_ids = {x['versionId'] for x in activities}
activity_packages = [p for p in packages if p['lesson']['versionId'] in activity_ids]
packages = [p for p in packages if p['lesson']['versionId'] not in activity_ids]
base_catalog = json.loads((root / 'content/curriculum/catalog.v1.json').read_text('utf-8'))
for lesson in base_catalog['lessons']:
    if lesson['key'].startswith('L'):
        p = next(json.loads(p.read_text('utf-8')) for p in (root / 'content/staging/slice').glob(f"{lesson['key']}.v*.json") if json.loads(p.read_text('utf-8'))['lesson']['versionId'] == lesson['currentVersion'])
        packages.append(p)

rows = []
for page_index in range(79, 129):
    for line in page_text(page_index).splitlines():
        match = re.match(r'^\s*(\d+)\s+([1-4])(?:（[^）]+）)*\s+', line)
        if not match:
            continue
        ordinal, level = map(int, match.groups())
        if ordinal > 2000:
            continue
        refs = [(p, v) for p in packages for v in p['alignment']['vocabularyReferences'] if v['ordinal'] == ordinal and v['officialLevel'] == level and v['status'] == 'VERIFIED']
        taught = [(p, v) for p, v in refs if any(v['id'] in c['referenceIds'] for c in p['concepts'])]
        exercises = sorted({e['id'] for p, v in taught for c in p['concepts'] if v['id'] in c['referenceIds'] for e in p['exercises'] if e['conceptId'] == c['id']})
        rows.append({'id': f'v-{ordinal}', 'dimension': 'vocabulary', 'introductionLevel': level, 'ordinal': ordinal, 'pdfIndex': page_index, 'physicalPage': page_index + 1, 'printedPage': page_index - 2, 'status': 'CONTENT_DRAFT' if taught else 'NOT_MAPPED', 'mappingStatus': 'MAPPED_VERIFIED' if refs else 'NOT_MAPPED', 'mappingMeaning': 'entry and reading only; original senses unreviewed', 'senseReadings': [{'senseId': v['senseId'], 'pinyin': v['pinyin']} for _, v in taught], 'lessonVersions': sorted({p['lesson']['versionId'] for p, _ in taught}), 'exercises': exercises, 'reviewEligibility': 'LOCAL_PROVISIONAL_ONLY' if exercises else 'NONE', 'publicationStatus': 'BLOCKED', 'reviewStatus': 'DRAFT_UNREVIEWED' if taught else 'NOT_REVIEWED', 'missingEvidence': ['qualified-language-review', 'publication-rights', 'secure-mastery'], 'userMastery': None})
counts = {level: sum(x['introductionLevel'] == level for x in rows) for level in range(1, 5)}
for row in rows:
    concept_ids = {c['id'] for p in packages for v in p['alignment']['vocabularyReferences'] if v['ordinal'] == row['ordinal'] and v['status'] == 'VERIFIED' for c in p['concepts'] if v['id'] in c['referenceIds']}
    row['reviewActivityVersions'] = sorted({p['lesson']['versionId'] for p in activity_packages if any(c['id'] in concept_ids for c in p['concepts'])})
assert counts == {1: 300, 2: 200, 3: 500, 4: 1000}, counts
assert len({x['ordinal'] for x in rows}) == len(rows)
report = {'schemaVersion': 1, 'epicStatus': 'HSK24_EPIC_PARTIAL', 'source': {'edition': 'hsk-exam-2025-11', 'sha256': digest, 'url': extra['sourceUrl']}, 'states': ['NOT_MAPPED', 'MAPPED_UNVERIFIED', 'MAPPED_VERIFIED', 'CONTENT_DRAFT', 'CONTENT_REVIEWED', 'PRACTICE_AVAILABLE', 'PUBLISHED'], 'stateRule': 'Technical structure, source mapping, practice runtime, human review and publication are separate; no mastery inferred.', 'vocabulary': rows, 'levels': [], 'dimensions': []}
report['reviewActivities'] = {'count':len(activities), 'newVocabulary':0, 'versions':[p['lesson']['versionId'] for p in activity_packages], 'countRule':'Excluded from introduction counts; source senses reused.'}
report['detailedFiveDimensionAudit'] = 'docs/hsk24/five-dimensions.json'
task_headings = [(i, line) for i in range(8,13) for line in r.pages[i].extract_text().splitlines() if re.match(r'^[一二三四五六七八九十]+、',line)]
assert len(task_headings) == 17
hanzi_ordinals = {int(m[1]) for m in re.finditer(r'(\d+)\.\s*[\u4e00-\u9fff]', r.pages[357].extract_text())}
assert hanzi_ordinals == set(range(1,126))
assert '5个 18个 34个' in r.pages[61].extract_text()
report['independentScopeEvidenceHSK2'] = {'tasks': {'denominator':17, 'pdfIndexes':[8,9,10,11,12]}, 'characterRecognition':{'denominator':125,'pdfIndex':357}, 'topics':{'hierarchyCounts':[5,18,34],'pdfIndexes':[60,61], 'warning':'References mix hierarchy depths; no coverage percentage derived'}, 'grammar':{'denominator':None,'pdfIndexes':[388,389,390],'status':'ATOMIC_SCOPE_NOT_FULLY_ENUMERATED'}, 'historicalPackagesExcludedFromCurrentCounts':True}
for level, new, cumulative in [(1, 300, 300), (2, 200, 500), (3, 500, 1000), (4, 1000, 2000)]:
    level_rows = [x for x in rows if x['introductionLevel'] == level]
    report['levels'].append({'level': level, 'status': 'PARTIAL', 'vocabularyDenominator': new, 'cumulativeDenominator': cumulative, 'locatorRows': len(level_rows), 'contentCreated': len({p['lesson']['versionId'] for p in packages if p['alignment']['targetLevel'] == level}), 'entriesWithDraftTeaching': sum(x['status'] == 'CONTENT_DRAFT' for x in level_rows), 'entriesMapped': sum(x['mappingStatus'] == 'MAPPED_VERIFIED' for x in level_rows), 'entriesPracticed': None, 'approved': 0, 'userMastery': None})
    for dimension, field in [('grammar', 'grammarReferences'), ('character', 'characterReferences'), ('topic', 'topicReferences'), ('task', 'taskReferences')]:
        refs = {v['id']: {'reference': v, 'lessonVersions': sorted({p['lesson']['versionId'] for p in packages if any(x['id'] == v['id'] for x in p['alignment'][field])}), 'status': 'MAPPED_VERIFIED' if v['status'] == 'VERIFIED' else 'MAPPED_UNVERIFIED', 'instructionAndAssessmentCoverage': 'UNVERIFIED', 'writingCoverage': 'NOT_ASSESSED' if dimension == 'character' else None} for p in packages if p['alignment']['targetLevel'] == level for v in p['alignment'][field]}
        denominator = 125 if level == 2 and dimension == 'character' else 17 if level == 2 and dimension == 'task' else None
        report['dimensions'].append({'level': level, 'dimension': dimension, 'denominator': denominator, 'denominatorStatus': 'SOURCE_CHECKED' if denominator else 'FULL_SCOPE_NOT_ENUMERATED', 'references': list(refs.values()), 'mappedSourceLocators':len({json.dumps(v['reference']['sourceLocator'],sort_keys=True) for v in refs.values() if v['reference']['status']=='VERIFIED'}), 'covered': None, 'approved': 0})
out = root / 'docs/hsk24'
out.mkdir(exist_ok=True)
(out / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS: exact PDF and', len(extra['references']), 'bounded mappings;', counts, 'locator rows. No language/publication approval.')
