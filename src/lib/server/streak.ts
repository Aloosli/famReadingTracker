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
