<script lang="ts">
	import { onMount } from 'svelte';
	import { getTheme, setTheme, type Theme } from '$lib/theme';
	import SonicHead from './SonicHead.svelte';

	// Left-to-right slots on the switch: dark · light · sonic.
	const OPTIONS: { value: Theme; label: string }[] = [
		{ value: 'dark', label: 'Dark mode' },
		{ value: 'light', label: 'Light mode' },
		{ value: 'sonic', label: 'Sonic mode' }
	];

	let theme = $state<Theme>('light');
	let mounted = $state(false);

	onMount(() => {
		theme = getTheme();
		mounted = true;
	});

	function choose(value: Theme) {
		theme = value;
		setTheme(value);
	}

	// Which slot the stick slides to (falls back to 0 for an unknown value).
	let index = $derived(Math.max(0, OPTIONS.findIndex((o) => o.value === theme)));
</script>

{#if mounted}
	<div class="switch" role="group" aria-label="Theme">
		<span class="stick" style="--i: {index}" aria-hidden="true"></span>
		{#each OPTIONS as opt (opt.value)}
			<button
				class="seg"
				class:active={theme === opt.value}
				onclick={() => choose(opt.value)}
				aria-label={opt.label}
				aria-pressed={theme === opt.value}
			>
				{#if opt.value === 'dark'}
					<span class="emoji">🌙</span>
				{:else if opt.value === 'light'}
					<span class="emoji">☀️</span>
				{:else}
					<SonicHead />
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.switch {
		--seg: 40px;
		--pad: 5px;
		--h: 34px;
		position: fixed;
		top: calc(1rem + env(safe-area-inset-top));
		right: calc(1rem + env(safe-area-inset-right));
		z-index: 50;
		display: flex;
		padding: var(--pad);
		border-radius: 999px;
		/* An inset slot cut into the panel, like an amplifier's switch track. */
		background: var(--color-bg-alt);
		border: 1px solid var(--color-border);
		box-shadow:
			inset 0 2px 5px var(--color-shadow),
			0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.seg {
		position: relative;
		z-index: 1;
		width: var(--seg);
		height: var(--h);
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.4;
		transition: opacity 0.2s ease;
	}
	.seg.active {
		opacity: 1;
	}

	.emoji {
		font-size: 1.15rem;
		line-height: 1;
	}

	/* The sliding stick — a raised knob that rides under the lit icon. */
	.stick {
		position: absolute;
		top: var(--pad);
		left: var(--pad);
		z-index: 0;
		width: var(--seg);
		height: var(--h);
		border-radius: 999px;
		background: var(--color-surface);
		box-shadow:
			0 2px 6px var(--color-shadow),
			0 1px 0 rgba(255, 255, 255, 0.4);
		transform: translateX(calc(var(--i) * var(--seg)));
		transition: transform 0.42s var(--spring);
	}

	@media (prefers-reduced-motion: reduce) {
		.stick {
			transition: none;
		}
	}
</style>
