import { redirect, type Handle } from '@sveltejs/kit';
import { refreshSessionIfStale, resolveSession } from '$lib/server/db/accounts';
import { logStartupConfig } from '$lib/server/startup-checks';

// Runs once when the server boots, so the container log says plainly whether optional-but-important
// configuration actually arrived.
logStartupConfig();

export const SESSION_COOKIE = 'session';

/**
 * Reachable without an account. Everything else — including /api and /data — requires one.
 *
 * `/_app` and the PWA files are listed because in dev they pass through this handler; under
 * adapter-node they're served before it. Cheaper to allow them in both cases than to have the
 * manifest 302 to /login and break Add to Home Screen.
 */
const PUBLIC_EXACT = new Set(['/login', '/signup']);
const PUBLIC_PREFIXES = ['/_app/', '/favicon', '/apple-touch-icon', '/manifest', '/icons/'];

function isPublic(pathname: string): boolean {
	return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Resolves who is asking, and refuses everyone else.
 *
 * This is the seam the whole tenant-isolation effort was built around. `locals.householdId` used to
 * come from `getDefaultHouseholdId()` — the same household for every request, because there was
 * only one. It now comes from the signed-in account's session, which is what turns the guards in
 * $lib/server/guards from a consistency check into a real boundary: a forged profile cookie can
 * still name any reader id, but it is looked up inside *this account's* household, and there is no
 * longer any way to choose a different one.
 *
 * The gate lives here rather than in each route so `locals.householdId` stays non-null and no
 * handler has to defend itself. An unauthenticated request never reaches a route at all.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const account = resolveSession(token);

	if (account && token) {
		event.locals.account = account;
		event.locals.householdId = account.household_id;
		refreshSessionIfStale(token);
	}

	if (!account && !isPublic(event.url.pathname)) {
		// Come back to where they were heading once they're in.
		const target = event.url.pathname + event.url.search;
		const next = target === '/' ? '' : `?next=${encodeURIComponent(target)}`;
		redirect(303, `/login${next}`);
	}

	return resolve(event);
};
