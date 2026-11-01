import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  validatePronunciation,
  type PronunciationNoteRepository,
} from "../domain/notes";

export function pinnedPronunciation(
  bytes: string,
  pin: { sha256: string; releaseId: string },
) {
  bytes = bytes.replace(/\r\n/g, "\n");
  if (createHash("sha256").update(bytes).digest("hex") !== pin.sha256)
    throw new Error("PRONUNCIATION_RELEASE_HASH_MISMATCH");
  const release = validatePronunciation(JSON.parse(bytes));
  if (release.id !== pin.releaseId)
    throw new Error("PRONUNCIATION_RELEASE_PIN_MISMATCH");
  return release;
}

export class FilePronunciationNoteRepository implements PronunciationNoteRepository {
  load() {
    const dir = path.join(process.cwd(), "content/pronunciation");
    const bytes = fs
      .readFileSync(path.join(dir, "release.v1.json"), "utf8")
      .replace(/\r\n/g, "\n");
    const pin = JSON.parse(
      fs.readFileSync(path.join(dir, "release-pin.json"), "utf8"),
    );
    return pinnedPronunciation(bytes, pin);
  }
}
