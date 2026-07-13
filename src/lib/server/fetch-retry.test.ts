import { describe, expect, it } from 'vitest';
import { fetchWithRetry } from './fetch-retry';

// Zero delays keep the suite fast; retry counting is what's under test, not the pacing.
const NO_WAIT = { retryDelaysMs: [0, 0] };

function fetchScript(...outcomes: (number | Error)[]) {
	let call = 0;
	const fetchFn = async () => {
		const outcome = outcomes[Math.min(call++, outcomes.length - 1)];
		if (outcome instanceof Error) throw outcome;
		return new Response('{}', { status: outcome });
	};
	return { fetchFn, calls: () => call };
}

describe('fetchWithRetry', () => {
	it('returns a successful response on the first attempt', async () => {
		const script = fetchScript(200);
		const response = await fetchWithRetry('https://example.test', { ...NO_WAIT, ...script });
		expect(response.status).toBe(200);
		expect(script.calls()).toBe(1);
	});

	it('retries a transient 503 and succeeds', async () => {
		const script = fetchScript(503, 200);
		const response = await fetchWithRetry('https://example.test', { ...NO_WAIT, ...script });
		expect(response.status).toBe(200);
		expect(script.calls()).toBe(2);
	});

	it('retries a network error and succeeds', async () => {
		const script = fetchScript(new Error('socket hang up'), 200);
		const response = await fetchWithRetry('https://example.test', { ...NO_WAIT, ...script });
		expect(response.status).toBe(200);
		expect(script.calls()).toBe(2);
	});

	it('gives up after exhausting retries', async () => {
		const script = fetchScript(503);
		await expect(
			fetchWithRetry('https://example.test', { ...NO_WAIT, ...script })
		).rejects.toThrow('503');
		expect(script.calls()).toBe(3);
	});

	it('does not retry non-transient statuses like 404', async () => {
		const script = fetchScript(404);
		const response = await fetchWithRetry('https://example.test', { ...NO_WAIT, ...script });
		expect(response.status).toBe(404);
		expect(script.calls()).toBe(1);
	});

	it('stops retrying once the signal is aborted', async () => {
		const controller = new AbortController();
		let call = 0;
		const fetchFn = async () => {
			call++;
			controller.abort();
			throw new Error('aborted mid-flight');
		};
		await expect(
			fetchWithRetry('https://example.test', {
				...NO_WAIT,
				fetchFn,
				signal: controller.signal
			})
		).rejects.toThrow('aborted mid-flight');
		expect(call).toBe(1);
	});
});
