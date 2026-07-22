import { fail, redirect } from '@sveltejs/kit';
import { getUserById, updateMonthlyGoal, updateUserProfile } from '$lib/server/db/users';
import { isAvatarColor, isAvatarEmoji } from '$lib/avatars';
import { updateBookPageCount } from '$lib/server/db/books';
import {
	countFinishedThisMonth,
	finishEntry,
	getCurrentlyReading,
	getFinishedShelf,
	getReadingStreak,
	getSetAside,
	personalBestsForFinish,
	removeEntry,
	resumeEntry,
	setAsideEntry,
	setReaction,
	startReading,
	unfinishEntry
} from '$lib/server/db/entries';
import { isReaction } from '$lib/reactions';
import { logProgress as saveProgress, checkInToday } from '$lib/server/db/sessions';
import type { PositionType } from '$lib/server/db/types';
import { evaluateTitles, revokeFinishDependentTitles } from '$lib/server/titles/engine';
import { READING_TIME_OF_DAY, type ReadingTimeOfDay } from '$lib/server/titles/config';
import { getPatchesForUser, setActiveTitle as applyActiveTitle } from '$lib/server/db/titles';
import { getActiveGoal, getGoalProgress, pagesReadSince } from '$lib/server/db/goals';
import { awardFreezeForBigLog, getStreakFreezes, maintainStreakFreezes } from '$lib/server/db/streaks';
import { getWishlist, removeFromWishlist as removeWishlistItem } from '$lib/server/db/wishlist';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';

/** Sentinel distinguishing "no reading date supplied" (undefined) from "a date that didn't parse". */
const INVALID_READ_AT = '\0invalid';

/**
 * Turns the log form's "when did you read this?" answer into a read_at datetime for logProgress.
 *  - `readWhen` unset or 'now' → undefined (a live log; logProgress defaults read_at to now).
 *  - a 'YYYY-MM-DD' date + a rough time bucket → that day at the bucket's representative UTC hour,
 *    clamped so it can never land in the future. A malformed date returns INVALID_READ_AT.
 */
