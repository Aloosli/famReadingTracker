import { db } from './index';
import {
	FREEZE_WINDOW,
	MAX_STREAK_FREEZES,
	freezeThreshold,
	planFreezeConsumption,
	sittingAdvancements,
	type SittingSession
} from '../streak';

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
	const row = db.prepare(`SELECT COUNT(*) AS n FROM freeze_bank WHERE user_id = ?`).get(userId) as {
		n: number;
	};
	return row.n;
}

/** The "YYYY-MM-DD" each banked freeze was earned, oldest first — for the no-retroactive rule. */
function getFreezeEarnedDays(userId: number): string[] {
	return (
		db
			.prepare(`SELECT date(earned_at) AS d FROM freeze_bank WHERE user_id = ? ORDER BY earned_at`)
			.all(userId) as { d: string }[]
	).map((r) => r.d);
}

/**
 * Lazily spends banked freezes to protect recent missed days, keeping the streak alive. Called when
 * a reader loads their shelf: if they came back after missing a day (or two) and have freezes that
 * were banked before those days, this bridges the gap. Idempotent — a bridged day is recorded, so it
 * won't be paid for twice. Returns how many freezes were just spent (0 if none were needed/eligible).
 */
export function maintainStreakFreezes(userId: number, now: Date = new Date()): { consumed: number } {
	const earnedDays = getFreezeEarnedDays(userId);
	if (earnedDays.length === 0) return { consumed: 0 };

	const active = getActivityDays(userId);
	for (const day of getFrozenDays(userId)) active.add(day);

	const toFreeze = planFreezeConsumption(active, earnedDays, now);
	if (toFreeze.length === 0) return { consumed: 0 };

	const insertDay = db.prepare(`INSERT OR IGNORE INTO streak_freeze_days (user_id, date) VALUES (?, ?)`);
	// Spend the oldest banked freezes (the ones eligible for these days).
	const spend = db.prepare(
		`DELETE FROM freeze_bank WHERE id IN (
			SELECT id FROM freeze_bank WHERE user_id = ? ORDER BY earned_at LIMIT ?
		)`
	);
	db.transaction(() => {
		for (const day of toFreeze) insertDay.run(userId, day);
		spend.run(userId, toFreeze.length);
	})();
	return { consumed: toFreeze.length };
}

/**
 * Awards a streak freeze when the reader's most recent sitting beat their own rolling pace — the
 * pages advanced in this log clear `freezeThreshold` of their recent sittings (see streak.ts).
 * Per-profile, capped at MAX_STREAK_FREEZES. Call right after saving a progress log. Returns whether
 * one was earned and the new balance.
 */
export function awardFreezeForBigLog(userId: number): { earned: boolean; freezes: number } {
	const current = getStreakFreezes(userId);
	if (current >= MAX_STREAK_FREEZES) return { earned: false, freezes: current };

	// Every session chronologically, so per-book advancement (and the just-saved sitting, last) is
	// computed against the furthest point reached before it.
	const sessions = db
		.prepare(
			`SELECT rs.book_id, rs.position, rs.position_type, b.page_count
			 FROM reading_sessions rs JOIN books b ON b.id = rs.book_id
			 WHERE rs.user_id = ? ORDER BY rs.created_at, rs.id`
		)
		.all(userId) as SittingSession[];

	const advances = sittingAdvancements(sessions);
	const thisSitting = advances[advances.length - 1];
	if (thisSitting == null) return { earned: false, freezes: current }; // couldn't be measured

	// Baseline = the reader's prior measurable sittings (this one excluded), last FREEZE_WINDOW of them.
	const baseline = advances
		.slice(0, -1)
		.filter((a): a is number => a != null)
		.slice(-FREEZE_WINDOW);

	if (thisSitting >= freezeThreshold(baseline)) {
		db.prepare(`INSERT INTO freeze_bank (user_id) VALUES (?)`).run(userId);
		return { earned: true, freezes: current + 1 };
	}
	return { earned: false, freezes: current };
}
