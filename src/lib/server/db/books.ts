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
	return createBook(householdId, input);
}
