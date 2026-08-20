import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createSession } from '$lib/server/db/accounts';
import { isFirstRun, signUp } from '$lib/server/db/signup';
import { evaluateSignupPolicy, needsInviteCode } from '$lib/server/signup-policy';
import { clientKey, createRateLimitStore, hit, prune } from '$lib/server/rate-limit';
import { getAllUsers } from '$lib/server/db/users';
import { getDefaultHouseholdId } from '$lib/server/db/households';
import { SESSION_COOKIE } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Throttles the one unauthenticated write endpoint that faces the internet.
 *
 * Keyed on IP only. Keying on email would be useless here — the attacker chooses it, so varying it
 * would step around the limit — and there is no account to protect from lockout yet.
 *
 * Ten in fifteen minutes is generous for a real person mistyping an invite code, and brutal for
 * guessing one: it caps a brute-force run at about a thousand attempts a day, which turns even a
 * memorable, human-chosen code into something that will not fall.
 */
const SIGNUP_ATTEMPTS = createRateLimitStore();
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_PER_IP = 10;

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
	default: async ({ request, cookies, url, getClientAddress }) => {
		// The key space is attacker-controlled, so don't let the map grow without bound.
		prune(SIGNUP_ATTEMPTS);
		const throttle = hit(
			SIGNUP_ATTEMPTS,
			`signup:${clientKey(getClientAddress)}`,
			SIGNUP_PER_IP,
			SIGNUP_WINDOW_MS
		);
		if (!throttle.allowed) {
			return fail(429, {
				email: '',
				message: `Too many attempts. Try again in ${Math.ceil(throttle.retryAfter / 60)} minute(s).`
			});
		}

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
