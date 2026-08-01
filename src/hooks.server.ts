import type { Handle } from '@sveltejs/kit';
import { getDefaultHouseholdId } from '$lib/server/db/households';
import { logStartupConfig } from '$lib/server/startup-checks';

// Runs once when the server boots, so the container log says plainly whether optional-but-important
// configuration actually arrived.
logStartupConfig();

export const handle: Handle = async ({ event, resolve }) => {
	// Which family/tenant this request belongs to. Today there is a single household, so we resolve
	// the default one. When accounts land, this is the one place that changes: read the session cookie
	// and set the signed-in user's household instead. Load functions and actions read
	// `locals.householdId` and pass it to the db layer — no request-global state, so it stays safe
	// under concurrent requests from different households.
	event.locals.householdId = getDefaultHouseholdId();
	return resolve(event);
};