function resolveReadAt(readWhen: string | undefined, readTime: string | undefined): string | undefined {
	if (!readWhen || readWhen === 'now') return undefined;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(readWhen)) return INVALID_READ_AT;
	const parsed = new Date(`${readWhen}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return INVALID_READ_AT;

	const bucket = (readTime ?? '') as ReadingTimeOfDay;
	const hour = READING_TIME_OF_DAY[bucket] ?? READING_TIME_OF_DAY.evening;
	const candidate = `${readWhen} ${String(hour).padStart(2, '0')}:00:00`;
	// Same "YYYY-MM-DD HH:MM:SS" shape, so a lexical compare is a chronological one.
	const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
	return candidate > now ? now : candidate;
}

export const load: PageServerLoad = ({ cookies }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}

	// A compact read-only view of the family goal so everyone sees the shared bar from their shelf.
	// (The Family page owns setting it and celebrating when it's reached.)
	const activeGoal = getActiveGoal(user.household_id);
	let familyGoal = null;
	if (activeGoal) {
		// This reader's pages toward the goal *today* — count from the later of the goal start and
		// the start of today (UTC, matching the rest of the app), so a goal set mid-day only counts
		// reading after it began.
		const todayStart = `${new Date().toISOString().slice(0, 10)} 00:00:00`;
		const since = activeGoal.started_at > todayStart ? activeGoal.started_at : todayStart;
		familyGoal = {
			title: activeGoal.title,
			emoji: activeGoal.emoji,
			progress: getGoalProgress(activeGoal),
			myTodayPages: pagesReadSince(user.id, since)
		};
	}

	// Spend any banked freezes needed to cover a recently missed day, then read the (protected)
	// streak. `freezeUsed` is >0 only on the load that actually consumes one, so the page can note it.
	const { consumed: freezeUsed } = maintainStreakFreezes(user.id);

	return {
		user,
		currentlyReading: getCurrentlyReading(user.id),
		streak: getReadingStreak(user.id),
		streakFreezes: getStreakFreezes(user.id),
		freezeUsed,
		finishedThisMonth: countFinishedThisMonth(user.id),
		bookshelf: getFinishedShelf(user.id),
		wishlist: getWishlist(user.id),
		setAside: getSetAside(user.id),
		patches: getPatchesForUser(user.id),
		familyGoal
	};
};

export const actions: Actions = {
	switchProfile: async ({ cookies }) => {
		cookies.delete(PROFILE_COOKIE, { path: '/' });
		redirect(303, '/');
	},
	finishBook: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		if (!entryId) {
			return fail(400, { message: 'Missing book to finish.' });
		}

		finishEntry(entryId, user.id);
		const bests = personalBestsForFinish(user.id, entryId);
		const grants = evaluateTitles(user.id);
		return { success: true, grants, bests };
	},
	unfinishBook: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		if (!entryId) {
			return fail(400, { message: 'Missing book to move back.' });
		}

		unfinishEntry(entryId, user.id);
		revokeFinishDependentTitles(user.id);
		return { success: true };
	},
	removeBook: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		if (!entryId) {
			return fail(400, { message: 'Missing book to remove.' });
		}

		removeEntry(entryId, user.id);
		return { success: true };
	},
	setAsideBook: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		if (!entryId) {
			return fail(400, { message: 'Missing book to set aside.' });
		}

		setAsideEntry(entryId, user.id);
		return { success: true };
	},
	resumeBook: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		if (!entryId) {
			return fail(400, { message: 'Missing book to resume.' });
		}

		resumeEntry(entryId, user.id);
		return { success: true };
	},
	logProgress: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const bookId = Number(data.get('bookId'));
		const positionType: PositionType = data.get('positionType') === 'percent' ? 'percent' : 'page';
		const position = Number(data.get('position'));

		if (!bookId || !Number.isFinite(position) || position < 0) {
			return fail(400, { message: 'Enter a valid position.' });
		}
		if (positionType === 'percent' && position > 100) {
			return fail(400, { message: 'Percent must be between 0 and 100.' });
		}

		const readAt = resolveReadAt(data.get('readWhen')?.toString(), data.get('readTime')?.toString());
		if (readAt === INVALID_READ_AT) {
			return fail(400, { message: 'Pick a valid reading date.' });
		}

		saveProgress(user.id, bookId, Math.round(position), positionType, readAt);
		// A sitting that beats the reader's own rolling pace banks a streak freeze (unless at the cap).
		const freeze = awardFreezeForBigLog(user.id);
		const grants = evaluateTitles(user.id);
		return { success: true, grants, freezeEarned: freeze.earned };
	},
	checkIn: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const bookId = Number(data.get('bookId'));
		if (!bookId) {
			return fail(400, { message: 'Missing book to check in.' });
		}

		checkInToday(user.id, bookId);
		const grants = evaluateTitles(user.id);
		return { success: true, grants };
	},
	updatePageCount: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const bookId = Number(data.get('bookId'));
		const pageCountRaw = data.get('pageCount')?.toString().trim();
		const pageCount = pageCountRaw && Number(pageCountRaw) > 0 ? Math.round(Number(pageCountRaw)) : null;

		if (!bookId) {
			return fail(400, { message: 'Missing book.' });
		}

		updateBookPageCount(bookId, pageCount);
		return { success: true };
	},
	setActiveTitle: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const titleKey = data.get('titleKey')?.toString().trim() || null;
		applyActiveTitle(user.id, titleKey);
		return { success: true };
	},
	setMonthlyGoal: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const goal = Number(data.get('monthlyGoal'));
		if (!Number.isFinite(goal) || goal < 1) {
			return fail(400, { message: 'Pick a goal of at least 1 book.' });
		}

		updateMonthlyGoal(user.id, Math.round(goal));
		return { success: true };
	},
	updateProfile: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const name = data.get('name')?.toString().trim();
		const emoji = data.get('avatarEmoji')?.toString();
		const color = data.get('avatarColor')?.toString();
		const goalNumber = Number(data.get('monthlyGoal'));

		if (!name) {
			return fail(400, { message: 'Your name can’t be empty.' });
		}

		updateUserProfile(user.id, {
			name,
			avatarEmoji: isAvatarEmoji(emoji) ? emoji : user.avatar_emoji,
			avatarColor: isAvatarColor(color) ? color : user.avatar_color,
			monthlyGoal: Number.isFinite(goalNumber) && goalNumber >= 1 ? Math.round(goalNumber) : user.monthly_goal
		});
		return { success: true };
	},
	startFromWishlist: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const wishlistId = Number(data.get('wishlistId'));
		if (!wishlistId) {
			return fail(400, { message: 'Missing book.' });
		}

		// Remove from Up Next and move it onto the currently-reading shelf.
		const bookId = removeWishlistItem(wishlistId, user.id);
		if (bookId) {
			startReading(user.id, bookId);
		}
		return { success: true };
	},
	removeFromWishlist: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const wishlistId = Number(data.get('wishlistId'));
		if (!wishlistId) {
			return fail(400, { message: 'Missing book to remove.' });
		}

		removeWishlistItem(wishlistId, user.id);
		return { success: true };
	},
	setReaction: async ({ request, cookies }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const entryId = Number(data.get('entryId'));
		const raw = data.get('reaction')?.toString() ?? '';
		if (!entryId) {
			return fail(400, { message: 'Missing book.' });
		}

		// An empty/"clear" value removes the reaction; otherwise it must be a known one.
		const reaction = raw === '' ? null : isReaction(raw) ? raw : undefined;
		if (reaction === undefined) {
			return fail(400, { message: 'Unknown reaction.' });
		}

		setReaction(entryId, user.id, reaction);
		return { success: true };
	}
};
