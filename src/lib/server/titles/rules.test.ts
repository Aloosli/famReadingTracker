import { describe, it, expect } from 'vitest';
import {
	consecutiveSessionDayStreak,
	dateInSeasonWindow,
	hasBurstOfSessions,
	hasComebackGap,
	hasTwoFinishesWithinDays,
	hasSameDayFinish,
	hasSessionInHourWindow,
	hasWeekendPair,
	totalFinishedPages,
	toUtcMillis,
	type FinishedLike,
	type SessionLike
} from './rules';

/** Helper: a session on a given UTC day/time for a book. */
function session(book_id: number, created_at: string): SessionLike {
	return { book_id, created_at };
}

function finishedBook(
	started_at: string,
	finished_at: string | null,
	page_count: number | null = null
): FinishedLike {
	return { started_at, finished_at, page_count };
}

describe('toUtcMillis', () => {
	it('parses a stored SQLite datetime as UTC', () => {
		expect(toUtcMillis('2026-07-10 12:00:00')).toBe(Date.parse('2026-07-10T12:00:00Z'));
	});
});

describe('hasBurstOfSessions', () => {
	it('is false with fewer sessions than required', () => {
		expect(hasBurstOfSessions([session(1, '2026-07-10 09:00:00')], 3, 24)).toBe(false);
	});

	it('is true when enough sessions fall inside the window', () => {
		const sessions = [
			session(1, '2026-07-10 09:00:00'),
			session(1, '2026-07-10 12:00:00'),
			session(1, '2026-07-10 20:00:00')
		];
		expect(hasBurstOfSessions(sessions, 3, 24)).toBe(true);
	});

	it('is false when the same count is spread beyond the window', () => {
		const sessions = [
			session(1, '2026-07-10 09:00:00'),
			session(1, '2026-07-11 12:00:00'),
			session(1, '2026-07-13 20:00:00')
		];
		expect(hasBurstOfSessions(sessions, 3, 24)).toBe(false);
	});

	it('finds a qualifying burst that starts later in the list', () => {
		const sessions = [
			session(1, '2026-07-01 09:00:00'),
			session(1, '2026-07-10 09:00:00'),
			session(1, '2026-07-10 10:00:00'),
			session(1, '2026-07-10 11:00:00')
		];
		expect(hasBurstOfSessions(sessions, 3, 6)).toBe(true);
	});
});

describe('consecutiveSessionDayStreak', () => {
	const now = new Date('2026-07-10T18:00:00Z');

	it('is 0 with no sessions', () => {
		expect(consecutiveSessionDayStreak([], now)).toBe(0);
	});

	it('counts back over consecutive days ending today', () => {
		const sessions = [
			session(1, '2026-07-08 20:00:00'),
			session(1, '2026-07-09 20:00:00'),
			session(1, '2026-07-10 08:00:00')
		];
		expect(consecutiveSessionDayStreak(sessions, now)).toBe(3);
	});

	it('breaks the streak on a missed day', () => {
		const sessions = [
			session(1, '2026-07-08 20:00:00'),
			session(1, '2026-07-10 08:00:00') // gap on the 9th
		];
		expect(consecutiveSessionDayStreak(sessions, now)).toBe(1);
	});

	it('is 0 when the most recent activity was before today', () => {
		// This helper anchors strictly at today (the DB streak adds the grace day separately).
		expect(consecutiveSessionDayStreak([session(1, '2026-07-09 20:00:00')], now)).toBe(0);
	});
});

describe('hasComebackGap', () => {
	it('is true when one book has two sessions far enough apart', () => {
		const sessions = [
			session(7, '2026-01-01 10:00:00'),
			session(7, '2026-03-01 10:00:00')
		];
		expect(hasComebackGap(sessions, 30)).toBe(true);
	});

	it('is false when the gap is under the threshold', () => {
		const sessions = [
			session(7, '2026-01-01 10:00:00'),
			session(7, '2026-01-10 10:00:00')
		];
		expect(hasComebackGap(sessions, 30)).toBe(false);
	});

	it('does not count a gap across two different books', () => {
		const sessions = [
			session(1, '2026-01-01 10:00:00'),
			session(2, '2026-06-01 10:00:00')
		];
		expect(hasComebackGap(sessions, 30)).toBe(false);
	});
});

describe('hasWeekendPair', () => {
	it('is true for a Saturday followed by its Sunday', () => {
		// 2026-07-11 is a Saturday, 2026-07-12 the Sunday.
		const sessions = [
			session(1, '2026-07-11 10:00:00'),
			session(1, '2026-07-12 10:00:00')
		];
		expect(hasWeekendPair(sessions)).toBe(true);
	});

	it('is false for a Saturday alone', () => {
		expect(hasWeekendPair([session(1, '2026-07-11 10:00:00')])).toBe(false);
	});

	it('is false for a Sunday not preceded by its Saturday', () => {
		expect(hasWeekendPair([session(1, '2026-07-12 10:00:00')])).toBe(false);
	});
});

