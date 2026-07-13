<script lang="ts">
	import type { Snippet } from 'svelte';
	import TitlePatch from './TitlePatch.svelte';

	let {
		emoji,
		label,
		color,
		description,
		earnedLabel = '',
		onclose,
		actions
	}: {
		emoji: string;
		label: string;
		color: string;
		description: string;
		/** Optional footnote, e.g. "Earned 12 Jul 2026". */
		earnedLabel?: string;
		onclose: () => void;
		/** Optional action controls (e.g. a "show on my profile" form). Omitted for read-only views. */
		actions?: Snippet;
	} = $props();

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="patch-overlay">
	<button type="button" class="patch-backdrop" aria-label="Close" onclick={onclose}></button>
	<div class="patch-modal" role="dialog" aria-modal="true" aria-label={label}>
		<TitlePatch {emoji} {label} {color} size="celebration" active />
		<p class="patch-desc">{description}</p>
		{#if earnedLabel}
			<p class="patch-earned">{earnedLabel}</p>
		{/if}
		{#if actions}
			<div class="patch-actions">{@render actions()}</div>
		{/if}
		<button type="button" class="patch-close" onclick={onclose}>Close</button>
	</div>
</div>

<style>
	.patch-overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.patch-backdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.55);
		cursor: pointer;
	}

	.patch-modal {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 340px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 2rem 1.75rem calc(1.5rem + env(safe-area-inset-bottom));
		box-shadow: 0 18px 48px var(--color-shadow);
		animation: patch-pop 0.18s ease;
	}

	@keyframes patch-pop {
		from {
			transform: scale(0.94);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.patch-desc {
		margin: 0;
		color: var(--color-text);
		font-size: 1.05rem;
		line-height: 1.5;
	}

	.patch-earned {
		margin: -0.4rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}

	.patch-actions {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.patch-close {
		margin-top: 0.25rem;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 0.95rem;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.patch-modal {
			animation: none;
		}
	}
</style>
