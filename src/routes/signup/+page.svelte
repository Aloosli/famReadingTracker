<script lang="ts">
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Create an account · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<span class="mark" aria-hidden="true">📚</span>
		<h1>{data.firstRun ? 'Claim your shelf' : 'Start your family shelf'}</h1>
		<p class="subtitle">
			{data.firstRun
				? 'This adds a sign-in to the family already on this server.'
				: 'One account for the grown-up; readers live inside it.'}
		</p>
	</header>

	{#if data.firstRun && data.existingReaders.length > 0}
		<!-- Without this, "create an account" on an install that already holds a year of reading
		     looks like it might replace it. Name the readers so it's obviously the same family. -->
		<div class="claim" role="note">
			<p class="claim-title">You'll keep everything that's already here</p>
			<p class="claim-body">
				{data.existingReaders.join(', ')} — along with their books, streaks and patches.
			</p>
		</div>
	{/if}

	{#if data.closedReason && !form?.message}
		<div class="closed" role="note">
			<p class="closed-title">Not open for sign-ups</p>
			<p class="closed-body">{data.closedReason}</p>
		</div>
	{/if}

	<form method="POST">
		{#if form?.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}

		{#if data.inviteRequired}
			<label>
				Invite code
				<input type="text" name="invite" autocomplete="off" required />
				<span class="hint">From whoever runs this server.</span>
			</label>
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
			<input
				type="password"
				name="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
			<span class="hint">At least 8 characters.</span>
		</label>

		<button type="submit" class="primary">
			{data.firstRun ? 'Claim this family' : 'Create account'}
		</button>
	</form>

	{#if !data.firstRun}
		<p class="alt">Already have an account? <a href="/login">Sign in</a></p>
	{/if}
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
		gap: var(--space-lg);
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

	.closed {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-alt);
		border-left: 4px solid var(--color-text-muted);
	}

	.closed-title {
		margin: 0 0 var(--space-3xs);
		font-weight: 700;
		font-size: var(--text-sm);
		color: var(--color-text);
	}

	.closed-body {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.claim {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-alt);
		border-left: 4px solid var(--color-accent);
	}

	.claim-title {
		margin: 0 0 var(--space-3xs);
		font-weight: 700;
		font-size: var(--text-sm);
		color: var(--color-text);
	}

	.claim-body {
		margin: 0;
		font-size: var(--text-sm);
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

	.hint {
		font-weight: 400;
		font-size: var(--text-xs);
		color: var(--color-text-muted);
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
