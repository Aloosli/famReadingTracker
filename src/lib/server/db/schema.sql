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
	-- When the reading actually happened. For a live log this equals created_at; for an
	-- after-the-fact log it's the date/time the reader chose. Every "when did they read"
	-- question — streaks, time-of-day patches, seasonal windows — reads this, never created_at.
	read_at TEXT NOT NULL DEFAULT (datetime('now')),
	-- When the row was recorded. Immutable audit/order key: the most recently recorded session
	-- is the reader's current position, even if an older reading date was filled in afterwards.
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_book ON reading_sessions(user_id, book_id);

-- One row per banked (unspent) streak freeze, with WHEN it was earned. The earned time matters: a
-- freeze can only protect a day that was missed *after* it was banked — no retroactive protection.
-- (Replaces the bare users.streak_freezes count, which had no earn time.)
CREATE TABLE IF NOT EXISTS freeze_bank (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	-- The sitting that earned this freeze, so correcting or deleting a mistyped log can take back
	-- the freeze it wrongly banked. NULL for freezes banked before this was tracked, and for ones
	-- whose session has since gone (ON DELETE SET NULL) — a NULL here just means "can't attribute".
	session_id INTEGER REFERENCES reading_sessions(id) ON DELETE SET NULL,
	earned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_freeze_bank_user ON freeze_bank(user_id);

-- Days a reader's streak was kept alive by spending a banked freeze. These count as active days in
-- the streak calc, so a covered miss doesn't break it.
CREATE TABLE IF NOT EXISTS streak_freeze_days (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	date TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_streak_freeze_days_user ON streak_freeze_days(user_id);

-- "Up Next": books a reader wants to read but hasn't started.
CREATE TABLE IF NOT EXISTS wishlist (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	added_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- A shared, cooperative reading goal for a household — everyone's pages read fill one bar toward a
-- real-world reward (e.g. a cinema trip). One live campaign at a time (achieved_at IS NULL);
-- reached goals are kept as mementos. Progress counts pages read since started_at (see db/goals.ts).
CREATE TABLE IF NOT EXISTS family_goals (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	emoji TEXT NOT NULL DEFAULT '🎯',
	target_pages INTEGER NOT NULL,
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	achieved_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_family_goals_household ON family_goals(household_id);

-- Answers from the book lookup APIs, keyed by the normalised search text. Not family data: book
-- metadata is the same for everyone, so this is deliberately NOT scoped to a household and is NOT
-- part of a backup — it's a disposable speed-and-quota layer that rebuilds itself.
--
-- It exists because every household shares one Google Books API key, and that key has a daily
-- request ceiling. Families search for the same handful of titles, so caching turns what would be
-- N families' worth of requests into one, and keeps search working when the API is down.
CREATE TABLE IF NOT EXISTS book_lookup_cache (
	query_key TEXT PRIMARY KEY,
	results_json TEXT NOT NULL,
	-- Which source actually answered, for debugging a bad cached result.
	source TEXT NOT NULL,
	fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_book_lookup_cache_fetched ON book_lookup_cache(fetched_at);

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
