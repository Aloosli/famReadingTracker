import { describe, it, expect } from 'vitest';
import { computeReadingStreak } from './streak';

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
