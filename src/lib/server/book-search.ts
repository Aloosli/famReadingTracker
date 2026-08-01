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
 * backs it up in two distinct ways, because Google fails in two distinct ways for the books this
 * app is actually used for (UK children's editions, picture books, school reading-scheme titles):
 *
 *  1. Google returns nothing at all → ask Open Library instead.
 *  2. Google finds the book but omits its page count → fill that one field from Open Library.
 *
 * The second case matters more than it looks. A book with no page count that gets tracked by
 * percent contributes *nothing* to the family goal (see goal-progress.ts), so the readers whose
 * books have the thinnest metadata — the youngest ones — would quietly under-count on a bar the
 * family shares. It's only done for barcode scans, where the ISBN names exactly one physical book
 * and the two sources can be matched with confidence; for a text search the reader is offered the
 * page-count prompt on the confirm card instead.
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
