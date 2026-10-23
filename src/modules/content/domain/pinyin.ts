export const PINYIN_NORMALIZER = "pinyin-nfc-tone-v1";
const vowelTones: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};
function marked(base: string, tone: number) {
  if (tone === 0) return base;
  let position = base.indexOf("a");
  if (position < 0) position = base.indexOf("e");
  if (position < 0 && base.includes("ou")) position = base.indexOf("o");
  if (position < 0)
    for (let i = base.length - 1; i >= 0; i--)
      if ("aeiouü".includes(base[i])) {
        position = i;
        break;
      }
  if (position < 0) return null;
  return (
    base.slice(0, position) +
    vowelTones[base[position]][tone - 1] +
    base.slice(position + 1)
  );
}
// Returns tone-number syllables, never strips a wrong/missing tone into a right one.
// Bare syllables are neutral (0), not a wildcard. v is an explicit input convention.
export function normalizePinyin(input: string, allowV = true): string | null {
  const text = input
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/[，。！？,.!?;；:：]+/g, " ")
    .trim();
  if (!text || text.length > 160) return null;
  const result: string[] = [];
  for (const token of text.split(/\s+/)) {
    let base = "",
      tone = 0,
      marks = 0;
    const digit = token.match(/[0-5]$/)?.[0];
    const raw = digit ? token.slice(0, -1) : token;
    for (const char of raw) {
      let found = false;
      for (const [vowel, tones] of Object.entries(vowelTones)) {
        const n = tones.indexOf(char);
        if (n >= 0) {
          base += vowel;
          tone = n + 1;
          marks++;
          found = true;
          break;
        }
      }
      if (!found) base += char;
    }
    if (base.includes("v")) {
      if (!allowV) return null;
      base = base.replaceAll("v", "ü");
    }
    if (
      !/^[a-zü]+$/.test(base) ||
      !/[aeiouü]/.test(base) ||
      marks > 1 ||
      (digit && marks)
    )
      return null;
    if (digit) tone = Number(digit) % 5;
    if (marks && marked(base, tone) !== raw) return null;
    result.push(`${base}${tone}`);
  }
  return result.join(" ");
}
export function validDictionaryPinyin(value: string) {
  return !/[0-9v]/i.test(value) && normalizePinyin(value, false) !== null;
}