describe('hasSameDayFinish', () => {
	const MIN_MINUTES = 5;

	it('is true when a book is finished the day it was started', () => {
		expect(
			hasSameDayFinish([finishedBook('2026-07-10 09:00:00', '2026-07-10 21:00:00')], MIN_MINUTES)
		).toBe(true);
	});

	it('is false when start and finish are different days', () => {
		expect(
			hasSameDayFinish([finishedBook('2026-07-08 09:00:00', '2026-07-10 21:00:00')], MIN_MINUTES)
		).toBe(false);
	});

	it('ignores books that are not finished', () => {
		expect(hasSameDayFinish([finishedBook('2026-07-10 09:00:00', null)], MIN_MINUTES)).toBe(false);
	});

	it('ignores books logged as already-read, whose start date was never observed', () => {
		const loggedAsRead: FinishedLike = {
			...finishedBook('2026-07-10 09:00:00', '2026-07-10 09:00:00'),
			start_unknown: 1
		};
		expect(hasSameDayFinish([loggedAsRead], MIN_MINUTES)).toBe(false);
	});

	it('ignores a book marked finished seconds after it was added — that is logging, not reading', () => {
		expect(
			hasSameDayFinish([finishedBook('2026-07-16 08:47:13', '2026-07-16 08:47:21')], MIN_MINUTES)
		).toBe(false);
	});

	it('counts a finish once the minimum time has passed', () => {
		expect(
			hasSameDayFinish([finishedBook('2026-07-10 09:00:00', '2026-07-10 09:05:00')], MIN_MINUTES)
		).toBe(true);
	});
});

describe('hasTwoFinishesWithinDays', () => {
	it('is true when two books are finished within the window (a couple of days apart)', () => {
		const finished = [
			finishedBook('2026-07-01 09:00:00', '2026-07-10 12:00:00'),
			finishedBook('2026-07-05 09:00:00', '2026-07-12 20:00:00')
		];
		expect(hasTwoFinishesWithinDays(finished, 3)).toBe(true);
	});

	it('is true for two books finished on the same day (a subset of the window)', () => {
		const finished = [
			finishedBook('2026-07-01 09:00:00', '2026-07-10 09:00:00'),
			finishedBook('2026-07-05 09:00:00', '2026-07-10 20:00:00')
		];
		expect(hasTwoFinishesWithinDays(finished, 3)).toBe(true);
	});

	it('is false when the two finishes are further apart than the window', () => {
		const finished = [
			finishedBook('2026-07-01 09:00:00', '2026-07-10 12:00:00'),
			finishedBook('2026-07-05 09:00:00', '2026-07-20 20:00:00')
		];
		expect(hasTwoFinishesWithinDays(finished, 3)).toBe(false);
	});

	it('is false with fewer than two finishes', () => {
		expect(
			hasTwoFinishesWithinDays([finishedBook('2026-07-01 09:00:00', '2026-07-10 12:00:00')], 3)
		).toBe(false);
	});
});

describe('totalFinishedPages', () => {
	it('sums page counts and treats missing counts as zero', () => {
		const finished = [
			finishedBook('2026-07-01 09:00:00', '2026-07-02 09:00:00', 300),
			finishedBook('2026-07-03 09:00:00', '2026-07-04 09:00:00', null),
			finishedBook('2026-07-05 09:00:00', '2026-07-06 09:00:00', 250)
		];
		expect(totalFinishedPages(finished)).toBe(550);
	});

	it('is 0 with no finished books', () => {
		expect(totalFinishedPages([])).toBe(0);
	});
});

describe('hasSessionInHourWindow', () => {
	it('matches a session inside a daytime window [5, 8)', () => {
		expect(hasSessionInHourWindow([session(1, '2026-07-10 06:30:00')], 5, 8)).toBe(true);
	});

	it('excludes the exclusive end hour', () => {
		expect(hasSessionInHourWindow([session(1, '2026-07-10 08:00:00')], 5, 8)).toBe(false);
	});

	it('matches a late-night session in a wrapping window [22, 5)', () => {
		expect(hasSessionInHourWindow([session(1, '2026-07-10 23:30:00')], 22, 5)).toBe(true);
		expect(hasSessionInHourWindow([session(1, '2026-07-10 02:00:00')], 22, 5)).toBe(true);
	});

	it('excludes daytime from a wrapping night window', () => {
		expect(hasSessionInHourWindow([session(1, '2026-07-10 14:00:00')], 22, 5)).toBe(false);
	});
});

describe('dateInSeasonWindow', () => {
	const october = { start: [10, 1] as [number, number], end: [10, 31] as [number, number] };

	it('is true inside the window and on its boundaries', () => {
		expect(dateInSeasonWindow('2026-10-01 09:00:00', october)).toBe(true);
		expect(dateInSeasonWindow('2026-10-15 09:00:00', october)).toBe(true);
		expect(dateInSeasonWindow('2026-10-31 23:00:00', october)).toBe(true);
	});

	it('is false just outside the window', () => {
		expect(dateInSeasonWindow('2026-09-30 09:00:00', october)).toBe(false);
		expect(dateInSeasonWindow('2026-11-01 09:00:00', october)).toBe(false);
	});

	it('is false for an unparseable date', () => {
		expect(dateInSeasonWindow('not-a-date', october)).toBe(false);
	});
});
