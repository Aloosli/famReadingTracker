import { describe, it, expect } from 'vitest';
import { computePersonalBests, type FinishedForBests } from './personal-bests';

function book(id: number, page_count: number | null): FinishedForBests {
	return { id, page_count };
}

describe('computePersonalBests — longest book', () => {
	it('celebrates a new longest book once there is a prior one to beat', () => {
		const finished = [book(1, 200), book(2, 500)];
		const bests = computePersonalBests(finished, 2);
		expect(bests.some((b) => b.emoji === '📏')).toBe(true);
		expect(bests.find((b) => b.emoji === '📏')?.message).toContain('500');
	});

	it('does not celebrate the very first page-counted book (nothing to beat)', () => {
		expect(computePersonalBests([book(1, 500)], 1)).toEqual([]);
	});

	it('does not celebrate when the finished book is not the longest', () => {
		const finished = [book(1, 800), book(2, 300)];
		expect(computePersonalBests(finished, 2).some((b) => b.emoji === '📏')).toBe(false);
	});

	it('ignores books without a page count when finding the record', () => {
		const finished = [book(1, null), book(2, 250)];
		// No prior *counted* book, so no "longest" — but not a crash either.
		expect(computePersonalBests(finished, 2).some((b) => b.emoji === '📏')).toBe(false);
	});
});

describe('computePersonalBests — milestones', () => {
	it('celebrates reaching a round milestone count', () => {
		const finished = Array.from({ length: 5 }, (_, i) => book(i + 1, 100));
		const bests = computePersonalBests(finished, 5);
		expect(bests.some((b) => b.emoji === '🏆' && b.message.includes('5'))).toBe(true);
	});

	it('says nothing at a non-milestone count', () => {
		const finished = Array.from({ length: 4 }, (_, i) => book(i + 1, 100));
		expect(computePersonalBests(finished, 4).some((b) => b.emoji === '🏆')).toBe(false);
	});

	it('can return both a longest-book and a milestone at once', () => {
		// 5 books, and the just-finished one (id 5) is the new longest.
		const finished = [book(1, 100), book(2, 100), book(3, 100), book(4, 100), book(5, 900)];
		const bests = computePersonalBests(finished, 5);
		expect(bests.map((b) => b.emoji).sort()).toEqual(['🏆', '📏']);
	});
});
