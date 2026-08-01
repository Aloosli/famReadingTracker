import type { BookSearchResult } from '$lib/types';
import { searchGoogleBooks } from './google-books';
import { searchOpenLibrary } from './open-library';
import { getCachedLookup, putCachedLookup } from './db/lookup-cache';
import { normalizeLookupKey, parseIsbnQuery } from './lookup-key';

/** Runs a lookup, turning any failure into null so the caller can tell it apart from "no matches". */
async function attempt(run: () => Promise<BookSearchResult[]>): Promise<BookSearchResult[] | null> {
	try {
		return await run();
	} catch {
		return null;
	}
}

/**
 * Finds a book, from whichever source can answer.
 *
 * Google Books is tried first — its search ranking is better for the common case. Open Library
 * backs it up in two distinct ways:
 *
 *  1. Google returns nothing, or errors → ask Open Library instead.
 *  2. Google finds the book but omits its page count → fill that one field from Open Library.
 *
 * Case 1 is the one that earns its keep, and not for the reason first assumed. Measured against a
 * sample of the books this family actually reads (Oxford Reading Tree, Project X, Zog, Horrid
 * Henry), authenticated Google Books has *good* coverage and supplies page counts — the coverage
 * worry was unfounded. What it does instead is fall over: 2 of 8 queries returned 503 in one run,
 * matching the intermittent failures that made search feel unreliable. fetchWithRetry absorbs most
 * of those; Open Library catches what's left, turning an outage into a slightly slower answer.
 *
 * The second case matters because a book with no page count that gets tracked by percent
 * contributes *nothing* to the family goal (see goal-progress.ts). It is deliberately restricted to
 * barcode scans, and the measurements above are why: the two sources report very different lengths
 * for the same title (222 vs 24 pages for a Biff & Chip book, 12 vs 26 for The Very Hungry
 * Caterpillar) because they describe different editions. An ISBN pins one physical book, so the
 * sources can be matched safely; a text search cannot, and guessing there would write confidently
 * wrong numbers into a shared goal. Text searches get the confirm card's page-count prompt instead.
 *
 * Every answer is cached (see db/lookup-cache.ts) — that's what keeps one shared API key viable
 * across many households, and what lets search keep working while an upstream is down.
 */
export async function searchBooks(rawQuery: string): Promise<BookSearchResult[]> {
	const key = normalizeLookupKey(rawQuery);
	const cached = getCachedLookup(key);
	if (cached) return cached.results;

	const google = await attempt(() => searchGoogleBooks(rawQuery));

	let results: BookSearchResult[];
	let source: string;

	if (google && google.length > 0) {
		results = google;
		source = 'google';

		const isScan = parseIsbnQuery(rawQuery) !== null;
		if (isScan && results[0].pageCount === null) {
			const fallback = await attempt(() => searchOpenLibrary(rawQuery));
			const withPages = fallback?.find((r) => r.pageCount !== null);
			if (withPages) {
				// Keep Google's title, author and cover — usually the better ones — and take only the
				// field it was missing.
				results = [{ ...results[0], pageCount: withPages.pageCount }, ...results.slice(1)];
				source = 'google+openlibrary';
			}
		}
	} else {
		const fallback = await attempt(() => searchOpenLibrary(rawQuery));
		if (fallback === null) {
			// Both sources failed. Don't cache that — a transient outage must not be remembered as
			// "this book doesn't exist" — and let the endpoint report a lookup failure.
			if (google === null) throw new Error('Both book lookup sources failed');
			results = [];
			source = 'google';
		} else {
			results = fallback;
			source = fallback.length > 0 ? 'openlibrary' : 'none';
		}
	}

	putCachedLookup(key, results, source);
	return results;
}
