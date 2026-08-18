import { describe, it, expect } from 'vitest';
import { evaluateSignupPolicy, needsInviteCode } from './signup-policy';

const base = {
	firstRun: false,
	configuredCode: undefined,
	providedCode: undefined,
	openSignup: false
};

describe('evaluateSignupPolicy', () => {
	it('is CLOSED by default — an unconfigured public instance must refuse', () => {
		expect(evaluateSignupPolicy(base).allowed).toBe(false);
	});

	it('always allows the very first account, whatever the config', () => {
		// A fresh deploy has nobody who could have set an invite code, so refusing here would be a
		// permanent lockout that looks exactly like a bug.
		expect(evaluateSignupPolicy({ ...base, firstRun: true }).allowed).toBe(true);
		expect(
			evaluateSignupPolicy({ ...base, firstRun: true, configuredCode: 'secret' }).allowed
		).toBe(true);
	});

	it('allows anyone when open signup is switched on', () => {
		expect(evaluateSignupPolicy({ ...base, openSignup: true }).allowed).toBe(true);
	});

	it('requires the code when one is configured', () => {
		const cfg = { ...base, configuredCode: 'letmein' };
		expect(evaluateSignupPolicy(cfg).allowed).toBe(false);
		expect(evaluateSignupPolicy({ ...cfg, providedCode: 'wrong' }).allowed).toBe(false);
		expect(evaluateSignupPolicy({ ...cfg, providedCode: 'letmein' }).allowed).toBe(true);
	});

	it('lets an invite code override open signup being off', () => {
		expect(
			evaluateSignupPolicy({ ...base, configuredCode: 'x', providedCode: 'x', openSignup: false })
				.allowed
		).toBe(true);
	});

	it('ignores surrounding whitespace on both sides', () => {
		expect(
			evaluateSignupPolicy({ ...base, configuredCode: ' code ', providedCode: 'code' }).allowed
		).toBe(true);
	});

	it('treats a blank configured code as not configured', () => {
		// Otherwise SIGNUP_INVITE_CODE="" would silently demand an empty string.
		const cfg = { ...base, configuredCode: '   ', openSignup: true };
		expect(evaluateSignupPolicy(cfg).allowed).toBe(true);
	});

	it('explains why it refused', () => {
		const closed = evaluateSignupPolicy(base);
		expect(closed.allowed).toBe(false);
		if (!closed.allowed) expect(closed.reason).toMatch(/invite/i);
	});
});

describe('needsInviteCode', () => {
	it('is false on first run, and false when no code is configured', () => {
		expect(needsInviteCode({ firstRun: true, configuredCode: 'x' })).toBe(false);
		expect(needsInviteCode({ firstRun: false, configuredCode: undefined })).toBe(false);
	});

	it('is true once a code is configured and the install is claimed', () => {
		expect(needsInviteCode({ firstRun: false, configuredCode: 'x' })).toBe(true);
	});
});
