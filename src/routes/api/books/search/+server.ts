import { json } from '@sveltejs/kit';
import { searchBooks } from '$lib/server/book-search';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q) {
		return json({ results: [] });
	}

	try {
		const results = await searchBooks(q);
		return json({ results });
	} catch {
		// Lookup failures should never block logging — the client falls back to manual entry.
		return json({ results: [], error: 'lookup_failed' });
	}
};
