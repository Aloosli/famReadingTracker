/**
 * Pure "pages read" maths for the family goal. Given one book's reading sessions, works out how
 * many pages a reader advanced *during the goal window* (read_at >= startedAt) — no database, so it
 * can be unit tested. The DB layer (db/goals.ts) groups sessions by book and sums across readers.
 *
 * Percent logs are converted to pages via the book's page count, so a %-tracked book counts the
 * same as a page-tracked one. A %-tracked book with no page count can't be converted and simply
 * contributes nothing (set its page count to fix that). Only forward movement counts — re-logging
 * the same page, or a plain "read today" check-in that carries the position over, adds zero.
 */

export interface SessionPos {
	position: number;
	position_type: 'page' | 'percent';
	/** UTC "YYYY-MM-DD HH:MM:SS" — lexical compare against startedAt is chronological. */
	read_at: string;
}

/** A session's absolute page, or null when it can't be expressed in pages (percent, no page count). */
function toAbsPage(s: SessionPos, pageCount: number | null): number | null {
	if (s.position_type === 'page') return s.position;
	return pageCount && pageCount > 0 ? Math.round((s.position / 100) * pageCount) : null;
}

/**
 * Pages advanced on one book during [startedAt, now). `sessions` must be ordered oldest-first.
 * The page reached just before the window is the baseline, so only reading done during the goal
 * counts. If the book was finished inside the window and its length is known, progress is counted
 * through to the end — otherwise finishing without a final log would lose the last stretch.
 */
export function pagesReadForBook(
	sessions: SessionPos[],
	pageCount: number | null,
	startedAt: string,
	finishedInWindow: boolean
): number {
	let baseline = 0;
	const windowSessions: SessionPos[] = [];
	for (const s of sessions) {
		const abs = toAbsPage(s, pageCount);
		if (s.read_at < startedAt) {
			if (abs != null) baseline = Math.max(baseline, abs);
		} else {
			windowSessions.push(s);
		}
	}

	let reached = baseline;
	let pages = 0;
	for (const s of windowSessions) {
		const abs = toAbsPage(s, pageCount);
		if (abs == null) continue;
		if (abs > reached) {
			pages += abs - reached;
			reached = abs;
		}
	}

	if (finishedInWindow && pageCount && pageCount > reached) {
		pages += pageCount - reached;
	}
	return pages;
}
