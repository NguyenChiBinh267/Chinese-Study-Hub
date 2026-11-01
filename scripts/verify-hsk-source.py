"""Read-only verification of bounded locators against the exact private PDF.
Requires pypdf. Never downloads, exports a corpus, or changes approval metadata.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else root / '.local-postgres/source-research/hsk-2025-11.pdf'
pin = json.loads((root / 'content/staging/slice/source-pin.json').read_text(encoding='utf-8'))
evidence_file = root / 'content/staging/slice/source-evidence.json'
evidence = json.loads(evidence_file.read_text(encoding='utf-8'))
assert hashlib.sha256(pdf.read_bytes()).hexdigest() == pin['pdfSha256'], 'Exact PDF checksum mismatch'
assert hashlib.sha256(evidence_file.read_bytes().replace(b'\r\n', b'\n')).hexdigest() == pin['evidenceFileSha256'], 'Evidence checksum mismatch'
reader = PdfReader(pdf)
assert len(reader.pages) == 406
cover = reader.pages[0].extract_text()
assert all(part in cover for part in ['HSK 考试大纲', '中外语言交流合作中心', '2025-11', '2026-07'])
assert len(evidence['references']) <= 50
for ref in evidence['references']:
    locator = ref['sourceLocator']
    assert locator['physicalPage'] == locator['pdfIndex'] + 1
    assert locator['printedPage'] == locator['pdfIndex'] - 2
    page = reader.pages[locator['pdfIndex']].extract_text()
    if ref['kind'] == 'vocabulary':
        line = next((line for line in page.splitlines() if re.match(rf"^\s*{ref['ordinal']}\s+1", line)), '')
        # The web parser joins nǐhǎo while the physical PDF writes nǐ hǎo.
        assert ref['written'] in line and ref['pinyin'].replace(' ', '') in line.replace(' ', ''), ref['id']
    elif ref['kind'] == 'character':
        assert re.search(rf"\b{ref['ordinal']}\.\s*{re.escape(ref['written'])}", page), ref['id']
    else:
        assert ref['written'] in page, ref['id']
print(f"PASS: exact 406-page PDF, cover and {len(evidence['references'])} narrow entry locators. Not human language/rights approval.")
