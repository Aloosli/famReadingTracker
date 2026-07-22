/**
 * Pure reading-streak calculation, split out from the DB query so it can be unit tested.
 *
 * A streak is the run of consecutive days (ending today or yesterday) on which the reader was
 * active — `activeDays` holds "YYYY-MM-DD" UTC strings for every day with a logged session or a
 * finished book. The streak stays alive through a one-day grace: if the most recent activity was
 * today OR yesterday we count back from there; a fully missed day breaks it.
 */
export function computeReadingStreak(activeDays: Set<string>, now: Date = new Date()): number {
	if (activeDays.size === 0) return 0;

	const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
	const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	// Anchor at today if there's activity today, otherwise yesterday (grace day).
	// If the last active day is older than that, the streak is already broken.
	let cursor: number;
	if (activeDays.has(dayStr(todayMs))) {
		cursor = todayMs;
	} else if (activeDays.has(dayStr(todayMs - 86_400_000))) {
		cursor = todayMs - 86_400_000;
	} else {
		return 0;
	}

	let streak = 0;
	while (activeDays.has(dayStr(cursor))) {
		streak++;
		cursor -= 86_400_000;
	}
	return streak;
}

/** Most freezes a reader can bank at once (Duolingo-style). */
export const MAX_STREAK_FREEZES = 2;

// --- Adaptive freeze threshold ---------------------------------------------------------------
// A freeze is earned by "beating your usual pace" rather than a flat page count, so it scales for a
// slim-book kid and a doorstop-reading adult alike. Each is per-profile — no sibling comparison.
/** Never earn on less than this many pages, even if a reader's baseline is tiny. */
export const FREEZE_FLOOR_PAGES = 12;
/** A sitting must beat the rolling median by this factor (higher = rarer freezes). */
export const FREEZE_MULTIPLIER = 1.6;
/** Rolling window of recent sittings the baseline is taken over. */
export const FREEZE_WINDOW = 10;
/** Below this many prior sittings, fall back to the flat floor (not enough history yet). */
export const FREEZE_COLD_START_MIN = 5;

export interface SittingSession {
	book_id: number;
	position: number;
	position_type: 'page' | 'percent';
	page_count: number | null;
}

/** Median of a list (outlier-resistant, unlike the mean). 0 for an empty list. */
export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pages advanced in each sitting, one entry per session in the given (chronological) order. A
 * session's advancement is its page position minus the furthest reached before it on the same book,
 * clamped at 0. Percent logs convert to pages via the book's page count; a percent log on a book with
 * no page count can't be measured and yields null (so it neither earns nor pollutes the baseline).
 */
export function sittingAdvancements(sessions: SittingSession[]): (number | null)[] {
	const furthest = new Map<number, number>();
	return sessions.map((s) => {
		const abs =
			s.position_type === 'page'
				? s.position
				: s.page_count && s.page_count > 0
					? Math.round((s.position / 100) * s.page_count)
					: null;
		if (abs == null) return null;
		const prev = furthest.get(s.book_id) ?? 0;
		furthest.set(s.book_id, Math.max(prev, abs));
		return Math.max(0, abs - prev);
	});
}

/**
 * The pages a sitting must reach to earn a freeze, given the reader's recent sitting sizes (their
 * rolling baseline, excluding the current sitting). Under `FREEZE_COLD_START_MIN` sittings of history
 * there isn't enough to personalise, so the flat floor applies; otherwise it's the floor or 1.6× the
 * median, whichever is higher. The bar rises naturally as a reader's stamina grows.
 */
export function freezeThreshold(recentSittingPages: number[]): number {
	if (recentSittingPages.length < FREEZE_COLD_START_MIN) return FREEZE_FLOOR_PAGES;
	return Math.max(FREEZE_FLOOR_PAGES, Math.round(FREEZE_MULTIPLIER * median(recentSittingPages)));
}

/**
 * Works out which missed days a reader's banked freezes should protect to keep the streak alive,
 * walking back from yesterday. Each freeze covers one missed day, but only a day that was missed
 * *after* the freeze was banked — a freeze earned today can't reach back and save yesterday (no
 * retroactive protection). We only commit if every day in the gap can be covered and the bridge
 * reconnects to a real active day, so freezes are never wasted into a void. `freezeEarnedDays` is
 * the "YYYY-MM-DD" a each banked freeze was earned. Returns the days to mark frozen (empty if none).
 */
export function planFreezeConsumption(
	activeDays: Set<string>,
	freezeEarnedDays: string[],
	now: Date = new Date()
): string[] {
	if (freezeEarnedDays.length === 0) return [];
	const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
	const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	// Collect the run of missed days back from yesterday, up to the number of freezes on hand.
	const gap: string[] = [];
	let cursor = todayMs - 86_400_000; // yesterday — today is never "missed", it's still in progress
	while (gap.length < freezeEarnedDays.length && !activeDays.has(dayStr(cursor))) {
		gap.push(dayStr(cursor));
		cursor -= 86_400_000;
	}
	if (gap.length === 0) return []; // yesterday already active — nothing to bridge
	if (!activeDays.has(dayStr(cursor))) return []; // couldn't reconnect within the freezes on hand

	// Each missed day needs a distinct freeze that was already banked before it. Assign oldest freeze
	// to oldest day; if any day can't be covered, the streak can't be revived here — bridge nothing.
	const daysOldestFirst = [...gap].sort();
	const freezesOldestFirst = [...freezeEarnedDays].sort();
	const used = new Array(freezesOldestFirst.length).fill(false);
	for (const day of daysOldestFirst) {
		let assigned = false;
		for (let i = 0; i < freezesOldestFirst.length; i++) {
			if (!used[i] && freezesOldestFirst[i] < day) {
				used[i] = true;
				assigned = true;
				break;
			}
		}
		if (!assigned) return [];
	}
	return gap;
}
