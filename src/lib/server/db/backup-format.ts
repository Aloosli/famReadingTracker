/**
 * Pure backup format definitions and validation — no database — so the "is this a real backup?"
 * guard can be tested in isolation and shared between the export builder and the restore path.
 */

export const BACKUP_FORMAT = 'famreadingtracker-backup';

/**
 * A bump signals an incompatible change to the backup shape, so a future importer can refuse (or
 * migrate) files it doesn't understand rather than restoring garbage.
 */
export const BACKUP_VERSION = 1;

/**
 * Tables in dependency order: a parent always precedes the rows that reference it. Restore inserts
 * in this order and clears in reverse, so foreign keys are satisfied at every step.
 */
export const BACKUP_TABLES = [
	'titles',
	'users',
	'books',
	'reading_entries',
	'reading_sessions',
	'wishlist',
	'user_titles'
] as const;

export interface ParsedBackup {
	format: string;
	version: number;
	data: Record<string, Record<string, unknown>[]>;
}

/** Guards against restoring something that isn't ours, or a newer format we can't understand yet. */
export function isValidBackup(value: unknown): value is ParsedBackup {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<ParsedBackup>;
	if (candidate.format !== BACKUP_FORMAT) return false;
	if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) return false;
	if (!candidate.data || typeof candidate.data !== 'object') return false;
	return BACKUP_TABLES.every((table) => Array.isArray(candidate.data![table]));
}
