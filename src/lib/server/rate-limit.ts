/**
 * A fixed-window rate limiter, in memory, with the clock and store injected — so it can be tested
 * without waiting for real time to pass.
 *
 * In memory is the right scope here: the app is a single Node process with a single SQLite file, so
 * there is no second instance for a shared counter to coordinate with. If it ever scales
 * horizontally this needs replacing, and that will be obvious because the limit will stop biting.
 */

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the window resets. 0 when allowed. */
	retryAfter: number;
}

interface Bucket {
	count: number;
	resetAt: number;
}

export type RateLimitStore = Map<string, Bucket>;

export function createRateLimitStore(): RateLimitStore {
	return new Map();
}

/**
 * Counts one attempt against `key`. A rejected attempt still counts — otherwise a caller who is
 * already over the limit could hammer it for free, which is precisely the case worth throttling.
 */
export function hit(
	store: RateLimitStore,
	key: string,
	limit: number,
	windowMs: number,
	now: number = Date.now()
): RateLimitResult {
	const bucket = store.get(key);

	if (!bucket || now >= bucket.resetAt) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfter: 0 };
	}

	bucket.count += 1;
	if (bucket.count > limit) {
		return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
	}
	return { allowed: true, retryAfter: 0 };
}

/**
 * Drops windows that have already reset. Nothing depends on this running — an expired bucket is
 * replaced on its next hit — it just stops the map growing without bound on a public instance,
 * where the key space is attacker-controlled.
 */
export function prune(store: RateLimitStore, now: number = Date.now()): void {
	for (const [key, bucket] of store) {
		if (now >= bucket.resetAt) store.delete(key);
	}
}

/**
 * The rate-limit key for a request's origin, without letting address resolution take the endpoint
 * down with it.
 *
 * adapter-node's `getClientAddress()` *throws* when ADDRESS_HEADER is configured but the header is
 * absent — which is every request that doesn't arrive through the proxy: a direct hit on the LAN
 * address, a container health check, anything bypassing the tunnel. Since the only callers are the
 * login and sign-up handlers, that turned a missing header into a 500 on both, i.e. nobody can sign
 * in over the LAN.
 *
 * Falling back to a single shared bucket is the conservative direction: unproxied callers are
 * throttled together rather than not at all, and the endpoint keeps working.
 */
export function clientKey(getClientAddress: () => string): string {
	try {
		return getClientAddress();
	} catch {
		return 'no-address-header';
	}
}
