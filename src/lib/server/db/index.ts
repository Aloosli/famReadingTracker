import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { env } from '$env/dynamic/private';
import { TITLE_CATALOG } from '../titles/config';
import { seedTitleCatalog } from './titles';
// Import the schema as an inlined string (Vite `?raw`) rather than reading the .sql file at runtime:
// adapter-node bundles server code into chunks and does not copy the .sql asset next to them, so a
// readFileSync(__dirname, 'schema.sql') breaks in the production build.
import schema from './schema.sql?raw';

export const dbPath = env.DATABASE_PATH || join(process.cwd(), 'data', 'reading-tracker.db');

// better-sqlite3 will not create missing parent directories. This module is imported at build time
// (SvelteKit's route analysis) and on a fresh host before any data directory exists, so make it.
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(schema);

// Migrate databases created before page_count existed on books.
const bookColumns = db.prepare('PRAGMA table_info(books)').all() as { name: string }[];
if (!bookColumns.some((column) => column.name === 'page_count')) {
	db.exec('ALTER TABLE books ADD COLUMN page_count INTEGER');
}

// Migrate databases created before titles had their own colour.
const titleColumns = db.prepare('PRAGMA table_info(titles)').all() as { name: string }[];
if (!titleColumns.some((column) => column.name === 'color')) {
	db.exec("ALTER TABLE titles ADD COLUMN color TEXT NOT NULL DEFAULT '#c97b4a'");
}

// Migrate databases created before titles carried a tap-to-reveal description. seedTitleCatalog
// (on every start) fills in the real blurbs from the code catalog.
if (!titleColumns.some((column) => column.name === 'description')) {
	db.exec("ALTER TABLE titles ADD COLUMN description TEXT NOT NULL DEFAULT ''");
}

// Migrate databases created before reading_entries could hold a finish reaction
// or a "set aside" (paused) flag.
const entryColumns = db.prepare('PRAGMA table_info(reading_entries)').all() as { name: string }[];
if (!entryColumns.some((column) => column.name === 'reaction')) {
	db.exec('ALTER TABLE reading_entries ADD COLUMN reaction TEXT');
}
if (!entryColumns.some((column) => column.name === 'set_aside_at')) {
	db.exec('ALTER TABLE reading_entries ADD COLUMN set_aside_at TEXT');
}
// ...or record that an entry's start date was never observed (logged as already-read).
if (!entryColumns.some((column) => column.name === 'start_unknown')) {
	db.exec('ALTER TABLE reading_entries ADD COLUMN start_unknown INTEGER NOT NULL DEFAULT 0');
}

// Migrate databases created before readers could bank "streak freezes".
const userColumnsForFreezes = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!userColumnsForFreezes.some((column) => column.name === 'streak_freezes')) {
	db.exec('ALTER TABLE users ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 0');
}

// Migrate databases created before a session recorded when the reading actually happened
// (read_at), separate from when the row was saved (created_at). Backfill it from created_at so
// existing history is unchanged: every past log is treated as read at the moment it was recorded.
const sessionColumns = db.prepare('PRAGMA table_info(reading_sessions)').all() as { name: string }[];
if (!sessionColumns.some((column) => column.name === 'read_at')) {
	// ALTER can't add a NOT NULL column with a non-constant default, so add it nullable, backfill,
	// then rely on the app always supplying read_at on insert (schema.sql defaults it for fresh DBs).
	db.exec('ALTER TABLE reading_sessions ADD COLUMN read_at TEXT');
	db.exec('UPDATE reading_sessions SET read_at = created_at WHERE read_at IS NULL');
}

// Multi-tenancy foundation: every reader and book belongs to a household. Databases created before
// households existed get the column added here, then adopted into a default household below.
const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!userColumns.some((column) => column.name === 'household_id')) {
	db.exec('ALTER TABLE users ADD COLUMN household_id INTEGER REFERENCES households(id)');
}
const bookColumnsForHousehold = db.prepare('PRAGMA table_info(books)').all() as { name: string }[];
if (!bookColumnsForHousehold.some((column) => column.name === 'household_id')) {
	db.exec('ALTER TABLE books ADD COLUMN household_id INTEGER REFERENCES households(id)');
}

// Index the household columns here (not in schema.sql) so they're created only after the columns
// exist — on an upgraded database the ALTER TABLE above runs after schema.sql.
db.exec('CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_books_household ON books(household_id)');

// Guarantee a default household and adopt any rows that predate it. Safe to run on every start.
// Inlined (rather than importing households.ts) to avoid a circular import at module-eval time:
// households.ts imports `db` from here, so calling into it before this module finishes initializing
// would hit an uninitialized binding under Vite SSR.
const existingHousehold = db.prepare('SELECT id FROM households ORDER BY id LIMIT 1').get() as
	| { id: number }
	| undefined;
const defaultHouseholdId =
	existingHousehold?.id ??
	Number(db.prepare("INSERT INTO households (name) VALUES ('My Family')").run().lastInsertRowid);
db.prepare('UPDATE users SET household_id = ? WHERE household_id IS NULL').run(defaultHouseholdId);
db.prepare('UPDATE books SET household_id = ? WHERE household_id IS NULL').run(defaultHouseholdId);

// No profile seeding: a fresh database starts empty and the app sends the first visitor
// to the setup wizard (/setup) to create their own family of readers.

// Keep the titles table in sync with the code-defined catalog on every start.
seedTitleCatalog(TITLE_CATALOG);

// Invariant: a permanent title never keeps an expiry. Badges that used to be temporary are now
// permanent collectibles, so any still-ticking expiry on an already-granted one is cleared here —
// nobody loses a badge they earned. Idempotent (after the first clear nothing matches), and it
// self-heals if a title is ever flipped from temporary to permanent in the catalog again.
db.prepare(
	`UPDATE user_titles SET expires_at = NULL
	 WHERE expires_at IS NOT NULL
	   AND title_key IN (SELECT key FROM titles WHERE is_temporary = 0)`
).run();
