import { db } from './index';
import { countAccounts, createAccount, getAccountByEmail, type AccountRow } from './accounts';
import { createHousehold } from './households';
import { getDefaultHouseholdId } from './households';

export type SignupResult =
	| { ok: true; account: AccountRow; claimed: boolean }
	| { ok: false; error: string };

/** Deliberately permissive — the only thing that matters is that it round-trips to a person. */
export function isPlausibleEmail(email: string): boolean {
	const trimmed = email.trim();
	return trimmed.length >= 3 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Whether this install has no accounts yet. The first sign-up on an existing install *claims* the
 * household that's already there rather than creating an empty one — otherwise adding auth to a
 * running app would strand the family's readers, books and history behind a household nobody owns.
 */
export function isFirstRun(): boolean {
	return countAccounts() === 0;
}

/**
 * Creates the account, and the household to go with it.
 *
 * Two paths, and the distinction matters exactly once per install:
 *  - first sign-up: adopt the existing default household, inheriting whatever readers and reading
 *    history are already there;
 *  - every sign-up after that: a brand-new, empty household, which is what another family joining
 *    should get.
 *
 * Wrapped in a transaction so a failure can't leave a household with no owner.
 */
export function signUp(email: string, password: string): SignupResult {
	if (!isPlausibleEmail(email)) return { ok: false, error: "That doesn't look like an email address." };
	if (password.length < MIN_PASSWORD_LENGTH) {
		return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` };
	}
	if (getAccountByEmail(email)) {
		return { ok: false, error: 'There is already an account with that email.' };
	}

	const claimed = isFirstRun();
	const run = db.transaction(() => {
		const householdId = claimed ? getDefaultHouseholdId() : createHousehold('My Family').id;
		return createAccount(householdId, email, password);
	});

	try {
		return { ok: true, account: run(), claimed };
	} catch {
		// Almost certainly the UNIQUE(email) race between the check above and the insert.
		return { ok: false, error: 'There is already an account with that email.' };
	}
}
