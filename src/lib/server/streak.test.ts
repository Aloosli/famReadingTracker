import { describe, it, expect } from 'vitest';
import {
	computeReadingStreak,
	freezeThreshold,
	median,
	planFreezeConsumption,
	sittingAdvancements,
	FREEZE_FLOOR_PAGES,
	type SittingSession
} from './streak';

const now = new Date('2026-07-10T18:00:00Z');

describe('computeReadingStreak', () => {
	it('is 0 with no active days', () => {
		expect(computeReadingStreak(new Set(), now)).toBe(0);
	});

	it('counts a run ending today', () => {
		const days = new Set(['2026-07-08', '2026-07-09', '2026-07-10']);
		expect(computeReadingStreak(days, now)).toBe(3);
	});

	it('keeps the streak alive through the one-day grace (active yesterday, not today)', () => {
		const days = new Set(['2026-07-08', '2026-07-09']);
		expect(computeReadingStreak(days, now)).toBe(2);
	});

	it('is 0 when the last active day is older than yesterday', () => {
		const days = new Set(['2026-07-07', '2026-07-08']);
		expect(computeReadingStreak(days, now)).toBe(0);
	});

	it('stops at the first missed day', () => {
		const days = new Set(['2026-07-05', '2026-07-06', '2026-07-09', '2026-07-10']);
		expect(computeReadingStreak(days, now)).toBe(2);
	});

	it('counts a single active day today as 1', () => {
		expect(computeReadingStreak(new Set(['2026-07-10']), now)).toBe(1);
	});
});

describe('planFreezeConsumption', () => {
	// "today" is 2026-07-10; yesterday is 07-09.
	it('does nothing when no freezes are banked', () => {
		expect(planFreezeConsumption(new Set(['2026-07-08']), 0, now)).toEqual([]);
	});

	it('does nothing when yesterday was already active', () => {
		expect(planFreezeConsumption(new Set(['2026-07-09']), 2, now)).toEqual([]);
	});

	it('bridges a single missed yesterday when a prior day reconnects', () => {
		// read 07-08, missed 07-09 → freeze 07-09 to reconnect.
		expect(planFreezeConsumption(new Set(['2026-07-08']), 1, now)).toEqual(['2026-07-09']);
	});

	it('bridges two missed days with two freezes', () => {
		// read 07-07, missed 07-08 and 07-09.
		expect(planFreezeConsumption(new Set(['2026-07-07']), 2, now)).toEqual(['2026-07-09', '2026-07-08']);
	});

	it('spends nothing when the gap is longer than the freezes on hand', () => {
		// missed 07-08 and 07-09 but only one freeze → can't reconnect, so don't waste it.
		expect(planFreezeConsumption(new Set(['2026-07-07']), 1, now)).toEqual([]);
	});

	it('bridges an internal gap even when today is active', () => {
		// active today + 07-08, missed 07-09 → freeze 07-09 so the streak stays continuous.
		expect(planFreezeConsumption(new Set(['2026-07-10', '2026-07-08']), 1, now)).toEqual(['2026-07-09']);
	});

	it('spends nothing when there is no prior activity to protect', () => {
		expect(planFreezeConsumption(new Set(), 2, now)).toEqual([]);
	});
});

describe('median', () => {
	it('is 0 for an empty list', () => {
		expect(median([])).toBe(0);
	});
	it('takes the middle of an odd-length list', () => {
		expect(median([9, 1, 5])).toBe(5);
	});
	it('averages the two middle values of an even-length list', () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
	});
	it('resists a single outlier', () => {
		expect(median([10, 10, 10, 10, 200])).toBe(10);
	});
});

describe('freezeThreshold', () => {
	it('falls back to the flat floor before there is enough history (cold start)', () => {
		expect(freezeThreshold([])).toBe(FREEZE_FLOOR_PAGES);
		expect(freezeThreshold([30, 40, 50, 60])).toBe(FREEZE_FLOOR_PAGES); // 4 < 5
	});
	it('is 1.6x the rolling median once there is enough history', () => {
		// median 50 -> round(1.6*50) = 80
		expect(freezeThreshold([50, 50, 50, 50, 50])).toBe(80);
	});
	it('never drops below the floor even for a tiny baseline', () => {
		// median 5 -> round(1.6*5)=8, but the floor (12) wins
		expect(freezeThreshold([5, 5, 5, 5, 5])).toBe(FREEZE_FLOOR_PAGES);
	});
	it('rounds the multiplier result', () => {
		// median 7 -> 1.6*7 = 11.2 -> round 11 -> floor(12) wins; median 20 -> 32
		expect(freezeThreshold([20, 20, 20, 20, 20, 20])).toBe(32);
	});
});

describe('sittingAdvancements', () => {
	const s = (
		book_id: number,
		position: number,
		position_type: 'page' | 'percent',
		page_count: number | null
	): SittingSession => ({ book_id, position, position_type, page_count });

	it('measures each sitting as pages gained since the furthest point on that book', () => {
		const sessions = [s(1, 20, 'page', 300), s(1, 84, 'page', 300), s(1, 100, 'page', 300)];
		expect(sittingAdvancements(sessions)).toEqual([20, 64, 16]);
	});

	it('converts percent logs to pages via the page count (feeds the baseline)', () => {
		// 10% -> 40% of a 300-page book = 30 -> 120 = advances 30, then 90
		const sessions = [s(1, 10, 'percent', 300), s(1, 40, 'percent', 300)];
		expect(sittingAdvancements(sessions)).toEqual([30, 90]);
	});

	it('yields null for a percent log on a book with no page count', () => {
		expect(sittingAdvancements([s(1, 50, 'percent', null)])).toEqual([null]);
	});

	it('tracks each book independently and clamps a backward jump to 0', () => {
		const sessions = [s(1, 50, 'page', 300), s(2, 30, 'page', 200), s(1, 40, 'page', 300)];
		expect(sittingAdvancements(sessions)).toEqual([50, 30, 0]);
	});
});
