// Offline authoring only. A one-character response must fit both displayed gaps.
export function glyphPrompt(
  word: string,
  character: string,
  meaning: string,
  pinyin: string,
  sentence: string,
) {
  if (
    [...character].length !== 1 ||
    !word.includes(character) ||
    !sentence.includes(word)
  )
    throw Error("GLYPH_CONTEXT_MUST_CONTAIN_TARGET");
  const maskedWord = word.replace(character, "□");
  const context = sentence.replace(word, maskedWord);
  return `Nhận diện chữ trong từ mang nghĩa “${meaning}”: ${maskedWord} (${pinyin}). Ngữ cảnh: ${context} Chỉ chọn một chữ còn thiếu; giữ nguyên các chữ đã hiện.`;
}
