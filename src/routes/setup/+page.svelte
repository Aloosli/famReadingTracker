<script lang="ts">
	import { enhance } from '$app/forms';
	import AvatarChooser from '$lib/components/AvatarChooser.svelte';
	import { AVATAR_EMOJI, AVATAR_COLORS } from '$lib/avatars';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface DraftReader {
		name: string;
		emoji: string;
		color: string;
		goal: number;
	}

	function makeReader(index: number): DraftReader {
		return {
			name: '',
			emoji: AVATAR_EMOJI[index % AVATAR_EMOJI.length],
			color: AVATAR_COLORS[index % AVATAR_COLORS.length],
			goal: 4
		};
	}

	// Start with a single reader (you). "+ Add another reader" adds more; the ✕ removes extras.
	let readers = $state<DraftReader[]>([makeReader(0)]);

	const payload = $derived(
		JSON.stringify(
			readers.map((r) => ({ name: r.name.trim(), emoji: r.emoji, color: r.color, goal: r.goal }))
		)
	);
	const canSubmit = $derived(readers.length > 0 && readers.every((r) => r.name.trim().length > 0));
	const isFirstRun = $derived(data.existingCount === 0);

	function addReader() {
		readers = [...readers, makeReader(readers.length)];
	}

	function removeReader(index: number) {
		readers = readers.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>Set up your reading family · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<p class="eyebrow">{isFirstRun ? 'Welcome!' : 'Add readers'}</p>
		<h1>{isFirstRun ? "Let's set up your reading shelf" : 'Add more readers'}</h1>
		<p class="subtitle">
			Add everyone who'll be reading. Each person gets their own shelf — pick a name, an avatar and a
			colour that's yours.
		</p>
	</header>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}

	<form
		method="POST"
		action="?/createFamily"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
	>
		<input type="hidden" name="readers" value={payload} />

		<div class="reader-list">
			{#each readers as reader, i (i)}
				<div class="reader-card">
					<div class="reader-top">
						<label class="name-field">
							<span class="field-label">Name</span>
							<input
								type="text"
								bind:value={reader.name}
								placeholder="e.g. {AVATAR_EMOJI[i % AVATAR_EMOJI.length] === '🐉' ? 'Finn' : 'your name'}"
								maxlength="24"
								autocomplete="off"
							/>
						</label>
						<label class="goal-field">
							<span class="field-label">Books / month</span>
							<input type="number" min="1" inputmode="numeric" bind:value={reader.goal} />
						</label>
						{#if readers.length > 1}
							<button
								type="button"
								class="remove-reader"
								aria-label="Remove this reader"
								onclick={() => removeReader(i)}>✕</button
							>
						{/if}
					</div>
					<AvatarChooser bind:emoji={reader.emoji} bind:color={reader.color} />
				</div>
			{/each}
		</div>

		<button type="button" class="add-reader" onclick={addReader}>+ Add another reader</button>

		<button type="submit" class="primary" disabled={!canSubmit}>
			{isFirstRun ? 'Start reading! →' : 'Add readers →'}
		</button>
	</form>
</main>

<style>
	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 2.5rem 1.5rem calc(4rem + env(safe-area-inset-bottom));
	}

	.eyebrow {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-accent);
	}

	h1 {
		font-family: var(--font-heading);
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		color: var(--color-wood-dark);
		margin: 0.4rem 0 0;
		text-wrap: balance;
	}

	.subtitle {
		margin: 0.75rem 0 0;
		color: var(--color-text-muted);
		max-width: 52ch;
	}

	.error {
		margin: 0;
		color: var(--color-error);
		font-weight: 600;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.reader-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.reader-card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: 0 6px 16px var(--color-shadow);
	}

	.reader-top {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.name-field {
		flex: 1;
		min-width: 160px;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.goal-field {
		width: 7rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	input[type='text'],
	input[type='number'] {
		font-size: 1rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
		width: 100%;
	}

	.remove-reader {
		flex-shrink: 0;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		width: 40px;
		height: 44px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.remove-reader:hover {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.add-reader {
		align-self: flex-start;
		background: none;
		border: 2px dashed var(--color-border);
		color: var(--color-accent);
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.add-reader:hover {
		border-color: var(--color-accent);
	}

	.primary {
		align-self: flex-start;
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 1.05rem;
		padding: 0.9rem 1.75rem;
		border-radius: var(--radius-md);
		box-shadow: 0 8px 18px var(--color-shadow);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.primary:hover {
		background: var(--color-accent-hover);
	}

	.primary:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
		box-shadow: none;
	}
</style>
