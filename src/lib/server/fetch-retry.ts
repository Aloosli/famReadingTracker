// Upstream APIs (notably Google Books) intermittently return 5xx for identical requests
// moments apart. Retrying briefly keeps a transient blip from surfacing as "search is
// unavailable" on a reader's screen.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = [250, 500];

type FetchLike = (url: string | URL, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface FetchWithRetryOptions {
	signal?: AbortSignal;
	/** Injectable for tests; defaults to global fetch. */
	fetchFn?: FetchLike;
	/** Wait times before each retry. Length = number of retries. */
	retryDelaysMs?: number[];
}

/**
 * Fetch with retries on transient failures (network errors and 429/5xx responses).
 * Other responses — including non-retryable errors like 404 — are returned as-is,
 * so callers still check `response.ok`. An abort of `signal` stops retrying.
 */
export async function fetchWithRetry(
	url: string | URL,
	options: FetchWithRetryOptions = {}
): Promise<Response> {
	const { signal, fetchFn = fetch, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = options;

	let lastFailure: unknown;
	for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
		if (attempt > 0) {
			await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1]));
			if (signal?.aborted) break;
		}

		let response: Response;
		try {
			response = await fetchFn(url, { signal });
		} catch (error) {
			// An aborted request means the caller's deadline hit — stop, don't burn retries.
			if (signal?.aborted) throw error;
			lastFailure = error;
			continue;
		}

		if (RETRYABLE_STATUS.has(response.status)) {
			lastFailure = new Error(`upstream responded with ${response.status}`);
			continue;
		}
		return response;
	}

	throw lastFailure ?? new Error('request failed before any attempt completed');
}
