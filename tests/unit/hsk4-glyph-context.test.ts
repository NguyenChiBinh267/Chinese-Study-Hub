import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const catalog = JSON.parse(
  fs.readFileSync("content/hsk24/catalog.json", "utf8"),
);
for (const [id, fragment] of [
  ["L4025", "□烦你帮我看一下"],
  ["L4028", "一串□萄"],
  ["L4036", "这些西红□还没红"],
]) {
  test(`${id}: glyph context preserves the rest of the original compound`, () => {
    const version = catalog.lessons
      .find((l: { key: string }) => l.key === id)
      .currentVersion.match(/-v(\d+)$/)[1];
    const p = JSON.parse(
      fs.readFileSync(`content/hsk24/${id}.v${version}.json`, "utf8"),
    );
    const e = p.exercises.find(
      (e: { skill: string }) => e.skill === "recognition",
    );
    assert(e.prompt.includes(fragment), e.prompt);
    if (id === "L4036")
      assert(
        !e.choices.includes("杮"),
        "Untaught near-identical Unicode distractor",
      );
  });
}
