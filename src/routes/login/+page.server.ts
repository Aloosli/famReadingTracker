import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession } from '$lib/server/db/accounts';
import { createRateLimitStore, hit, prune } from '$lib/server/rate-limit';
import { isFirstRun } from '$lib/server/db/signup';
import { SESSION_COOKIE } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Brute-force throttling for the one endpoint that takes a guessable secret.
 *
 * Two keys, deliberately. Per-IP alone lets a distributed attempt walk straight past it; per-email
 * alone lets anyone lock a specific person out. Requiring both, with a short window, throttles
 * guessing without turning into a denial-of-service against a named account — the worst an attacker
 * achieves is a five-minute inconvenience for one email.
 */
const ATTEMPTS = createRateLimitStore();
const WINDOW_MS = 5 * 60 * 1000;
const PER_IP = 20;
const PER_EMAIL = 8;

/** Only ever follow a same-site path, so `?next=` can't be used to bounce someone off-site. */
function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
	return next;
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.account) redirect(303, safeNext(url.searchParams.get('next')));
	// A fresh install has nobody to log in as — send them to make the first account instead.
	if (isFirstRun()) redirect(303, '/signup');
	return { next: url.searchParams.get('next') };
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString() ?? '';
		const password = data.get('password')?.toString() ?? '';

		// The key space is attacker-controlled on a public instance, so keep the map from growing.
		prune(ATTEMPTS);
		const ip = getClientAddress();
		const byIp = hit(ATTEMPTS, `ip:${ip}`, PER_IP, WINDOW_MS);
		const byEmail = hit(ATTEMPTS, `email:${email.trim().toLowerCase()}`, PER_EMAIL, WINDOW_MS);
		if (!byIp.allowed || !byEmail.allowed) {
			const retryAfter = Math.max(byIp.retryAfter, byEmail.retryAfter);
			return fail(429, {
				email,
				message: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
			});
		}

		const account = authenticate(email, password);
		if (!account) {
			// One message for both "no such account" and "wrong password": saying which would let
			// anyone test whether an email is registered here.
			return fail(401, { email, message: 'That email and password don’t match.' });
		}

		cookies.set(SESSION_COOKIE, createSession(account.id), {
			path: '/',
			maxAge: ONE_YEAR,
			httpOnly: true,
			sameSite: 'lax',
			// The app is served over HTTPS in production but plain HTTP on the LAN; letting the
			// request decide keeps sign-in working in both without weakening the public case.
			secure: url.protocol === 'https:'
		});
		redirect(303, safeNext(data.get('next')?.toString() ?? url.searchParams.get('next')));
	}
};
