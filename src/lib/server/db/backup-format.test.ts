import { describe, it, expect } from 'vitest';
import { BACKUP_TABLES, BACKUP_VERSION, isValidBackup } from './backup-format';

/** A minimal well-formed backup: every expected table present as an array. */
function validBackup(overrides: Record<string, unknown> = {}) {
	const data = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
	return { format: 'famreadingtracker-backup', version: BACKUP_VERSION, data, ...overrides };
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
});
