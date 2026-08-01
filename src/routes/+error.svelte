<script lang="ts">
	import { page } from '$app/state';

	// A warm, non-scary fallback for any unhandled error, tailored a little by status.
	const status = $derived(page.status);
	const heading = $derived(
		status === 404 ? 'That page wandered off' : 'Something slipped off the shelf'
	);
	const blurb = $derived(
		status === 404
			? "We couldn't find the page you were after — it may have moved or never existed."
			: "A hiccup on our end, not yours. Your reading is safe — let's get you back to it."
	);
</script>

<svelte:head>
	<title>{status} · Family Reading Tracker</title>
</svelte:head>

<main>
	<div class="emoji" aria-hidden="true">📚</div>
	<p class="status">{status}</p>
	<h1>{heading}</h1>
	<p class="blurb">{blurb}</p>
	{#if page.error?.message && status !== 404}
		<p class="detail">{page.error.message}</p>
	{/if}
	<div class="actions">
		<a class="primary" href="/home">Back to my shelf</a>
		<a class="ghost" href="/">Choose a reader</a>
	</div>
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
		text-align: center;
	}

	.emoji {
		font-size: var(--text-3xl);
		margin-bottom: var(--space-xs);
	}

	.status {
		margin: 0;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--color-accent);
		font-size: var(--text-sm);
	}

	h1 {
		margin: var(--space-2xs) 0 0;
		font-family: var(--font-heading, inherit);
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		color: var(--color-wood-dark);
		text-wrap: balance;
	}

	.blurb {
		margin: var(--space-xs) 0 0;
		max-width: 42ch;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.detail {
		margin: var(--space-sm) 0 0;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		opacity: 0.75;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		justify-content: center;
		margin-top: var(--space-2xl);
	}

	.actions a {
		text-decoration: none;
		font-weight: 700;
		padding: var(--space-sm) var(--space-xl);
		border-radius: var(--radius-md);
	}

	.primary {
		background: var(--color-accent);
		color: #fff;
		box-shadow: 0 8px 18px var(--color-shadow);
	}

	.ghost {
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}
</style>
