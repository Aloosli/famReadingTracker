import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing, with no database and no framework — so it can be unit tested directly.
 *
 * scrypt from node:crypto rather than argon2id: argon2 is the stronger choice on paper, but it
 * means a native dependency, and this app deliberately ships four. scrypt is memory-hard, built in,
 * and far beyond what a family reading tracker's threat model needs.
 *
 * Synchronous on purpose. The whole data layer is better-sqlite3, i.e. sync, so an async hash here
 * would be the only await in the request path for no benefit at this scale — a login costs ~100ms
 * of event loop, and logins are rare.
 */

/** cost / blockSize / parallelism. Bumping these is safe: existing hashes carry their own params. */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Stored form: `scrypt$N$r$p$salt$hash`, all hex after the params. The params travel with the hash
 * so raising them later doesn't invalidate every existing password — old hashes keep verifying
 * against the values they were made with.
 */
export function hashPassword(password: string): string {
	const salt = randomBytes(SALT_BYTES);
	const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
	return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Constant-time verification. Returns false rather than throwing on a malformed or unknown-scheme
 * stored value — a corrupt row should fail the login, not 500 the request.
 */
export function verifyPassword(password: string, stored: string): boolean {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

	const n = Number(parts[1]);
	const r = Number(parts[2]);
	const p = Number(parts[3]);
	if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

	let salt: Buffer;
	let expected: Buffer;
	try {
		salt = Buffer.from(parts[4], 'hex');
		expected = Buffer.from(parts[5], 'hex');
	} catch {
		return false;
	}
	if (salt.length === 0 || expected.length === 0) return false;

	let actual: Buffer;
	try {
		actual = scryptSync(password, salt, expected.length, { N: n, r, p });
	} catch {
		// Absurd params in a tampered row would otherwise throw out of the login handler.
		return false;
	}
	// Lengths already match by construction, but timingSafeEqual throws if they don't.
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
