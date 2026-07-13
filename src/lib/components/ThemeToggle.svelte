<script lang="ts">
	import { onMount } from 'svelte';

	let theme: 'light' | 'dark' = $state('light');
	let mounted = $state(false);

	onMount(() => {
		theme = (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light';
		mounted = true;
	});

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// localStorage unavailable (private browsing) — theme still applies for this load.
		}
		document.getElementById('theme-color-meta')?.setAttribute('content', theme === 'dark' ? '#1c1611' : '#f5ead9');
	}
</script>

{#if mounted}
	<button
		class="theme-toggle"
		onclick={toggle}
		aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} mode"
	>
		{theme === 'dark' ? '☀️' : '🌙'}
	</button>
{/if}

<style>
	.theme-toggle {
		position: fixed;
		top: calc(1rem + env(safe-area-inset-top));
		right: calc(1rem + env(safe-area-inset-right));
		z-index: 50;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: var(--color-surface);
		box-shadow: 0 4px 12px var(--color-shadow);
		font-size: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
</style>
