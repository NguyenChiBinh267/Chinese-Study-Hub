"""Reproducible source rows and conservative teaching gaps; no approval inference."""
import hashlib
import json
import re
from pathlib import Path
import pdfplumber
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
pdf = root / '.local-postgres/source-research/hsk-2025-11.pdf'
sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
assert sha == 'ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941'
cat = json.loads((root / 'content/hsk24/catalog.json').read_text('utf-8'))
current = {x['currentVersion'] for x in cat['lessons']}
packages = [p for f in (root / 'content/hsk24').glob('L*.json') if (p := json.loads(f.read_text('utf-8')))['lesson']['versionId'] in current]
packages = [p for p in packages if p['alignment']['targetLevel'] == 2]
reviews_file = root / 'content/hsk24/reviews.json'
reviews = json.loads(reviews_file.read_text('utf-8')) if reviews_file.exists() else {'activities': []}
reviews['activities'] = [a for a in reviews['activities'] if any(p['lesson']['versionId'] == a['versionId'] for p in packages)]
activity_ids = {a['versionId'] for a in reviews['activities']}
intro = [p for p in packages if p['lesson']['versionId'] not in activity_ids]

def clean(s):
    return ''.join(x.strip() for x in (s or '').splitlines() if x.strip() not in ['汉', '考', '国', '际'])

def links(kind, predicate):
    return [{'versionId': p['lesson']['versionId'], 'referenceId': v['id'], 'teachingBlocks': [b['id'] for b in p['blocks'] if b['type'] == 'teaching'], 'exerciseIds': [e['id'] for e in p['exercises']]} for p in intro for v in p['alignment'][kind + 'References'] if v['status'] == 'VERIFIED' and predicate(v)]

grammar, topics = [], []
with pdfplumber.open(pdf) as source:
    for page, count in [(388, 34), (389, 31), (390, 13)]:
        rows = source.pages[page].extract_tables()[0][1:]
        assert len(rows) == count
        for n, row in enumerate(rows, 1):
            cells = [clean(x) for x in row]
            label = next(x for x in reversed(cells) if x)
            mapped = links('grammar', lambda v: v['sourceLocator']['pdfIndex'] == page and clean(v['written']) in ''.join(cells))
            grammar.append({'id': f'g-{page}-{n}', 'pdfIndex': page, 'tableBodyRow': n, 'rowSha256': hashlib.sha256(json.dumps(cells, ensure_ascii=False).encode()).hexdigest(), 'label': label, 'mappedEvidence': mapped, 'teaching': 'PARTIAL_CANDIDATE' if mapped else 'MISSING', 'practice': 'PARTIAL_CANDIDATE' if mapped else 'MISSING', 'reviewed': False, 'gap': 'Check every subalternative and its own contextual assessment; a row locator is not full teaching proof.'})
    for page, count in [(60, 24), (61, 10)]:
        rows = source.pages[page].extract_tables()[0][1:1 + count]
        parents = ['', '']
        for n, row in enumerate(rows, 1):
            cells = [clean(x) for x in row]
            for i in range(2):
                if cells[i]: parents[i] = cells[i]
            leaf = cells[2]
            mapped = links('topic', lambda v: v['sourceLocator']['pdfIndex'] == page and clean(v['written']) == leaf)
            topics.append({'id': f'topic-{page}-{n}', 'pdfIndex': page, 'tableBodyRow': n, 'path': parents + [leaf], 'mappedEvidence': mapped, 'teaching': 'PARTIAL_CANDIDATE' if mapped else 'MISSING', 'practice': 'PARTIAL_CANDIDATE' if mapped else 'MISSING', 'reviewed': False, 'gap': 'Verify topic-specific communication, not merely a broad parent reference.'})
