<script lang="ts">
	import { reactionEmoji } from '$lib/reactions';
	import TitlePatch from '$lib/components/TitlePatch.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const isCurrentYear = $derived(data.year === String(new Date().getFullYear()));
	const pagesLabel = $derived(data.totalPages.toLocaleString());
</script>

<svelte:head>
	<title>{data.user.name}'s {data.year} in books · Family Reading Tracker</title>
</svelte:head>

<main>
	<a href="/home" class="back-link">← Back to my shelf</a>

	<header class="hero" style:--tile-color={data.user.avatar_color}>
		<span class="avatar-circle">{data.user.avatar_emoji}</span>
		<p class="hero-eyebrow">{data.user.name}'s year in books</p>
		<h1>{data.year}</h1>
	</header>

	{#if data.finishedCount === 0}
		<p class="empty-state">
			{data.user.name}'s {data.year} story is just beginning — finish a book and it'll start filling
			up here.
		</p>
	{:else}
		<p class="lede">
			{isCurrentYear ? 'So far this year' : `In ${data.year}`}, {data.user.name} finished
			<strong>{data.finishedCount}</strong>
			{data.finishedCount === 1 ? 'book' : 'books'}.
		</p>

		<section class="stat-tiles">
			<div class="stat-tile">
				<span class="stat-number">{data.finishedCount}</span>
				<span class="stat-caption">{data.finishedCount === 1 ? 'book' : 'books'} finished</span>
			</div>
			{#if data.totalPages > 0}
				<div class="stat-tile">
					<span class="stat-number">{pagesLabel}</span>
					<span class="stat-caption">pages read</span>
				</div>
			{/if}
			{#if data.busiestMonth}
				<div class="stat-tile">
					<span class="stat-number">{data.busiestMonth.name}</span>
					<span class="stat-caption">busiest month · {data.busiestMonth.count}</span>
				</div>
			{/if}
			{#if data.longest?.page_count}
				<div class="stat-tile">
					<span class="stat-number">{data.longest.page_count.toLocaleString()}</span>
					<span class="stat-caption">longest book · {data.longest.title}</span>
				</div>
			{/if}
		</section>

		{#if data.favourite}
			<section class="favourite" style:--fav-accent={data.user.avatar_color}>
				<p class="section-label">The one you loved 😍</p>
				<div class="favourite-card">
					{#if data.favourite.cover_url}
						<img class="favourite-cover" src={data.favourite.cover_url} alt="" />
					{:else}
						<span class="favourite-cover favourite-placeholder">📕</span>
					{/if}
					<div class="favourite-info">
						<h2>{data.favourite.title}</h2>
						{#if data.favourite.author}<p class="favourite-author">{data.favourite.author}</p>{/if}
					</div>
				</div>
			</section>
		{/if}

		{#if data.patches.length > 0}
			<section class="patches">
				<p class="section-label">Patches earned this year</p>
				<div class="patch-row">
					{#each data.patches as patch (patch.key)}
						<TitlePatch emoji={patch.emoji} label={patch.label} color={patch.color} />
					{/each}
				</div>
			</section>
		{/if}

		<section class="wall">
			<p class="section-label">Every book, {data.year}</p>
			<div class="cover-wall">
				{#each data.books as book (book.id)}
					<div
						class="wall-book"
						title={book.author ? `${book.title} — ${book.author}` : book.title}
					>
						{#if book.cover_url}
							<img src={book.cover_url} alt={book.title} />
						{:else}
							<span class="wall-placeholder">{book.title}</span>
						{/if}
						{#if reactionEmoji(book.reaction)}
							<span class="wall-reaction" aria-hidden="true">{reactionEmoji(book.reaction)}</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}
</main>

<style>
	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 2rem 1.5rem calc(4rem + env(safe-area-inset-bottom));
	}

	.back-link {
		align-self: flex-start;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		color: var(--color-accent);
	}

	.back-link:hover {
		text-decoration: underline;
	}

	/* ---- Hero ---- */
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.4rem;
		padding: 1rem 0 0.5rem;
	}

	.avatar-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: var(--tile-color);
		font-size: 2.1rem;
		box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.15);
		margin-bottom: 0.5rem;
	}

	.hero-eyebrow {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	h1 {
		font-family: var(--font-heading);
		font-size: clamp(3.5rem, 14vw, 6rem);
		line-height: 0.95;
		color: var(--color-wood-dark);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.lede {
		text-align: center;
		font-size: 1.15rem;
		color: var(--color-text);
		margin: -0.5rem 0 0;
	}

	.lede strong {
		color: var(--color-accent);
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 1rem;
		max-width: 46ch;
		margin: 1rem auto;
	}

	.section-label {
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: var(--color-wood-dark);
		margin: 0 0 0.9rem;
	}

	/* ---- Stat tiles ---- */
	.stat-tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.stat-tile {
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px var(--color-shadow);
		padding: 1.25rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		text-align: center;
	}

	.stat-number {
		font-family: var(--font-heading);
		font-size: 1.7rem;
		font-weight: 700;
		color: var(--color-wood-dark);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.stat-caption {
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}

	/* ---- Favourite ---- */
	.favourite-card {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: 0 8px 20px var(--color-shadow);
		border-left: 6px solid var(--fav-accent);
	}

	.favourite-cover {
		flex-shrink: 0;
		width: 84px;
		height: 126px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 10px var(--color-shadow);
	}

	.favourite-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-alt);
		font-size: 2.5rem;
	}

	.favourite-info h2 {
		font-size: 1.4rem;
		color: var(--color-wood-dark);
		margin: 0;
	}

	.favourite-author {
		margin: 0.35rem 0 0;
		color: var(--color-text-muted);
	}

	/* ---- Patches ---- */
	.patch-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem 1rem;
	}

	.patch-row :global(.patch) {
		width: 104px;
	}

	/* ---- Cover wall ---- */
	.cover-wall {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 1rem;
	}

	.wall-book {
		position: relative;
		aspect-ratio: 2 / 3;
	}

	.wall-book img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: var(--radius-sm);
		box-shadow: 0 5px 12px var(--color-shadow);
	}

	.wall-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0.4rem;
		background: var(--color-bg-alt);
		border-radius: var(--radius-sm);
		box-shadow: 0 5px 12px var(--color-shadow);
		font-size: 0.72rem;
		font-weight: 600;
		text-align: center;
		color: var(--color-text-muted);
		line-height: 1.2;
		overflow: hidden;
	}

	.wall-reaction {
		position: absolute;
		top: -7px;
		right: -7px;
		font-size: 1rem;
		background: var(--color-surface);
		border-radius: 50%;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 5px var(--color-shadow);
	}
</style>
