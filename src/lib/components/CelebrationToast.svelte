<script lang="ts">
	import { onMount } from 'svelte';
	import TitlePatch from './TitlePatch.svelte';

	let {
		message,
		accentColor,
		patch,
		emoji = '🎉',
		onDismiss
	}: {
		message: string;
		accentColor: string;
		patch?: { emoji: string; label: string; color: string } | null;
		/** Big emoji shown for non-patch celebrations (finishes, personal bests). */
		emoji?: string;
		onDismiss: () => void;
	} = $props();

	// A warm, varied confetti palette so a burst feels festive rather than monochrome.
	const CONFETTI_COLORS = ['#e0762f', '#c2478a', '#4a9d5f', '#e0a520', '#3f7fbf', '#d64545', '#6b4c9a'];

	// Unlocking a patch is the bigger moment, so it gets a fuller burst.
	const particles = $derived.by(() => {
		const count = patch ? 22 : 14;
		return Array.from({ length: count }, (_, i) => ({
			angle: (360 / count) * i + (Math.random() * 20 - 10),
			distance: 60 + Math.random() * 45,
			delay: Math.random() * 0.15,
			color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
			round: i % 3 === 0
		}));
	});

	onMount(() => {
		const timer = setTimeout(onDismiss, patch ? 3400 : 2800);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="celebration-backdrop"
	role="button"
	tabindex="0"
	onclick={(e) => e.target === e.currentTarget && onDismiss()}
	onkeydown={(e) => e.key === 'Enter' && onDismiss()}
>
	<div class="celebration-card" style:--accent={accentColor} role="status">
		<div class="confetti" aria-hidden="true">
			{#each particles as particle, i (i)}
				<span
					class="particle"
					class:round={particle.round}
					style:--angle="{particle.angle}deg"
					style:--distance="{particle.distance}px"
					style:--delay="{particle.delay}s"
					style:--pcolor={particle.color}
				></span>
			{/each}
		</div>
		{#if patch}
			<p class="celebration-message">{message}</p>
			<TitlePatch emoji={patch.emoji} label={patch.label} color={patch.color} size="celebration" active />
		{:else}
			<span class="celebration-emoji">{emoji}</span>
			<p class="celebration-message">{message}</p>
		{/if}
	</div>
</div>

<style>
	.celebration-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		cursor: pointer;
		animation: fade-in 0.15s ease;
		padding: 1.5rem;
	}

	.celebration-card {
		position: relative;
		background: var(--color-surface);
		border: 3px solid var(--accent);
		border-radius: var(--radius-lg);
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		max-width: 320px;
		text-align: center;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
		animation: pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
		cursor: default;
	}

	.celebration-emoji {
		font-size: 3rem;
	}

	.celebration-message {
		margin: 0;
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--accent);
	}

	.confetti {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
	}

	.particle {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--pcolor, var(--accent));
		opacity: 0;
		animation: burst 0.7s ease-out forwards;
		animation-delay: var(--delay);
	}

	.particle.round {
		border-radius: 50%;
	}

	@keyframes burst {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0.4);
		}
	}

	@keyframes pop-in {
		0% {
			transform: scale(0.7);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Respect readers who prefer less motion: keep the message, drop the flying confetti and bounce. */
	@media (prefers-reduced-motion: reduce) {
		.particle {
			display: none;
		}
		.celebration-card {
			animation: fade-in 0.2s ease;
		}
	}
</style>
