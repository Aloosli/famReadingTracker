<script lang="ts">
	import { AVATAR_EMOJI, AVATAR_COLORS } from '$lib/avatars';

	let {
		emoji = $bindable(),
		color = $bindable()
	}: {
		emoji: string;
		color: string;
	} = $props();
</script>

<div class="chooser">
	<div class="preview" style:background={color} aria-hidden="true">{emoji}</div>

	<div class="chooser-fields">
		<div class="field">
			<span class="field-label">Pick an avatar</span>
			<div class="emoji-grid">
				{#each AVATAR_EMOJI as option (option)}
					<button
						type="button"
						class="emoji-option"
						class:selected={emoji === option}
						aria-label="Avatar {option}"
						aria-pressed={emoji === option}
						onclick={() => (emoji = option)}
					>
						{option}
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="field-label">Pick a colour</span>
			<div class="colour-row">
				{#each AVATAR_COLORS as option (option)}
					<button
						type="button"
						class="colour-option"
						class:selected={color === option}
						style:background={option}
						aria-label="Colour"
						aria-pressed={color === option}
						onclick={() => (color = option)}
					></button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.chooser {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.preview {
		flex-shrink: 0;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.15);
	}

	.chooser-fields {
		flex: 1;
		min-width: 220px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		gap: 0.4rem;
	}

	.emoji-option {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		background: var(--color-bg-alt);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			border-color 0.12s ease,
			transform 0.12s ease;
	}

	.emoji-option:hover {
		transform: translateY(-2px);
	}

	.emoji-option.selected {
		border-color: var(--color-accent);
		background: var(--color-surface);
	}

	.colour-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.colour-option {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 3px solid transparent;
		cursor: pointer;
		box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.18);
		transition: transform 0.12s ease;
	}

	.colour-option:hover {
		transform: translateY(-2px);
	}

	.colour-option.selected {
		border-color: var(--color-text);
	}
</style>
