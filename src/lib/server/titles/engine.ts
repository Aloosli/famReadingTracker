import { getFinishedEntries } from '../db/entries';
import { getSessionsForUser } from '../db/sessions';
import { getTitle, grantTitle, holdsTitle, lastEarnedAt, revokeTitle } from '../db/titles';
import type { TitleGrant } from '$lib/types';
import { THRESHOLDS, SEASONAL_WINDOWS } from './config';
import {
	consecutiveSessionDayStreak,
	dateInSeasonWindow,
	hasComebackGap,
	hasTwoFinishesWithinDays,
	hasSameDayFinish,
	hasSessionInHourWindow,
	latestSessionBurstEnd,
	latestWeekendPairSunday,
	totalFinishedPages
} from './rules';

function futureDatetime(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

function endOfMonthDatetime(): string {
	const now = new Date();
	const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1000);
	return end.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Grants a temporary, event-based title only when the triggering event is NEWER than the last time
 * it was earned. The pattern behind these (a weekend read, a burst of logs) stays true in history
 * forever, so without this check the badge would silently re-grant every time it expired and the
 * reader logged again — e.g. earning Weekend Warrior on a random Wednesday. A genuinely new event
 * (next weekend, a fresh burst) is later than the last grant and still re-earns it.
 *
 * `eventStamp` is compared at its own granularity: a date ("YYYY-MM-DD") against the last-earned
 * date, a full datetime against the full last-earned time — hence slicing the stored time to match.
 */
function grantForNewerEvent(
	userId: number,
	key: string,
	eventStamp: string | null,
	grants: TitleGrant[]
): void {
	if (!eventStamp) return;
	const last = lastEarnedAt(userId, key);
	if (last && eventStamp <= last.slice(0, eventStamp.length)) return;
	const grant = tryGrant(userId, key);
	if (grant) grants.push(grant);
}

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
		const grant = tryGrant(userId, 'on_a_roll', endOfMonthDatetime());
		if (grant) grants.push(grant);
	}

	// Speed Demon: a burst of logs in a short window. Event-based temporary title — only (re)grant
	// when the burst is newer than the last grant, so an old burst doesn't re-earn it after it lapses.
	grantForNewerEvent(
		userId,
		'speed_demon',
		latestSessionBurstEnd(sessions, THRESHOLDS.speedDemonMinLogs, THRESHOLDS.speedDemonWindowHours),
		grants
	);

	if (consecutiveSessionDayStreak(sessions) >= THRESHOLDS.unstoppableDays) {
		const grant = tryGrant(userId, 'unstoppable');
		if (grant) grants.push(grant);
	}

	if (hasComebackGap(sessions, THRESHOLDS.comebackGapDays)) {
		const grant = tryGrant(userId, 'comeback_kid');
		if (grant) grants.push(grant);
	}

	// Weekend Warrior: read a Saturday and its Sunday. Event-based temporary title — gated on the
	// weekend being newer than the last grant, so a past weekend can't re-earn it mid-week.
	grantForNewerEvent(userId, 'weekend_warrior', latestWeekendPairSunday(sessions), grants);

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