reader = PdfReader(pdf)
chars = [(int(m[1]), m[2]) for m in re.finditer(r'(\d+)\.\s*([\u4e00-\u9fff])', reader.pages[357].extract_text())]
assert len(chars) == 125 and {n for n, _ in chars} == set(range(1, 126))
character_rows = []
for n, char in sorted(chars):
    mapped = links('character', lambda v: v['ordinal'] == n)
    explicit = []
    for a in reviews['activities']:
        for x in a.get('characterItems', []):
            if x['character'] != char: continue
            p = next(p for p in packages if p['lesson']['versionId'] == a['versionId'])
            ex = next(e for e in p['exercises'] if e['id'] == x['exerciseId'])
            key = next(k for k in p['privateKeys'] if k['id'] == ex['keyRef'])
            concept = next(c for c in p['concepts'] if c['id'] == ex['conceptId'])
            assert char in concept['hanzi'] and key['accepted'] == [char] and char in ex['choices']
            explicit.append({'versionId': a['versionId'], 'exerciseId': x['exerciseId'], 'conceptId': concept['id']})
    taught_words = [{'versionId': p['lesson']['versionId'], 'conceptId': c['id']} for p in intro for c in p['concepts'] if char in c['hanzi']]
    bridge = [{'versionId': p['lesson']['versionId'], 'referenceId': v['id']} for p in packages if p['lesson']['versionId'] in activity_ids for v in p['alignment']['characterReferences'] if v['ordinal'] == n]
    character_rows.append({'id': f'char-{n}', 'ordinal': n, 'character': char, 'pdfIndex': 357, 'mappedEvidence': mapped, 'activityMappings': bridge, 'taughtWordEvidence': taught_words, 'taughtInVocabulary': bool(taught_words), 'recognitionExerciseEvidence': explicit, 'practiced': bool(explicit), 'reviewed': False, 'writing': 'NOT_ASSESSED', 'gap': None if explicit else 'No dedicated recognition item; occurrence inside a vocabulary word is insufficient.'})
tasks = []
for page in range(8, 13):
    for line in reader.pages[page].extract_text().splitlines():
        m = re.match(r'^([一二三四五六七八九十]+)、(.+)', line)
        if not m: continue
        mapped = links('task', lambda v: v['sourceLocator']['pdfIndex'] == page and v['sourceLocator']['entry'].split(' / ')[0] == m[1])
        tasks.append({'id': f'task-{m[1]}', 'pdfIndex': page, 'entry': m[1], 'label': m[2], 'mappedEvidence': mapped, 'textPractice': 'PARTIAL_CANDIDATE' if mapped else 'MISSING', 'listeningSpeaking': 'MISSING', 'reviewed': False, 'gap': 'Text practice does not substantiate oral/listening/forms and every subrequirement.'})
assert len(grammar) == 78 and len(topics) == 34 and len(tasks) == 17
report = {'sourceSha256': sha, 'status': 'HSK2_CURRICULUM_PARTIAL', 'countRule': 'Current immutable introduction packages; reviews never add vocabulary. Mapped, partial teaching candidates, explicit practice and competent review are separate.', 'denominators': {'vocabulary': 200, 'grammarOperationalTableRows': 78, 'characterRecognition': 125, 'topicLeaves': 34, 'communicationTasks': 17}, 'grammarDenominatorCaveat': '78 physical body rows (34+31+13), not an official count of atomic grammar patterns; multi-alternative rows remain partial.', 'grammar': grammar, 'characters': character_rows, 'topics': topics, 'tasks': tasks, 'summary': {'grammarRowsMappedCandidates': sum(bool(x['mappedEvidence']) for x in grammar), 'grammarRowsFullySubstantiated': 0, 'charactersMapped': sum(bool(x['mappedEvidence']) for x in character_rows), 'charactersExplicitlyPracticed': sum(x['practiced'] for x in character_rows), 'topicLeavesMapped': sum(bool(x['mappedEvidence']) for x in topics), 'tasksMapped': sum(bool(x['mappedEvidence']) for x in tasks), 'competentlyReviewed': 0}, 'prerequisites': {'HSK1Taught': 8, 'HSK1Denominator': 300, 'policy': 'Each introduction retains prerequisite notes and secure prerequisite rules; exploratory draft access grants no HSK1 mastery.'}, 'remainingWork': ['Teach and assess all unsubstantiated grammar subalternatives', 'Dedicated recognition items for remaining characters', 'Topic-specific and task-specific subrequirements', 'Qualified independent human language/key review', 'Rights/publication evidence and reviewed listening/speaking material']}
if all(x['practiced'] for x in character_rows):
    report['remainingWork'].remove('Dedicated recognition items for remaining characters')
report['summary']['explicitCharacterItemCount'] = sum(len(a.get('characterItems', [])) for a in reviews['activities'])
(root / 'docs/hsk24/five-dimensions.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['summary']))
