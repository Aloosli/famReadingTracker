<script lang="ts">
	import { onMount } from 'svelte';
	import { sound, playClick } from '$lib/sound.svelte';

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	function toggle() {
		sound.toggle();
		if (!sound.muted) playClick(); // a little confirmation that sound is back on
	}
</script>

{#if mounted}
	<button
		class="sound-toggle"
		onclick={toggle}
		aria-label={sound.muted ? 'Unmute sounds' : 'Mute sounds'}
		aria-pressed={sound.muted}
	>
		{sound.muted ? '🔇' : '🔊'}
	</button>
{/if}

<style>
	/* Positioning belongs to the .app-chrome group in +layout.svelte, not here. This used to place
	   itself with `right: calc(1rem + 132px + 0.6rem)` — a hardcoded guess at the theme switch's
	   width, which silently broke the moment either control changed size. */
	.sound-toggle {
		flex-shrink: 0;
		width: var(--chrome-size, 44px);
		height: var(--chrome-size, 44px);
		border-radius: 50%;
		border: none;
		background: var(--color-surface);
		box-shadow: 0 4px 12px var(--color-shadow);
		font-size: var(--text-md);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
</style>
