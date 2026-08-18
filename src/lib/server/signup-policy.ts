import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Who is allowed to create an account. No database, no framework — so the rules can be tested
 * directly, which matters because getting this wrong on a public host means strangers creating
 * households on someone's server.
 */

export type SignupDecision = { allowed: true } | { allowed: false; reason: string };

export interface SignupPolicyInput {
	/** True when the install has no accounts yet. */
	firstRun: boolean;
	/** SIGNUP_INVITE_CODE, if configured. */
	configuredCode: string | undefined;
	/** The code typed into the form. */
	providedCode: string | undefined;
	/** ALLOW_OPEN_SIGNUP=true — anyone may sign up. */
	openSignup: boolean;
}

/** Constant-time compare of two arbitrary-length strings, via their digests. */
function secretEquals(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a).digest();
	const hb = createHash('sha256').update(b).digest();
	return timingSafeEqual(ha, hb);
}

/**
 * The order matters.
 *
 * First run always wins: a freshly deployed instance has no accounts and therefore nobody who could
 * configure an invite code, so refusing here would make the app permanently unusable — a lockout
 * that looks exactly like a bug. It is also self-limiting, since it can only ever happen once.
 *
 * After that, the default is **closed**. An instance on the public internet with no configuration
 * should refuse sign-ups rather than accept them; the safe direction is the one you get by doing
 * nothing.
 */
export function evaluateSignupPolicy(input: SignupPolicyInput): SignupDecision {
	if (input.firstRun) return { allowed: true };

	const configured = input.configuredCode?.trim();
	if (configured) {
		const provided = input.providedCode?.trim() ?? '';
		if (!provided) return { allowed: false, reason: 'This server needs an invite code to sign up.' };
		if (!secretEquals(configured, provided)) {
			return { allowed: false, reason: 'That invite code isn’t right.' };
		}
		return { allowed: true };
	}

	if (input.openSignup) return { allowed: true };

	return {
		allowed: false,
		reason: 'This server isn’t accepting new accounts. Ask whoever runs it for an invite.'
	};
}

/** Whether the sign-up form should show an invite field at all. */
export function needsInviteCode(input: Pick<SignupPolicyInput, 'firstRun' | 'configuredCode'>): boolean {
	return !input.firstRun && Boolean(input.configuredCode?.trim());
}
