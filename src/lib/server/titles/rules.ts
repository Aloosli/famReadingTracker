/**
 * Pure trigger rules for the hidden surprise-title system. These take plain reading-session data
 * and answer "does this pattern qualify?" — no database, no side effects — so they can be unit
 * tested in isolation. The engine wires them to real data and handles granting.
 *
 * All stored datetimes are UTC strings ("YYYY-MM-DD HH:MM:SS"), matching SQLite's datetime('now').
 */

export interface SessionLike {
	book_id: number;
	created_at: string;
}

export interface FinishedLike {
	started_at: string;
	finished_at: string | null;
	page_count: number | null;
	/** 1 when logged as already-read — started_at is a placeholder, not an observed start. */
	start_unknown?: number;
}

export interface SeasonWindow {
	start: [number, number];
	end: [number, number];
}

/** Parses a stored "YYYY-MM-DD HH:MM:SS" UTC datetime to epoch millis. */
export function toUtcMillis(datetimeStr: string): number {
	return Date.parse(`${datetimeStr.replace(' ', 'T')}Z`);
}

/**
 * True if at least `minCount` sessions fall within any `windowHours` span — a reading burst.
 * Assumes `sessions` is ordered oldest-first (as the DB returns them).
 */
export function hasBurstOfSessions(
	sessions: SessionLike[],
	minCount: number,
	windowHours: number
): boolean {
	if (sessions.length < minCount) return false;
	const windowMs = windowHours * 3_600_000;
	const times = sessions.map((s) => toUtcMillis(s.created_at));
	for (let i = 0; i <= times.length - minCount; i++) {
		if (times[i + minCount - 1] - times[i] <= windowMs) return true;
	}
	return false;
}

/** Consecutive days (ending today, UTC) on which the reader logged at least one session. */
export function consecutiveSessionDayStreak(sessions: SessionLike[], now: Date = new Date()): number {
	if (sessions.length === 0) return 0;
	const days = new Set(sessions.map((s) => s.created_at.slice(0, 10)));
	const todayStr = now.toISOString().slice(0, 10);
	let streak = 0;
	let cursor = Date.parse(`${todayStr}T00:00:00Z`);
	while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
		streak++;
		cursor -= 86_400_000;
	}
	return streak;
}

/** True if any single book has two sessions at least `minGapDays` apart — a return after a break. */
export function hasComebackGap(sessions: SessionLike[], minGapDays: number): boolean {
	const byBook = new Map<number, number[]>();
	for (const session of sessions) {
		const times = byBook.get(session.book_id) ?? [];
		times.push(toUtcMillis(session.created_at));
		byBook.set(session.book_id, times);
	}
	const minGapMs = minGapDays * 86_400_000;
	for (const times of byBook.values()) {
		times.sort((a, b) => a - b);
		for (let i = 1; i < times.length; i++) {
			if (times[i] - times[i - 1] >= minGapMs) return true;
		}
	}
	return false;
}

/** True if the reader logged on a Saturday and the very next day (its Sunday), UTC. */
export function hasWeekendPair(sessions: SessionLike[]): boolean {
	const saturdays = new Set<string>();
	const sundays = new Set<string>();
	for (const session of sessions) {
		const dateStr = session.created_at.slice(0, 10);
		const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
		if (weekday === 6) saturdays.add(dateStr);
		if (weekday === 0) sundays.add(dateStr);
	}
	for (const sat of saturdays) {
		const nextDay = new Date(Date.parse(`${sat}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
		if (sundays.has(nextDay)) return true;
	}
	return false;
}

/**
 * True if any book was finished on the same calendar day it was started — read in one sitting.
 *
 * Two kinds of entry are deliberately not "read in a day", because started_at records when a book
 * reached the shelf rather than when reading began:
 *  - logged as already-read (start_unknown), where the start was never observed at all;
 *  - finished less than `minMinutes` after being added, which is recording a book already read.
 */
export function hasSameDayFinish(finished: FinishedLike[], minMinutes: number): boolean {
	return finished.some((entry) => {
		if (entry.start_unknown || entry.finished_at == null) return false;
		if (entry.started_at.slice(0, 10) !== entry.finished_at.slice(0, 10)) return false;
		const elapsedMs = toUtcMillis(entry.finished_at) - toUtcMillis(entry.started_at);
		return elapsedMs >= minMinutes * 60_000;
	});
}

/**
 * True if two books were finished within `windowDays` of each other — a back-to-back double bill.
 * (Same-day finishes are a subset, so they still qualify.)
 */
export function hasTwoFinishesWithinDays(finished: FinishedLike[], windowDays: number): boolean {
	const times = finished
		.filter((entry) => entry.finished_at != null)
		.map((entry) => toUtcMillis(entry.finished_at as string))
		.sort((a, b) => a - b);
	const windowMs = windowDays * 86_400_000;
	for (let i = 1; i < times.length; i++) {
		if (times[i] - times[i - 1] <= windowMs) return true;
	}
	return false;
}

/** Total pages across all finished books (books without a page count contribute nothing). */
export function totalFinishedPages(finished: FinishedLike[]): number {
	return finished.reduce((sum, entry) => sum + (entry.page_count ?? 0), 0);
}

/**
 * True if any session's UTC hour falls in the half-open window [startHour, endHour). When
 * startHour > endHour the window wraps past midnight (e.g. 22→5 covers late night into early hours).
 */
export function hasSessionInHourWindow(
	sessions: SessionLike[],
	startHour: number,
	endHour: number
): boolean {
	return sessions.some((session) => {
		const hour = Number(session.created_at.slice(11, 13));
		if (Number.isNaN(hour)) return false;
		return startHour <= endHour
			? hour >= startHour && hour < endHour
			: hour >= startHour || hour < endHour;
	});
}

/**
 * True if a stored datetime's month/day falls within a recurring [start, end] window.
 * Windows are assumed not to cross a year boundary (start <= end within the calendar year).
 */
export function dateInSeasonWindow(dateStr: string, window: SeasonWindow): boolean {
	const month = Number(dateStr.slice(5, 7));
	const day = Number(dateStr.slice(8, 10));
	if (!month || !day) return false;
	const value = month * 100 + day;
	const start = window.start[0] * 100 + window.start[1];
	const end = window.end[0] * 100 + window.end[1];
	return value >= start && value <= end;
}
