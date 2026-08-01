import { db } from './index';
import {
	BACKUP_FORMAT,
	BACKUP_TABLES,
	BACKUP_VERSION,
	HOUSEHOLD_SCOPE,
	isValidBackup,
	normalizeBackup,
	scopedDelete,
	scopedSelect,
	type ParsedBackup
} from './backup-format';

// Re-exported so existing import sites (the export endpoint, the restore action) keep working.
export { BACKUP_VERSION, isValidBackup, type ParsedBackup };

export interface BackupSummary {
	readers: number;
	books: number;
	entries: number;
}

/** Raised when a backup can't be restored for a reason worth explaining to the reader. */
export class BackupRestoreError extends Error {}

/**
 * Headline counts for the Data & backup page — "what's in the box" before you download it.
 * Scoped to one household: a family's backup page must never count another family's rows.
 */
export function getBackupSummary(householdId: number): BackupSummary {
	const count = (sql: string) => (db.prepare(sql).get(householdId) as { n: number }).n;
	return {
		readers: count('SELECT COUNT(*) AS n FROM users WHERE household_id = ?'),
		books: count('SELECT COUNT(*) AS n FROM books WHERE household_id = ?'),
		entries: count(
			`SELECT COUNT(*) AS n FROM reading_entries
			 WHERE user_id IN (SELECT id FROM users WHERE household_id = ?)`
		)
	};
}

/**
 * A complete, self-contained snapshot of one household's data (plus the code-seeded title catalog,
 * so an export stays faithful even if the catalog later changes). Ordered so the importer can insert
 * parents before the rows that reference them.
 *
 * Every table is selected through HOUSEHOLD_SCOPE — there is no "select everything" path here, which
 * is what stops a future table being added to the backup without anyone deciding how it scopes.
 */
export function buildBackup(householdId: number) {
	const rowsFor = (table: (typeof BACKUP_TABLES)[number]) => {
		const statement = db.prepare(scopedSelect(table));
		return HOUSEHOLD_SCOPE[table] === 'global' ? statement.all() : statement.all(householdId);
	};
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		data: Object.fromEntries(BACKUP_TABLES.map((table) => [table, rowsFor(table)]))
	};
}

/**
 * Replaces one household's data with the contents of a backup. Runs in a single transaction, so a
 * failure part-way through rolls back and leaves the existing data untouched.
 *
 * Three rows deliberately survive a restore:
 *  - the `titles` catalog is shared by every household, so it is topped up (INSERT OR IGNORE) rather
 *    than cleared — one family's restore must not rewrite everyone's badge definitions;
 *  - the `households` row itself is updated in place, never deleted and re-created, because deleting
 *    it would cascade away the family we're restoring into;
 *  - other households' rows are simply out of scope and never touched.
 *
 * Row ids are preserved so foreign keys inside the backup still line up. If an id is already taken
 * by *another* household the insert violates the primary key, the transaction rolls back, and we
 * report it rather than corrupting either family's data.
 */
export function restoreBackup(householdId: number, backup: ParsedBackup): void {
	const data = normalizeBackup(backup);

	const replace = db.transaction(() => {
		// Clear this household's children before its parents (reverse dependency order).
		for (const table of [...BACKUP_TABLES].reverse()) {
			const sql = scopedDelete(table);
			if (sql) db.prepare(sql).run(householdId);
		}

		// The backup's household row carries the family's chosen name; adopt it without changing which
		// household row we are (its id is the tenant key that everything else hangs off).
		const householdRow = data.households[0];
		if (householdRow && typeof householdRow.name === 'string') {
			db.prepare('UPDATE households SET name = ? WHERE id = ?').run(householdRow.name, householdId);
		}

		for (const table of BACKUP_TABLES) {
			if (table === 'households') continue; // handled above
			for (const row of data[table]) {
				const values = { ...row };
				// Re-tag rows that name their household directly, so restoring a backup taken from a
				// different household lands in *this* one instead of vanishing into the original's id.
				if (HOUSEHOLD_SCOPE[table] === 'household_id') values.household_id = householdId;

				const columns = Object.keys(values);
				if (columns.length === 0) continue;
				const cols = columns.map((c) => `"${c}"`).join(', ');
				const params = columns.map((c) => `@${c}`).join(', ');
				// The shared catalog is topped up, never overwritten (see the note above); everything
				// else is this household's and was just cleared, so a plain INSERT is correct.
				const verb = table === 'titles' ? 'INSERT OR IGNORE INTO' : 'INSERT INTO';
				db.prepare(`${verb} ${table} (${cols}) VALUES (${params})`).run(values);
			}
		}
	});

	try {
		replace();
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('UNIQUE constraint failed') || message.includes('PRIMARY KEY')) {
			throw new BackupRestoreError(
				"This backup's rows clash with data already stored for another family. Nothing was changed."
			);
		}
		throw error;
	}
}
