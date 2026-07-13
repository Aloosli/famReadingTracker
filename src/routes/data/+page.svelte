<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const { readers, books, entries } = $derived(data.summary);

	// The chosen restore file's name, shown before the (destructive) confirm button appears.
	let restoreFileName = $state<string | null>(null);

	function plural(n: number, word: string): string {
		return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
	}

	function pickFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		restoreFileName = input.files?.[0]?.name ?? null;
	}

	function onRestore() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			restoreFileName = null;
		};
	}
</script>

<svelte:head>
	<title>Data & backup · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<a class="back" href="/">← Back to readers</a>
		<h1>Data &amp; backup</h1>
		<p class="subtitle">
			This is your family's reading history, and it's yours to keep. Download a copy any time — no
			account, no cloud, nothing locked away.
		</p>
	</header>

	<p class="summary">
		Right now you have <strong>{plural(readers, 'reader')}</strong>,
		<strong>{plural(books, 'book')}</strong> and
		<strong>{plural(entries, 'reading record')}</strong>.
	</p>

	<div class="cards">
		<section class="card">
			<div class="card-head">
				<span class="card-emoji">💾</span>
				<h2>Full backup</h2>
			</div>
			<p>
				A complete, restore-ready copy of everything. Keep it somewhere safe — if you ever need to
				start fresh or move to a new device, drop this file back in place of
				<code>data/reading-tracker.db</code> and every shelf returns exactly as it was.
			</p>
			<a class="download primary" href="/data/export?format=db" download>Download backup (.db)</a>
		</section>

		<section class="card">
			<div class="card-head">
				<span class="card-emoji">📄</span>
				<h2>Readable export</h2>
			</div>
			<p>
				The same data as plain, open JSON — every reader, book, session and patch, in a file you can
				open, read, and take anywhere. Great for peeking inside or moving to another tool.
			</p>
			<a class="download" href="/data/export?format=json" download>Export as JSON</a>
		</section>

		<section class="card restore">
			<div class="card-head">
				<span class="card-emoji">♻️</span>
				<h2>Restore from a backup</h2>
			</div>
			<p>
				Have a <strong>JSON export</strong> from this app? Upload it to bring everything back.
				<strong>This replaces all current data</strong> — every reader, book and bit of progress — so
				it's worth downloading a fresh backup first if you're unsure. (Restoring a full
				<code>.db</code> backup is a file swap — see the note below.)
			</p>

			{#if form?.restored}
				<p class="restore-note ok">
					✅ Restored {plural(form.summary.readers, 'reader')} and {plural(form.summary.books, 'book')}.
				</p>
			{:else if form?.restoreError}
				<p class="restore-note error">{form.restoreError}</p>
			{/if}

			<form method="POST" action="?/restore" enctype="multipart/form-data" use:enhance={onRestore}>
				<input
					class="file-input"
					type="file"
					name="backup"
					accept=".json,application/json"
					onchange={pickFile}
				/>
				{#if restoreFileName}
					<div class="restore-confirm">
						<p>
							Restore from <strong>{restoreFileName}</strong>? This erases what's here now and can't
							be undone.
						</p>
						<button type="submit" class="download danger">Replace all data</button>
					</div>
				{/if}
			</form>
		</section>
	</div>

	<p class="footnote">
		Backups are made on the spot from your live data, so they're always current the moment you
		download.
	</p>
</main>

<style>
	main {
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 2.5rem 1.5rem calc(4rem + env(safe-area-inset-bottom));
	}

	.back {
		display: inline-block;
		margin-bottom: 1.25rem;
		color: var(--color-text-muted);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.back:hover {
		color: var(--color-accent);
	}

	h1 {
		font-family: var(--font-heading, inherit);
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		color: var(--color-wood-dark);
		margin: 0;
		text-wrap: balance;
	}

	.subtitle {
		margin: 0.75rem 0 0;
		color: var(--color-text-muted);
		max-width: 54ch;
		line-height: 1.5;
	}

	.summary {
		margin: 0;
		font-size: 1.05rem;
		color: var(--color-text);
	}

	.summary strong {
		color: var(--color-accent);
		white-space: nowrap;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: 0 6px 16px var(--color-shadow);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.card-emoji {
		font-size: 1.6rem;
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		color: var(--color-text);
	}

	.card p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.55;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85em;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.35rem;
	}

	.download {
		align-self: flex-start;
		margin-top: 0.25rem;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text);
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.7rem 1.25rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.download:hover {
		border-color: var(--color-accent);
	}

	.download.primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: #fff;
		box-shadow: 0 8px 18px var(--color-shadow);
	}

	.download.primary:hover {
		background: var(--color-accent-hover);
	}

	.file-input {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		max-width: 100%;
	}

	.file-input::file-selector-button {
		margin-right: 0.75rem;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text);
		font-weight: 600;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.file-input::file-selector-button:hover {
		border-color: var(--color-accent);
	}

	.restore-confirm {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
	}

	.restore-confirm p {
		margin: 0;
		color: var(--color-text);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.download.danger {
		align-self: flex-start;
		background: var(--color-error);
		border-color: var(--color-error);
		color: #fff;
	}

	.restore-note {
		margin: 0;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.restore-note.ok {
		color: var(--color-accent);
	}

	.restore-note.error {
		color: var(--color-error);
	}

	.footnote {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}
</style>
