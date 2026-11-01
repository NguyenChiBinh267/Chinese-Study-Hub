import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePinyin,
  validDictionaryPinyin,
} from "../../src/modules/content/domain/pinyin";

test("The pinned syllabus reading ǹg for 嗯 supports its marked and numbered forms", () => {
  assert.equal(validDictionaryPinyin("ǹg"), true);
  assert.equal(normalizePinyin("ǹg"), "ng4");
  assert.equal(normalizePinyin("n\u0300g"), "ng4");
  assert.equal(normalizePinyin("ng4"), "ng4");
});
test("Syllabic nasal tones remain distinct; missing or doubled tones are not accepted as wildcards", () => {
  assert.notEqual(normalizePinyin("ńg"), normalizePinyin("ǹg"));
  assert.notEqual(normalizePinyin("ng"), normalizePinyin("ǹg"));
  assert.equal(normalizePinyin("ǹg4"), null);
  assert.equal(normalizePinyin("ǹg2"), null);
  assert.equal(normalizePinyin("ng6"), null);
  assert.equal(normalizePinyin("brr"), null);
});
