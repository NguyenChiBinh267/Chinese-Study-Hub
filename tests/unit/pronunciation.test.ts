import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import raw from "../../content/pronunciation/release.v1.json";
import pin from "../../content/pronunciation/release-pin.json";
import { validatePronunciation } from "../../src/modules/pronunciation/domain/notes";
import {
  pinnedPronunciation,
  FilePronunciationNoteRepository,
} from "../../src/modules/pronunciation/application/repository";
import {
  DisabledAcousticAnalysisAdapter,
  mapPronunciationFeedback,
  type AcousticAnalysisResult,
} from "../../src/modules/pronunciation/domain/feedback";
import { ArticulationGuide } from "../../src/modules/pronunciation/ui/articulation-guide";
import { exportPronunciationReview } from "../../scripts/export-pronunciation-review";

const release = validatePronunciation(raw);
test("31 bounded notes, seven categories, pinned Foundation bindings and unreviewed publication separation", () => {
  assert.equal(release.notes.length, 31);
  assert.ok(
    release.notes.every(
      (n) =>
        n.quickTip.length <= 220 &&
        n.quickTip.split(/[.!?]\s+/u).filter(Boolean).length === 1,
    ),
  );
  assert.equal(release.illustrations.length, 26);
  assert.equal(new Set(release.notes.map((n) => n.category)).size, 7);
  assert.deepEqual(new FilePronunciationNoteRepository().load(), release);
  assert.equal(release.lessonBindings.F01.length, 24);
  assert.equal(release.lessonBindings.F02.length, 7);
  assert.ok(
    release.notes.every(
      (n) =>
        n.humanReview === null &&
        n.reviewStatus === "DRAFT_UNREVIEWED" &&
        n.audioRefs.length === 0 &&
        n.publication === "LOCAL_DEVELOPMENT_ONLY",
    ),
  );
});
test("Missing target/source/illustration, duplicate/version drift and invalid anatomical metadata rejected", () => {
  const bad: unknown[] = [];
  const clone = () => structuredClone(raw);
  let r = clone();
  r.notes[0].target = "";
  bad.push(r);
  r = clone();
  r.notes[0].references[0].sourceId = "missing";
  bad.push(r);
  r = clone();
  r.notes[0].illustrationRefs = ["missing-v1"];
  bad.push(r);
  r = clone();
  r.notes[0].articulation.tongueBody = "";
  bad.push(r);
  r = clone();
  r.notes[0].version = 2;
  bad.push(r);
  r = clone();
  r.notes.push(r.notes[0]);
  bad.push(r);
  r = clone();
  r.lessonBindings.F02 = [r.notes[0].versionId];
  bad.push(r);
  r = clone();
  r.illustrations[0].place = "NONE";
  bad.push(r);
  r = clone();
  r.sources[0].url = "javascript:alert(1)";
  bad.push(r);
  for (const value of bad) assert.throws(() => validatePronunciation(value));
  assert.throws(() =>
    validatePronunciation({
      ...raw,
      notes: [
        {
          ...raw.notes[0],
          reviewStatus: "APPROVED",
          humanReview: { identity: "AI" },
        },
      ],
    }),
  );
});
test("Release bytes and stable note versions are pinned, not auto-upgraded", () => {
  const bytes = fs.readFileSync(
    "content/pronunciation/release.v1.json",
    "utf8",
  );
  assert.deepEqual(pinnedPronunciation(bytes, pin), release);
  assert.throws(
    () => pinnedPronunciation(bytes.replace("Bản nháp", "Bản đổi"), pin),
    /HASH_MISMATCH/,
  );
  assert.throws(
    () => pinnedPronunciation(bytes, { ...pin, releaseId: "other-v1" }),
    /PIN_MISMATCH/,
  );
});
test("Aspiration and major articulatory distinctions use different explicit model configurations", () => {
  const note = (id: string) =>
    release.notes.find((n) => n.id === `pron-${id}`)!;
  const art = (id: string) =>
    release.illustrations.find((m) => m.id === note(id).illustrationRefs[0])!;
  for (const [a, b] of [
    ["b", "p"],
    ["d", "t"],
    ["g", "k"],
  ]) {
    assert.equal(art(a).place, art(b).place);
    assert.equal(art(a).aspiration, "UNASPIRATED");
    assert.equal(art(b).aspiration, "ASPIRATED");
    assert.ok(
      note(a).articulation.voicing.includes("b") ||
        note(a).articulation.voicing.includes(a),
    );
  }
  assert.equal(art("q").place, "PALATAL");
  assert.equal(art("q").manner, "AFFRICATE");
  assert.equal(art("x").manner, "FRICATIVE");
  assert.equal(art("ch").place, "POSTALVEOLAR");
  assert.equal(art("s").place, "DENTAL");
  assert.equal(art("r").manner, "APPROXIMANT");
  assert.equal(art("u").place, "BACK_VOWEL");
  assert.equal(art("ue").place, "FRONT_VOWEL");
  assert.equal(art("u").mouth, art("ue").mouth);
  assert.ok(note("ju").quickTip.includes("hai chấm"));
  assert.ok(note("ju").articulation.tone.includes("jū/qū/xū"));
  assert.ok(!note("ju").articulation.tone.includes("lù"));
  assert.ok(!note("nihao").articulation.tongueBody.includes("mẫu ma"));
  assert.ok(!note("third-context").articulation.tongueBody.includes("mẫu ma"));
  assert.ok(note("spelling-trap").articulation.voicing.includes("r/ü"));
});
test("Citation, low connected third tone, 3+3 sandhi and neutral timing are distinct from measurements", () => {
  const contours = release.illustrations
    .filter((i) => i.kind === "TONE")
    .map((i) => i.contour);
  for (const c of ["LEVEL", "RISE", "DIP", "LOW", "FALL", "NEUTRAL", "SANDHI"])
    assert.ok(contours.includes(c as (typeof contours)[number]));
  assert.ok(
    release.notes.find((n) => n.id === "pron-nihao")!.pinyin.includes("nǐ hǎo"),
  );
  assert.ok(
    release.notes.find((n) => n.id === "pron-nihao")!.pinyin.includes("ní hǎo"),
  );
  assert.ok(
    release.notes
      .find((n) => n.id === "pron-tone-neutral")!
      .explanation.includes("không phải"),
  );
});
test("All figures have descriptions, text fallback and escaping; no copied remote images/scripts", () => {
  for (const model of release.illustrations) {
    const html = renderToStaticMarkup(
      createElement(ArticulationGuide, { model }),
    );
    assert.ok(html.includes("DRAFT"));
    if (model.kind !== "TEXT") {
      assert.ok(html.includes("<title"));
      assert.ok(html.includes("<desc"));
      assert.ok(html.includes('role="img"'));
    }
    assert.ok(!/<image|<script|<foreignObject/.test(html));
  }
  const m = {
    ...release.illustrations[0],
    description: '<img src=x onerror="alert(1)">',
  };
  const html = renderToStaticMarkup(
    createElement(ArticulationGuide, { model: m }),
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
});
test("Unknown/unsupported/unvalidated observations never become a diagnosis, score or mastery", async () => {
  assert.equal(
    (await new DisabledAcousticAnalysisAdapter().analyze()).state,
    "NOT_ANALYZED",
  );
  const values: AcousticAnalysisResult[] = [
    { state: "NOT_ANALYZED", reason: "NO_VALIDATED_ANALYZER" },
    { state: "INSUFFICIENT_AUDIO", reason: "unclear" },
    { state: "UNSUPPORTED_TARGET", targetVersion: "x-v1" },
    { state: "REVIEW_REQUIRED", reason: "policy" },
    {
      state: "ACOUSTIC_OBSERVATION",
      targetVersion: "pron-p-v1",
      policy: "UNVALIDATED",
      measurements: { durationMs: 400 },
    },
  ];
  for (const value of values) {
    const f = mapPronunciationFeedback(value, release.notes[0], true);
    assert.equal(f.masteryEligible, false);
    assert.ok(!("score" in f));
    assert.ok(f.correction.mayBeWrong.startsWith("Nếu"));
    assert.ok(f.correction.change.length > 10);
    assert.ok(f.correction.nextTry.length > 10);
    assert.ok(f.evidence.includes("tự chọn"));
    assert.ok(!f.summary.includes("95%"));
  }
});
test("Reviewer packet/standalone SVG export has empty real-human fields and preserves later findings", () => {
  const dir = path.resolve(
    ".local-postgres/review-packets",
    `sprint7-test-${randomUUID()}`,
  );
  exportPronunciationReview(dir);
  const file = path.join(dir, "pronunciation-foundation-v1.json");
  const packet = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(packet.notes.length, 31);
  assert.equal(packet.illustrations.length, 26);
  assert.ok(
    packet.notes.every(
      (v: { reviewer: { identity: null; decision: null } }) =>
        v.reviewer.identity === null && v.reviewer.decision === null,
    ),
  );
  assert.ok(fs.readdirSync(dir).some((n) => n.endsWith(".svg")));
  packet.notes[0].reviewer.findings = ["TEST_ONLY_NOT_A_HUMAN_APPROVAL"];
  fs.writeFileSync(file, JSON.stringify(packet));
  exportPronunciationReview(dir);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(file, "utf8")).notes[0].reviewer.findings,
    packet.notes[0].reviewer.findings,
  );
  assert.throws(
    () => exportPronunciationReview(path.resolve("public")),
    /private directory/,
  );
});
