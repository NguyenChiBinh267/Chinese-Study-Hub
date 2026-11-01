# Local draft packages — Phase 4 + Sprint 5

Four current lessons / six immutable versions of **original, unreviewed LOCAL DEVELOPMENT drafts**. `F01/F02` are internal foundation lessons, not official HSK units. `L001/L002` are original drafts with `PARTIAL` source mapping. Each package contains private answer keys: never import these JSON files into a client module, public asset directory, React props or hydration payload.

The application obtains an explicit public allowlist from a development-only, authenticated loopback API. Answers, normalization, immutable key binding and grading remain server-side. Production rejects every `/api/local/content` endpoint. Runtime cannot mutate/publish catalog records. No publisher or human-review adapter is enabled.

| Package | Concepts (max 6) | Exercises (max 8) | Teaching blocks | Status |
| --- | --- | --- | --- | --- |
| F01.v1 | 3 | 6 | 4 | Internal foundation; practice only |
| F02.v1 | 6 | 8 | 5 | Written tone recognition; hearing/pronunciation unassessed |
| L001.v1 | 6 | 2 | 3 | HSK1 draft; exact teaching pattern unresolved, proper name supplementary |
| L002.v1 | 6 | 2 | 2 | HSK1 draft; exact teaching-pattern interpretation unresolved |
| L001.v2 | 6 | 6 | 3 | Current original dialogue; choice/sequence/short/Pinyin, PARTIAL |
| L002.v2 | 6 | 6 | 3 | Current original dialogue; choice/sequence/short/Pinyin, PARTIAL |

Estimated 15-minute labels are planning targets, not measured completion times or pilot results. The bounded drafts are not full HSK1 coverage. No third-party dialogue, exercise, dictionary corpus or audio was copied. Vietnamese explanations and answer keys remain subject to competent Mandarin review. Do not publish them as reviewed learning content.

## Source evidence and pin

`source-evidence.json` records 26 narrow factual references read from the exact official document. Source reading is independent of language/key review and rights. The internal sense IDs are project identifiers, not official sense numbers. Source verification of entry/reading/level does not certify the Vietnamese meaning or pragmatic usage.

`source-pin.json` is additive evidence from the subsequently completed private full-PDF download: 4,636,209 bytes, 406 physical pages, SHA-256 `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. It also binds the normalized-LF evidence file hash. The exact PDF and source page renders remain only in ignored `.local-postgres/source-research/`, never Git or application assets.

The v1 manifests were created while the local download was incomplete and bind the web-read source metadata; their `sourceSnapshotSha256` remains null. They are not silently rewritten after attempts exist. The mandatory additive pin now rejects a changed evidence file or source checksum at catalog loading. Fully source-pinned publication manifests will require a new content version and the remaining approval gates.

The PDF writes `nǐ hǎo`; the web extractor joined it as `nǐhǎo`. The verifier explicitly normalizes Pinyin whitespace for this entry. No tone or character was changed to force a match.

## Versioning

`packageHash` covers schema-parsed manifest fields excluding that hash, using stable schema field order/JSON serialization. PostgreSQL JSONB is parsed through the same schema before hash verification. Exercise/key/normalizer/grading versions are bound to each immutable attempt by foreign keys and server validation. Existing version IDs cannot be reseeded with different bytes/semantics. The one-time authoring script refuses to overwrite v1; create a new version for corrections.

New state follows DRAFT → validation → VALIDATED → REVIEW_PENDING. `REVIEWED/PUBLISHED` transitions require authority that Phase 4 deliberately does not provide. A passed test does not substitute for that authority. Source rights are `UNKNOWN / REFERENCE_ONLY`; public PDF access is not a corpus license.

Sprint5 adds v2 without mutating historical v1 manifests or source evidence. Each v2 directly binds the full source snapshot hash. Grammar locators remain broad; the two exact teaching patterns remain UNVERIFIED, and 安 remains SUPPLEMENTARY. Neither test success nor source checksum grants publication/review authority. New short answers use exact NFC Hanzi with whitespace/listed punctuation ignored; they are not semantic free-text grading. Sequence answers require one exact permutation of distinct public tokens.
