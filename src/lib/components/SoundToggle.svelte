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
	.sound-toggle {
		position: fixed;
		top: calc(1rem + env(safe-area-inset-top));
		right: calc(1rem + 44px + 0.6rem + env(safe-area-inset-right));
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
