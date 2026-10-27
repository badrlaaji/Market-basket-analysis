// No import: also run directly by Node's test runner (tests/sameRange.test.mjs).

// Words that say nothing about the kind of product: they cut the name in two
const BREAKS = new Set([
  ...["red", "pink", "blue", "green", "white", "black", "ivory", "yellow", "purple"],
  ...["orange", "grey", "gold", "silver", "cream", "brown"],
  ...["set", "pack", "small", "large", "mini", "design", "designs", "asstd", "assorted"],
]);
// Small words skipped without cutting: "heart of wicker" → "heart wicker"
const SKIPPED = new Set(["of", "and", "the", "a", "in", "with", "for"]);

/** "PACK OF 72 RETROSPOT CAKE CASES" → ["retrospot cake", "cake cases"]. */
function wordPairs(name: string): string[] {
  const pairs: string[] = [];
  let previous = "";
  for (const word of name.toLowerCase().split(/[^a-z0-9'-]+/)) {
    if (!word || SKIPPED.has(word)) continue;
    if (BREAKS.has(word) || /^\d+$/.test(word)) {
      previous = "";
      continue;
    }
    if (previous) pairs.push(`${previous} ${word}`);
    previous = word;
  }
  return pairs;
}

/**
 * Two products of the same range: their names share two consecutive words,
 * colours, sizes and numbers cutting the name ("jumbo bag", "regency teacup").
 * A shared print alone ("red retrospot" on a jumbo bag and a lunch bag) is not a range.
 */
export function sameRange(a: string, b: string): boolean {
  const pairs = new Set(wordPairs(a));
  return wordPairs(b).some((pair) => pairs.has(pair));
}
