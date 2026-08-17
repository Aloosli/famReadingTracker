import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession } from '$lib/server/db/accounts';
import { isFirstRun } from '$lib/server/db/signup';
import { SESSION_COOKIE } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

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
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString() ?? '';
		const password = data.get('password')?.toString() ?? '';

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
