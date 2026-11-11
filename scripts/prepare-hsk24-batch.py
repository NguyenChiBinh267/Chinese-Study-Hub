"""Resolve only a selected original teaching batch against the private pinned PDF."""
import hashlib, json, re, sys
from pathlib import Path
from pypdf import PdfReader
root = Path(__file__).resolve().parent.parent
pdf = root / '.local-postgres/source-research/hsk-2025-11.pdf'
assert hashlib.sha256(pdf.read_bytes()).hexdigest() == 'ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941'
batch = json.loads((root / sys.argv[1]).read_text('utf-8'))
r = PdfReader(pdf)
level = batch.get('targetLevel', 2)
assert level in [1, 2, 3, 4]
selected = {w[0]+'@'+w[1].replace(' ',''):w for l in batch['lessons'] for w in l['words']}
def source_reading_key(value):
    # Source-only syllable boundary punctuation; never remove tone marks.
    return re.sub(r"[\s’'\-]",'',value)
found = {}
for index in {1:range(79,87),2:range(86,92),3:range(91,104),4:range(104,129)}[level]:
    for line in r.pages[index].extract_text().splitlines():
        m = re.match(r'^\s*(\d+)\s+('+str(level)+r'(?:（[^）]+）)*)\s+(\S+)\s+(.+)$', line)
        if not m: continue
        text = m[4].split()
        # selected compounds use joined pinyin except multiword phrases; preserve exact column
        pinyin = ' '.join(x for x in text if re.fullmatch(r"[A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ’'/\-]+",x))
        # The actual 熟 entry lists shú/shóu; one declared source reading is
        # selected for a lesson. Keep the complete source column as evidence.
        for variant in pinyin.split('/'):
            key=m[3]+'@'+source_reading_key(variant)
            if key in selected: found[key] = {'ordinal': int(m[1]), 'page':index, 'pinyin':variant, 'sourcePinyin':pinyin, 'annotation': m[2] + ' ' + m[4]}
assert set(selected) == set(found), sorted(set(selected)-set(found))
chars = {m[2]:{'ordinal':int(m[1]),'page':index} for index in {1:[355,356],2:[357],3:[358,359],4:[360,361,362]}[level] for m in re.finditer(r'(\d+)\.\s*([\u4e00-\u9fff])',r.pages[index].extract_text())}
for lesson in batch['lessons']:
    for c in lesson.get('characterTargets',[]):
        assert len(c)==1 and c in chars and c in ''.join([lesson['passage'][0],lesson['grammar'][4],*[w[4] for w in lesson['words']]]), ('UNSUPPORTED_CHARACTER_TARGET',c)
    for field in ['grammar','task','topic']:
        ref=lesson[field]
        assert ref[1] in r.pages[ref[2]].extract_text(), ref
    for word in lesson['words']:
        key=word[0]+'@'+word[1].replace(' ','')
        assert word[1].replace(' ','') == source_reading_key(found[key]['pinyin']), (word[0],word[1],found[key])
target_chars={c for w in selected.values() for c in w[0]}|{c for l in batch['lessons'] for c in l.get('characterTargets',[])}
print(json.dumps({'words':found,'characters':{c:chars[c] for c in target_chars if c in chars}},ensure_ascii=False))
