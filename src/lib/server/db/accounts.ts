import { createHash, randomBytes } from 'node:crypto';
import { db } from './index';
import { hashPassword, verifyPassword } from '../password';

export interface AccountRow {
	id: number;
	household_id: number;
	email: string;
	password_hash: string;
	created_at: string;
}

/** How long a session lasts. Rolling: every authenticated request pushes it back out. */
const SESSION_DAYS = 365;

/**
 * Emails are compared and stored lowercased — otherwise "Adi@..." and "adi@..." would be two
 * accounts, and the UNIQUE constraint would happily allow it.
 */
function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** The cookie carries the token; the table stores only this. See the schema comment. */
function tokenHash(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function countAccounts(): number {
	return (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n;
}

export function getAccountByEmail(email: string): AccountRow | undefined {
	return db.prepare('SELECT * FROM accounts WHERE email = ?').get(normalizeEmail(email)) as
		| AccountRow
		| undefined;
}

/**
 * Creates an account owning `householdId`. Throws on a duplicate email (the UNIQUE constraint) —
 * callers check first so they can report it kindly rather than 500.
 */
export function createAccount(householdId: number, email: string, password: string): AccountRow {
	const result = db
		.prepare('INSERT INTO accounts (household_id, email, password_hash) VALUES (?, ?, ?)')
		.run(householdId, normalizeEmail(email), hashPassword(password));
	return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid) as AccountRow;
}

/**
 * Verifies credentials. Deliberately runs the hash comparison even when the email is unknown, so a
 * missing account and a wrong password take the same time — otherwise response timing reveals which
 * emails are registered.
 */
export function authenticate(email: string, password: string): AccountRow | undefined {
	const account = getAccountByEmail(email);
	if (!account) {
		// Compare against a throwaway hash so the work is done either way.
		verifyPassword(password, hashPassword('no-such-account'));
		return undefined;
	}
	return verifyPassword(password, account.password_hash) ? account : undefined;
}

/** Issues a session and returns the raw token — the only moment it exists outside the cookie. */
export function createSession(accountId: number): string {
	const token = randomBytes(32).toString('base64url');
	db.prepare(
		`INSERT INTO auth_sessions (id, account_id, expires_at)
		 VALUES (?, ?, datetime('now', ?))`
	).run(tokenHash(token), accountId, `+${SESSION_DAYS} days`);
	return token;
}

/**
 * The account behind a cookie token, or undefined if the session is unknown or expired. Expired
 * rows are deleted on the way past, so the table self-prunes for anyone who comes back.
 */
export function resolveSession(token: string | undefined): AccountRow | undefined {
	if (!token) return undefined;
	const id = tokenHash(token);
	const row = db
		.prepare(
			`SELECT a.* FROM auth_sessions s
			 JOIN accounts a ON a.id = s.account_id
			 WHERE s.id = ? AND s.expires_at > datetime('now')`
		)
		.get(id) as AccountRow | undefined;
	if (!row) {
		db.prepare(`DELETE FROM auth_sessions WHERE id = ? AND expires_at <= datetime('now')`).run(id);
		return undefined;
	}
	return row;
}

/**
 * Rolling expiry: using the app keeps you signed in, so the family tablet never asks again.
 *
 * The WHERE clause makes this self-limiting — it only writes once the session has aged past a
 * tenth of its life, so this is a no-op on almost every request instead of a database write per
 * page view. No read needed to decide; SQLite does it in the one statement.
 */
export function refreshSessionIfStale(token: string): void {
	const refreshAfterDays = Math.round(SESSION_DAYS * 0.9);
	db.prepare(
		`UPDATE auth_sessions SET expires_at = datetime('now', ?)
		 WHERE id = ? AND expires_at < datetime('now', ?)`
	).run(`+${SESSION_DAYS} days`, tokenHash(token), `+${refreshAfterDays} days`);
}

export function deleteSession(token: string | undefined): void {
	if (!token) return;
	db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(tokenHash(token));
}
