<script lang="ts">
	import { computeProgress, progressFillBackground } from '$lib/progress';
	import { reactionEmoji } from '$lib/reactions';
	import TitleBanner from '$lib/components/TitleBanner.svelte';
	import PatchInfoModal from '$lib/components/PatchInfoModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Tap a reader's patch to see what they earned it for.
	let selectedPatch: { emoji: string; label: string; color: string; description: string } | null =
		$state(null);

	const readingByUser = $derived.by(() => {
		const groups = new Map<
			number,
			{
				name: string;
				emoji: string;
				color: string;
				displayTitle: {
					emoji: string;
					label: string;
					color: string;
					description: string;
				} | null;
				books: typeof data.currentlyReading;
			}
		>();
		for (const entry of data.currentlyReading) {
			const existing = groups.get(entry.user_id);
			if (existing) {
				existing.books.push(entry);
			} else {
				groups.set(entry.user_id, {
					name: entry.user_name,
					emoji: entry.user_avatar_emoji,
					color: entry.user_avatar_color,
					displayTitle: data.displayTitles.get(entry.user_id) ?? null,
					books: [entry]
				});
			}
		}
		return [...groups.values()];
	});
</script>

<svelte:head>
	<title>Family shelf · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<div>
			<h1>Family shelf</h1>
			<p class="subtitle">What everyone's reading right now.</p>
		</div>
		<a href="/home" class="back-link">← My shelf</a>
	</header>

	<section>
		<h2>Currently reading</h2>
		{#if readingByUser.length === 0}
			<p class="empty-state">No one's mid-book right now.</p>
		{:else}
			<div class="user-groups">
				{#each readingByUser as group (group.name)}
					<div class="user-group">
						<div class="user-group-header">
							<span class="avatar-circle" style:--tile-color={group.color}>{group.emoji}</span>
							<span class="user-name">{group.name}</span>
							{#if group.displayTitle}
								{@const dt = group.displayTitle}
								<button
									type="button"
									class="title-banner-button"
									aria-label="What is {dt.label}?"
									onclick={() => (selectedPatch = dt)}
								>
									<TitleBanner emoji={dt.emoji} label={dt.label} color={dt.color} />
								</button>
							{/if}
						</div>
						<ul class="book-list">
							{#each group.books as entry (entry.id)}
								{@const progress = computeProgress(
									entry.latest_position_type,
									entry.latest_position,
									entry.page_count
								)}
								<li
									class="book-item"
									style:background-image={progress.percent !== null
										? progressFillBackground(group.color, progress.percent)
										: undefined}
								>
									{#if progress.label}
										<span class="progress-label">{progress.label}</span>
									{/if}
									{#if entry.cover_url}
										<img class="cover" src={entry.cover_url} alt="" />
									{:else}
										<span class="cover cover-placeholder">📖</span>
									{/if}
									<div class="book-info">
										<span class="book-title">{entry.title}</span>
										{#if entry.author}
											<span class="book-author">{entry.author}</span>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section>
		<h2>Recently finished</h2>
		{#if data.recentlyFinished.length === 0}
			<p class="empty-state">No finished books yet — first one's coming soon.</p>
		{:else}
			<ul class="book-list">
				{#each data.recentlyFinished as entry (entry.id)}
					<li class="book-item">
						{#if entry.cover_url}
							<img class="cover" src={entry.cover_url} alt="" />
						{:else}
							<span class="cover cover-placeholder">📖</span>
						{/if}
						<div class="book-info">
							<span class="book-title">{entry.title}</span>
							{#if entry.author}
								<span class="book-author">{entry.author}</span>
							{/if}
						</div>
						{#if reactionEmoji(entry.reaction)}
							<span class="finish-reaction" title="{entry.user_name}'s reaction">
								{reactionEmoji(entry.reaction)}
							</span>
						{/if}
						<span class="finisher-badge" style:--tile-color={entry.user_avatar_color}
							>{entry.user_avatar_emoji} {entry.user_name}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

{#if selectedPatch}
	<PatchInfoModal
		emoji={selectedPatch.emoji}
		label={selectedPatch.label}
		color={selectedPatch.color}
		description={selectedPatch.description}
		onclose={() => (selectedPatch = null)}
	/>
{/if}

<style>
	.title-banner-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 2.5rem 1.5rem;
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding-right: calc(44px + 1rem + env(safe-area-inset-right));
		gap: 1rem;
	}

	h1 {
		font-size: 1.5rem;
		color: var(--color-wood-dark);
	}

	.subtitle {
		margin: 0.25rem 0 0;
		color: var(--color-text-muted);
	}

	.back-link {
		flex-shrink: 0;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		padding: 0.5rem 0;
	}

	section h2 {
		font-size: 1.15rem;
		color: var(--color-wood-dark);
		margin-bottom: 0.75rem;
	}

	.empty-state {
		color: var(--color-text-muted);
		font-size: 0.95rem;
	}

	.user-groups {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.user-group-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
	}

	.avatar-circle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--tile-color);
		font-size: 1.1rem;
		box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.15);
	}

	.user-name {
		font-weight: 600;
		color: var(--color-text);
	}

	.book-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.book-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		background-color: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.progress-label {
		position: absolute;
		top: 0.6rem;
		right: 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-text);
		background: var(--color-surface);
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		box-shadow: 0 2px 6px var(--color-shadow);
	}

	.cover {
		flex-shrink: 0;
		width: 44px;
		height: 64px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		background: var(--color-bg-alt);
	}

	.cover-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
	}

	.book-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.book-title {
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-author {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.finish-reaction {
		flex-shrink: 0;
		font-size: 1.2rem;
		line-height: 1;
	}

	.finisher-badge {
		flex-shrink: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text);
		background: var(--tile-color);
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		opacity: 0.85;
	}
</style>
