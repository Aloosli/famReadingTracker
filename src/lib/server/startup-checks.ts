import { env } from '$env/dynamic/private';

/**
 * Reports configuration that silently degrades the app when missing, once at boot.
 *
 * This exists because the failures it covers are invisible from the outside. A missing Google Books
 * key doesn't break lookups, it makes them flaky in a way that looks like the API being unreliable —
 * which cost a real debugging detour. In a container the log is the only window in, so the container
 * log answers these questions directly rather than requiring a shell inside it.
 */
export function logStartupConfig(): void {
	if (env.GOOGLE_BOOKS_API_KEY) {
		console.log('[config] Google Books API key: set — book lookups are authenticated.');
	} else {
		console.warn(
			'[config] Google Books API key: NOT SET. Book lookups will go out anonymously against a ' +
				'small shared quota and will fail intermittently regardless of how little the app is used. ' +
				'Set GOOGLE_BOOKS_API_KEY in the container environment to fix it. ' +
				'(Open Library still answers as a fallback, so search degrades rather than breaks.)'
		);
	}

	// Who can create an account. Worth stating plainly: "closed" is the default, and someone who
	// expected an invite flow to work should find out at boot rather than from a confused friend.
	if (env.ALLOW_OPEN_SIGNUP === 'true') {
		console.warn(
			'[config] Sign-ups: OPEN — anyone who can reach this server can create a household. ' +
				'Only appropriate for an instance meant to be a public service.'
		);
	} else if (env.SIGNUP_INVITE_CODE?.trim()) {
		console.log('[config] Sign-ups: invite code required.');
	} else {
		console.log(
			'[config] Sign-ups: closed (the default). The first account is still allowed and will ' +
				'claim the existing household. Set SIGNUP_INVITE_CODE to let others in.'
		);
	}

	// Login is throttled per client IP. Behind a tunnel or reverse proxy every request appears to
	// come from the proxy unless adapter-node is told otherwise, so the per-IP limit would throttle
	// all users collectively — a self-inflicted outage that looks like the app being broken.
	if (env.ORIGIN && !env.ADDRESS_HEADER) {
		console.warn(
			'[config] ORIGIN is set (so this is behind a proxy) but ADDRESS_HEADER is not. ' +
				'Every request will look like it comes from the proxy, so the per-IP login rate limit ' +
				'applies to everyone at once. Set ADDRESS_HEADER (e.g. CF-Connecting-IP).'
		);
	}
}
