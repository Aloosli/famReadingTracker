import { db } from './index';
import type { UserRow } from './types';

export function getAllUsers(householdId: number): UserRow[] {
	return db
		.prepare('SELECT * FROM users WHERE household_id = ? ORDER BY id')
		.all(householdId) as UserRow[];
}

export function getUserById(id: number): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

/** Each reader sets their own monthly goal — nobody else's call. */
export function updateMonthlyGoal(userId: number, monthlyGoal: number): void {
	db.prepare('UPDATE users SET monthly_goal = ? WHERE id = ?').run(monthlyGoal, userId);
}

export interface NewUser {
	householdId: number;
	name: string;
	avatarEmoji: string;
	avatarColor: string;
	monthlyGoal: number;
}

/** Creates a reader profile in a household (used by the setup / add-readers wizard). */
export function createUser(input: NewUser): UserRow {
	const result = db
		.prepare(
			`INSERT INTO users (household_id, name, avatar_emoji, avatar_color, reading_source, monthly_goal)
			 VALUES (@householdId, @name, @avatarEmoji, @avatarColor, 'manual', @monthlyGoal)`
		)
		.run(input);
	return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
}

/** Lets a reader rename themselves and choose their own avatar emoji, colour and goal. */
export function updateUserProfile(
	userId: number,
	input: { name: string; avatarEmoji: string; avatarColor: string; monthlyGoal: number }
): void {
	db.prepare(
		`UPDATE users SET name = @name, avatar_emoji = @avatarEmoji,
		        avatar_color = @avatarColor, monthly_goal = @monthlyGoal
		 WHERE id = @id`
	).run({ ...input, id: userId });
}

/** How many books a reader has on their shelf — used to spell out what retiring them removes. */
export function countBooksForUser(userId: number): number {
	const row = db
		.prepare('SELECT COUNT(*) AS n FROM reading_entries WHERE user_id = ?')
		.get(userId) as { n: number };
	return row.n;
}

/**
 * Permanently removes a reader and everything tied to them — entries, sessions, wishlist and
 * earned titles all cascade away (books stay; they belong to the household, not the reader). No undo.
 */
export function deleteUser(userId: number): void {
	db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
