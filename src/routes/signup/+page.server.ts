import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createSession } from '$lib/server/db/accounts';
import { isFirstRun, signUp } from '$lib/server/db/signup';
import { evaluateSignupPolicy, needsInviteCode } from '$lib/server/signup-policy';
import { getAllUsers } from '$lib/server/db/users';
import { getDefaultHouseholdId } from '$lib/server/db/households';
import { SESSION_COOKIE } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

function policyInput(providedCode?: string) {
	const firstRun = isFirstRun();
	return {
		firstRun,
		configuredCode: env.SIGNUP_INVITE_CODE,
		providedCode,
		openSignup: env.ALLOW_OPEN_SIGNUP === 'true'
	};
}

export const load: PageServerLoad = ({ locals }) => {
	if (locals.account) redirect(303, '/');

	const input = policyInput();
	const decision = evaluateSignupPolicy(input);

	// On the very first sign-up, name what is about to be adopted — otherwise "create an account" on
	// an install that already has readers and a year of history reads like it might wipe them.
	const existingReaders = input.firstRun
		? getAllUsers(getDefaultHouseholdId()).map((u) => u.name)
		: [];

	return {
		firstRun: input.firstRun,
		existingReaders,
		inviteRequired: needsInviteCode(input),
		// A closed instance says so up front rather than after someone has typed their details in.
		closedReason: decision.allowed ? null : decision.reason
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString() ?? '';
		const password = data.get('password')?.toString() ?? '';
		const invite = data.get('invite')?.toString();

		// Checked server-side regardless of what the form showed — the field being hidden is a
		// convenience, never the control.
		const decision = evaluateSignupPolicy(policyInput(invite));
		if (!decision.allowed) {
			return fail(403, { email, message: decision.reason });
		}

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
