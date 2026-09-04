export const RESPONSE_WORD_LIMIT = 220;

export function countWords(value) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function endsWithSentence(value) {
  return /[.!?]["')\]]?$/.test(value.trim());
}

function normalizeForComparison(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function dedupeNumberedItems(value) {
  const itemPattern = /(?:^|\s)([1-9]|1\d)\.\s+(.+?)(?=(?:\s+(?:[1-9]|1\d)\.\s)|$)/gs;
  const matches = [...value.matchAll(itemPattern)];
  if (matches.length < 2 || matches[0][1] !== '1') return value;

  const seen = new Set();
  const uniqueItems = [];
  for (const match of matches) {
    const item = match[2].trim();
    const key = normalizeForComparison(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  const prefix = value.slice(0, matches[0].index).trimEnd();
  const rebuiltList = uniqueItems.map((item, index) => `${index + 1}. ${item}`).join('\n');
  return `${prefix}${prefix ? '\n' : ''}${rebuiltList}`;
}

export function finalizeResponse(value, wordLimit = RESPONSE_WORD_LIMIT) {
  const clean = dedupeNumberedItems(value)
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\s*\r?\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return '';
  if (countWords(clean) <= wordLimit && endsWithSentence(clean)) return clean;

  const completeSentences = clean.match(/.+?(?:[!?]|(?<!\d)\.)(?=\s|$)/gs) || [];
  let completeEnd = 0;
  for (const sentence of completeSentences) {
    const sentenceEnd = clean.indexOf(sentence, completeEnd) + sentence.length;
    const candidate = clean.slice(0, sentenceEnd).trim();
    if (countWords(candidate) > wordLimit) {
      if (!completeEnd) return sentence.trim();
      break;
    }
    completeEnd = sentenceEnd;
  }
  if (completeEnd) return clean.slice(0, completeEnd).trim();

  const shortened = clean.split(/\s+/).slice(0, wordLimit).join(' ').replace(/[,:;\-]+$/, '');
  return `${shortened}.`;
}
