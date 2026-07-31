import { db } from './index';
import type { PositionType, ReadingSessionRow } from './types';

/**
 * Records a progress log. `readAt` is when the reading actually happened, as a UTC
 * "YYYY-MM-DD HH:MM:SS" string — pass it for after-the-fact logs; omit it for a live log, where
 * the reading time is now. created_at is always now regardless, so the row still orders by when
 * it was recorded (the most recent record wins as the reader's current position).
 */
export function logProgress(
	userId: number,
	bookId: number,
	position: number,
	positionType: PositionType,
	readAt?: string
): ReadingSessionRow {
	const result = db
		.prepare(
			`INSERT INTO reading_sessions (user_id, book_id, position, position_type, read_at, created_at)
			 VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
		)
		.run(userId, bookId, position, positionType, readAt ?? null);
	return db
		.prepare('SELECT * FROM reading_sessions WHERE id = ?')
		.get(result.lastInsertRowid) as ReadingSessionRow;
}

export function getLatestSession(userId: number, bookId: number): ReadingSessionRow | undefined {
	return db
		.prepare(
			`SELECT * FROM reading_sessions
			 WHERE user_id = ? AND book_id = ?
			 ORDER BY created_at DESC, id DESC
			 LIMIT 1`
		)
		.get(userId, bookId) as ReadingSessionRow | undefined;
}

export function getSessionsForUser(userId: number): ReadingSessionRow[] {
	return db
		.prepare('SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY read_at ASC, id ASC')
		.all(userId) as ReadingSessionRow[];
}

/**
 * A reader's most recent sittings for one book, newest first — the "what have I logged?" list that
 * backs correcting a typo. Ordered by created_at (like getLatestSession) so the first row is always
 * the one currently driving the energy bar, even if an older reading date was filled in afterwards.
 */
export function getRecentSessionsForBook(
	userId: number,
	bookId: number,
	limit = 8
): ReadingSessionRow[] {
	return db
		.prepare(
			`SELECT * FROM reading_sessions
			 WHERE user_id = ? AND book_id = ?
			 ORDER BY created_at DESC, id DESC
			 LIMIT ?`
		)
		.all(userId, bookId, limit) as ReadingSessionRow[];
}

/**
 * Corrects a logged sitting in place. Scoped by user_id so one reader can only ever edit their own
 * history. created_at is deliberately left alone — it's the audit/order key, and rewriting it would
 * reshuffle which log counts as the reader's current position. Returns false if nothing matched.
 */
export function updateSession(
	sessionId: number,
	userId: number,
	position: number,
	readAt?: string
): boolean {
	const result = db
		.prepare(
			`UPDATE reading_sessions
			 SET position = ?, read_at = COALESCE(?, read_at)
			 WHERE id = ? AND user_id = ?`
		)
		.run(position, readAt ?? null, sessionId, userId);
	return result.changes > 0;
}

/** Removes a logged sitting. Scoped by user_id; returns false if it wasn't theirs (or is gone). */
export function deleteSession(sessionId: number, userId: number): boolean {
	const result = db
		.prepare('DELETE FROM reading_sessions WHERE id = ? AND user_id = ?')
		.run(sessionId, userId);
	return result.changes > 0;
}

/**
 * Records that a reader picked this book up today, without asking for a page/percent.
 * Carries the last known position forward so the energy bar doesn't move — the point is
 * to keep the streak alive, not to claim new progress. No-ops if today is already logged
 * for this book (so tapping twice, or after a real progress log, can't be gamed).
 */
export function checkInToday(userId: number, bookId: number): { created: boolean } {
	const alreadyToday = db
		.prepare(
			`SELECT 1 FROM reading_sessions
			 WHERE user_id = ? AND book_id = ? AND date(read_at) = date('now')
			 LIMIT 1`
		)
		.get(userId, bookId);
	if (alreadyToday) return { created: false };

	const latest = getLatestSession(userId, bookId);
	logProgress(userId, bookId, latest?.position ?? 0, latest?.position_type ?? 'percent');
	return { created: true };
}
