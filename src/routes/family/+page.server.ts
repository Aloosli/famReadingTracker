import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db/users';
import { getFamilyCurrentlyReading, getFamilyRecentlyFinished } from '$lib/server/db/entries';
import { getDisplayTitlesForAllUsers } from '$lib/server/db/titles';
import type { PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';

export const load: PageServerLoad = ({ cookies, locals }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}
	return {
		user,
		currentlyReading: getFamilyCurrentlyReading(locals.householdId),
		recentlyFinished: getFamilyRecentlyFinished(locals.householdId),
		displayTitles: getDisplayTitlesForAllUsers()
	};
};
