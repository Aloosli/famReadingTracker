import { db } from './index';
import { computeReadingStreak } from '../streak';
import { computePersonalBests, type PersonalBest } from '../personal-bests';
import type { PositionType, ReadingEntryRow } from './types';

export interface ReadingEntryWithBook extends ReadingEntryRow {
	title: string;
	author: string | null;
	cover_url: string | null;
	page_count: number | null;
	latest_position: number | null;
	latest_position_type: PositionType | null;
	latest_session_at: string | null;
}

/** Latest reading_sessions row per (user_id, book_id) — joined onto the currently-reading queries. */
const LATEST_SESSION_JOIN = `
	LEFT JOIN (
		SELECT rs.* FROM reading_sessions rs
		WHERE rs.id = (
			SELECT id FROM reading_sessions rs2
			WHERE rs2.user_id = rs.user_id AND rs2.book_id = rs.book_id
			ORDER BY rs2.created_at DESC, rs2.id DESC LIMIT 1
		)
	) ls ON ls.user_id = re.user_id AND ls.book_id = re.book_id
`;

export interface ReadingEntryWithBookAndUser extends ReadingEntryWithBook {
	user_name: string;
	user_avatar_emoji: string;
	user_avatar_color: string;
}



/**
 * Puts a book on a reader's currently-reading shelf. If it's already open (whether actively
 * reading or set aside), that same entry is reused rather than creating a duplicate — so adding
 * a book twice, starting one that's already in progress, or a double-tapped submit can never
 * split its progress across two cards. A set-aside book quietly returns to the active shelf.
 * (A book that was *finished* still starts a fresh entry — that's a genuine re-read.)
 */
export function startReading(userId: number, bookId: number): ReadingEntryRow {
	const existing = db
		.prepare(
			`SELECT * FROM reading_entries
			 WHERE user_id = ? AND book_id = ? AND status = 'reading'
			 LIMIT 1`
		)
		.get(userId, bookId) as ReadingEntryRow | undefined;

	if (existing) {
		if (existing.set_aside_at) {
			db.prepare(`UPDATE reading_entries SET set_aside_at = NULL WHERE id = ?`).run(existing.id);
			return db
				.prepare('SELECT * FROM reading_entries WHERE id = ?')
				.get(existing.id) as ReadingEntryRow;
		}
		return existing;
	}

	const result = db
		.prepare(
			`INSERT INTO reading_entries (user_id, book_id, status, started_at)
			 VALUES (?, ?, 'reading', datetime('now'))`
		)
		.run(userId, bookId);
	return db.prepare('SELECT * FROM reading_entries WHERE id = ?').get(result.lastInsertRowid) as ReadingEntryRow;
}

/** Removes a currently-reading entry outright (not a status change) — scoped to the owning user. */
export function removeEntry(entryId: number, userId: number): void {
	db.prepare(`DELETE FROM reading_entries WHERE id = ? AND user_id = ? AND status = 'reading'`).run(
		entryId,
		userId
	);
}

export function getCurrentlyReading(userId: number): ReadingEntryWithBook[] {
	return db
		.prepare(
			`SELECT re.*, b.title, b.author, b.cover_url, b.page_count,
			        ls.position as latest_position, ls.position_type as latest_position_type,
			        ls.created_at as latest_session_at
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 ${LATEST_SESSION_JOIN}
			 WHERE re.user_id = ? AND re.status = 'reading' AND re.set_aside_at IS NULL
			 ORDER BY re.started_at DESC`
		)
		.all(userId) as ReadingEntryWithBook[];
}

/** All of a user's finished entries with page_count, oldest first — used by the title engine. */
export function getFinishedEntries(userId: number): ReadingEntryWithBook[] {
	return db
		.prepare(
			`SELECT re.*, b.title, b.author, b.cover_url, b.page_count,
			        NULL as latest_position, NULL as latest_position_type
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 WHERE re.user_id = ? AND re.status = 'finished'
			 ORDER BY re.finished_at ASC`
		)
		.all(userId) as ReadingEntryWithBook[];
}

