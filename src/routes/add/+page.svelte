<script lang="ts">
	import { enhance } from '$app/forms';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import type { GoogleBookResult } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Destination = 'reading' | 'finished' | 'wishlist';

	const SHELVES: { value: Destination; label: string; cta: string }[] = [
		{ value: 'reading', label: 'Reading now', cta: 'Add to my shelf' },
		{ value: 'finished', label: "Already read", cta: 'Add as read' },
		{ value: 'wishlist', label: 'Up Next', cta: 'Add to Up Next' }
	];

	// Seeded by the link that got here, but the reader can change it — the same book might be
	// one they're starting, one they just finished, or one they're only planning.
	// svelte-ignore state_referenced_locally
	let destination: Destination = $state(data.destination as Destination);

	// This component is reused when navigating between /add and /add?to=wishlist, so re-seed from
	// the link instead of stranding the previous visit's choice.
	$effect(() => {
		destination = data.destination as Destination;
	});

	const ctaLabel = $derived(SHELVES.find((s) => s.value === destination)?.cta ?? 'Add to my shelf');

	type Tab = 'scan' | 'search' | 'manual';
	let tab: Tab = $state('scan');

	let selected: GoogleBookResult | null = $state(null);

	// Scan tab state
	let scannerActive = $state(true);
	let lookupState: 'idle' | 'loading' | 'not-found' = $state('idle');
	let scannedIsbn = $state('');

	// Search tab state
	let searchQuery = $state('');
	let searchLoading = $state(false);
	let searchResults: GoogleBookResult[] = $state([]);
	let searchAttempted = $state(false);
	let searchFailed = $state(false);

	// Manual tab state
	let manualTitle = $state('');
	let manualAuthor = $state('');
	let manualPageCount = $state('');

	// Page count prompt shown on the confirm card when Google Books didn't provide one
	let confirmPageCount = $state('');
	$effect(() => {
		selected;
		confirmPageCount = '';
	});

	function switchTab(next: Tab) {
		tab = next;
		selected = null;
	}

	async function lookupIsbn(isbn: string) {
		scannerActive = false;
		lookupState = 'loading';
		scannedIsbn = isbn;
		try {
			const res = await fetch(`/api/books/search?q=isbn:${encodeURIComponent(isbn)}`);
			const body = (await res.json()) as { results: GoogleBookResult[] };
			if (body.results.length > 0) {
				selected = body.results[0];
				lookupState = 'idle';
			} else {
				lookupState = 'not-found';
			}
		} catch {
			lookupState = 'not-found';
		}
	}

	function scanAgain() {
		selected = null;
		lookupState = 'idle';
		scannedIsbn = '';
		scannerActive = true;
	}

	async function runSearch(e: SubmitEvent) {
		e.preventDefault();
		if (!searchQuery.trim()) return;
		searchLoading = true;
		searchAttempted = true;
		searchFailed = false;
		try {
			const res = await fetch(`/api/books/search?q=${encodeURIComponent(searchQuery)}`);
			const body = (await res.json()) as { results: GoogleBookResult[]; error?: string };
			searchResults = body.results;
			searchFailed = Boolean(body.error);
		} catch {
			searchResults = [];
			searchFailed = true;
		} finally {
			searchLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Add a book · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<a href="/home" class="back">&larr; Back</a>
		<h1>Add a book for {data.user.name}</h1>
	</header>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}

	<fieldset class="shelves">
		<legend>Where does it go?</legend>
		<div class="shelf-options">
			{#each SHELVES as shelf (shelf.value)}
				<label class="shelf" class:selected={destination === shelf.value}>
					<input type="radio" name="shelf" value={shelf.value} bind:group={destination} />
					{shelf.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="tabs">
		<button class:active={tab === 'scan'} onclick={() => switchTab('scan')}>Scan barcode</button>
		<button class:active={tab === 'search'} onclick={() => switchTab('search')}
			>Search by title</button
		>
		<button class:active={tab === 'manual'} onclick={() => switchTab('manual')}
			>Type it in</button
		>
	</div>

	{#if selected}
		<div class="confirm-card">
			{#if selected.coverUrl}
				<img src={selected.coverUrl} alt={selected.title} />
			{:else}
				<div class="cover-placeholder">📕</div>
			{/if}
			<div class="confirm-info">
				<h2>{selected.title}</h2>
				{#if selected.author}<p class="author">{selected.author}</p>{/if}
			</div>
			<form method="POST" action="?/addBook" use:enhance>
				<input type="hidden" name="destination" value={destination} />
				<input type="hidden" name="title" value={selected.title} />
				<input type="hidden" name="author" value={selected.author ?? ''} />
				<input type="hidden" name="coverUrl" value={selected.coverUrl ?? ''} />
				<input type="hidden" name="googleBooksId" value={selected.googleBooksId} />
				<input type="hidden" name="isbn" value={selected.isbn ?? ''} />
				{#if selected.pageCount}
					<input type="hidden" name="pageCount" value={selected.pageCount} />
				{:else}
					<label class="page-count-label">
						How many pages? <span class="optional">(optional — powers the progress bar)</span>
						<input
							type="number"
							name="pageCount"
							min="1"
							inputmode="numeric"
							bind:value={confirmPageCount}
							placeholder="e.g. 320"
						/>
					</label>
				{/if}
				<button type="submit" class="primary">{ctaLabel}</button>
			</form>
			<button class="link-button" onclick={() => (selected = null)}>Choose something else</button>
		</div>
	{:else if tab === 'scan'}
		<section class="panel">
			{#if scannerActive}
				<BarcodeScanner ondetected={lookupIsbn} onmanual={() => switchTab('manual')} />
			{:else if lookupState === 'loading'}
				<p class="hint">Looking up ISBN {scannedIsbn}…</p>
			{:else if lookupState === 'not-found'}
				<p class="hint">Couldn't find that one online. Add it by hand instead:</p>
				<form method="POST" action="?/addBook" use:enhance>
					<input type="hidden" name="destination" value={destination} />
					<input type="hidden" name="isbn" value={scannedIsbn} />
					<label>
						Title
						<input type="text" name="title" required placeholder="Book title" />
					</label>
					<label>
						Author <span class="optional">(optional)</span>
						<input type="text" name="author" placeholder="Author" />
					</label>
					<label>
						Total pages <span class="optional">(optional — powers the progress bar)</span>
						<input type="number" name="pageCount" min="1" inputmode="numeric" placeholder="e.g. 320" />
					</label>
					<button type="submit" class="primary">{ctaLabel}</button>
				</form>
				<button class="link-button" onclick={scanAgain}>Scan again</button>
			{/if}
		</section>
	{:else if tab === 'search'}
		<section class="panel">
			<form onsubmit={runSearch} class="search-form">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Title, author, or keyword…"
					aria-label="Search for a book"
				/>
				<button type="submit" class="primary">Search</button>
			</form>

			{#if searchLoading}
				<p class="hint">Searching…</p>
			{:else if searchFailed}
				<p class="hint">
					Book search is unavailable right now. You can <button
						class="link-button inline"
						onclick={() => switchTab('manual')}>type it in by hand</button
					> instead.
				</p>
			{:else if searchAttempted && searchResults.length === 0}
				<p class="hint">
					No matches. Try a different search, or <button
						class="link-button inline"
						onclick={() => switchTab('manual')}>type it in by hand</button
					>.
				</p>
			{:else if searchResults.length > 0}
				<div class="results">
					{#each searchResults as result (result.googleBooksId)}
						<button class="result-card" onclick={() => (selected = result)}>
							{#if result.coverUrl}
								<img src={result.coverUrl} alt={result.title} />
							{:else}
								<div class="cover-placeholder small">📕</div>
							{/if}
							<div class="result-info">
								<strong>{result.title}</strong>
								{#if result.author}<span class="author">{result.author}</span>{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		<section class="panel">
			<form method="POST" action="?/addBook" use:enhance>
				<input type="hidden" name="destination" value={destination} />
				<label>
					Title
					<input type="text" name="title" required bind:value={manualTitle} placeholder="Book title" />
				</label>
				<label>
					Author <span class="optional">(optional)</span>
					<input type="text" name="author" bind:value={manualAuthor} placeholder="Author" />
				</label>
				<label>
					Total pages <span class="optional">(optional — powers the progress bar)</span>
					<input
						type="number"
						name="pageCount"
						min="1"
						inputmode="numeric"
						bind:value={manualPageCount}
						placeholder="e.g. 320"
					/>
				</label>
				<button type="submit" class="primary" disabled={!manualTitle.trim()}>{ctaLabel}</button>
			</form>
		</section>
	{/if}
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
		max-width: 560px;
		margin: 0 auto;
	}

	header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.back {
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	h1 {
		font-size: 1.5rem;
		color: var(--color-wood-dark);
	}

	.error {
		color: var(--color-error);
		font-weight: 600;
		margin: 0;
	}

	.shelves {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shelves legend {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text-muted);
		padding: 0;
		margin-bottom: 0.4rem;
	}

	.shelf-options {
		display: flex;
		gap: 0.5rem;
		background: var(--color-bg-alt);
		padding: 0.35rem;
		border-radius: var(--radius-md);
	}

	.shelf {
		flex: 1;
		text-align: center;
		padding: 0.65rem 0.5rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.shelf.selected {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 4px 10px var(--color-shadow);
	}

	/* The radio drives state and keeps the control keyboard- and screen-reader-navigable; the
	   label is what's actually painted. */
	.shelf input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.shelf:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		background: var(--color-bg-alt);
		padding: 0.35rem;
		border-radius: var(--radius-md);
	}

	.tabs button {
		flex: 1;
		border: none;
		background: transparent;
		padding: 0.65rem 0.5rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.tabs button.active {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 4px 10px var(--color-shadow);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hint {
		color: var(--color-text-muted);
		text-align: center;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text);
	}

	.optional {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	input[type='text'],
	input[type='search'] {
		font-size: 1rem;
		padding: 0.75rem 0.9rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.search-form {
		flex-direction: row;
	}

	.search-form input {
		flex: 1;
	}

	button.primary {
		background: var(--color-accent);
		color: #fff;
		border: none;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-sm);
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	button.primary:hover {
		background: var(--color-accent-hover);
	}

	button.primary:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.link-button {
		background: none;
		border: none;
		color: var(--color-accent);
		font-weight: 600;
		cursor: pointer;
		padding: 0.25rem 0;
		align-self: center;
	}

	.link-button.inline {
		display: inline;
		padding: 0;
		font-weight: 600;
		text-decoration: underline;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.result-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		background: var(--color-surface);
		border: none;
		border-radius: var(--radius-md);
		padding: 0.75rem;
		box-shadow: 0 4px 12px var(--color-shadow);
		cursor: pointer;
		text-align: left;
	}

	.result-card img {
		width: 48px;
		height: 72px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.result-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.result-info .author {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.cover-placeholder {
		width: 48px;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-alt);
		border-radius: 4px;
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.confirm-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: 0 10px 24px var(--color-shadow);
		text-align: center;
	}

	.confirm-card img {
		width: 100px;
		height: 150px;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}

	.confirm-card .cover-placeholder {
		width: 100px;
		height: 150px;
		font-size: 2.5rem;
		border-radius: var(--radius-sm);
	}

	.confirm-info h2 {
		font-size: 1.3rem;
	}

	.confirm-info .author {
		color: var(--color-text-muted);
		margin: 0.25rem 0 0;
	}

	.confirm-card form {
		width: 100%;
	}
</style>
