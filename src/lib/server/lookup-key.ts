/**
 * Pure query-shaping for book lookups — no network, no database — so the cache key and the
 * "is this a barcode scan?" test can be unit tested on their own.
 */

/**
 * The cache key for a search. Two readers typing "Dog Man" and "  dog   man  " are asking the
 * same question and must share one cached answer, otherwise the cache barely helps.
 * Deliberately not stripping punctuation: "Peter Rabbit" and "Peter-Rabbit" can genuinely return
 * different results upstream, and a wrong hit is worse than a miss.
 */
export function normalizeLookupKey(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The ISBN from a scanner lookup (`isbn:9780241558959`), or null for an ordinary text search.
 * Used to decide when a missing page count is worth a second request: a scan names exactly one
 * physical book, so a fallback lookup can be matched to it with confidence. A text search can't.
 */
export function parseIsbnQuery(query: string): string | null {
	const match = /^isbn:\s*([0-9Xx-]+)$/.exec(query.trim());
	if (!match) return null;
	const digits = match[1].replace(/-/g, '').toUpperCase();
	return digits.length === 10 || digits.length === 13 ? digits : null;
}
