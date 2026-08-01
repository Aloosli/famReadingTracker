/**
 * Pure backup format definitions and validation — no database — so the "is this a real backup?"
 * guard and the household-scoping rules can be tested in isolation and shared between the export
 * builder and the restore path.
 */

export const BACKUP_FORMAT = 'famreadingtracker-backup';

/**
 * A bump signals an incompatible change to the backup shape, so a future importer can refuse (or
 * migrate) files it doesn't understand rather than restoring garbage.
 *
 * v1 → v2: added households, freeze_bank, streak_freeze_days and family_goals. v1 backups silently
 * omitted them, so restoring one lost every banked streak freeze and the family goal. v2 files
 * carry them; v1 files are still accepted and those tables simply come back empty (see
 * `normalizeBackup`) — exactly what a v1 restore did, minus the silence.
 */
export const BACKUP_VERSION = 2;

/**
 * Tables in dependency order: a parent always precedes the rows that reference it. Restore inserts
 * in this order and clears in reverse, so foreign keys are satisfied at every step.
 */
export const BACKUP_TABLES = [
	'titles',
	'households',
	'users',
	'books',
	'reading_entries',
	'reading_sessions',
	'wishlist',
	'user_titles',
	'freeze_bank',
	'streak_freeze_days',
	'family_goals'
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * The tables a v1 backup was guaranteed to contain. Validation requires only these, so files
 * exported before v2 still restore. Anything outside this set is optional on import.
 */
export const REQUIRED_BACKUP_TABLES = [
	'titles',
	'users',
	'books',
	'reading_entries',
	'reading_sessions',
	'wishlist',
	'user_titles'
] as const;

/**
 * How each table is tied to a household — the single place that answers "which rows are this
 * family's?". Export selects by these rules and restore clears by them, so the two can never drift
 * apart and leave a backup that reads more than it writes (or vice versa).
 *
 *  - `id`           the households row itself
 *  - `household_id` owns the column directly
 *  - `user_id`      belongs to a reader, and scopes through them
 *  - `global`       not household data at all (the code-seeded title catalog, shared by everyone)
 */
export type ScopeRule = 'id' | 'household_id' | 'user_id' | 'global';

export const HOUSEHOLD_SCOPE: Record<BackupTable, ScopeRule> = {
	titles: 'global',
	households: 'id',
	users: 'household_id',
	books: 'household_id',
	reading_entries: 'user_id',
	reading_sessions: 'user_id',
	wishlist: 'user_id',
	user_titles: 'user_id',
	freeze_bank: 'user_id',
	streak_freeze_days: 'user_id',
	family_goals: 'household_id'
};

/** Rows of `table` belonging to one household. Takes the household id as its only parameter. */
export function scopedSelect(table: BackupTable): string {
	switch (HOUSEHOLD_SCOPE[table]) {
		case 'global':
			return `SELECT * FROM ${table}`;
		case 'id':
			return `SELECT * FROM ${table} WHERE id = ?`;
		case 'household_id':
			return `SELECT * FROM ${table} WHERE household_id = ?`;
		case 'user_id':
			return `SELECT * FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE household_id = ?)`;
	}
}

/**
 * Clears one household's rows from `table`, ahead of re-inserting them from a backup. Global and
 * households rows are deliberately never deleted: the title catalog is shared, and dropping the
 * household row itself would cascade away the very family being restored.
 */
export function scopedDelete(table: BackupTable): string | null {
	switch (HOUSEHOLD_SCOPE[table]) {
		case 'global':
		case 'id':
			return null;
		case 'household_id':
			return `DELETE FROM ${table} WHERE household_id = ?`;
		case 'user_id':
			return `DELETE FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE household_id = ?)`;
	}
}

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
	// Only the v1 tables are mandatory — see REQUIRED_BACKUP_TABLES. Optional tables still have to be
	// arrays when present, so a malformed v2 file is caught rather than half-restored.
	if (!REQUIRED_BACKUP_TABLES.every((table) => Array.isArray(candidate.data![table]))) return false;
	return BACKUP_TABLES.every(
		(table) => candidate.data![table] === undefined || Array.isArray(candidate.data![table])
	);
}

/**
 * Fills in tables a backup predates, so the restore path can treat every version uniformly and
 * never has to ask "was this a v1 file?".
 */
export function normalizeBackup(backup: ParsedBackup): Record<BackupTable, Record<string, unknown>[]> {
	return Object.fromEntries(BACKUP_TABLES.map((table) => [table, backup.data[table] ?? []])) as Record<
		BackupTable,
		Record<string, unknown>[]
	>;
}
