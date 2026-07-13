import { env } from '$env/dynamic/private';
import type { GoogleBookResult } from '$lib/types';
import { fetchWithRetry } from './fetch-retry';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

interface VolumeInfo {
	title?: string;
	authors?: string[];
	imageLinks?: { thumbnail?: string; smallThumbnail?: string };
	industryIdentifiers?: { type: string; identifier: string }[];
	pageCount?: number;
}

interface VolumeItem {
	id: string;
	volumeInfo?: VolumeInfo;
}

function mapVolumeToResult(item: VolumeItem): GoogleBookResult {
	const info = item.volumeInfo ?? {};
	const identifiers = info.industryIdentifiers ?? [];
	const isbn =
		identifiers.find((id) => id.type === 'ISBN_13')?.identifier ??
		identifiers.find((id) => id.type === 'ISBN_10')?.identifier ??
		null;
	const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;

	return {
		googleBooksId: item.id,
		title: info.title ?? 'Untitled',
		author: info.authors?.join(', ') ?? null,
		coverUrl: rawCover ? rawCover.replace(/^http:/, 'https:') : null,
		isbn,
		pageCount: info.pageCount && info.pageCount > 0 ? info.pageCount : null
	};
}

export async function searchGoogleBooks(query: string): Promise<GoogleBookResult[]> {
	const url = new URL(GOOGLE_BOOKS_API);
	url.searchParams.set('q', query);
	url.searchParams.set('maxResults', '12');
	if (env.GOOGLE_BOOKS_API_KEY) {
		url.searchParams.set('key', env.GOOGLE_BOOKS_API_KEY);
	}

	// Don't let a hung upstream keep the reader waiting forever — bail after a few seconds and
	// let the caller fall back to manual entry.
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetchWithRetry(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Google Books API responded with ${response.status}`);
		}
		const data = (await response.json()) as { items?: VolumeItem[] };
		return (data.items ?? []).map(mapVolumeToResult);
	} finally {
		clearTimeout(timeout);
	}
}
