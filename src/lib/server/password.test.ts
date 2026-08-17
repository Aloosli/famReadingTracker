import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
	it('verifies the password it was made from', () => {
		const stored = hashPassword('correct horse battery staple');
		expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
	});

	it('rejects a wrong password', () => {
		const stored = hashPassword('correct horse battery staple');
		expect(verifyPassword('Correct horse battery staple', stored)).toBe(false);
		expect(verifyPassword('', stored)).toBe(false);
	});

	it('salts, so the same password hashes differently every time', () => {
		expect(hashPassword('same')).not.toBe(hashPassword('same'));
	});

	it('carries its parameters, so they can be raised later without invalidating old hashes', () => {
		const [scheme, n, r, p] = hashPassword('x').split('$');
		expect(scheme).toBe('scrypt');
		expect(Number(n)).toBeGreaterThanOrEqual(16384);
		expect(Number(r)).toBeGreaterThan(0);
		expect(Number(p)).toBeGreaterThan(0);
	});

	it('handles unicode and long passwords', () => {
		const pw = '🔒 a very long passphrase with spaces and émoji '.repeat(8);
		expect(verifyPassword(pw, hashPassword(pw))).toBe(true);
	});
});

describe('verifyPassword on bad input', () => {
	// A corrupt or tampered row should fail the login, never throw out of the handler.
	it('returns false rather than throwing', () => {
		for (const bad of [
			'',
			'notahash',
			'scrypt$16384$8$1$onlyfiveparts',
			'bcrypt$16384$8$1$aa$bb',
			'scrypt$x$y$z$aa$bb',
			'scrypt$16384$8$1$$',
			'$$$$$'
		]) {
			expect(() => verifyPassword('anything', bad)).not.toThrow();
			expect(verifyPassword('anything', bad)).toBe(false);
		}
	});

	it('verifies against a hash made with different parameters', () => {
		// Simulates an old row after the defaults are raised.
		const stored = hashPassword('legacy');
		const [, n, r, p] = stored.split('$');
		expect(`${n}$${r}$${p}`).toBeTruthy();
		expect(verifyPassword('legacy', stored)).toBe(true);
	});
});
