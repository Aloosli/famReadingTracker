import { fail, redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db/users';
import { findOrCreateBook } from '$lib/server/db/books';
import { startReading } from '$lib/server/db/entries';
import { addToWishlist } from '$lib/server/db/wishlist';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';

export const load: PageServerLoad = ({ cookies, url }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}
	const destination = url.searchParams.get('to') === 'wishlist' ? 'wishlist' : 'reading';
	return { user, destination };
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

		if (data.get('destination') === 'wishlist') {
			addToWishlist(user.id, book.id);
		} else {
			startReading(user.id, book.id);
		}

		redirect(303, '/home');
	}
};
