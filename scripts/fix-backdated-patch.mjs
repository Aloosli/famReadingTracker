// One-off maintenance: correct a session that was logged after the fact under the old code (which
// timestamped reading at the moment it was recorded), and drop any patch that mis-timing wrongly
// earned. Use it for the "logged last night's reading this morning → got Early Bird" case.
//
// Deleting the patch alone doesn't stick: the offending session still carries a morning time, so
// the next progress log re-grants it. This retimes the session to when the reading actually
// happened AND revokes the grant, so it can't come back (and the correct patch can, later).
//
//   node scripts/fix-backdated-patch.mjs --reader Finn --list
//   node scripts/fix-backdated-patch.mjs --reader Finn --session 42 --to "2026-07-21 22:00:00" \
//     --revoke early_bird --commit
//
// Dry-run by default: prints what it would do and changes nothing until you add --commit.
// Datetimes are UTC "YYYY-MM-DD HH:MM:SS", matching the rest of the app. Stop the app before
// committing (the DB uses WAL — writing underneath a running server can corrupt it).

import Database from 'better-sqlite3';
import fs from 'node:fs';

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const dbPath = arg('db', 'data/reading-tracker.db');
const readerName = arg('reader', null);
const sessionId = arg('session', null);
const to = arg('to', null);
const revokeKey = arg('revoke', null);
const list = flag('list');
const commit = flag('commit');

if (!fs.existsSync(dbPath)) {
	console.error(`[fix] database not found at ${dbPath}`);
	process.exit(1);
}
if (!readerName) {
	console.error('[fix] --reader <name> is required');
	process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
// Wait out any brief write lock from the running app rather than failing, so this is safe to run
// live via `docker exec` (like scripts/backup.mjs) without stopping the container. The writes are a
// single quick transaction, which WAL mode serialises against the app's own writes.
db.pragma('busy_timeout = 5000');

const reader = db.prepare('SELECT id, name FROM users WHERE name = ? COLLATE NOCASE').get(readerName);
if (!reader) {
	console.error(`[fix] no reader named "${readerName}"`);
	process.exit(1);
}
console.log(`[fix] reader: ${reader.name} (id ${reader.id})`);

if (list || (!sessionId && !revokeKey)) {
	const rows = db
		.prepare(
			`SELECT rs.id, rs.read_at, rs.created_at, rs.position, rs.position_type, b.title
			 FROM reading_sessions rs JOIN books b ON b.id = rs.book_id
			 WHERE rs.user_id = ? ORDER BY rs.created_at DESC LIMIT 15`
		)
		.all(reader.id);
	console.log(`\n[fix] most recent sessions (read_at is what the patches use):`);
	for (const r of rows) {
		console.log(
			`  #${r.id}  read_at=${r.read_at}  (recorded ${r.created_at})  ${r.position}${
				r.position_type === 'percent' ? '%' : 'p'
			}  — ${r.title}`
		);
	}
	console.log(`\n[fix] then re-run with --session <id> --to "<UTC datetime>" [--revoke <key>] --commit`);
	if (!sessionId && !revokeKey) process.exit(0);
}

const apply = db.transaction(() => {
	if (sessionId) {
		if (!to) throw new Error('--to "<UTC datetime>" is required when retiming a --session');
		const session = db
			.prepare('SELECT id FROM reading_sessions WHERE id = ? AND user_id = ?')
			.get(Number(sessionId), reader.id);
		if (!session) throw new Error(`session #${sessionId} not found for ${reader.name}`);
		console.log(`[fix] session #${sessionId}: read_at → ${to}`);
		if (commit) db.prepare('UPDATE reading_sessions SET read_at = ? WHERE id = ?').run(to, Number(sessionId));
	}
	if (revokeKey) {
		const held = db
			.prepare('SELECT COUNT(*) n FROM user_titles WHERE user_id = ? AND title_key = ?')
			.get(reader.id, revokeKey).n;
		console.log(`[fix] revoke patch "${revokeKey}": ${held} grant(s) held`);
		if (commit) db.prepare('DELETE FROM user_titles WHERE user_id = ? AND title_key = ?').run(reader.id, revokeKey);
	}
});
apply();

console.log(commit ? '\n[fix] committed.' : '\n[fix] dry run — add --commit to apply.');
db.close();
