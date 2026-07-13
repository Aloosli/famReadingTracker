import { db } from './index';

export interface WishlistBook {
	id: number;
	book_id: number;
	title: string;
	author: string | null;
	cover_url: string | null;
	page_count: number | null;
	added_at: string;
}

/** Adds a book to a reader's Up Next list. No-ops if it's already there (UNIQUE constraint). */
export function addToWishlist(userId: number, bookId: number): void {
	db.prepare(
		`INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)
		 ON CONFLICT (user_id, book_id) DO NOTHING`
	).run(userId, bookId);
}

/** A reader's Up Next list, most recently added first. */
export function getWishlist(userId: number): WishlistBook[] {
	return db
		.prepare(
			`SELECT w.id, w.book_id, b.title, b.author, b.cover_url, b.page_count, w.added_at
			 FROM wishlist w
			 JOIN books b ON b.id = w.book_id
			 WHERE w.user_id = ?
			 ORDER BY w.added_at DESC, w.id DESC`
		)
		.all(userId) as WishlistBook[];
}

/** Removes an item from a reader's Up Next list — scoped to the owner. Returns its book_id. */
export function removeFromWishlist(wishlistId: number, userId: number): number | null {
	const row = db
		.prepare('SELECT book_id FROM wishlist WHERE id = ? AND user_id = ?')
		.get(wishlistId, userId) as { book_id: number } | undefined;
	if (!row) return null;
	db.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ?').run(wishlistId, userId);
	return row.book_id;
}
