import { defineConfig } from 'vitest/config';

// Standalone config (kept separate from vite.config.ts) so the unit suite runs without the
// SvelteKit plugin or native modules — the tested logic is intentionally pure.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
