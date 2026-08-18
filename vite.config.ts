
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	],

	server: {
		/**
		 * Dev-server only; has no effect on the built app.
		 *
		 * Testing a layout on a real phone is awkward from WSL: mirrored networking mode gives WSL a
		 * LAN address, but the Hyper-V firewall blocks inbound by default, so a phone on the same
		 * wifi can't reach it. The reliable way round is a `cloudflared tunnel --url
		 * http://localhost:5173`, and Vite refuses unknown Host headers, which rejects the tunnel's
		 * hostname. Allowing the quick-tunnel domain makes phone testing a two-command job instead of
		 * a Windows firewall expedition.
		 */
		allowedHosts: ['.trycloudflare.com']
	}
});
