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
		gap: 0.4rem;
		padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
		text-align: center;
	}

	.emoji {
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}

	.status {
		margin: 0;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--color-accent);
		font-size: 0.9rem;
	}

	h1 {
		margin: 0.25rem 0 0;
		font-family: var(--font-heading, inherit);
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		color: var(--color-wood-dark);
		text-wrap: balance;
	}

	.blurb {
		margin: 0.5rem 0 0;
		max-width: 42ch;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.detail {
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		opacity: 0.75;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 1.75rem;
	}

	.actions a {
		text-decoration: none;
		font-weight: 700;
		padding: 0.8rem 1.4rem;
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
