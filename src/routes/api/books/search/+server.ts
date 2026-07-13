import { json } from '@sveltejs/kit';
import { searchGoogleBooks } from '$lib/server/google-books';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q) {
		return json({ results: [] });
	}

	try {
		const results = await searchGoogleBooks(q);
		return json({ results });
	} catch {
		// Lookup failures should never block logging — the client falls back to manual entry.
		return json({ results: [], error: 'lookup_failed' });
	}
};
