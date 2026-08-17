import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { getUserInHousehold } from './db/users';
import type { UserRow } from './db/types';

export const PROFILE_COOKIE = 'profile_id';

/**
 * Resolves the reader a request is acting as, guaranteed to belong to `locals.householdId`.
 *
 * IMPORTANT — what this is and isn't. The profile cookie is a plain user id with no signature: it
 * says "I am reader 7", and on the family tablet that is exactly right, because picking a profile is
 * a convenience, not a login. It is NOT authentication, and anyone who can reach the server can set
 * it to any number. What this DOES guarantee is that the resulting reader is inside the household
 * the request resolved to, so no handler can be steered across tenants by a forged id.
 *
 * Real authentication (accounts + signed sessions) replaces the cookie in the next step, at which
 * point `locals.householdId` comes from the session and this guarantee becomes a real boundary
 * rather than a consistency check. Everything needing a reader already goes through here, so that
 * change lands in one place. See docs/stage-0-tenant-isolation.md.
 *
 * Takes `cookies` and `locals` rather than the whole RequestEvent so call sites can keep their
 * existing destructuring.
 */
export function getProfile(cookies: Cookies, locals: App.Locals): UserRow | undefined {
	const id = Number(cookies.get(PROFILE_COOKIE));
	return id ? getUserInHousehold(locals.householdId, id) : undefined;
}

/**
 * The load-function form: no valid reader means there is nothing to render, so send them to the
 * picker. Actions want `getProfile` instead — a form POST should report a failure, not silently
 * redirect a submission into a different page.
 */
export function requireProfile(cookies: Cookies, locals: App.Locals): UserRow {
	const user = getProfile(cookies, locals);
	if (!user) redirect(302, '/');
	return user;
}
