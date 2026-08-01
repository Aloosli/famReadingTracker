import { env } from '$env/dynamic/private';

/**
 * Reports configuration that silently degrades the app when missing, once at boot.
 *
 * This exists because a missing Google Books key is invisible from the outside: lookups still
 * "work", they just go out anonymously against a small shared IP quota and fail on days nobody has
 * even opened the app. That looked exactly like the API being flaky, and cost a real debugging
 * detour. In a container the log is the only window in — so the container log now answers the
 * question directly, rather than requiring a shell inside the container to inspect its environment.
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
}
