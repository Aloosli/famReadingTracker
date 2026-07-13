import { fail, redirect } from '@sveltejs/kit';
import { countBooksForUser, deleteUser, getAllUsers, getUserById } from '$lib/server/db/users';
import { getDisplayTitlesForAllUsers } from '$lib/server/db/titles';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const load: PageServerLoad = ({ cookies, locals }) => {
	const users = getAllUsers(locals.householdId);
	// Fresh install with no readers yet → send them to set up their family.
	if (users.length === 0) {
		redirect(302, '/setup');
	}

	const profileId = cookies.get(PROFILE_COOKIE);
	if (profileId && getUserById(Number(profileId))) {
		redirect(302, '/home');
	}
	const displayTitles = getDisplayTitlesForAllUsers();
	return {
		users: users.map((user) => ({
			...user,
			displayTitle: displayTitles.get(user.id) ?? null,
			bookCount: countBooksForUser(user.id)
		}))
	};
};

export const actions: Actions = {
	select: async ({ request, cookies }) => {
		const data = await request.formData();
		const userId = Number(data.get('userId'));
		if (!userId || !getUserById(userId)) {
			return fail(400, { message: 'Pick a profile to continue.' });
		}
		cookies.set(PROFILE_COOKIE, String(userId), {
			path: '/',
			maxAge: ONE_YEAR,
			httpOnly: true,
			sameSite: 'lax'
		});
		redirect(303, '/home');
	},
	retireReader: async ({ request, cookies }) => {
		const data = await request.formData();
		const userId = Number(data.get('userId'));
		if (!userId || !getUserById(userId)) {
			return fail(400, { message: 'Pick a reader to remove.' });
		}

		deleteUser(userId);
		// If the retired reader happened to be the remembered profile, forget them too.
		if (cookies.get(PROFILE_COOKIE) === String(userId)) {
			cookies.delete(PROFILE_COOKIE, { path: '/' });
		}
		return { success: true };
	}
};
