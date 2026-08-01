/**
 * One book as returned by a lookup, whichever source found it. Google Books is tried first and
 * Open Library backs it up, so this deliberately isn't named after either.
 */
export interface BookSearchResult {
	/**
	 * The finding source's own id for this book: a bare Google volume id, or an Open Library key
	 * prefixed `ol:`. Stored in `books.google_books_id` — the column predates the second source and
	 * keeping its name avoids a migration for no behavioural gain. Two results from different
	 * sources still de-duplicate on ISBN, which findOrCreateBook checks anyway.
	 */
	sourceId: string;
	title: string;
	author: string | null;
	coverUrl: string | null;
	isbn: string | null;
	pageCount: number | null;
}

export interface TitleGrant {
	key: string;
	label: string;
	emoji: string;
	color: string;
}
