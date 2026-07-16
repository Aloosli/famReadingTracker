-- Family Reading Tracker schema

-- A household is one family/tenant. Today there is exactly one (see index.ts, which ensures a
-- default household and adopts every existing reader and book into it). When accounts land, each
-- sign-up creates its own household and readers/books are scoped to it — the columns are already here.
CREATE TABLE IF NOT EXISTS households (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL DEFAULT 'My Family',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	household_id INTEGER REFERENCES households(id),
	name TEXT NOT NULL,
	avatar_emoji TEXT NOT NULL DEFAULT '📚',
	avatar_color TEXT NOT NULL DEFAULT '#c97b4a',
	reading_source TEXT NOT NULL DEFAULT 'manual' CHECK (reading_source IN ('manual', 'bookorbit')),
	monthly_goal INTEGER NOT NULL DEFAULT 4,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	household_id INTEGER REFERENCES households(id),
	title TEXT NOT NULL,
	author TEXT,
	cover_url TEXT,
	google_books_id TEXT,
	isbn TEXT,
	page_count INTEGER,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reading_entries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'finished')),
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	finished_at TEXT,
	reaction TEXT CHECK (reaction IN ('loved', 'liked', 'meh')),
	-- When set, the book is "set aside" (paused): still status 'reading', but not actively read.
	set_aside_at TEXT,
	-- Set for books logged as already-read: the reader said it's finished but never said when they
	-- started, so started_at above is a placeholder rather than something we observed. Anything
	-- reasoning about how long a book took must ignore these.
	start_unknown INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reading_entries_user ON reading_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_entries_book ON reading_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_entries_status ON reading_entries(status);

CREATE TABLE IF NOT EXISTS reading_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	position_type TEXT NOT NULL CHECK (position_type IN ('page', 'percent')),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_book ON reading_sessions(user_id, book_id);

-- "Up Next": books a reader wants to read but hasn't started.
CREATE TABLE IF NOT EXISTS wishlist (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	added_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

CREATE TABLE IF NOT EXISTS titles (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	key TEXT NOT NULL UNIQUE,
	label TEXT NOT NULL,
	emoji TEXT NOT NULL,
	color TEXT NOT NULL DEFAULT '#c97b4a',
	description TEXT NOT NULL DEFAULT '',
	is_temporary INTEGER NOT NULL DEFAULT 0,
	duration_days INTEGER
);

CREATE TABLE IF NOT EXISTS user_titles (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title_key TEXT NOT NULL REFERENCES titles(key),
	earned_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT,
	is_active INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_titles_user ON user_titles(user_id);
