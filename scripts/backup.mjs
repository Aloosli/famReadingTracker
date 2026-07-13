// Daily WAL-safe backup of the reading-tracker database, with rotation.
//
// Designed to run from cron *hourly*: it exits immediately if today's backup already
// exists, so on machines that aren't always on (WSL, a laptop) the day's backup is made
// whenever the machine happens to be awake, instead of being missed at a fixed hour.
//
//   node scripts/backup.mjs [--db path] [--dest dir] [--keep days]
//
// Defaults: --db data/reading-tracker.db  --dest backups/  --keep 14
// Uses SQLite's online backup API (via better-sqlite3), which is safe while the app is
// running — it takes a consistent snapshot without blocking writers.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dbPath = arg('db', 'data/reading-tracker.db');
const destDir = arg('dest', 'backups');
const keepDays = Number(arg('keep', '14'));

const today = new Date().toISOString().slice(0, 10);
const target = path.join(destDir, `reading-tracker-${today}.db`);

if (!fs.existsSync(dbPath)) {
	console.error(`[backup] database not found at ${dbPath} — nothing to back up`);
	process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

if (fs.existsSync(target)) {
	process.exit(0); // today's backup already made — hourly cron makes this a no-op
}

const db = new Database(dbPath, { readonly: true });
try {
	await db.backup(target);

	// A backup that can't be opened is worse than none — verify before trusting it. Flattening
	// to rollback-journal mode makes the backup one self-contained file (no -wal/-shm sidecars).
	const copy = new Database(target);
	copy.pragma('journal_mode = DELETE');
	const check = copy.pragma('quick_check', { simple: true });
	copy.close();
	if (check !== 'ok') {
		fs.unlinkSync(target);
		throw new Error(`integrity check failed: ${check}`);
	}

	const size = (fs.statSync(target).size / 1024).toFixed(0);
	console.log(`[backup] ${new Date().toISOString()} wrote ${target} (${size} KiB)`);
} finally {
	db.close();
}

// Rotate by the date in the filename (not mtime, which copying can disturb).
const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
for (const file of fs.readdirSync(destDir)) {
	const match = /^reading-tracker-(\d{4}-\d{2}-\d{2})\.db$/.exec(file);
	if (match && match[1] < cutoff) {
		fs.unlinkSync(path.join(destDir, file));
		console.log(`[backup] rotated out ${file}`);
	}
}