export type { PersonalBest };

/**
 * Records the reader beat their own record with the book they just finished — never compared
 * to anyone else. Returns celebration items (may be empty). Call right after finishEntry.
 */
export function personalBestsForFinish(userId: number, entryId: number): PersonalBest[] {
	return computePersonalBests(getFinishedEntries(userId), entryId);
}

export interface FinishedBook {
	id: number;
	book_id: number;
	title: string;
	author: string | null;
	cover_url: string | null;
	finished_at: string | null;
	reaction: 'loved' | 'liked' | 'meh' | null;
}

/** Every book a user has finished, newest first — the "look how much I've read" shelf. */
export function getFinishedShelf(userId: number): FinishedBook[] {
	return db
		.prepare(
			`SELECT re.id, re.book_id, b.title, b.author, b.cover_url, re.finished_at, re.reaction
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 WHERE re.user_id = ? AND re.status = 'finished'
			 ORDER BY re.finished_at DESC`
		)
		.all(userId) as FinishedBook[];
}

export interface FinishedYearBook {
	id: number;
	title: string;
	author: string | null;
	cover_url: string | null;
	page_count: number | null;
	finished_at: string;
	reaction: 'loved' | 'liked' | 'meh' | null;
}

/** A reader's finished books within a calendar year (UTC), newest first — powers the yearbook. */
export function getFinishedInYear(userId: number, year: string): FinishedYearBook[] {
	return db
		.prepare(
			`SELECT re.id, b.title, b.author, b.cover_url, b.page_count, re.finished_at, re.reaction
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 WHERE re.user_id = ? AND re.status = 'finished'
			   AND re.finished_at IS NOT NULL AND strftime('%Y', re.finished_at) = ?
			 ORDER BY re.finished_at DESC`
		)
		.all(userId, year) as FinishedYearBook[];
}

/** Records how a book felt when finished. Scoped to the owner and only on finished entries. */
export function setReaction(
	entryId: number,
	userId: number,
	reaction: 'loved' | 'liked' | 'meh' | null
): void {
	db.prepare(
		`UPDATE reading_entries SET reaction = ?
		 WHERE id = ? AND user_id = ? AND status = 'finished'`
	).run(reaction, entryId, userId);
}

export function getRecentlyFinished(userId: number, limit = 5): ReadingEntryWithBook[] {
	return db
		.prepare(
			`SELECT re.*, b.title, b.author, b.cover_url
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 WHERE re.user_id = ? AND re.status = 'finished'
			 ORDER BY re.finished_at DESC
			 LIMIT ?`
		)
		.all(userId, limit) as ReadingEntryWithBook[];
}

/** Marks an entry finished. Scoped to the owning user so one profile can't finish another's book. */
export function finishEntry(entryId: number, userId: number): void {
	db.prepare(
		`UPDATE reading_entries SET status = 'finished', finished_at = datetime('now')
		 WHERE id = ? AND user_id = ? AND status = 'reading'`
	).run(entryId, userId);
}

/** Reverses a finish — puts the book back to currently-reading and clears finished_at. */
export function unfinishEntry(entryId: number, userId: number): void {
	db.prepare(
		`UPDATE reading_entries SET status = 'reading', finished_at = NULL
		 WHERE id = ? AND user_id = ? AND status = 'finished'`
	).run(entryId, userId);
}

export interface SetAsideBook {
	id: number;
	book_id: number;
	title: string;
	author: string | null;
	cover_url: string | null;
	set_aside_at: string | null;
}

/** Pauses a currently-reading book — guilt-free, keeps its progress and history. */
export function setAsideEntry(entryId: number, userId: number): void {
	db.prepare(
		`UPDATE reading_entries SET set_aside_at = datetime('now')
		 WHERE id = ? AND user_id = ? AND status = 'reading' AND set_aside_at IS NULL`
	).run(entryId, userId);
}

