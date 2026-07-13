import { db } from './index';
import type { HouseholdRow } from './types';

/**
 * Ensures at least one household exists and that every reader and book belongs to one, then returns
 * the default household's id. Called once at startup (see index.ts). Existing single-family data
 * created before multi-tenancy is adopted into this default household.
 */
export function ensureDefaultHousehold(): number {
	const existing = db.prepare('SELECT id FROM households ORDER BY id LIMIT 1').get() as
		| { id: number }
		| undefined;
	const id =
		existing?.id ??
		Number(db.prepare("INSERT INTO households (name) VALUES ('My Family')").run().lastInsertRowid);

	// Adopt any pre-multi-tenancy rows (household_id IS NULL) into the default household.
	db.prepare('UPDATE users SET household_id = ? WHERE household_id IS NULL').run(id);
	db.prepare('UPDATE books SET household_id = ? WHERE household_id IS NULL').run(id);
	return id;
}

/**
 * The household to scope a request to. Today there is only one, so this returns it. When accounts
 * land, the request handler will resolve the household from the session instead (see hooks.server.ts)
 * and this becomes a fallback for un-authenticated/first-run flows.
 */
export function getDefaultHouseholdId(): number {
	const row = db.prepare('SELECT id FROM households ORDER BY id LIMIT 1').get() as
		| { id: number }
		| undefined;
	return row?.id ?? ensureDefaultHousehold();
}

export function getHouseholdById(id: number): HouseholdRow | undefined {
	return db.prepare('SELECT * FROM households WHERE id = ?').get(id) as HouseholdRow | undefined;
}

/** Creates a new household (a new family/tenant). Used later, when a grown-up signs up. */
export function createHousehold(name: string): HouseholdRow {
	const result = db.prepare('INSERT INTO households (name) VALUES (?)').run(name);
	return db
		.prepare('SELECT * FROM households WHERE id = ?')
		.get(result.lastInsertRowid) as HouseholdRow;
}
