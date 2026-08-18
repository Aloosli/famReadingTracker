import { describe, it, expect } from 'vitest';
import { createRateLimitStore, hit, prune } from './rate-limit';

const LIMIT = 3;
const WINDOW = 60_000;

describe('hit', () => {
	it('allows up to the limit, then refuses', () => {
		const store = createRateLimitStore();
		for (let i = 0; i < LIMIT; i++) {
			expect(hit(store, 'a', LIMIT, WINDOW, 1000).allowed).toBe(true);
		}
		expect(hit(store, 'a', LIMIT, WINDOW, 1000).allowed).toBe(false);
	});

	it('reports how long to wait', () => {
		const store = createRateLimitStore();
		for (let i = 0; i <= LIMIT; i++) hit(store, 'a', LIMIT, WINDOW, 1000);
		const result = hit(store, 'a', LIMIT, WINDOW, 31_000);
		expect(result.allowed).toBe(false);
		expect(result.retryAfter).toBe(30);
	});

	it('starts a fresh window once the old one passes', () => {
		const store = createRateLimitStore();
		for (let i = 0; i <= LIMIT; i++) hit(store, 'a', LIMIT, WINDOW, 1000);
		expect(hit(store, 'a', LIMIT, WINDOW, 1000).allowed).toBe(false);
		expect(hit(store, 'a', LIMIT, WINDOW, 61_001).allowed).toBe(true);
	});

	it('keeps keys independent, so one attacker cannot lock everyone out', () => {
		const store = createRateLimitStore();
		for (let i = 0; i <= LIMIT; i++) hit(store, 'attacker', LIMIT, WINDOW, 1000);
		expect(hit(store, 'attacker', LIMIT, WINDOW, 1000).allowed).toBe(false);
		expect(hit(store, 'someone-else', LIMIT, WINDOW, 1000).allowed).toBe(true);
	});

	it('counts rejected attempts, so being over the limit is not free', () => {
		const store = createRateLimitStore();
		for (let i = 0; i < 20; i++) hit(store, 'a', LIMIT, WINDOW, 1000);
		// Still refused right up to the window edge rather than drifting back under.
		expect(hit(store, 'a', LIMIT, WINDOW, 59_999).allowed).toBe(false);
	});

	it('never reports a retryAfter of zero while refusing', () => {
		const store = createRateLimitStore();
		for (let i = 0; i <= LIMIT; i++) hit(store, 'a', LIMIT, WINDOW, 1000);
		// A refusal 1ms before reset would round to 0 seconds and read as "try again now".
		const result = hit(store, 'a', LIMIT, WINDOW, 60_999);
		expect(result.allowed).toBe(false);
		expect(result.retryAfter).toBeGreaterThanOrEqual(1);
	});
});

describe('prune', () => {
	it('drops expired windows but keeps live ones', () => {
		const store = createRateLimitStore();
		hit(store, 'old', LIMIT, WINDOW, 1000);
		hit(store, 'new', LIMIT, WINDOW, 50_000);
		prune(store, 61_001);
		expect(store.has('old')).toBe(false);
		expect(store.has('new')).toBe(true);
	});
});
