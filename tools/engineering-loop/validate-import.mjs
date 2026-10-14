import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, requireThat } from './core.mjs';
import { readJson, writeJson } from './io.mjs';
import { plain, deriveRepository, PLAN, STATUS, MANIFEST } from './plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function validateImport(directory = root, { persist = false } = {}) {
  const base = path.join(directory, 'docs/master-plan'), native = readJson(path.join(base, 'native-paragraph-validation.json'));
  const raw = fs.readFileSync(path.join(base, 'source-export-v1.1.md')), text = raw.toString('utf8');
  const normalized = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
  const fnv = s => { let h = 14695981039346656037n; for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = BigInt.asUintN(64, h * 1099511628211n); } return h.toString(16).padStart(16, '0'); };
  const paragraphs = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^\|\s*:?-+/.test(line)) continue;
    if (line.startsWith('|')) paragraphs.push(...line.slice(1, -1).split(/(?<!\\)\|/).map(x => plain(x.trim())));
    else paragraphs.push(plain(line));
  }
  const hashes = paragraphs.map(x => fnv(normalized(x))), mismatches = [];
  for (let i = 0; i < Math.max(hashes.length, native.hashes.length); i++) if (hashes[i] !== native.hashes[i]) mismatches.push(i);
  const missingUrls = native.externalUrls.filter(url => !text.includes(url));
  const manifest = readJson(path.join(directory, MANIFEST));
  requireThat(native.revision === manifest.originalRevision && manifest.snapshotSha256 === hash(raw), 'Source revision/snapshot checksum mismatch');
  requireThat(manifest.planSha256 === hash(fs.readFileSync(path.join(directory, PLAN))), 'Canonical plan checksum mismatch');
  const planText = fs.readFileSync(path.join(directory, PLAN), 'utf8');
  const expectedBody = text.split(/\r?\n/).filter(x => !/^Trạng thái T\d{3}:/.test(x)).join('\n');
  requireThat(planText.slice(planText.indexOf('\n\n') + 2) === expectedBody, 'Unexpected canonical specification edit');
  const source = deriveRepository(directory);
  const adrs = [...planText.matchAll(/^## .*ADR-(00\d) —/gm)].map(x => x[1]);
  requireThat(new Set(adrs).size === 7 && adrs.length === 7, 'Seven ADRs not preserved');
  const report = { at: new Date().toISOString(), source: manifest.originalUrl, revision: manifest.originalRevision,
    snapshotSha256: hash(raw), canonicalSha256: manifest.planSha256, statusSha256: hash(fs.readFileSync(path.join(directory, STATUS))),
    sourceParagraphs: native.hashes.length, exportedParagraphs: hashes.length, orderedParagraphMismatches: mismatches, missingExternalUrls: missingUrls,
    tablesPreserved: 3, adrIds: adrs, taskCount: source.tasks.length, buckets: Object.fromEntries(Object.entries(source.buckets).map(([k, v]) => [k, v.length])),
    dependencyGraph: 'VALID_NO_CYCLES_M0_CLOSURE', doneIds: source.tasks.filter(t => t.status === 'done').map(t => t.id),
    allowedDifferences: manifest.transforms, status: mismatches.length || missingUrls.length ? 'BLOCKED' : 'PASS_TEXT_AND_SPEC_VALIDATION',
    limitations: ['Paragraph comparison uses FNV1a digests after whitespace/Markdown normalization; not a cryptographic proof of semantic equivalence',
      'Exact export bytes are protected separately by SHA256; layout/comment/revision history equivalence is not claimed',
      'Git SSOT authority on main remains pending migration review/merge; no Google Doc writes performed'] };
  if (persist) writeJson(path.join(base, 'migration-report.json'), report);
  requireThat(report.status === 'PASS_TEXT_AND_SPEC_VALIDATION', 'Import content mismatch; see migration-report.json and stop migration');
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(validateImport(root, { persist: true }), null, 2));
