import { db } from './index';
import type { TitleCatalogEntry } from '../titles/config';

export interface TitleRow {
	id: number;
	key: string;
	label: string;
	emoji: string;
	color: string;
	description: string;
	is_temporary: number;
	duration_days: number | null;
}

export interface UserTitleRow {
	id: number;
	user_id: number;
	title_key: string;
	earned_at: string;
	expires_at: string | null;
	is_active: number;
}

export type DisplayableUserTitle = UserTitleRow &
	Pick<TitleRow, 'label' | 'emoji' | 'color' | 'description'>;

/**
 * A title from the full catalog, annotated with this user's relationship to it. Always
 * includes every title (earned or not) so a future "locked/mystery slot" UI is a rendering
 * change, not a data-layer one — today's UI just filters to `earned`.
 */
export interface PatchInfo {
	key: string;
	label: string;
	emoji: string;
	color: string;
	description: string;
	isTemporary: boolean;
	earned: boolean;
	isActive: boolean;
	earnedAt: string | null;
	expiresAt: string | null;
}

/** Upserts the code-defined catalog into the titles table so labels/emoji/colour stay in sync. */
export function seedTitleCatalog(catalog: TitleCatalogEntry[]): void {
	const upsert = db.prepare(
		`INSERT INTO titles (key, label, emoji, color, description, is_temporary, duration_days)
		 VALUES (@key, @label, @emoji, @color, @description, @isTemporary, @durationDays)
		 ON CONFLICT(key) DO UPDATE SET
			label = excluded.label,
			emoji = excluded.emoji,
			color = excluded.color,
			description = excluded.description,
			is_temporary = excluded.is_temporary,
			duration_days = excluded.duration_days`
	);
	const insertMany = db.transaction((entries: TitleCatalogEntry[]) => {
		for (const entry of entries) {
			upsert.run({
				key: entry.key,
				label: entry.label,
				emoji: entry.emoji,
				color: entry.color,
				description: entry.description,
				isTemporary: entry.isTemporary ? 1 : 0,
				durationDays: entry.durationDays
			});
		}
	});
	insertMany(catalog);
}

export function getTitle(key: string): TitleRow | undefined {
	return db.prepare('SELECT * FROM titles WHERE key = ?').get(key) as TitleRow | undefined;
}

/** True if the user currently holds this title — permanent, or temporary and not yet expired. */
export function holdsTitle(userId: number, key: string): boolean {
	const row = db
		.prepare(
			`SELECT 1 FROM user_titles
			 WHERE user_id = ? AND title_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
			 LIMIT 1`
		)
		.get(userId, key);
	return row !== undefined;
}

/** Removes a title a user holds — used when un-finishing a book invalidates a milestone. */
export function revokeTitle(userId: number, key: string): void {
	db.prepare('DELETE FROM user_titles WHERE user_id = ? AND title_key = ?').run(userId, key);
}

/**
 * The most recent earned_at for a title (a UTC "YYYY-MM-DD HH:MM:SS" string), regardless of whether
 * it has since expired, or null if never earned. The engine uses this to stop event-based temporary
 * titles re-granting from an old, still-in-history event once the badge lapses.
 */
export function lastEarnedAt(userId: number, key: string): string | null {
	const row = db
		.prepare(`SELECT MAX(earned_at) AS t FROM user_titles WHERE user_id = ? AND title_key = ?`)
		.get(userId, key) as { t: string | null } | undefined;
	return row?.t ?? null;
}

export function grantTitle(userId: number, key: string, expiresAt: string | null): UserTitleRow {
	const result = db
		.prepare(
			`INSERT INTO user_titles (user_id, title_key, earned_at, expires_at, is_active)
			 VALUES (?, ?, datetime('now'), ?, 0)`
		)
		.run(userId, key, expiresAt);
	return db.prepare('SELECT * FROM user_titles WHERE id = ?').get(result.lastInsertRowid) as UserTitleRow;
}

/** Every non-expired title a user holds, most recently earned first. */
export function getActiveUserTitles(userId: number): DisplayableUserTitle[] {
	return db
		.prepare(
			`SELECT ut.*, t.label, t.emoji, t.color, t.description
			 FROM user_titles ut
			 JOIN titles t ON t.key = ut.title_key
			 WHERE ut.user_id = ? AND (ut.expires_at IS NULL OR ut.expires_at > datetime('now'))
			 ORDER BY ut.earned_at DESC`
		)
		.all(userId) as DisplayableUserTitle[];
}

