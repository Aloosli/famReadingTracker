import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db/users';
import { getFinishedInYear } from '$lib/server/db/entries';
import { getPatchesEarnedInYear } from '$lib/server/db/titles';
import type { PageServerLoad } from './$types';

const PROFILE_COOKIE = 'profile_id';
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export const load: PageServerLoad = ({ cookies, url }) => {
	const profileId = cookies.get(PROFILE_COOKIE);
	const user = profileId ? getUserById(Number(profileId)) : undefined;
	if (!user) {
		redirect(302, '/');
	}

	const requested = url.searchParams.get('year');
	const year = requested && /^\d{4}$/.test(requested) ? requested : String(new Date().getUTCFullYear());

	const books = getFinishedInYear(user.id, year);

	const totalPages = books.reduce((sum, book) => sum + (book.page_count ?? 0), 0);

	// Busiest month (by books finished).
	const monthCounts: number[] = new Array(12).fill(0);
	for (const book of books) {
		const monthIndex = Number(book.finished_at.slice(5, 7)) - 1;
		if (monthIndex >= 0 && monthIndex < 12) monthCounts[monthIndex] += 1;
	}
	let busiestMonth: { name: string; count: number } | null = null;
	for (let i = 0; i < 12; i++) {
		if (monthCounts[i] > 0 && (busiestMonth === null || monthCounts[i] > busiestMonth.count)) {
			busiestMonth = { name: MONTHS[i], count: monthCounts[i] };
		}
	}

	// Favourite = most recently finished book they loved (books already newest-first).
	const favourite = books.find((book) => book.reaction === 'loved') ?? null;

	// Longest book by page count.
	let longest: (typeof books)[number] | null = null;
	for (const book of books) {
		if (book.page_count && (!longest || book.page_count > (longest.page_count ?? 0))) {
			longest = book;
		}
	}

	return {
		user,
		year,
		books,
		finishedCount: books.length,
		totalPages,
		busiestMonth,
		favourite,
		longest,
		patches: getPatchesEarnedInYear(user.id, year)
	};
};