/** Picks a set-aside book back up — it returns to the currently-reading shelf. */
export function resumeEntry(entryId: number, userId: number): void {
	db.prepare(
		`UPDATE reading_entries SET set_aside_at = NULL
		 WHERE id = ? AND user_id = ? AND status = 'reading'`
	).run(entryId, userId);
}

/** A reader's paused books, most recently set aside first. */
export function getSetAside(userId: number): SetAsideBook[] {
	return db
		.prepare(
			`SELECT re.id, re.book_id, b.title, b.author, b.cover_url, re.set_aside_at
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 WHERE re.user_id = ? AND re.status = 'reading' AND re.set_aside_at IS NOT NULL
			 ORDER BY re.set_aside_at DESC`
		)
		.all(userId) as SetAsideBook[];
}

export function countFinishedThisMonth(userId: number): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) as count FROM reading_entries
			 WHERE user_id = ? AND status = 'finished'
			 AND strftime('%Y-%m', finished_at) = strftime('%Y-%m', 'now')`
		)
		.get(userId) as { count: number };
	return row.count;
}

export function getFamilyCurrentlyReading(householdId: number): ReadingEntryWithBookAndUser[] {
	return db
		.prepare(
			`SELECT re.*, b.title, b.author, b.cover_url, b.page_count,
			        ls.position as latest_position, ls.position_type as latest_position_type,
			        ls.created_at as latest_session_at,
			        u.name as user_name, u.avatar_emoji as user_avatar_emoji, u.avatar_color as user_avatar_color
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 JOIN users u ON u.id = re.user_id
			 ${LATEST_SESSION_JOIN}
			 WHERE u.household_id = ? AND re.status = 'reading' AND re.set_aside_at IS NULL
			 ORDER BY u.id, re.started_at DESC`
		)
		.all(householdId) as ReadingEntryWithBookAndUser[];
}

export function getFamilyRecentlyFinished(
	householdId: number,
	limit = 10
): ReadingEntryWithBookAndUser[] {
	return db
		.prepare(
			`SELECT re.*, b.title, b.author, b.cover_url,
			        u.name as user_name, u.avatar_emoji as user_avatar_emoji, u.avatar_color as user_avatar_color
			 FROM reading_entries re
			 JOIN books b ON b.id = re.book_id
			 JOIN users u ON u.id = re.user_id
			 WHERE u.household_id = ? AND re.status = 'finished'
			 ORDER BY re.finished_at DESC
			 LIMIT ?`
		)
		.all(householdId, limit) as ReadingEntryWithBookAndUser[];
}

/**
 * Consecutive days the user actually read, ending today (UTC). A day counts only
 * when there's real activity that day: progress logged (a reading_sessions row) or a
 * book finished (finished_at). Merely having an unfinished book open does NOT count —
 * that would let a streak climb forever without reading.
 *
 * The streak stays "alive" through today: if the most recent active day is today or
 * yesterday, we count the run back from there; a full missed day breaks it. All dates
 * are UTC to match datetime('now') used elsewhere in the schema.
 */
export function getReadingStreak(userId: number): number {
	const sessionDays = db
		.prepare(`SELECT DISTINCT date(created_at) AS day FROM reading_sessions WHERE user_id = ?`)
		.all(userId) as { day: string }[];
	const finishDays = db
		.prepare(
			`SELECT DISTINCT date(finished_at) AS day FROM reading_entries
			 WHERE user_id = ? AND status = 'finished' AND finished_at IS NOT NULL`
		)
		.all(userId) as { day: string }[];

	const activeDays = new Set<string>();
	for (const row of sessionDays) activeDays.add(row.day);
	for (const row of finishDays) activeDays.add(row.day);

	return computeReadingStreak(activeDays);
}
