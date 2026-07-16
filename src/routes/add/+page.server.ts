import { fail, redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db/users';
import { findOrCreateBook } from '$lib/server/db/books';
import { startReading, addAlreadyRead } from '$lib/server/db/entries';
import { addToWishlist, removeFromWishlistByBook } from '$lib/server/db/wishlist';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';

/** Where an added book lands. The page lets the reader change this, so it is never trusted blindly. */
const DESTINATIONS = ['reading', 'finished', 'wishlist'] as const;
type Destination = (typeof DESTINATIONS)[number];

function toDestination(value: string | null | undefined): Destination {
	return DESTINATIONS.includes(value as Destination) ? (value as Destination) : 'reading';
}

export const load: PageServerLoad = ({ cookies, url }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}
	// Only the initial selection — the page offers all three.
	return { user, destination: toDestination(url.searchParams.get('to')) };
};

export const actions: Actions = {
	addBook: async ({ request, cookies, locals }) => {
		const profileId = cookies.get(PROFILE_COOKIE);
		const user = profileId ? getUserById(Number(profileId)) : undefined;
		if (!user) {
			return fail(401, { message: 'No active profile — pick one first.' });
		}

		const data = await request.formData();
		const title = data.get('title')?.toString().trim();
		if (!title) {
			return fail(400, { message: 'Give the book a title before adding it.' });
		}

		const pageCountRaw = data.get('pageCount')?.toString().trim();
		const pageCount = pageCountRaw && Number(pageCountRaw) > 0 ? Math.round(Number(pageCountRaw)) : null;

		const book = findOrCreateBook(locals.householdId, {
			title,
			author: data.get('author')?.toString().trim() || null,
			coverUrl: data.get('coverUrl')?.toString().trim() || null,
			googleBooksId: data.get('googleBooksId')?.toString().trim() || null,
			isbn: data.get('isbn')?.toString().trim() || null,
			pageCount
		});

		const destination = toDestination(data.get('destination')?.toString());
		if (destination === 'wishlist') {
			addToWishlist(user.id, book.id);
		} else {
			// Reading it or having read it both settle the question of what's up next.
			if (destination === 'finished') {
				addAlreadyRead(user.id, book.id);
			} else {
				startReading(user.id, book.id);
			}
			removeFromWishlistByBook(user.id, book.id);
		}

		redirect(303, '/home');
	}
};
