import { db } from './index';
import { getDefaultHouseholdId } from './households';
import { BACKUP_FORMAT, BACKUP_TABLES, BACKUP_VERSION, isValidBackup, type ParsedBackup } from './backup-format';

// Re-exported so existing import sites (the export endpoint, the restore action) keep working.
export { BACKUP_VERSION, isValidBackup, type ParsedBackup };

export interface BackupSummary {
	readers: number;
	books: number;
	entries: number;
}

/** Headline counts for the Data & backup page — "what's in the box" before you download it. */
export function getBackupSummary(): BackupSummary {
	const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
	return {
		readers: count('SELECT COUNT(*) AS n FROM users'),
		books: count('SELECT COUNT(*) AS n FROM books'),
		entries: count('SELECT COUNT(*) AS n FROM reading_entries')
	};
}

/**
 * A complete, self-contained snapshot of every table (including the code-seeded title catalog, so an
 * export is faithful even if the catalog later changes). Ordered so the importer can insert parents
 * before the rows that reference them.
 */
export function buildBackup() {
	const all = (table: string) => db.prepare(`SELECT * FROM ${table}`).all();
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		data: Object.fromEntries(BACKUP_TABLES.map((table) => [table, all(table)]))
	};
}

/**
 * Replaces ALL current data with the contents of a backup. Runs in a single transaction, so a
 * failure part-way through rolls back and leaves the existing data untouched.
 */
export function restoreBackup(backup: ParsedBackup): void {
	const replace = db.transaction(() => {
		// Clear children before parents.
		for (const table of [...BACKUP_TABLES].reverse()) {
			db.prepare(`DELETE FROM ${table}`).run();
		}
		// Re-insert parents before children, preserving original ids so foreign keys still line up.
		for (const table of BACKUP_TABLES) {
			for (const row of backup.data[table]) {
				const columns = Object.keys(row);
				if (columns.length === 0) continue;
				const cols = columns.map((c) => `"${c}"`).join(', ');
				const params = columns.map((c) => `@${c}`).join(', ');
				db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${params})`).run(row);
			}
		}
		// Backups taken before multi-tenancy have no household_id; adopt those rows into the default
		// household so they stay visible (getAllUsers and friends filter by household).
		const householdId = getDefaultHouseholdId();
		db.prepare('UPDATE users SET household_id = ? WHERE household_id IS NULL').run(householdId);
		db.prepare('UPDATE books SET household_id = ? WHERE household_id IS NULL').run(householdId);
	});
	replace();
}
