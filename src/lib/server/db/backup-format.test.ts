import { describe, it, expect } from 'vitest';
import {
	BACKUP_TABLES,
	BACKUP_VERSION,
	HOUSEHOLD_SCOPE,
	REQUIRED_BACKUP_TABLES,
	isValidBackup,
	normalizeBackup,
	scopedDelete,
	scopedSelect
} from './backup-format';

/** A minimal well-formed backup: every expected table present as an array. */
function validBackup(overrides: Record<string, unknown> = {}) {
	const data = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
	return { format: 'famreadingtracker-backup', version: BACKUP_VERSION, data, ...overrides };
}

/** A v1 file: only the tables that existed before households/freezes/goals were backed up. */
function v1Backup() {
	const data = Object.fromEntries(REQUIRED_BACKUP_TABLES.map((t) => [t, []]));
	return { format: 'famreadingtracker-backup', version: 1, data };
}

describe('isValidBackup', () => {
	it('accepts a well-formed backup', () => {
		expect(isValidBackup(validBackup())).toBe(true);
	});

	it('rejects a foreign format', () => {
		expect(isValidBackup(validBackup({ format: 'something-else' }))).toBe(false);
	});

	it('rejects a newer version than we understand', () => {
		expect(isValidBackup(validBackup({ version: BACKUP_VERSION + 1 }))).toBe(false);
	});

	it('accepts an older/equal version', () => {
		expect(isValidBackup(validBackup({ version: BACKUP_VERSION }))).toBe(true);
	});

	it('rejects a backup missing a required table', () => {
		const backup = validBackup();
		delete (backup.data as Record<string, unknown>).users;
		expect(isValidBackup(backup)).toBe(false);
	});

	it('rejects a table that is not an array', () => {
		const backup = validBackup();
		(backup.data as Record<string, unknown>).users = { not: 'an array' };
		expect(isValidBackup(backup)).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(isValidBackup(null)).toBe(false);
		expect(isValidBackup('a string')).toBe(false);
		expect(isValidBackup(42)).toBe(false);
	});

	it('rejects an object with no data', () => {
		expect(isValidBackup({ format: 'famreadingtracker-backup', version: 1 })).toBe(false);
	});

	// v1 files predate households/freeze_bank/streak_freeze_days/family_goals. They must still
	// restore, or upgrading the app would strand every backup a family already has on disk.
	it('accepts a v1 backup that omits the tables added in v2', () => {
		expect(isValidBackup(v1Backup())).toBe(true);
	});

	it('still rejects a v2-shaped file whose optional table is the wrong type', () => {
		const backup = validBackup();
		(backup.data as Record<string, unknown>).family_goals = 'nope';
		expect(isValidBackup(backup)).toBe(false);
	});
});

describe('normalizeBackup', () => {
	it('fills tables a v1 backup never carried', () => {
		const normalized = normalizeBackup(v1Backup());
		expect(normalized.family_goals).toEqual([]);
		expect(normalized.freeze_bank).toEqual([]);
		expect(normalized.streak_freeze_days).toEqual([]);
		expect(normalized.households).toEqual([]);
	});

	it('covers every backed-up table, so the restore path never sees undefined', () => {
		const normalized = normalizeBackup(v1Backup());
		for (const table of BACKUP_TABLES) expect(Array.isArray(normalized[table])).toBe(true);
	});
});

describe('household scoping', () => {
	// The whole point of HOUSEHOLD_SCOPE: adding a table to the backup forces a decision about which
	// family owns it. A missing entry here is how a future table quietly leaks into every export.
	it('classifies every backed-up table', () => {
		for (const table of BACKUP_TABLES) expect(HOUSEHOLD_SCOPE[table]).toBeDefined();
	});

	it('filters every table except the shared title catalog', () => {
		for (const table of BACKUP_TABLES) {
			const sql = scopedSelect(table);
			if (table === 'titles') expect(sql).not.toContain('WHERE');
			else expect(sql).toContain('WHERE');
		}
	});

	it('scopes reader-owned tables through the household on users', () => {
		expect(scopedSelect('reading_sessions')).toContain(
			'user_id IN (SELECT id FROM users WHERE household_id = ?)'
		);
		expect(scopedSelect('freeze_bank')).toContain(
			'user_id IN (SELECT id FROM users WHERE household_id = ?)'
		);
	});

	it('scopes directly-owned tables on their own column', () => {
		expect(scopedSelect('books')).toContain('WHERE household_id = ?');
		expect(scopedSelect('family_goals')).toContain('WHERE household_id = ?');
	});

	it('never deletes the shared catalog or the household row itself', () => {
		// Clearing titles would rewrite every family's badges; clearing the household row would
		// cascade away the family being restored into.
		expect(scopedDelete('titles')).toBeNull();
		expect(scopedDelete('households')).toBeNull();
	});

	it('deletes exactly what it selects, for every other table', () => {
		for (const table of BACKUP_TABLES) {
			const sql = scopedDelete(table);
			if (table === 'titles' || table === 'households') continue;
			expect(sql).toContain('DELETE FROM');
			// Export and restore must agree on what "this family's rows" means, or a backup would
			// read a wider set than it replaces.
			const selectPredicate = scopedSelect(table).split('WHERE')[1];
			expect(sql).toContain(`WHERE${selectPredicate}`);
		}
	});
});
