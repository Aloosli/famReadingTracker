import { fail, redirect } from '@sveltejs/kit';
import { createSession } from '$lib/server/db/accounts';
import { isFirstRun, signUp } from '$lib/server/db/signup';
import { getAllUsers } from '$lib/server/db/users';
import { getDefaultHouseholdId } from '$lib/server/db/households';
import { SESSION_COOKIE } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

export const load: PageServerLoad = ({ locals }) => {
	if (locals.account) redirect(303, '/');
	const first = isFirstRun();
	// On the very first sign-up, tell them what they're about to adopt — otherwise "create an
	// account" on an install that already has four readers and a year of history reads like it
	// might wipe them.
	const existingReaders = first ? getAllUsers(getDefaultHouseholdId()).map((u) => u.name) : [];
	return { firstRun: first, existingReaders };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString() ?? '';
		const password = data.get('password')?.toString() ?? '';

		const result = signUp(email, password);
		if (!result.ok) {
			return fail(400, { email, message: result.error });
		}

		cookies.set(SESSION_COOKIE, createSession(result.account.id), {
			path: '/',
			maxAge: ONE_YEAR,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:'
		});
		// A claimed household already has readers; a new one needs setting up.
		redirect(303, result.claimed ? '/' : '/setup');
	}
};
