import type { BookSearchResult } from '$lib/types';
import { fetchWithRetry } from './fetch-retry';
import { parseIsbnQuery } from './lookup-key';

const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json';

/**
 * Only the fields we map. Asking for a narrow set keeps the response small — the default search
 * document is enormous.
 */
const FIELDS = 'key,title,author_name,isbn,cover_i,number_of_pages_median';

interface OpenLibraryDoc {
	key?: string;
	title?: string;
	author_name?: string[];
	isbn?: string[];
	cover_i?: number;
	number_of_pages_median?: number;
}

/**
 * Prefer a 13-digit ISBN, matching how the Google mapper picks ISBN_13 over ISBN_10 — otherwise the
 * same book found through the two sources could be stored under different identifiers.
 */
function pickIsbn(isbns: string[] | undefined): string | null {
	if (!isbns?.length) return null;
	return isbns.find((i) => i.length === 13) ?? isbns[0];
}

/**
 * `scannedIsbn` wins when present. Open Library matches by *work*, not edition, so an ISBN search
 * returns a document listing every edition's ISBN — picking one of those can record a different
 * printing than the reader is holding. The barcode they just scanned is the authoritative answer
 * for their copy, and it's also the key findOrCreateBook de-duplicates on.
 */
function mapDoc(doc: OpenLibraryDoc, scannedIsbn: string | null): BookSearchResult {
	const pages = doc.number_of_pages_median;
	return {
		// Open Library keys look like "/works/OL45804W". Namespaced so it can never be mistaken for a
		// Google volume id — books found through either source still de-duplicate on ISBN, which is
		// the stronger key anyway (see findOrCreateBook).
		sourceId: doc.key ? `ol:${doc.key.replace(/^\/works\//, '')}` : '',
		title: doc.title ?? 'Untitled',
		author: doc.author_name?.join(', ') ?? null,
		coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
		isbn: scannedIsbn ?? pickIsbn(doc.isbn),
		// number_of_pages_median is the median across a work's editions. For a picture book whose
		// editions genuinely differ that's an estimate, not a fact — but an estimate makes the
		// progress bar and the family goal work, where a null contributes nothing at all.
		pageCount: pages && pages > 0 ? pages : null
	};
}

/**
 * Searches Open Library. Used as a fallback when Google Books has nothing, or to fill in a page
 * count Google omitted — both of which happen most for exactly the books this app is for:
 * UK children's editions, picture books and school reading-scheme titles.
 *
 * No API key and no registration, so unlike the Google path this can't be rate-limited per install.
 */
export async function searchOpenLibrary(query: string): Promise<BookSearchResult[]> {
	const url = new URL(OPEN_LIBRARY_SEARCH);
	const isbn = parseIsbnQuery(query);
	if (isbn) {
		url.searchParams.set('isbn', isbn);
	} else {
		url.searchParams.set('q', query);
	}
	url.searchParams.set('limit', '12');
	url.searchParams.set('fields', FIELDS);

	// Open Library is slower than Google under load, but it's a fallback the reader is already
	// waiting on — keep the ceiling tight so a slow answer doesn't out-wait their patience.
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetchWithRetry(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Open Library responded with ${response.status}`);
		}
		const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
		return (data.docs ?? []).map((doc) => mapDoc(doc, isbn)).filter((r) => r.sourceId !== '');
	} finally {
		clearTimeout(timeout);
	}
}