export interface EarnedPatch {
	key: string;
	label: string;
	emoji: string;
	color: string;
	earned_at: string;
}

/**
 * Every distinct patch a user earned within a calendar year (UTC) — including temporary ones
 * that have since expired, since they were still won that year. For the yearbook.
 */
export function getPatchesEarnedInYear(userId: number, year: string): EarnedPatch[] {
	return db
		.prepare(
			`SELECT t.key, t.label, t.emoji, t.color, MIN(ut.earned_at) AS earned_at
			 FROM user_titles ut
			 JOIN titles t ON t.key = ut.title_key
			 WHERE ut.user_id = ? AND strftime('%Y', ut.earned_at) = ?
			 GROUP BY t.key
			 ORDER BY earned_at`
		)
		.all(userId, year) as EarnedPatch[];
}

/**
 * The full title catalog for one user, each entry flagged with whether they currently hold
 * it (and whether it's their active banner). Filter to `earned` for today's trophy grid.
 */
export function getPatchesForUser(userId: number): PatchInfo[] {
	const rows = db
		.prepare(
			`SELECT t.key, t.label, t.emoji, t.color, t.description, t.is_temporary,
			        ut.earned_at, ut.expires_at, ut.is_active
			 FROM titles t
			 LEFT JOIN user_titles ut ON ut.title_key = t.key AND ut.user_id = ?
			     AND (ut.expires_at IS NULL OR ut.expires_at > datetime('now'))
			     AND ut.id = (
			         SELECT id FROM user_titles ut2
			         WHERE ut2.user_id = ? AND ut2.title_key = t.key
			           AND (ut2.expires_at IS NULL OR ut2.expires_at > datetime('now'))
			         ORDER BY ut2.earned_at DESC, ut2.id DESC LIMIT 1
			     )
			 ORDER BY t.id`
		)
		.all(userId, userId) as {
		key: string;
		label: string;
		emoji: string;
		color: string;
		description: string;
		is_temporary: number;
		earned_at: string | null;
		expires_at: string | null;
		is_active: number | null;
	}[];

	return rows.map((row) => ({
		key: row.key,
		label: row.label,
		emoji: row.emoji,
		color: row.color,
		description: row.description,
		isTemporary: row.is_temporary === 1,
		earned: row.earned_at != null,
		isActive: row.is_active === 1,
		earnedAt: row.earned_at,
		expiresAt: row.expires_at
	}));
}

/** The active display title for every user that has one, keyed by user_id. */
export function getDisplayTitlesForAllUsers(): Map<number, DisplayableUserTitle> {
	const rows = db
		.prepare(
			`SELECT ut.*, t.label, t.emoji, t.color, t.description
			 FROM user_titles ut
			 JOIN titles t ON t.key = ut.title_key
			 WHERE ut.is_active = 1 AND (ut.expires_at IS NULL OR ut.expires_at > datetime('now'))`
		)
		.all() as DisplayableUserTitle[];
	return new Map(rows.map((row) => [row.user_id, row]));
}

/** The title a user has chosen to display, if any and if it hasn't expired. */
export function getDisplayTitle(userId: number): DisplayableUserTitle | undefined {
	return db
		.prepare(
			`SELECT ut.*, t.label, t.emoji, t.color, t.description
			 FROM user_titles ut
			 JOIN titles t ON t.key = ut.title_key
			 WHERE ut.user_id = ? AND ut.is_active = 1 AND (ut.expires_at IS NULL OR ut.expires_at > datetime('now'))
			 LIMIT 1`
		)
		.get(userId) as DisplayableUserTitle | undefined;
}

/** Sets which held title (or none) a user wants shown next to their name. */
export function setActiveTitle(userId: number, titleKey: string | null): void {
	const apply = db.transaction(() => {
		db.prepare('UPDATE user_titles SET is_active = 0 WHERE user_id = ?').run(userId);
		if (titleKey) {
			db.prepare(
				`UPDATE user_titles SET is_active = 1
				 WHERE user_id = ? AND title_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`
			).run(userId, titleKey);
		}
	});
	apply();
}
