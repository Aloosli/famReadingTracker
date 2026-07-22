import { fail, redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db/users';
import { getFamilyCurrentlyReading, getFamilyRecentlyFinished } from '$lib/server/db/entries';
import { getDisplayTitlesForAllUsers } from '$lib/server/db/titles';
import {
	getActiveGoal,
	getGoalProgress,
	getPastGoals,
	setActiveGoal,
	clearActiveGoal,
	markGoalAchieved
} from '$lib/server/db/goals';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';

export const load: PageServerLoad = ({ cookies, locals }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}

	// Family goal: work out live progress, and the moment it's reached, retire it to the mementos
	// list and flag the win so the page can celebrate once.
	const active = getActiveGoal(locals.householdId);
	let goal = null;
	let justAchieved = null;
	if (active) {
		const progress = getGoalProgress(active);
		if (progress.reached) {
			markGoalAchieved(active.id);
			justAchieved = { goal: active, progress };
		} else {
			goal = { goal: active, progress };
		}
	}

	return {
		user,
		currentlyReading: getFamilyCurrentlyReading(locals.householdId),
		recentlyFinished: getFamilyRecentlyFinished(locals.householdId),
		displayTitles: getDisplayTitlesForAllUsers(),
		goal,
		justAchieved,
		pastGoals: getPastGoals(locals.householdId)
	};
};

export const actions: Actions = {
	setGoal: async ({ request, cookies, locals }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		if (!profileId || !getUserById(Number(profileId))) {
			return fail(401, { message: 'Pick a profile first.' });
		}

		const data = await request.formData();
		const title = data.get('title')?.toString().trim();
		const emojiRaw = data.get('emoji')?.toString().trim();
		const targetPages = Number(data.get('targetPages'));

		if (!title) {
			return fail(400, { message: 'Give the goal a name.' });
		}
		if (!Number.isFinite(targetPages) || targetPages < 1) {
			return fail(400, { message: 'Set a page target of at least 1.' });
		}
		// Keep the emoji to a single glyph; fall back to a target if it's missing or odd.
		const emoji = emojiRaw && [...emojiRaw].length <= 2 ? emojiRaw : '🎯';

		setActiveGoal(locals.householdId, { title, emoji, targetPages: Math.round(targetPages) });
		return { success: true };
	},
	clearGoal: async ({ cookies, locals }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		if (!profileId || !getUserById(Number(profileId))) {
			return fail(401, { message: 'Pick a profile first.' });
		}
		clearActiveGoal(locals.householdId);
		return { success: true };
	}
};
