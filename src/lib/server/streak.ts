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
/** Pages advanced in a single log that count as "an impressive sitting" and earn a freeze. */
export const FREEZE_EARN_PAGES = 75;

/**
 * Works out which missed days a reader's banked freezes should protect to keep the streak alive,
 * walking back from yesterday. A freeze covers one missed day; we spend them on the most recent
 * gap first, and only commit if the bridge actually reconnects to a real active day — so freezes
 * are never wasted into a void (a gap longer than the freezes on hand just lets the streak break).
 * Returns the "YYYY-MM-DD" days to mark as frozen (empty if none needed or none can help).
 */
export function planFreezeConsumption(
	activeDays: Set<string>,
	freezesAvailable: number,
	now: Date = new Date()
): string[] {
	if (freezesAvailable <= 0) return [];
	const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
	const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	let budget = freezesAvailable;
	const toFreeze: string[] = [];
	let cursor = todayMs - 86_400_000; // yesterday — today is never "missed", it's still in progress
	while (budget > 0 && !activeDays.has(dayStr(cursor))) {
		toFreeze.push(dayStr(cursor));
		budget--;
		cursor -= 86_400_000;
	}
	// Only spend the freezes if we reached a genuinely active day (streak reconnects). If we ran out
	// of budget still on a missed day, the streak is broken anyway — don't burn freezes for nothing.
	if (!activeDays.has(dayStr(cursor))) return [];
	return toFreeze;
}
