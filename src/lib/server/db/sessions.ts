import { db } from './index';
import type { PositionType, ReadingSessionRow } from './types';

export function logProgress(
	userId: number,
	bookId: number,
	position: number,
	positionType: PositionType
): ReadingSessionRow {
	const result = db
		.prepare(
			`INSERT INTO reading_sessions (user_id, book_id, position, position_type, created_at)
			 VALUES (?, ?, ?, ?, datetime('now'))`
		)
		.run(userId, bookId, position, positionType);
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
		.prepare('SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY created_at ASC')
		.all(userId) as ReadingSessionRow[];
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
			 WHERE user_id = ? AND book_id = ? AND date(created_at) = date('now')
			 LIMIT 1`
		)
		.get(userId, bookId);
	if (alreadyToday) return { created: false };

	const latest = getLatestSession(userId, bookId);
	logProgress(userId, bookId, latest?.position ?? 0, latest?.position_type ?? 'percent');
	return { created: true };
}
