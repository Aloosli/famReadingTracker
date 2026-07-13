/**
 * The ordered set of "peer" pages you can swipe between left/right (a tab-like loop, no wrap).
 * Utility pages (add, data, setup) are intentionally left out of the swipe loop.
 */
export const SWIPE_PAGES = ['/home', '/family', '/year'] as const;

export type SwipeDirection = 'forward' | 'back';

/** The page reached by moving `direction` (+1 next / -1 previous) from `current`, or null at the ends. */
export function neighborPage(current: string, direction: 1 | -1): string | null {
	const index = (SWIPE_PAGES as readonly string[]).indexOf(current);
	if (index === -1) return null;
	const next = index + direction;
	if (next < 0 || next >= SWIPE_PAGES.length) return null;
	return SWIPE_PAGES[next];
}
