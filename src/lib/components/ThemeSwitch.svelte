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
		/* Defaults, but overridable by the .app-chrome group so the whole switch can be scaled from
		   one place. Set plainly they would win over the parent's values, since a custom property
		   declared on the element beats an inherited one — and the phone shrink would silently do
		   nothing. */
		--seg: var(--switch-seg, 40px);
		--pad: var(--switch-pad, 5px);
		--h: var(--switch-h, 34px);
		/* The sliding stick is absolutely positioned against this element. That worked implicitly
		   while .switch was `position: fixed`; once positioning moved to the .app-chrome group, the
		   stick started measuring from there instead and sat a sound-button's width off to the left.
		   Being the stick's containing block is this element's job regardless of who places it. */
		position: relative;
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
		font-size: var(--text-md);
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
