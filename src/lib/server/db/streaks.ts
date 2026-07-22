import { db } from './index';
import { FREEZE_EARN_PAGES, MAX_STREAK_FREEZES, planFreezeConsumption } from '../streak';

/**
 * Every day a reader was genuinely active — a logged reading session (by when the reading happened,
 * read_at) or a finished book. These feed the streak calc alongside any frozen days.
 */
export function getActivityDays(userId: number): Set<string> {
	const days = new Set<string>();
	for (const row of db
		.prepare(`SELECT DISTINCT date(read_at) AS day FROM reading_sessions WHERE user_id = ?`)
		.all(userId) as { day: string }[]) {
		days.add(row.day);
	}
	for (const row of db
		.prepare(
			`SELECT DISTINCT date(finished_at) AS day FROM reading_entries
			 WHERE user_id = ? AND status = 'finished' AND finished_at IS NOT NULL`
		)
		.all(userId) as { day: string }[]) {
		days.add(row.day);
	}
	return days;
}

/** Days previously kept alive by spending a freeze — they count as active in the streak calc. */
export function getFrozenDays(userId: number): Set<string> {
	return new Set(
		(db.prepare(`SELECT date FROM streak_freeze_days WHERE user_id = ?`).all(userId) as {
			date: string;
		}[]).map((r) => r.date)
	);
}

/** A reader's banked (unspent) streak-freeze balance. */
export function getStreakFreezes(userId: number): number {
	const row = db.prepare(`SELECT streak_freezes FROM users WHERE id = ?`).get(userId) as
		| { streak_freezes: number }
		| undefined;
	return row?.streak_freezes ?? 0;
}

/**
 * Lazily spends banked freezes to protect recent missed days, keeping the streak alive. Called when
 * a reader loads their shelf: if they came back after missing a day (or two) and have freezes, this
 * bridges the gap. Idempotent — a bridged day is recorded, so it won't be paid for twice. Returns
 * how many freezes were just spent (0 if none were needed or none could help).
 */
export function maintainStreakFreezes(userId: number, now: Date = new Date()): { consumed: number } {
	const freezes = getStreakFreezes(userId);
	if (freezes <= 0) return { consumed: 0 };

	const active = getActivityDays(userId);
	for (const day of getFrozenDays(userId)) active.add(day);

	const toFreeze = planFreezeConsumption(active, freezes, now);
	if (toFreeze.length === 0) return { consumed: 0 };

	const insert = db.prepare(
		`INSERT OR IGNORE INTO streak_freeze_days (user_id, date) VALUES (?, ?)`
	);
	db.transaction(() => {
		for (const day of toFreeze) insert.run(userId, day);
		db.prepare(`UPDATE users SET streak_freezes = streak_freezes - ? WHERE id = ?`).run(
			toFreeze.length,
			userId
		);
	})();
	return { consumed: toFreeze.length };
}

/**
 * Awards a streak freeze when the reader's most recent log advanced them by an impressive number of
 * pages in one sitting (>= FREEZE_EARN_PAGES), capped at MAX_STREAK_FREEZES. Call right after saving
 * a progress log. Percent logs convert to pages via the book's page count; a book without one can't
 * be judged and never earns. Returns whether one was earned and the new balance.
 */
export function awardFreezeForBigLog(
	userId: number,
	bookId: number
): { earned: boolean; freezes: number } {
	const rows = db
		.prepare(
			`SELECT rs.position, rs.position_type, b.page_count
			 FROM reading_sessions rs JOIN books b ON b.id = rs.book_id
			 WHERE rs.user_id = ? AND rs.book_id = ?
			 ORDER BY rs.created_at DESC, rs.id DESC LIMIT 2`
		)
		.all(userId, bookId) as { position: number; position_type: string; page_count: number | null }[];

	const current = getStreakFreezes(userId);
	if (rows.length === 0) return { earned: false, freezes: current };

	const toPages = (r: { position: number; position_type: string; page_count: number | null }) =>
		r.position_type === 'page'
			? r.position
			: r.page_count && r.page_count > 0
				? Math.round((r.position / 100) * r.page_count)
				: null;

	const nowPages = toPages(rows[0]);
	const prevPages = rows[1] ? toPages(rows[1]) : 0;
	if (nowPages == null || prevPages == null) return { earned: false, freezes: current };

	const advanced = nowPages - prevPages;
	if (advanced >= FREEZE_EARN_PAGES && current < MAX_STREAK_FREEZES) {
		db.prepare(`UPDATE users SET streak_freezes = streak_freezes + 1 WHERE id = ?`).run(userId);
		return { earned: true, freezes: current + 1 };
	}
	return { earned: false, freezes: current };
}
