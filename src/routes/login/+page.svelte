<script lang="ts">
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<span class="mark" aria-hidden="true">📚</span>
		<h1>Welcome back</h1>
		<p class="subtitle">Sign in to your family's shelf.</p>
	</header>

	<form method="POST">
		{#if data.next}
			<input type="hidden" name="next" value={data.next} />
		{/if}

		{#if form?.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}

		<label>
			Email
			<input
				type="email"
				name="email"
				value={form?.email ?? ''}
				autocomplete="email"
				required
			/>
		</label>

		<label>
			Password
			<input type="password" name="password" autocomplete="current-password" required />
		</label>

		<button type="submit" class="primary">Sign in</button>
	</form>

	<p class="alt">No account yet? <a href="/signup">Create one</a></p>
</main>

<style>
	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 26rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--space-xl);
		padding: var(--space-2xl) var(--space-xl) calc(var(--space-2xl) + env(safe-area-inset-bottom));
	}

	header {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2xs);
	}

	.mark {
		font-size: var(--text-3xl);
		line-height: var(--leading-none);
		margin-bottom: var(--space-xs);
	}

	h1 {
		font-size: var(--text-2xl);
		color: var(--color-wood-dark);
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-muted);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		background: var(--color-surface);
		padding: var(--space-xl);
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 22px var(--color-shadow);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	input {
		font-family: inherit;
		font-size: var(--text-base);
		padding: var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
	}

	input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.primary {
		margin-top: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--color-surface);
		background: var(--color-accent);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.primary:hover {
		background: var(--color-accent-hover);
	}

	.error {
		margin: 0;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
		font-size: var(--text-sm);
	}

	.alt {
		margin: 0;
		text-align: center;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}
</style>
