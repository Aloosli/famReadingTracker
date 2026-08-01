import { db } from './index';
import type { BookSearchResult } from '$lib/types';

/**
 * How long a cached answer stays good. Book metadata barely changes, so a hit can sit for a month.
 * A *miss* is cached far more briefly: "no results" is often a temporary gap that fills in when a
 * source indexes the book, and a reader who tries again next week deserves a fresh look rather than
 * a month-old shrug.
 */
const HIT_TTL_HOURS = 24 * 30;
const MISS_TTL_HOURS = 6;

export interface CachedLookup {
	results: BookSearchResult[];
	source: string;
}

/**
 * A previous answer for this query, if one is still fresh. Returns undefined on a miss so the
 * caller can tell "nothing cached" from "cached, and the answer was no results".
 */
export function getCachedLookup(queryKey: string): CachedLookup | undefined {
	const row = db
		.prepare('SELECT results_json, source, fetched_at FROM book_lookup_cache WHERE query_key = ?')
		.get(queryKey) as { results_json: string; source: string; fetched_at: string } | undefined;
	if (!row) return undefined;

	let results: BookSearchResult[];
	try {
		results = JSON.parse(row.results_json) as BookSearchResult[];
	} catch {
		// A corrupt row is not worth crashing a search over — drop it and let the caller refetch.
		db.prepare('DELETE FROM book_lookup_cache WHERE query_key = ?').run(queryKey);
		return undefined;
	}

	const ttlHours = results.length > 0 ? HIT_TTL_HOURS : MISS_TTL_HOURS;
	const expired = (db.prepare(`SELECT datetime(?, ?) <= datetime('now') AS expired`).get(
		row.fetched_at,
		`+${ttlHours} hours`
	) as { expired: number }).expired;
	if (expired) return undefined;

	return { results, source: row.source };
}

/** Records an answer, replacing any previous one for the same query. */
export function putCachedLookup(queryKey: string, results: BookSearchResult[], source: string): void {
	db.prepare(
		`INSERT INTO book_lookup_cache (query_key, results_json, source, fetched_at)
		 VALUES (?, ?, ?, datetime('now'))
		 ON CONFLICT (query_key) DO UPDATE SET
		   results_json = excluded.results_json,
		   source = excluded.source,
		   fetched_at = excluded.fetched_at`
	).run(queryKey, JSON.stringify(results), source);
}

/**
 * Drops entries older than the longest TTL. Nothing depends on this running — an expired row is
 * already ignored on read — it just stops the table growing without bound.
 */
export function pruneLookupCache(): void {
	db.prepare(
		`DELETE FROM book_lookup_cache WHERE datetime(fetched_at, ?) <= datetime('now')`
	).run(`+${HIT_TTL_HOURS} hours`);
}
