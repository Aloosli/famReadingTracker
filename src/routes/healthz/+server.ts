import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Liveness probe for whatever is hosting this.
 *
 * Public by design — listed in hooks.server.ts alongside /login, because a platform health check
 * arrives with no cookies, and a 303 to /login would read as "unhealthy" and get the container
 * restarted in a loop.
 *
 * Deliberately says nothing beyond "the process is up": no version, no counts, no database state.
 * An unauthenticated endpoint on a public host should leak nothing, and anything more useful
 * belongs behind the session.
 */
export const GET: RequestHandler = () => json({ status: 'ok' });
