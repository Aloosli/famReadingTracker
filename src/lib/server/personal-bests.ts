/**
 * Pure "you beat your own record" logic, split from the DB layer for testing. Personal bests are
 * always about the reader against their own history — never compared to anyone else.
 */

export interface PersonalBest {
	emoji: string;
	message: string;
}

export interface FinishedForBests {
	id: number;
	page_count: number | null;
}

/** Round-number "books finished" celebrations. */
export const BOOK_MILESTONES = new Set([5, 10, 25, 50, 100, 150, 200]);

/**
 * Given all of a reader's finished books and the id of the one just finished, returns any personal
 * bests it triggers (may be empty).
 */
export function computePersonalBests(
	finished: FinishedForBests[],
	entryId: number
): PersonalBest[] {
	const bests: PersonalBest[] = [];
	const just = finished.find((entry) => entry.id === entryId);

	// Longest book yet — only once there's a prior page-counted book to beat.
	if (just?.page_count) {
		const others = finished
			.filter((entry) => entry.id !== entryId && entry.page_count)
			.map((entry) => entry.page_count as number);
		if (others.length > 0 && just.page_count > Math.max(...others)) {
			bests.push({
				emoji: '📏',
				message: `Your longest book yet — ${just.page_count.toLocaleString()} pages!`
			});
		}
	}

	if (BOOK_MILESTONES.has(finished.length)) {
		bests.push({ emoji: '🏆', message: `That's ${finished.length} books finished!` });
	}

	return bests;
}
