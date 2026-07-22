import { db } from './index';
import { pagesReadForBook, type SessionPos } from '../goal-progress';

export interface FamilyGoalRow {
	id: number;
	household_id: number;
	title: string;
	emoji: string;
	target_pages: number;
	started_at: string;
	achieved_at: string | null;
	created_at: string;
}

export interface GoalContribution {
	user_id: number;
	name: string;
	avatar_emoji: string;
	avatar_color: string;
	pages: number;
}

export interface GoalProgress {
	total: number;
	target: number;
	/** 0-100, clamped — for the bar fill. */
	percent: number;
	remaining: number;
	reached: boolean;
	contributions: GoalContribution[];
}

/** The one live campaign for a household (unachieved), or undefined if none is set. */
export function getActiveGoal(householdId: number): FamilyGoalRow | undefined {
	return db
		.prepare(
			`SELECT * FROM family_goals WHERE household_id = ? AND achieved_at IS NULL
			 ORDER BY id DESC LIMIT 1`
		)
		.get(householdId) as FamilyGoalRow | undefined;
}

/** Reached goals, newest first — kept as little mementos. */
export function getPastGoals(householdId: number, limit = 12): FamilyGoalRow[] {
	return db
		.prepare(
			`SELECT * FROM family_goals WHERE household_id = ? AND achieved_at IS NOT NULL
			 ORDER BY achieved_at DESC LIMIT ?`
		)
		.all(householdId, limit) as FamilyGoalRow[];
}

/**
 * Sets the household's active goal, starting the campaign now (so it fills from zero). Replaces any
 * existing unachieved goal — one live campaign at a time. Achieved goals are left as mementos.
 */
export function setActiveGoal(
	householdId: number,
	input: { title: string; emoji: string; targetPages: number }
): FamilyGoalRow {
	db.prepare(`DELETE FROM family_goals WHERE household_id = ? AND achieved_at IS NULL`).run(householdId);
	const result = db
		.prepare(
			`INSERT INTO family_goals (household_id, title, emoji, target_pages, started_at)
			 VALUES (?, ?, ?, ?, datetime('now'))`
		)
		.run(householdId, input.title, input.emoji, input.targetPages);
	return db
		.prepare(`SELECT * FROM family_goals WHERE id = ?`)
		.get(result.lastInsertRowid) as FamilyGoalRow;
}

/** Stamps a goal reached (idempotent). Once achieved it stops being the active goal. */
export function markGoalAchieved(goalId: number): void {
	db.prepare(
		`UPDATE family_goals SET achieved_at = datetime('now') WHERE id = ? AND achieved_at IS NULL`
	).run(goalId);
}

/** Removes the active goal without recording it as reached (cancel). */
export function clearActiveGoal(householdId: number): void {
	db.prepare(`DELETE FROM family_goals WHERE household_id = ? AND achieved_at IS NULL`).run(householdId);
}

interface SessionRow extends SessionPos {
	book_id: number;
	page_count: number | null;
}

/** Pages a reader has advanced across all their books since a given datetime (e.g. goal start, or
 *  the start of today for a "you added +X today" nudge). */
export function pagesReadSince(userId: number, startedAt: string): number {
	const sessions = db
		.prepare(
			`SELECT rs.book_id, rs.position, rs.position_type, rs.read_at, b.page_count
			 FROM reading_sessions rs JOIN books b ON b.id = rs.book_id
			 WHERE rs.user_id = ? ORDER BY rs.book_id, rs.read_at, rs.id`
		)
		.all(userId) as SessionRow[];

	const finishedInWindow = new Set<number>(
		(
			db
				.prepare(
					`SELECT DISTINCT book_id FROM reading_entries
					 WHERE user_id = ? AND status = 'finished' AND finished_at IS NOT NULL AND finished_at >= ?`
				)
				.all(userId, startedAt) as { book_id: number }[]
		).map((r) => r.book_id)
	);

	let total = 0;
	let i = 0;
	while (i < sessions.length) {
		const bookId = sessions[i].book_id;
		const pageCount = sessions[i].page_count;
		const bookSessions: SessionPos[] = [];
		while (i < sessions.length && sessions[i].book_id === bookId) {
			bookSessions.push(sessions[i]);
			i++;
		}
		total += pagesReadForBook(bookSessions, pageCount, startedAt, finishedInWindow.has(bookId));
	}
	return total;
}

/** Live progress toward a goal: total pages, per-reader contributions, and whether it's reached. */
export function getGoalProgress(goal: FamilyGoalRow): GoalProgress {
	const readers = db
		.prepare(
			`SELECT id, name, avatar_emoji, avatar_color FROM users WHERE household_id = ? ORDER BY id`
		)
		.all(goal.household_id) as {
		id: number;
		name: string;
		avatar_emoji: string;
		avatar_color: string;
	}[];

	const contributions: GoalContribution[] = [];
	let total = 0;
	for (const r of readers) {
		const pages = pagesReadSince(r.id, goal.started_at);
		total += pages;
		contributions.push({
			user_id: r.id,
			name: r.name,
			avatar_emoji: r.avatar_emoji,
			avatar_color: r.avatar_color,
			pages
		});
	}
	contributions.sort((a, b) => b.pages - a.pages);

	const percent = goal.target_pages > 0 ? Math.min(100, Math.round((total / goal.target_pages) * 100)) : 0;
	return {
		total,
		target: goal.target_pages,
		percent,
		remaining: Math.max(0, goal.target_pages - total),
		reached: total >= goal.target_pages,
		contributions
	};
}
