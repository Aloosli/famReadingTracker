import { describe, it, expect } from 'vitest';
import { pagesReadForBook, type SessionPos } from './goal-progress';

const START = '2026-07-20 00:00:00';
const s = (position: number, position_type: 'page' | 'percent', read_at: string): SessionPos => ({
	position,
	position_type,
	read_at
});

describe('pagesReadForBook', () => {
	it('counts forward page progress inside the window', () => {
		const sessions = [s(20, 'page', '2026-07-20 20:00:00'), s(84, 'page', '2026-07-21 20:00:00')];
		expect(pagesReadForBook(sessions, 300, START, false)).toBe(84);
	});

	it('uses pre-window reading as the baseline, not part of the total', () => {
		const sessions = [
			s(50, 'page', '2026-07-18 20:00:00'), // before the goal — baseline
			s(120, 'page', '2026-07-21 20:00:00') // during — only 70 counts
		];
		expect(pagesReadForBook(sessions, 300, START, false)).toBe(70);
	});

	it('converts percent logs to pages via the page count', () => {
		// Baseline 40% (before the goal) -> 60% during it, on a 300-page book = page 120 -> 180 = 60.
		const sessions = [
			s(40, 'percent', '2026-07-18 20:00:00'),
			s(60, 'percent', '2026-07-21 20:00:00')
		];
		expect(pagesReadForBook(sessions, 300, START, false)).toBe(60);
	});

	it('contributes nothing for a percent book with no page count', () => {
		const sessions = [s(30, 'percent', '2026-07-20 20:00:00'), s(80, 'percent', '2026-07-21 20:00:00')];
		expect(pagesReadForBook(sessions, null, START, false)).toBe(0);
	});

	it('ignores a re-logged same position (a check-in adds nothing)', () => {
		const sessions = [
			s(84, 'page', '2026-07-20 20:00:00'),
			s(84, 'page', '2026-07-21 08:00:00'), // "read today" carried the position over
			s(84, 'page', '2026-07-21 20:00:00')
		];
		expect(pagesReadForBook(sessions, 300, START, false)).toBe(84);
	});

	it('counts through to the end when a book is finished in-window without a final log', () => {
		// Logged to page 200, then hit finish (no 300 session). Whole remaining stretch counts.
		const sessions = [s(200, 'page', '2026-07-20 20:00:00')];
		expect(pagesReadForBook(sessions, 300, START, true)).toBe(300);
	});

	it('does not double-count a finish that was also logged to 100%', () => {
		const sessions = [s(100, 'percent', '2026-07-20 20:00:00')];
		expect(pagesReadForBook(sessions, 300, START, true)).toBe(300);
	});

	it('a backward-then-forward re-read counts only the re-read pages once forward', () => {
		const sessions = [
			s(150, 'page', '2026-07-20 20:00:00'),
			s(100, 'page', '2026-07-21 08:00:00'), // went back
			s(180, 'page', '2026-07-21 20:00:00') // forward again to 180
		];
		// 0->150 (=150), then 100->180 climbs past 150 to 180 (=30). Total 180.
		expect(pagesReadForBook(sessions, 300, START, false)).toBe(180);
	});
});
