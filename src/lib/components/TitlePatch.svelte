<script lang="ts">
	let {
		emoji = '',
		label = '',
		color = '',
		active = false,
		locked = false,
		size = 'grid'
	}: {
		emoji?: string;
		label?: string;
		color?: string;
		active?: boolean;
		/** A not-yet-earned mystery slot — shows a muted "?" silhouette, never the real badge. */
		locked?: boolean;
		size?: 'grid' | 'celebration';
	} = $props();
</script>

<div
	class="patch"
	class:celebration={size === 'celebration'}
	style:--patch-color={locked ? 'var(--color-text-muted)' : color}
>
	<div class="patch-badge" class:active={active && !locked} class:locked>
		{#if active && !locked}
			<span class="patch-ring" aria-hidden="true"></span>
		{/if}
		<span class="patch-emoji">{locked ? '?' : emoji}</span>
	</div>
	<span class="patch-label">{locked ? '???' : label}</span>
</div>

<style>
	.patch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.patch-badge {
		position: relative;
		width: 84px;
		height: 84px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--patch-color) 70%, #fff), var(--patch-color) 72%);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 6px 14px rgba(0, 0, 0, 0.3),
			inset 0 2px 4px rgba(255, 255, 255, 0.35),
			inset 0 -4px 8px rgba(0, 0, 0, 0.3);
		transition: transform 0.15s ease;
	}

	.patch-badge::before {
		content: '';
		position: absolute;
		inset: 7px;
		border-radius: 50%;
		border: 2px dashed rgba(255, 255, 255, 0.55);
		pointer-events: none;
	}

	.patch-badge::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 3px solid rgba(0, 0, 0, 0.28);
		pointer-events: none;
	}

	.patch-ring {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 3px solid var(--patch-color);
		box-shadow: 0 0 0 3px var(--color-surface);
	}

	/* Locked "mystery" slot: a flat, recessed, colourless silhouette that reveals nothing. */
	.patch-badge.locked {
		background: var(--color-bg-alt);
		box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.18);
	}

	.patch-badge.locked::before {
		border-color: var(--color-border);
	}

	.patch-badge.locked::after {
		border-color: rgba(0, 0, 0, 0.1);
	}

	.locked .patch-emoji {
		font-family: var(--font-heading);
		font-weight: 700;
		color: var(--color-text-muted);
		opacity: 0.65;
		filter: none;
	}

	.patch:has(.patch-badge.locked) .patch-label {
		color: var(--color-text-muted);
		opacity: 0.7;
		letter-spacing: 0.18em;
	}

	.patch-emoji {
		font-size: 2.1rem;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
		position: relative;
	}

	.patch-label {
		font-size: 0.78rem;
		font-weight: 700;
		text-align: center;
		color: var(--color-text);
		max-width: 100px;
		line-height: 1.2;
	}

	.celebration .patch-badge {
		width: 130px;
		height: 130px;
	}

	.celebration .patch-emoji {
		font-size: 3.4rem;
	}

	.celebration .patch-label {
		font-size: 1.05rem;
		max-width: none;
		color: var(--patch-color);
	}
</style>
