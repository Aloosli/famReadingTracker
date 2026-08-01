<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { computeProgress, progressFillBackground } from '$lib/progress';
	import { reactionEmoji } from '$lib/reactions';
	import { playChime, playSparkle } from '$lib/sound.svelte';
	import TitleBanner from '$lib/components/TitleBanner.svelte';
	import PatchInfoModal from '$lib/components/PatchInfoModal.svelte';
	import CelebrationToast from '$lib/components/CelebrationToast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// When the family just crossed the goal line, fire a one-off confetti burst + chime.
	let goalDismissed = $state(false);
	const goalCelebration = $derived(!goalDismissed ? data.justAchieved : null);
	onMount(() => {
		if (data.justAchieved) {
			playChime();
			setTimeout(playSparkle, 220);
		}
	});

	// Tap a reader's patch to see what they earned it for.
	let selectedPatch: { emoji: string; label: string; color: string; description: string } | null =
		$state(null);

	// Family goal: the set/edit form is hidden while a goal is running (tap "Edit" to reveal it),
	// and shown by default when there's no active goal so it's easy to start one.
	let editingGoal = $state(false);
	const fmt = (n: number) => n.toLocaleString();
	// Prefill for a fresh goal — the cinema idea we sized together.
	const draft = $derived({
		title: data.goal?.goal.title ?? 'Cinema trip',
		emoji: data.goal?.goal.emoji ?? '🎬',
		target: data.goal?.goal.target_pages ?? 3500
	});

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
	</header>

	<section class="goal-section">
		<h2>Family goal</h2>

		{#if data.justAchieved}
			{@const j = data.justAchieved}
			<div class="goal-achieved" role="status">
				<div class="goal-achieved-burst">{j.goal.emoji}</div>
				<div>
					<p class="goal-achieved-title">You did it!</p>
					<p class="goal-achieved-sub">
						{fmt(j.progress.total)} pages read together — <strong>{j.goal.title}</strong> unlocked. 🎉
					</p>
				</div>
			</div>
		{/if}

		{#if data.goal}
			{@const g = data.goal.goal}
			{@const p = data.goal.progress}
			<div class="goal-card">
				<div class="goal-head">
					<span class="goal-emoji" aria-hidden="true">{g.emoji}</span>
					<span class="goal-title">{g.title}</span>
					<button type="button" class="goal-edit" onclick={() => (editingGoal = !editingGoal)}>
						{editingGoal ? 'Close' : 'Edit'}
					</button>
				</div>

				<div class="goal-bar" role="progressbar" aria-valuenow={p.total} aria-valuemin="0" aria-valuemax={p.target}>
					<div class="goal-bar-fill" style:width="{p.percent}%"></div>
					<span class="goal-bar-text">{fmt(p.total)} / {fmt(p.target)} pages</span>
				</div>
				<p class="goal-remaining">{fmt(p.remaining)} pages to go · {p.percent}% there</p>

				{#if p.contributions.some((c) => c.pages > 0)}
					<ul class="goal-contribs">
						{#each p.contributions.filter((c) => c.pages > 0) as c (c.user_id)}
							<li class="goal-contrib">
								<span class="avatar-circle small" style:--tile-color={c.avatar_color}>{c.avatar_emoji}</span>
								<span class="goal-contrib-name">{c.name}</span>
								<span class="goal-contrib-pages">+{fmt(c.pages)}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="goal-empty-hint">No pages logged yet — every page any of you reads fills the bar.</p>
				{/if}
			</div>
		{/if}

		{#if !data.goal || editingGoal}
			<form
				method="POST"
				action="?/setGoal"
				class="goal-form"
				use:enhance={() => async ({ update }) => {
					await update();
					editingGoal = false;
				}}
			>
				<p class="goal-form-lead">
					{data.goal ? 'Update your family goal.' : 'Set a reward the whole family reads toward.'}
				</p>
				<div class="goal-form-row">
					<label class="goal-field emoji-field">
						<span>Icon</span>
						<input name="emoji" maxlength="4" value={draft.emoji} aria-label="Goal emoji" />
					</label>
					<label class="goal-field title-field">
						<span>Reward</span>
						<input name="title" value={draft.title} placeholder="Cinema trip" required />
					</label>
				</div>
				<label class="goal-field">
					<span>Pages to read together</span>
					<input name="targetPages" type="number" inputmode="numeric" min="1" value={draft.target} required />
				</label>
				<div class="goal-form-actions">
					<button type="submit" class="goal-save">{data.goal ? 'Save goal' : 'Start goal'}</button>
					{#if data.goal}
						<button
							type="submit"
							formaction="?/clearGoal"
							class="goal-cancel"
							onclick={() => (editingGoal = false)}>Remove goal</button
						>
					{/if}
				</div>
			</form>
		{/if}

		{#if data.pastGoals.length > 0}
			<div class="goal-past">
				<span class="goal-past-label">Reached</span>
				{#each data.pastGoals as pg (pg.id)}
					<span class="goal-past-chip" title="Reached {pg.achieved_at?.slice(0, 10)}">{pg.emoji} {pg.title}</span>
				{/each}
			</div>
		{/if}
	</section>

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

{#if goalCelebration}
	<CelebrationToast
		message="{goalCelebration.goal.title} unlocked! {goalCelebration.progress.total.toLocaleString()} pages read together."
		emoji={goalCelebration.goal.emoji}
		accentColor="var(--color-accent)"
		onDismiss={() => (goalDismissed = true)}
	/>
{/if}

<style>
	.title-banner-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	/* --- Family goal --- */
	.goal-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.goal-card,
	.goal-form,
	.goal-achieved {
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px var(--color-shadow);
		padding: var(--space-md) var(--space-md);
	}

	.goal-head {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-sm);
	}

	.goal-emoji {
		font-size: var(--text-xl);
		line-height: 1;
	}

	.goal-title {
		font-weight: 700;
		font-size: var(--text-md);
		color: var(--color-text);
		flex: 1;
		min-width: 0;
	}

	.goal-edit {
		flex-shrink: 0;
		border: none;
		background: var(--color-bg-alt);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: var(--text-xs);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: 999px;
		cursor: pointer;
	}

	.goal-bar {
		position: relative;
		height: 34px;
		border-radius: 999px;
		background: var(--color-bg-alt);
		overflow: hidden;
		box-shadow: inset 0 2px 5px var(--color-shadow);
	}

	.goal-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--color-accent), var(--color-accent-hover));
		transition: width 0.6s var(--spring, ease);
		min-width: 0.5rem;
	}

	.goal-bar-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		/* The number the whole family is working toward — it was smaller than body text. */
		font-size: var(--text-md);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
		text-shadow: 0 1px 2px var(--color-surface);
	}

	.goal-remaining {
		margin: var(--space-xs) 0 0;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.goal-contribs {
		list-style: none;
		margin: var(--space-sm) 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.goal-contrib {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		background: var(--color-bg-alt);
		border-radius: 999px;
		padding: var(--space-2xs) var(--space-sm) var(--space-2xs) var(--space-2xs);
	}

	.avatar-circle.small {
		width: 26px;
		height: 26px;
		font-size: var(--text-sm);
	}

	.goal-contrib-name {
		font-size: var(--text-sm);
		color: var(--color-text);
	}

	.goal-contrib-pages {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--color-accent);
		font-variant-numeric: tabular-nums;
	}

	.goal-empty-hint,
	.goal-form-lead {
		margin: var(--space-sm) 0 0;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.goal-form-lead {
		margin: 0 0 var(--space-sm);
	}

	.goal-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.goal-form-row {
		display: flex;
		gap: var(--space-xs);
	}

	.goal-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.goal-field input {
		font-size: var(--text-base);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.emoji-field {
		width: 4.5rem;
		flex-shrink: 0;
	}

	.emoji-field input {
		text-align: center;
		font-size: var(--text-lg);
	}

	.title-field {
		flex: 1;
	}

	.goal-form-actions {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.goal-save {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: var(--text-sm);
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.goal-cancel {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		text-decoration: underline;
	}

	.goal-achieved {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
		color: #fff;
	}

	.goal-achieved-burst {
		font-size: var(--text-2xl);
		line-height: 1;
	}

	.goal-achieved-title {
		margin: 0;
		font-weight: 800;
		font-size: var(--text-md);
	}

	.goal-achieved-sub {
		margin: var(--space-3xs) 0 0;
		font-size: var(--text-sm);
		opacity: 0.95;
	}

	.goal-past {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-xs);
	}

	.goal-past-label {
		font-size: var(--text-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
	}

	.goal-past-chip {
		font-size: var(--text-xs);
		background: var(--color-bg-alt);
		color: var(--color-text);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: 999px;
	}

	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xl);
		padding: var(--space-3xl) var(--space-xl);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding-right: calc(44px + 1rem + env(safe-area-inset-right));
		gap: var(--space-md);
	}

	h1 {
		font-size: var(--text-lg);
		color: var(--color-wood-dark);
	}

	.subtitle {
		margin: var(--space-2xs) 0 0;
		color: var(--color-text-muted);
	}

	section h2 {
		font-size: var(--text-md);
		color: var(--color-wood-dark);
		margin-bottom: var(--space-sm);
	}

	.empty-state {
		color: var(--color-text-muted);
		font-size: var(--text-base);
	}

	.user-groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.user-group-header {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-xs);
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
		font-size: var(--text-md);
		box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.15);
	}

	/* Each reader heads their own group, so their name is the thing you scan for down this page —
	   it had no size of its own and sat level with the book titles underneath it. */
	.user-name {
		font-size: var(--text-lg);
		font-family: var(--font-heading);
		line-height: var(--leading-snug);
		font-weight: 600;
		color: var(--color-text);
	}

	.book-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.book-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background-color: var(--color-surface);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.progress-label {
		position: absolute;
		top: 0.6rem;
		right: 0.75rem;
		font-size: var(--text-2xs);
		font-weight: 700;
		color: var(--color-text);
		background: var(--color-surface);
		padding: var(--space-3xs) var(--space-xs);
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
		font-size: var(--text-lg);
	}

	.book-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	/* Deliberately a step below .user-name, not level with it: here the reader is the heading and
	   their books are the list. (On /home there is only one reader, so the title leads instead.) */
	.book-title {
		font-size: var(--text-base);
		line-height: var(--leading-snug);
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-author {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.finish-reaction {
		flex-shrink: 0;
		font-size: var(--text-md);
		line-height: 1;
	}

	.finisher-badge {
		flex-shrink: 0;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-text);
		background: var(--tile-color);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: 999px;
		opacity: 0.85;
	}
</style>
