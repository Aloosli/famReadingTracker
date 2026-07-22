import { describe, it, expect } from 'vitest';
import { computeReadingStreak, planFreezeConsumption } from './streak';

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
