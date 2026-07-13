<script lang="ts">
	import { enhance } from '$app/forms';
	import TitleBanner from '$lib/components/TitleBanner.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let managing = $state(false);
	// The id of the reader whose retire confirmation is currently open (null = none).
	let confirming = $state<number | null>(null);

	const confirmingReader = $derived(
		confirming === null ? null : (data.users.find((u) => u.id === confirming) ?? null)
	);

	function bookLine(count: number): string {
		if (count === 0) return 'their shelf';
		return `their shelf and ${count} ${count === 1 ? 'book' : 'books'}`;
	}

	function rememberLocally({ formData }: { formData: FormData }) {
		const id = formData.get('userId');
		if (id) {
			try {
				localStorage.setItem('profile_id', String(id));
			} catch {
				// localStorage unavailable (private browsing) — cookie still handles persistence.
			}
		}
	}

	function afterRetire() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			confirming = null;
		};
	}
</script>

<svelte:head>
	<title>Who's reading? · Family Reading Tracker</title>
</svelte:head>

<main>
	<h1>Who's reading tonight?</h1>
	<p class="subtitle">Tap your shelf to settle in.</p>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}

	<div class="shelf">
		{#each data.users as user (user.id)}
			<div class="tile-wrap">
				<form method="POST" action="?/select" use:enhance={rememberLocally}>
					<button
						type={managing ? 'button' : 'submit'}
						name="userId"
						value={user.id}
						class="avatar-tile"
						class:managing
						style:--tile-color={user.avatar_color}
						onclick={managing ? () => (confirming = user.id) : undefined}
					>
						<span class="avatar-circle">{user.avatar_emoji}</span>
						<span class="name">{user.name}</span>
						{#if user.displayTitle}
							<TitleBanner
								emoji={user.displayTitle.emoji}
								label={user.displayTitle.label}
								color={user.displayTitle.color}
							/>
						{/if}
					</button>
				</form>
				{#if managing}
					<button
						type="button"
						class="retire-badge"
						aria-label="Retire {user.name}"
						onclick={() => (confirming = user.id)}>✕</button
					>
				{/if}
			</div>
		{/each}
	</div>

	<div class="manage-bar">
		{#if managing}
			<a class="add-link" href="/setup">+ Add reader</a>
			<a class="add-link" href="/data">Data &amp; backup</a>
			<button
				type="button"
				class="manage-toggle"
				onclick={() => {
					managing = false;
					confirming = null;
				}}>Done</button
			>
		{:else}
			<button type="button" class="manage-toggle subtle" onclick={() => (managing = true)}>
				Manage readers
			</button>
		{/if}
	</div>
</main>

{#if confirmingReader}
	<div
		class="confirm-backdrop"
		role="button"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (confirming = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirming = null)}
	>
		<div class="confirm-card" role="dialog" aria-modal="true">
			<span class="confirm-emoji" style:background={confirmingReader.avatar_color}>
				{confirmingReader.avatar_emoji}
			</span>
			<p class="confirm-title">Retire {confirmingReader.name}?</p>
			<p class="confirm-body">
				This permanently removes {bookLine(confirmingReader.bookCount)}, along with their reading
				streak and any patches earned. This can't be undone.
			</p>
			<div class="confirm-actions">
				<button type="button" class="ghost" onclick={() => (confirming = null)}>Cancel</button>
				<form method="POST" action="?/retireReader" use:enhance={afterRetire}>
					<input type="hidden" name="userId" value={confirmingReader.id} />
					<button type="submit" class="danger">Remove {confirmingReader.name}</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
		text-align: center;
	}

	h1 {
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		color: var(--color-wood-dark);
	}

	.subtitle {
		margin: 0 0 2.5rem;
		color: var(--color-text-muted);
		font-size: 1.05rem;
	}

	.error {
		color: var(--color-error);
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.shelf {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: clamp(1rem, 3vw, 2rem);
		max-width: 640px;
	}

	.avatar-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 140px;
		padding: 1.25rem 0.5rem;
		background: var(--color-surface);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: 0 10px 24px var(--color-shadow);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.avatar-tile:hover {
		transform: translateY(-4px);
		box-shadow: 0 14px 28px var(--color-shadow);
	}

	.avatar-tile:active {
		transform: scale(0.95);
		box-shadow: 0 6px 14px var(--color-shadow);
	}

	.avatar-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 84px;
		height: 84px;
		border-radius: 50%;
		background: var(--tile-color);
		font-size: 2.5rem;
		box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.15);
	}

	.name {
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--color-text);
	}

	.tile-wrap {
		position: relative;
	}

	.tile-wrap form {
		display: contents;
	}

	.avatar-tile.managing {
		cursor: pointer;
		animation: wiggle 0.4s ease-in-out infinite alternate;
	}

	.avatar-tile.managing:hover {
		transform: none;
	}

	@keyframes wiggle {
		from {
			transform: rotate(-1deg);
		}
		to {
			transform: rotate(1deg);
		}
	}

	.retire-badge {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid var(--color-surface);
		background: var(--color-error);
		color: #fff;
		font-size: 0.85rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 4px 10px var(--color-shadow);
		z-index: 2;
	}

	.manage-bar {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-top: 2.5rem;
		min-height: 1.5rem;
	}

	.manage-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-accent);
		padding: 0.4rem 0.6rem;
	}

	.manage-toggle.subtle {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.manage-toggle:hover {
		color: var(--color-accent);
	}

	.add-link {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-accent);
		text-decoration: none;
		padding: 0.4rem 0.6rem;
	}

	.confirm-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.5);
		z-index: 10;
	}

	.confirm-card {
		width: 100%;
		max-width: 380px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 1.75rem 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
		text-align: center;
	}

	.confirm-emoji {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		font-size: 2rem;
		box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.15);
		margin-bottom: 0.25rem;
	}

	.confirm-title {
		margin: 0;
		font-family: var(--font-heading, inherit);
		font-size: 1.35rem;
		color: var(--color-wood-dark);
	}

	.confirm-body {
		margin: 0 0 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		gap: 0.75rem;
		width: 100%;
	}

	.confirm-actions form {
		flex: 1;
		display: flex;
	}

	.confirm-actions button {
		flex: 1;
		padding: 0.8rem 1rem;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.ghost {
		flex: 1;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.danger {
		width: 100%;
		background: var(--color-error);
		border: none;
		color: #fff;
	}

	@media (prefers-reduced-motion: reduce) {
		.avatar-tile.managing {
			animation: none;
		}
	}
</style>
