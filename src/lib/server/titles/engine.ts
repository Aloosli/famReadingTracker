import { getFinishedEntries } from '../db/entries';
import { getSessionsForUser } from '../db/sessions';
import { getTitle, grantTitle, holdsTitle, revokeTitle } from '../db/titles';
import type { TitleGrant } from '$lib/types';
import { THRESHOLDS, SEASONAL_WINDOWS } from './config';
import {
	consecutiveSessionDayStreak,
	dateInSeasonWindow,
	hasBurstOfSessions,
	hasComebackGap,
	hasTwoFinishesWithinDays,
	hasSameDayFinish,
	hasSessionInHourWindow,
	hasWeekendPair,
	totalFinishedPages
} from './rules';

function futureDatetime(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

// All patches are permanent collectibles now — a reader keeps every one they earn. tryGrant is
// still written generically (it honours is_temporary/duration_days from the catalog) so a temporary
// patch could be reintroduced later, but none are temporary today.
function tryGrant(userId: number, key: string, expiresAtOverride?: string | null): TitleGrant | null {
	if (holdsTitle(userId, key)) return null;
	const title = getTitle(key);
	if (!title) return null;
	const expiresAt =
		expiresAtOverride !== undefined
			? expiresAtOverride
			: title.is_temporary && title.duration_days
				? futureDatetime(title.duration_days)
				: null;
	grantTitle(userId, key, expiresAt);
	return { key: title.key, label: title.label, emoji: title.emoji, color: title.color };
}

/**
 * Runs every hidden trigger rule against a user's full history and grants any title that
 * newly qualifies. Idempotent — safe to call after every progress-save and every finish.
 */
export function evaluateTitles(userId: number): TitleGrant[] {
	const grants: TitleGrant[] = [];
	const sessions = getSessionsForUser(userId);
	const finished = getFinishedEntries(userId);

	// First finished book → "First of Many".
	if (finished.length >= 1) {
		const grant = tryGrant(userId, 'it_begins');
		if (grant) grants.push(grant);
	}
	// A stack of finished books → "Certified Bookworm".
	if (finished.length >= THRESHOLDS.certifiedBookwormBooks) {
		const grant = tryGrant(userId, 'certified_bookworm');
		if (grant) grants.push(grant);
	}

	// Two tiers of big book: a chunky read → "Big Book Energy", a full doorstop → "Tome Raider".
	if (finished.some((entry) => (entry.page_count ?? 0) >= THRESHOLDS.bigBookPages)) {
		const grant = tryGrant(userId, 'big_book');
		if (grant) grants.push(grant);
	}
	if (finished.some((entry) => (entry.page_count ?? 0) >= THRESHOLDS.longBookPages)) {
		const grant = tryGrant(userId, 'absolute_unit');
		if (grant) grants.push(grant);
	}

	const monthPrefix = new Date().toISOString().slice(0, 7);
	const finishedThisMonth = finished.filter((entry) => entry.finished_at?.slice(0, 7) === monthPrefix).length;
	if (finishedThisMonth >= THRESHOLDS.onARollBooksPerMonth) {
		const grant = tryGrant(userId, 'on_a_roll');
		if (grant) grants.push(grant);
	}

	if (hasBurstOfSessions(sessions, THRESHOLDS.speedDemonMinLogs, THRESHOLDS.speedDemonWindowHours)) {
		const grant = tryGrant(userId, 'speed_demon');
		if (grant) grants.push(grant);
	}

	if (consecutiveSessionDayStreak(sessions) >= THRESHOLDS.unstoppableDays) {
		const grant = tryGrant(userId, 'unstoppable');
		if (grant) grants.push(grant);
	}

	if (hasComebackGap(sessions, THRESHOLDS.comebackGapDays)) {
		const grant = tryGrant(userId, 'comeback_kid');
		if (grant) grants.push(grant);
	}

	if (hasWeekendPair(sessions)) {
		const grant = tryGrant(userId, 'weekend_warrior');
		if (grant) grants.push(grant);
	}

	// Read a whole book in a single day.
	if (hasSameDayFinish(finished, THRESHOLDS.sameDayFinishMinMinutes)) {
		const grant = tryGrant(userId, 'finisher');
		if (grant) grants.push(grant);
	}

	// Two books finished back-to-back (within a few days).
	if (hasTwoFinishesWithinDays(finished, THRESHOLDS.doubleFeatureWindowDays)) {
		const grant = tryGrant(userId, 'double_feature');
		if (grant) grants.push(grant);
	}

	// A long consecutive-day streak — the tier above Unstoppable.
	if (consecutiveSessionDayStreak(sessions) >= THRESHOLDS.ironStreakDays) {
		const grant = tryGrant(userId, 'iron_streak');
		if (grant) grants.push(grant);
	}

	// A small mountain of pages read across finished books.
	if (totalFinishedPages(finished) >= THRESHOLDS.pageMountainTotal) {
		const grant = tryGrant(userId, 'page_mountain');
		if (grant) grants.push(grant);
	}

	// Time-of-day readers (approximate — based on the stored UTC hour).
	if (hasSessionInHourWindow(sessions, THRESHOLDS.nightOwlStartHour, THRESHOLDS.nightOwlEndHour)) {
		const grant = tryGrant(userId, 'night_owl');
		if (grant) grants.push(grant);
	}
	if (hasSessionInHourWindow(sessions, THRESHOLDS.earlyBirdStartHour, THRESHOLDS.earlyBirdEndHour)) {
		const grant = tryGrant(userId, 'early_bird');
		if (grant) grants.push(grant);
	}

	// Seasonal patches: earned once, if any reading activity fell inside a season's window.
	const activityDates = [
		...sessions.map((s) => s.read_at),
		...finished.map((entry) => entry.finished_at).filter((d): d is string => d != null)
	];
	for (const [key, window] of Object.entries(SEASONAL_WINDOWS)) {
		if (activityDates.some((date) => dateInSeasonWindow(date, window))) {
			const grant = tryGrant(userId, key);
			if (grant) grants.push(grant);
		}
	}

	return grants;
}

/**
 * Called after un-finishing a book. Only the permanent finish-milestone titles are re-checked
 * and revoked when no longer supported — so a mis-tapped finish doesn't leave a badge behind
 * (and doesn't "spend" the surprise the next time it's earned for real). Temporary/session-based
 * titles are left alone: they're time-boxed and meant to persist through their window.
 */
export function revokeFinishDependentTitles(userId: number): void {
	const finished = getFinishedEntries(userId);
	const finishCount = finished.length;
	const hasBigBook = finished.some((entry) => (entry.page_count ?? 0) >= THRESHOLDS.bigBookPages);
	const hasLongBook = finished.some((entry) => (entry.page_count ?? 0) >= THRESHOLDS.longBookPages);

	if (finishCount < 1) {
		revokeTitle(userId, 'it_begins');
	}
	if (finishCount < THRESHOLDS.certifiedBookwormBooks) {
		revokeTitle(userId, 'certified_bookworm');
	}
	if (!hasBigBook) {
		revokeTitle(userId, 'big_book');
	}
	if (!hasLongBook) {
		revokeTitle(userId, 'absolute_unit');
	}
	if (!hasSameDayFinish(finished, THRESHOLDS.sameDayFinishMinMinutes)) {
		revokeTitle(userId, 'finisher');
	}
	if (!hasTwoFinishesWithinDays(finished, THRESHOLDS.doubleFeatureWindowDays)) {
		revokeTitle(userId, 'double_feature');
	}
	if (totalFinishedPages(finished) < THRESHOLDS.pageMountainTotal) {
		revokeTitle(userId, 'page_mountain');
	}
}
