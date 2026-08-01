import { describe, it, expect } from 'vitest';
import { normalizeLookupKey, parseIsbnQuery } from './lookup-key';

describe('normalizeLookupKey', () => {
	it('folds case and collapses whitespace so equivalent searches share one cache entry', () => {
		expect(normalizeLookupKey('  Dog   Man  ')).toBe('dog man');
		expect(normalizeLookupKey('DOG MAN')).toBe('dog man');
		expect(normalizeLookupKey('dog man')).toBe('dog man');
	});

	it('keeps punctuation, which can genuinely change upstream results', () => {
		expect(normalizeLookupKey('Peter-Rabbit')).not.toBe(normalizeLookupKey('Peter Rabbit'));
	});

	it('handles an empty query without throwing', () => {
		expect(normalizeLookupKey('   ')).toBe('');
	});
});

describe('parseIsbnQuery', () => {
	it('reads a scanner lookup', () => {
		expect(parseIsbnQuery('isbn:9780241558959')).toBe('9780241558959');
	});

	it('accepts a 10-digit ISBN, including a trailing X check digit', () => {
		expect(parseIsbnQuery('isbn:043942089X')).toBe('043942089X');
	});

	it('strips hyphens so a printed ISBN matches a scanned one', () => {
		expect(parseIsbnQuery('isbn:978-0-241-55895-9')).toBe('9780241558959');
	});

	it('is not fooled by an ordinary text search', () => {
		expect(parseIsbnQuery('dog man')).toBeNull();
		expect(parseIsbnQuery('the isbn book')).toBeNull();
	});

	it('rejects a wrong-length number rather than treating it as a book', () => {
		expect(parseIsbnQuery('isbn:12345')).toBeNull();
	});
});
