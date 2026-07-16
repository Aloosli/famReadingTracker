import { db } from './index';
import type { BookRow } from './types';

export interface BookInput {
	title: string;
	author?: string | null;
	coverUrl?: string | null;
	googleBooksId?: string | null;
	isbn?: string | null;
	pageCount?: number | null;
}

export function findBookByGoogleId(
	householdId: number,
	googleBooksId: string
): BookRow | undefined {
	return db
		.prepare('SELECT * FROM books WHERE household_id = ? AND google_books_id = ?')
		.get(householdId, googleBooksId) as BookRow | undefined;
}

export function findBookByIsbn(householdId: number, isbn: string): BookRow | undefined {
	return db
		.prepare('SELECT * FROM books WHERE household_id = ? AND isbn = ?')
		.get(householdId, isbn) as BookRow | undefined;
}

/**
 * Matches a typed-in book, which carries no ids — so the reader's own words are all there is to
 * go on. Case- and whitespace-insensitive, and treats a missing author as its own value so
 * "Dune"/no-author matches "Dune"/no-author rather than any Dune.
 */
export function findBookByTitleAuthor(
	householdId: number,
	title: string,
	author: string | null
): BookRow | undefined {
	return db
		.prepare(
			`SELECT * FROM books
			 WHERE household_id = ?
			   AND lower(trim(title)) = lower(trim(?))
			   AND ifnull(lower(trim(author)), '') = ifnull(lower(trim(?)), '')
			 ORDER BY id LIMIT 1`
		)
		.get(householdId, title, author) as BookRow | undefined;
}

export function createBook(householdId: number, input: BookInput): BookRow {
	const result = db
		.prepare(
			`INSERT INTO books (household_id, title, author, cover_url, google_books_id, isbn, page_count)
			 VALUES (@householdId, @title, @author, @coverUrl, @googleBooksId, @isbn, @pageCount)`
		)
		.run({
			householdId,
			title: input.title,
			author: input.author ?? null,
			coverUrl: input.coverUrl ?? null,
			googleBooksId: input.googleBooksId ?? null,
			isbn: input.isbn ?? null,
			pageCount: input.pageCount ?? null
		});
	return db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid) as BookRow;
}

/** Lets a reader correct the page count later (e.g. a different physical edition). */
export function updateBookPageCount(bookId: number, pageCount: number | null): void {
	db.prepare('UPDATE books SET page_count = ? WHERE id = ?').run(pageCount, bookId);
}

/**
 * Reuses an existing book row within the household when we recognize it (by Google Books id or ISBN),
 * otherwise creates one. Books are scoped per household so one family's manual edits (titles, page
 * counts) never touch another's.
 */
export function findOrCreateBook(householdId: number, input: BookInput): BookRow {
	if (input.googleBooksId) {
		const existing = findBookByGoogleId(householdId, input.googleBooksId);
		if (existing) return existing;
	}
	if (input.isbn) {
		const existing = findBookByIsbn(householdId, input.isbn);
		if (existing) return existing;
	}
	// Typed in by hand: no ids to recognise it by, so fall back to title + author. Without this,
	// every re-entry of the same book mints a second row, splitting one book's Up Next, shelf and
	// history across two identities that look identical to the reader.
	if (!input.googleBooksId && !input.isbn) {
		const existing = findBookByTitleAuthor(householdId, input.title, input.author ?? null);
		if (existing) return existing;
	}
	return createBook(householdId, input);
}
