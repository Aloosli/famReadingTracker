<script lang="ts">
	let { emoji, label, color }: { emoji: string; label: string; color: string } = $props();
</script>

<span class="title-banner" style:--banner-color={color}>
	<span class="title-banner-emoji">{emoji}</span>
	{label}
</span>

<style>
	.title-banner {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-md);
		background: var(--banner-color);
		color: #fff;
		font-weight: 700;
		font-size: var(--text-xs);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		clip-path: polygon(5% 0, 95% 0, 100% 50%, 95% 100%, 5% 100%, 0 50%);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
		white-space: nowrap;
	}

	.title-banner-emoji {
		font-size: var(--text-base);
	}
</style>
