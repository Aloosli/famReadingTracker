import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db/accounts';
import { SESSION_COOKIE } from '../../hooks.server';
import type { RequestHandler } from './$types';

/**
 * POST only. A GET would let any image tag or prefetch sign the family out, which on a shared
 * tablet is a genuinely annoying thing to happen by accident.
 *
 * The session row is deleted rather than just the cookie: the token stays valid otherwise, so
 * anything that had captured it would still be signed in.
 */
export const POST: RequestHandler = ({ cookies }) => {
	deleteSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	// The profile choice is per-device convenience, not identity — but leaving it set would drop
	// the next person straight onto a reader's shelf after sign-in.
	cookies.delete('profile_id', { path: '/' });
	redirect(303, '/login');
};
