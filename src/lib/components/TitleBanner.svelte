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
		gap: 0.35rem;
		padding: 0.3rem 1.1rem;
		background: var(--banner-color);
		color: #fff;
		font-weight: 700;
		font-size: 0.8rem;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		clip-path: polygon(5% 0, 95% 0, 100% 50%, 95% 100%, 5% 100%, 0 50%);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
		white-space: nowrap;
	}

	.title-banner-emoji {
		font-size: 0.95rem;
	}
</style>
