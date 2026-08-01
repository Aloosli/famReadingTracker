import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getUserInHousehold } from './db/users';
import type { UserRow } from './db/types';

export const PROFILE_COOKIE = 'profile_id';

/**
 * Resolves the reader a request is acting as, guaranteed to belong to `locals.householdId`.
 *
 * IMPORTANT — what this is and isn't. The profile cookie is a plain user id with no signature: it
 * says "I am reader 7", and on the family tablet that is exactly right, because picking a profile is
 * a convenience, not a login. It is NOT authentication, and anyone who can reach the server can set
 * it to any number. What this helper *does* guarantee is that the resulting reader is inside the
 * household the request resolved to, so no handler can be steered across tenants by a forged id.
 *
 * Real authentication (accounts + signed sessions) replaces the cookie in the next step, at which
 * point `locals.householdId` comes from the session and this helper's guarantee becomes a real
 * boundary rather than a consistency check. Everything that needs a reader should already be going
 * through here by then. See docs/stage-0-tenant-isolation.md.
 */
export function requireProfile(event: RequestEvent): UserRow {
	const id = Number(event.cookies.get(PROFILE_COOKIE));
	const user = id ? getUserInHousehold(event.locals.householdId, id) : undefined;
	if (!user) redirect(302, '/');
	return user;
}
