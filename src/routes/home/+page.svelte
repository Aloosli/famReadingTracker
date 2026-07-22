<script lang="ts">
	import { enhance } from '$app/forms';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { playChime, playSparkle } from '$lib/sound.svelte';
	import { computeProgress, progressFillBackground } from '$lib/progress';
	import { REACTIONS, reactionEmoji } from '$lib/reactions';
	import CelebrationToast from '$lib/components/CelebrationToast.svelte';
	import TitlePatch from '$lib/components/TitlePatch.svelte';
	import TitleBanner from '$lib/components/TitleBanner.svelte';
	import AvatarChooser from '$lib/components/AvatarChooser.svelte';
	import PatchInfoModal from '$lib/components/PatchInfoModal.svelte';
	import type { ReadingEntryWithBook } from '$lib/server/db/entries';
	import type { TitleGrant } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Profile editing — a reader can rename themselves and pick their own avatar.
	let editingProfile = $state(false);
	let editName = $state('');
	let editEmoji = $state('');
	let editColor = $state('');
	let editGoal = $state(4);

	function openProfileEditor() {
		editName = data.user.name;
		editEmoji = data.user.avatar_emoji;
		editColor = data.user.avatar_color;
		editGoal = data.user.monthly_goal;
		editingProfile = true;
	}

	const goalProgress = $derived(
		Math.min(100, Math.round((data.finishedThisMonth / data.user.monthly_goal) * 100))
	);

	// Count-up stats — the numbers tick up from 0 on load (instant if reduced motion is preferred).
	const countDuration =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
			? 0
			: 900;
	const streakCount = new Tween(0, { duration: countDuration, easing: cubicOut });
	const monthCount = new Tween(0, { duration: countDuration, easing: cubicOut });
	$effect(() => {
		streakCount.set(data.streak);
		monthCount.set(data.finishedThisMonth);
	});
	// The goal bar fills in lockstep with the books-this-month count-up.
	const goalBarWidth = $derived(Math.min(100, (monthCount.current / data.user.monthly_goal) * 100));

	const earnedPatches = $derived(data.patches.filter((patch) => patch.earned));
	const activePatch = $derived(earnedPatches.find((patch) => patch.isActive) ?? null);
	// Earned badges first as the showcase, then the mystery slots still to discover.
	const trophyPatches = $derived([
		...earnedPatches,
		...data.patches.filter((patch) => !patch.earned)
	]);

	// Tap an earned patch to see what it's for (and choose whether to show it on your profile).
	let selectedPatch: (typeof data.patches)[number] | null = $state(null);

	function earnedDateLabel(earnedAt: string | null): string {
		if (!earnedAt) return '';
		const date = new Date(earnedAt.replace(' ', 'T') + 'Z');
		return Number.isNaN(date.getTime())
			? ''
			: `Earned ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
	}

	// UTC day, to match how sessions are timestamped server-side.
	const todayStr = new Date().toISOString().slice(0, 10);

	let openEntryId: number | null = $state(null);
	let logPosition = $state('');
	let logType: 'page' | 'percent' = $state('page');
	let pageCountDraft = $state('');

	// "When did you read this?" — for logging progress after the fact. 'now' is a live log; the
	// others backdate the reading to a chosen day + rough time of day (see resolveReadAt on the server).
	type LogWhen = 'now' | 'lastnight' | 'earlier';
	type LogBucket = 'morning' | 'afternoon' | 'evening' | 'night';
	let logWhen = $state<LogWhen>('now');
	let logDate = $state('');
	let logBucket = $state<LogBucket>('evening');
	const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
	// Number of freeze slots shown — keep in sync with MAX_STREAK_FREEZES on the server.
	const MAX_FREEZES = 2;
	// What the form actually submits, derived from the picker above.
	const readWhenValue = $derived(
		logWhen === 'now' ? 'now' : logWhen === 'lastnight' ? yesterdayStr : logDate || yesterdayStr
	);
	const readTimeValue: LogBucket = $derived(logWhen === 'lastnight' ? 'night' : logBucket);
	let editingGoal = $state(false);
	let goalDraft = $state('');
	let selectedFinishedId: number | null = $state(null);
	const selectedFinished = $derived(
		data.bookshelf.find((book) => book.id === selectedFinishedId) ?? null
	);

	interface PersonalBest {
		emoji: string;
		message: string;
	}
	interface CelebrationItem {
		id: number;
		message: string;
		emoji?: string;
		patch: { emoji: string; label: string; color: string } | null;
	}
	let celebrationQueue: CelebrationItem[] = $state([]);
	const activeCelebration = $derived(celebrationQueue[0] ?? null);
	let nextCelebrationId = 0;

	function queueCelebration(item: Omit<CelebrationItem, 'id'>) {
		nextCelebrationId += 1;
		celebrationQueue = [...celebrationQueue, { ...item, id: nextCelebrationId }];
	}

	function dismissCelebration() {
		celebrationQueue = celebrationQueue.slice(1);
	}

	function queueBests(bests: PersonalBest[]) {
		for (const best of bests) {
			queueCelebration({ message: best.message, emoji: best.emoji, patch: null });
		}
	}

	function queueGrants(grants: TitleGrant[]) {
		for (const grant of grants) {
			queueCelebration({
				message: 'You earned a new patch!',
				patch: { emoji: grant.emoji, label: grant.label, color: grant.color }
			});
		}
	}

	function queueTitleGrants(actionData: unknown) {
		const data = actionData as { grants?: TitleGrant[]; freezeEarned?: boolean } | undefined;
		queueGrants(data?.grants ?? []);
		if (data?.freezeEarned) {
			queueCelebration({
				message: 'Streak Freeze earned! It saves your streak if you miss a day.',
				emoji: '🧊',
				patch: null
			});
		}
	}

	// Give each celebration its voice as it appears: a sparkle for a patch, a warm chime otherwise.
	$effect(() => {
		const item = activeCelebration;
		if (!item) return;
		if (item.patch) playSparkle();
		else playChime();
	});

	// After finishing, ask "how was it?" before the record + patch celebrations play.
	let reactionPrompt: { entryId: number; title: string } | null = $state(null);
	let pendingGrants: TitleGrant[] = [];
	let pendingBests: PersonalBest[] = [];

	function closeReactionPrompt() {
		reactionPrompt = null;
		queueBests(pendingBests);
		queueGrants(pendingGrants);
		pendingBests = [];
		pendingGrants = [];
	}

	function toggleLogPanel(entry: ReadingEntryWithBook) {
		if (openEntryId === entry.id) {
			openEntryId = null;
			return;
		}
		openEntryId = entry.id;
		logPosition = '';
		logType = entry.latest_position_type ?? 'page';
		pageCountDraft = entry.page_count ? String(entry.page_count) : '';
		logWhen = 'now';
		logDate = yesterdayStr;
		logBucket = 'evening';
	}

	function forgetLocally() {
		try {
			localStorage.removeItem('profile_id');
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>{data.user.name}'s shelf · Family Reading Tracker</title>
</svelte:head>

<main>
	<header>
		<span class="avatar-circle" style:--tile-color={data.user.avatar_color}
			>{data.user.avatar_emoji}</span
		>
		<h1>{data.user.name}</h1>
		{#if activePatch}
			<TitleBanner emoji={activePatch.emoji} label={activePatch.label} color={activePatch.color} />
		{/if}
		{#if !editingProfile}
			<button type="button" class="edit-profile-toggle" onclick={openProfileEditor}>Edit profile</button>
		{/if}
	</header>

	{#if editingProfile}
		<section class="profile-editor">
			<h2>Make it yours</h2>
			<form
				method="POST"
				action="?/updateProfile"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') editingProfile = false;
					};
				}}
			>
				<input type="hidden" name="avatarEmoji" value={editEmoji} />
				<input type="hidden" name="avatarColor" value={editColor} />
				<label class="profile-name-field">
					<span class="field-label">Your name</span>
					<input type="text" name="name" bind:value={editName} maxlength="24" autocomplete="off" required />
				</label>
				<AvatarChooser bind:emoji={editEmoji} bind:color={editColor} />
				<label class="profile-goal-field">
					<span class="field-label">Books per month goal</span>
					<input type="number" name="monthlyGoal" min="1" inputmode="numeric" bind:value={editGoal} />
				</label>
				<div class="profile-editor-actions">
					<button type="submit" class="profile-save" disabled={!editName.trim()}>Save</button>
					<button type="button" class="profile-cancel" onclick={() => (editingProfile = false)}
						>Cancel</button
					>
				</div>
			</form>
		</section>
	{/if}

	<section class="streak-hero">
		<div class="streak-flame" class:cold={data.streak === 0} aria-hidden="true">🔥</div>
		<div class="streak-main">
			<span class="streak-number">{Math.round(streakCount.current)}</span>
			<span class="streak-word">day streak</span>
		</div>
		<div
			class="streak-freezes"
			title="Read a big chunk in one sitting to bank a freeze. It saves your streak if you miss a day."
		>
			{#each Array.from({ length: MAX_FREEZES }) as _, i (i)}
				<span class="freeze-slot" class:filled={i < (data.streakFreezes ?? 0)}>🧊</span>
			{/each}
			<span class="freeze-label">{(data.streakFreezes ?? 0) ? 'freezes ready' : 'no freezes yet'}</span>
		</div>
	</section>
	{#if data.freezeUsed > 0}
		<p class="freeze-note" role="status">🧊 A streak freeze kept your streak alive — nice sitting!</p>
	{/if}

	<section class="stats">
		<div class="stat-card goal-card">
			<div class="goal-header">
				{#if editingGoal}
					<form
						method="POST"
						action="?/setMonthlyGoal"
						class="goal-edit-form"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								editingGoal = false;
							};
						}}
					>
						<span class="stat-value">{data.finishedThisMonth} /</span>
						<input
							type="number"
							name="monthlyGoal"
							inputmode="numeric"
							min="1"
							bind:value={goalDraft}
							required
						/>
						<button type="submit" class="goal-save">Save</button>
					</form>
				{:else}
					<div class="goal-value-row">
						<span class="stat-value">{Math.round(monthCount.current)} / {data.user.monthly_goal}</span>
						<button
							type="button"
							class="goal-edit-toggle"
							onclick={() => {
								goalDraft = String(data.user.monthly_goal);
								editingGoal = true;
							}}
							aria-label="Change my monthly goal"
						>
							Change goal
						</button>
					</div>
				{/if}
				<span class="stat-label">books this month</span>
			</div>
			<div class="goal-bar" role="progressbar" aria-valuenow={goalProgress} aria-valuemin="0" aria-valuemax="100">
				<div class="goal-bar-fill" style:width="{goalBarWidth}%"></div>
			</div>
		</div>
	</section>

	{#if data.familyGoal}
		{@const fg = data.familyGoal}
		<a
			class="family-goal-strip"
			class:reached={fg.progress.reached}
			href="/family"
			aria-label="Family goal: {fg.title}"
		>
			<span class="fgs-emoji" aria-hidden="true">{fg.emoji}</span>
			<div class="fgs-body">
				<div class="fgs-top">
					<span class="fgs-title">{fg.title}</span>
					{#if fg.progress.reached}
						<span class="fgs-nums fgs-reached">🎉 Reached!</span>
					{:else}
						<span class="fgs-nums"
							>{fg.progress.total.toLocaleString()} / {fg.progress.target.toLocaleString()}</span
						>
					{/if}
				</div>
				<div class="fgs-bar">
					<div class="fgs-bar-fill" style:width="{fg.progress.percent}%"></div>
				</div>
				{#if fg.myTodayPages > 0}
					<p class="fgs-today">💪 You've added <strong>+{fg.myTodayPages.toLocaleString()}</strong> pages today</p>
				{/if}
			</div>
		</a>
	{/if}

	<div class="action-row">
		<a href="/add" class="add-book-button">+ Add a book</a>
		<a href="/family" class="family-link">👨‍👩‍👧‍👦 Family shelf</a>
		<a href="/year" class="family-link">📖 My {new Date().getFullYear()}</a>
	</div>

	<section class="currently-reading">
		<h2>Currently reading</h2>
		{#if data.currentlyReading.length === 0}
			{#if data.wishlist.length > 0}
				<p class="empty-state">Nothing on the go — start one from your Up Next list below.</p>
			{:else}
				<p class="empty-state">Nothing on the go — add a book to start your streak.</p>
			{/if}
		{:else}
			<ul class="book-list">
				{#each data.currentlyReading as entry, i (entry.id)}
					{@const progress = computeProgress(
						entry.latest_position_type,
						entry.latest_position,
						entry.page_count
					)}
					<li
						class="book-item rise-in"
						style:--i={i}
						style:background-image={progress.percent !== null
							? progressFillBackground(data.user.avatar_color, progress.percent)
							: undefined}
					>
						{#if progress.label}
							<span class="progress-label">{progress.label}</span>
						{/if}
						<div class="book-row">
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
							<div class="book-actions">
								<form
									method="POST"
									action="?/finishBook"
									use:enhance={() => {
										const entryId = entry.id;
										const title = entry.title;
										return async ({ result, update }) => {
											await update();
											if (result.type === 'success') {
												// Hold the record + patch celebrations until after they've reacted.
												const payload = result.data as
													| { grants?: TitleGrant[]; bests?: PersonalBest[] }
													| undefined;
												pendingGrants = payload?.grants ?? [];
												pendingBests = payload?.bests ?? [];
												reactionPrompt = { entryId, title };
											}
										};
									}}
								>
									<input type="hidden" name="entryId" value={entry.id} />
									<button type="submit" class="finish-button">Mark finished</button>
								</form>
								<form method="POST" action="?/setAsideBook" use:enhance>
									<input type="hidden" name="entryId" value={entry.id} />
									<button type="submit" class="setaside-button" aria-label="Set aside {entry.title}"
										>Set aside</button
									>
								</form>
								<form method="POST" action="?/removeBook" use:enhance>
									<input type="hidden" name="entryId" value={entry.id} />
									<button type="submit" class="remove-button" aria-label="Remove {entry.title}"
										>Remove</button
									>
								</form>
							</div>
						</div>

						<div class="log-progress">
							<div class="log-actions">
								{#if entry.latest_session_at?.slice(0, 10) === todayStr}
									<span class="checkin-done">✓ Read today</span>
								{:else}
									<form
										method="POST"
										action="?/checkIn"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();
												if (result.type === 'success') {
													queueTitleGrants(result.data);
												}
											};
										}}
									>
										<input type="hidden" name="bookId" value={entry.book_id} />
										<button type="submit" class="checkin-button">📖 I read today</button>
									</form>
								{/if}
								<button type="button" class="log-progress-toggle" onclick={() => toggleLogPanel(entry)}>
									{openEntryId === entry.id ? 'Cancel' : 'Log a page or %'}
								</button>
							</div>
							{#if openEntryId === entry.id}
								<form
									method="POST"
									action="?/logProgress"
									class="log-progress-form"
									use:enhance={() => {
										return async ({ result, update }) => {
											await update();
											openEntryId = null;
											if (result.type === 'success') {
												queueTitleGrants(result.data);
											}
										};
									}}
								>
									<input type="hidden" name="bookId" value={entry.book_id} />
									<input type="hidden" name="positionType" value={logType} />
									<input type="hidden" name="readWhen" value={readWhenValue} />
									<input type="hidden" name="readTime" value={readTimeValue} />

									<div class="log-when">
										<span class="log-when-label">When?</span>
										<div class="log-when-chips">
											<button
												type="button"
												class:active={logWhen === 'now'}
												onclick={() => (logWhen = 'now')}>Just now</button
											>
											<button
												type="button"
												class:active={logWhen === 'lastnight'}
												onclick={() => (logWhen = 'lastnight')}>Last night</button
											>
											<button
												type="button"
												class:active={logWhen === 'earlier'}
												onclick={() => (logWhen = 'earlier')}>Earlier…</button
											>
										</div>
									</div>
									{#if logWhen === 'earlier'}
										<div class="log-when-earlier">
											<input
												type="date"
												aria-label="Reading date"
												max={todayStr}
												bind:value={logDate}
											/>
											<div class="log-bucket-toggle">
												<button
													type="button"
													class:active={logBucket === 'morning'}
													onclick={() => (logBucket = 'morning')}>Morning</button
												>
												<button
													type="button"
													class:active={logBucket === 'afternoon'}
													onclick={() => (logBucket = 'afternoon')}>Afternoon</button
												>
												<button
													type="button"
													class:active={logBucket === 'evening'}
													onclick={() => (logBucket = 'evening')}>Evening</button
												>
												<button
													type="button"
													class:active={logBucket === 'night'}
													onclick={() => (logBucket = 'night')}>Night</button
												>
											</div>
										</div>
									{/if}

									<div class="position-type-toggle">
										<button
											type="button"
											class:active={logType === 'page'}
											onclick={() => (logType = 'page')}>Page</button
										>
										<button
											type="button"
											class:active={logType === 'percent'}
											onclick={() => (logType = 'percent')}>%</button
										>
									</div>
									<input
										type="number"
										name="position"
										inputmode="numeric"
										min="0"
										max={logType === 'percent' ? 100 : undefined}
										bind:value={logPosition}
										placeholder={logType === 'page' ? 'e.g. 84' : 'e.g. 62'}
										required
									/>
									<button type="submit" class="log-progress-save">Save</button>
								</form>

								<form method="POST" action="?/updatePageCount" class="page-count-form" use:enhance>
									<input type="hidden" name="bookId" value={entry.book_id} />
									<label>
										Total pages
										<input
											type="number"
											name="pageCount"
											inputmode="numeric"
											min="1"
											bind:value={pageCountDraft}
											placeholder="not set"
										/>
									</label>
									<button type="submit" class="page-count-save">Save</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="upnext-section">
		<h2>
			Up next
			{#if data.wishlist.length > 0}
				<span class="upnext-count">{data.wishlist.length}</span>
			{/if}
			<a href="/add?to=wishlist" class="upnext-add">+ Add</a>
		</h2>
		{#if data.wishlist.length === 0}
			<p class="empty-state">
				Nothing lined up yet — <a href="/add?to=wishlist">add a book you want to read</a>.
			</p>
		{:else}
			<ul class="upnext-list">
				{#each data.wishlist as book (book.id)}
					<li class="upnext-item">
						{#if book.cover_url}
							<img class="cover" src={book.cover_url} alt="" />
						{:else}
							<span class="cover cover-placeholder">📖</span>
						{/if}
						<div class="book-info">
							<span class="book-title">{book.title}</span>
							{#if book.author}
								<span class="book-author">{book.author}</span>
							{/if}
						</div>
						<div class="upnext-actions">
							<form method="POST" action="?/startFromWishlist" use:enhance>
								<input type="hidden" name="wishlistId" value={book.id} />
								<button type="submit" class="start-button">Start reading</button>
							</form>
							<form method="POST" action="?/removeFromWishlist" use:enhance>
								<input type="hidden" name="wishlistId" value={book.id} />
								<button type="submit" class="remove-button" aria-label="Remove {book.title} from Up Next"
									>Remove</button
								>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.setAside.length > 0}
		<section class="setaside-section">
			<h2>
				Set aside
				<span class="upnext-count">{data.setAside.length}</span>
			</h2>
			<ul class="upnext-list">
				{#each data.setAside as book (book.id)}
					<li class="upnext-item">
						{#if book.cover_url}
							<img class="cover" src={book.cover_url} alt="" />
						{:else}
							<span class="cover cover-placeholder">📖</span>
						{/if}
						<div class="book-info">
							<span class="book-title">{book.title}</span>
							{#if book.author}
								<span class="book-author">{book.author}</span>
							{/if}
						</div>
						<div class="upnext-actions">
							<form method="POST" action="?/resumeBook" use:enhance>
								<input type="hidden" name="entryId" value={book.id} />
								<button type="submit" class="start-button">Pick back up</button>
							</form>
							<form method="POST" action="?/removeBook" use:enhance>
								<input type="hidden" name="entryId" value={book.id} />
								<button type="submit" class="remove-button" aria-label="Remove {book.title}"
									>Remove</button
								>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="bookshelf-section">
		<h2>
			Bookshelf
			{#if data.bookshelf.length > 0}
				<span class="shelf-count"
					>{data.bookshelf.length} {data.bookshelf.length === 1 ? 'book' : 'books'}</span
				>
			{/if}
		</h2>
		{#if data.bookshelf.length === 0}
			<p class="empty-state">No finished books yet — your shelf is waiting.</p>
		{:else}
			<div class="shelf-scroll">
				<div class="shelf-row">
					{#each data.bookshelf as book (book.id)}
						<button
							type="button"
							class="shelf-book"
							class:selected={selectedFinishedId === book.id}
							title={book.author ? `${book.title} — ${book.author}` : book.title}
							aria-label={book.author ? `${book.title} by ${book.author}` : book.title}
							onclick={() =>
								(selectedFinishedId = selectedFinishedId === book.id ? null : book.id)}
						>
							{#if book.cover_url}
								<img src={book.cover_url} alt="" />
							{:else}
								<span class="shelf-placeholder"><span class="ph-emoji">📕</span>{book.title}</span>
							{/if}
							{#if reactionEmoji(book.reaction)}
								<span class="reaction-badge" aria-hidden="true">{reactionEmoji(book.reaction)}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
			{#if selectedFinished}
				<div class="unfinish-panel">
					<div class="reaction-picker">
						<span class="reaction-picker-label">How was it?</span>
						{#each REACTIONS as r (r.key)}
							<form method="POST" action="?/setReaction" use:enhance>
								<input type="hidden" name="entryId" value={selectedFinished.id} />
								<input
									type="hidden"
									name="reaction"
									value={selectedFinished.reaction === r.key ? '' : r.key}
								/>
								<button
									type="submit"
									class="reaction-pick"
									class:active={selectedFinished.reaction === r.key}
									aria-label={r.label}
									aria-pressed={selectedFinished.reaction === r.key}>{r.emoji}</button
								>
							</form>
						{/each}
					</div>
					<div class="unfinish-row">
						<span class="unfinish-text">
							Put <strong>{selectedFinished.title}</strong> back on your currently-reading shelf?
						</span>
						<div class="unfinish-actions">
							<form
								method="POST"
								action="?/unfinishBook"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										selectedFinishedId = null;
									};
								}}
							>
								<input type="hidden" name="entryId" value={selectedFinished.id} />
								<button type="submit" class="unfinish-confirm">Move back to reading</button>
							</form>
							<button type="button" class="unfinish-cancel" onclick={() => (selectedFinishedId = null)}>
								Cancel
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</section>

	<section class="trophy-section">
		<h2>
			Trophy case
			<span class="trophy-count">{earnedPatches.length} / {data.patches.length}</span>
		</h2>
		<div class="trophy-grid">
			{#each trophyPatches as patch (patch.key)}
				{#if patch.earned}
					<button
						type="button"
						class="trophy-slot"
						aria-pressed={patch.isActive}
						onclick={() => (selectedPatch = patch)}
					>
						<TitlePatch
							emoji={patch.emoji}
							label={patch.label}
							color={patch.color}
							active={patch.isActive}
						/>
					</button>
				{:else}
					<div class="trophy-slot trophy-slot--locked" aria-label="Locked badge — keep reading to reveal it">
						<TitlePatch locked />
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<form method="POST" action="?/switchProfile" use:enhance={forgetLocally}>
		<button type="submit" class="switch-link">Not {data.user.name}? Switch profile</button>
	</form>
</main>

{#if selectedPatch}
	<PatchInfoModal
		emoji={selectedPatch.emoji}
		label={selectedPatch.label}
		color={selectedPatch.color}
		description={selectedPatch.description}
		earnedLabel={earnedDateLabel(selectedPatch.earnedAt)}
		onclose={() => (selectedPatch = null)}
	>
		{#snippet actions()}
			{@const patch = selectedPatch}
			{#if patch}
				<form
					method="POST"
					action="?/setActiveTitle"
					use:enhance={() => async ({ update }) => {
						await update();
						selectedPatch = null;
					}}
				>
					<input type="hidden" name="titleKey" value={patch.isActive ? '' : patch.key} />
					<button type="submit" class="patch-display-btn">
						{patch.isActive ? 'Hide from my profile' : 'Show on my profile'}
					</button>
				</form>
			{/if}
		{/snippet}
	</PatchInfoModal>
{/if}

{#if reactionPrompt}
	<div class="reaction-backdrop" role="dialog" aria-label="How was the book?">
		<div class="reaction-card">
			<span class="reaction-tick">🎉</span>
			<p class="reaction-q">You finished <strong>{reactionPrompt.title}</strong>! How was it?</p>
			<form method="POST" action="?/setReaction" use:enhance={() => async ({ update }) => {
					await update();
					closeReactionPrompt();
				}}>
				<input type="hidden" name="entryId" value={reactionPrompt.entryId} />
				<div class="reaction-options">
					{#each REACTIONS as r (r.key)}
						<button type="submit" name="reaction" value={r.key} class="reaction-option">
							<span class="reaction-option-emoji">{r.emoji}</span>
							<span class="reaction-option-label">{r.label}</span>
						</button>
					{/each}
				</div>
			</form>
			<button type="button" class="reaction-skip" onclick={closeReactionPrompt}>Skip</button>
		</div>
	</div>
{:else if activeCelebration}
	{#key activeCelebration.id}
		<CelebrationToast
			message={activeCelebration.message}
			emoji={activeCelebration.emoji}
			patch={activeCelebration.patch}
			accentColor={data.user.avatar_color}
			onDismiss={dismissCelebration}
		/>
	{/key}
{/if}

<style>
	main {
		min-height: 100dvh;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 2.5rem 1.5rem calc(3.5rem + env(safe-area-inset-bottom));
	}

	header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		text-align: center;
	}

	.avatar-circle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: var(--tile-color);
		font-size: 2.75rem;
		box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.15);
	}

	h1 {
		font-size: 1.6rem;
		color: var(--color-wood-dark);
		margin: 0;
	}

	.edit-profile-toggle {
		background: none;
		border: none;
		color: var(--color-accent);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.15rem 0.5rem;
	}

	.edit-profile-toggle:hover {
		color: var(--color-accent-hover);
		text-decoration: underline;
	}

	.profile-editor {
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: 0 6px 16px var(--color-shadow);
	}

	.profile-editor h2 {
		font-family: var(--font-heading);
		font-size: 1.2rem;
		color: var(--color-wood-dark);
		margin: 0 0 1rem;
	}

	.profile-editor form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.field-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.profile-name-field,
	.profile-goal-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.profile-goal-field {
		max-width: 8rem;
	}

	.profile-editor input[type='text'],
	.profile-editor input[type='number'] {
		font-size: 1rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.profile-editor-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.profile-save {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.9rem;
		padding: 0.6rem 1.2rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.profile-save:hover {
		background: var(--color-accent-hover);
	}

	.profile-save:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.profile-cancel {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.9rem;
		padding: 0.6rem 1rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.profile-cancel:hover {
		color: var(--color-text);
	}

	.switch-link {
		align-self: flex-start;
		background: none;
		border: none;
		color: var(--color-accent);
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.5rem 0;
	}

	.switch-link:hover {
		color: var(--color-accent-hover);
		text-decoration: underline;
	}

	.add-book-button {
		align-self: flex-start;
		background: var(--color-accent);
		color: #fff;
		text-decoration: none;
		font-weight: 700;
		padding: 0.9rem 1.5rem;
		border-radius: var(--radius-md);
		box-shadow: 0 8px 18px var(--color-shadow);
		transition: background 0.15s ease;
	}

	.add-book-button:hover {
		background: var(--color-accent-hover);
	}

	.action-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	/* Compact, read-only view of the shared family goal; links through to the Family page. */
	.family-goal-strip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px var(--color-shadow);
		padding: 0.7rem 0.9rem;
	}

	.fgs-emoji {
		font-size: 1.5rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.fgs-body {
		flex: 1;
		min-width: 0;
	}

	.fgs-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.fgs-title {
		font-weight: 700;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fgs-nums {
		flex-shrink: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.fgs-bar {
		height: 10px;
		border-radius: 999px;
		background: var(--color-bg-alt);
		overflow: hidden;
		box-shadow: inset 0 1px 3px var(--color-shadow);
	}

	.fgs-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--color-accent), var(--color-accent-hover));
		transition: width 0.6s var(--spring, ease);
		min-width: 0.4rem;
	}

	.fgs-today {
		margin: 0.4rem 0 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.fgs-today strong {
		color: var(--color-accent);
	}

	.fgs-reached {
		color: var(--color-accent);
		font-weight: 700;
	}

	.family-goal-strip.reached {
		outline: 2px solid var(--color-accent);
	}

	.family-link {
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
	}

	/* The streak is the hero of the shelf now — a big warm card with the flame, the count, and the
	   banked freezes that protect it. */
	.streak-hero {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: linear-gradient(135deg, #ff8a3d, #e0762f);
		color: #fff;
		border-radius: var(--radius-md);
		padding: 1.1rem 1.4rem;
		box-shadow: 0 6px 18px var(--color-shadow);
	}

	.streak-flame {
		font-size: 2.6rem;
		line-height: 1;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
	}

	.streak-flame.cold {
		filter: grayscale(1);
		opacity: 0.7;
	}

	.streak-main {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.streak-number {
		font-family: var(--font-heading);
		font-size: 2.8rem;
		font-weight: 800;
		line-height: 1;
	}

	.streak-word {
		font-size: 1rem;
		font-weight: 600;
		opacity: 0.95;
	}

	.streak-freezes {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-wrap: wrap;
		justify-content: flex-end;
		max-width: 6.5rem;
	}

	.freeze-slot {
		font-size: 1.2rem;
		line-height: 1;
		opacity: 0.28;
		filter: grayscale(1);
	}

	.freeze-slot.filled {
		opacity: 1;
		filter: none;
	}

	.freeze-label {
		flex-basis: 100%;
		text-align: right;
		font-size: 0.7rem;
		font-weight: 600;
		opacity: 0.9;
	}

	.freeze-note {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
		background: var(--color-bg-alt);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.9rem;
	}

	.stats {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.stat-card {
		flex: 0 1 auto;
		background: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 12px var(--color-shadow);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.stat-value {
		font-family: var(--font-heading);
		font-size: 1.4rem;
		color: var(--color-wood-dark);
		font-weight: 700;
	}

	.stat-label {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.goal-card {
		justify-content: center;
		flex-basis: 320px;
		max-width: 100%;
	}

	.goal-header {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.goal-value-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.goal-edit-toggle {
		background: none;
		border: none;
		color: var(--color-accent);
		font-weight: 600;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
	}

	.goal-edit-toggle:hover {
		color: var(--color-accent-hover);
		text-decoration: underline;
	}

	.goal-edit-form {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.goal-edit-form input[type='number'] {
		width: 3.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		padding: 0.25rem 0.4rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.goal-save {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.35rem 0.65rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.goal-save:hover {
		background: var(--color-accent-hover);
	}

	.goal-bar {
		margin-top: 0.6rem;
		height: 8px;
		border-radius: 999px;
		background: var(--color-bg-alt);
		overflow: hidden;
	}

	.goal-bar-fill {
		height: 100%;
		background: var(--color-accent);
		border-radius: 999px;
		/* Width is animated by the count-up tween (goalBarWidth), so no CSS transition needed. */
	}

	.currently-reading h2,
	.trophy-section h2,
	.upnext-section h2,
	.setaside-section h2,
	.bookshelf-section h2 {
		font-size: 1.15rem;
		color: var(--color-wood-dark);
		margin-bottom: 0.75rem;
	}

	.bookshelf-section {
		display: flex;
		flex-direction: column;
	}

	.bookshelf-section h2 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.upnext-section,
	.setaside-section {
		display: flex;
		flex-direction: column;
	}

	.upnext-section h2,
	.setaside-section h2 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.upnext-count {
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 700;
		color: #fff;
		background: var(--color-accent);
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
	}

	.upnext-add {
		margin-left: auto;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-accent);
		text-decoration: none;
	}

	.upnext-add:hover {
		color: var(--color-accent-hover);
		text-decoration: underline;
	}

	.upnext-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.upnext-item {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
		background-color: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.upnext-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.start-button {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.start-button:hover {
		background: var(--color-accent-hover);
	}

	.shelf-count {
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 700;
		color: #fff;
		background: var(--color-accent);
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
	}

	.shelf-scroll {
		overflow-x: auto;
		padding-bottom: 0.5rem;
		-webkit-overflow-scrolling: touch;
	}

	.shelf-row {
		display: flex;
		align-items: flex-end;
		gap: 0.85rem;
		width: max-content;
		padding: 0.5rem 0.9rem 0;
		border-bottom: 9px solid var(--color-wood);
		border-radius: 0 0 4px 4px;
		box-shadow: 0 10px 16px -8px var(--color-shadow);
	}

	.shelf-book {
		flex-shrink: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		border-radius: 5px 5px 3px 3px;
		transition: transform 0.12s ease;
	}

	.shelf-book:hover {
		transform: translateY(-4px);
	}

	.shelf-book.selected {
		transform: translateY(-6px);
		outline: 3px solid var(--color-accent);
		outline-offset: 2px;
	}

	.shelf-book img {
		display: block;
		width: 66px;
		height: 99px;
		object-fit: cover;
		border-radius: 4px 4px 2px 2px;
		box-shadow: 0 5px 10px var(--color-shadow);
	}

	.unfinish-panel {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 1rem 1.1rem;
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.unfinish-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
	}

	.unfinish-text {
		font-size: 0.95rem;
		color: var(--color-text);
	}

	.unfinish-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-left: auto;
	}

	.unfinish-confirm {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.unfinish-confirm:hover {
		background: var(--color-accent-hover);
	}

	.unfinish-cancel {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.unfinish-cancel:hover {
		color: var(--color-text);
	}

	.shelf-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		width: 66px;
		height: 99px;
		padding: 0.35rem;
		background: var(--color-bg-alt);
		border-radius: 4px 4px 2px 2px;
		box-shadow: 0 5px 10px var(--color-shadow);
		font-size: 0.6rem;
		font-weight: 600;
		text-align: center;
		color: var(--color-text-muted);
		line-height: 1.15;
		overflow: hidden;
	}

	.ph-emoji {
		font-size: 1.3rem;
	}

	.trophy-section {
		display: flex;
		flex-direction: column;
	}

	.trophy-section h2 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.trophy-count {
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 700;
		color: #fff;
		background: var(--color-accent);
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
	}

	.trophy-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 1.5rem 1rem;
	}

	.trophy-slot {
		background: none;
		border: none;
		padding: 0.5rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.15s ease;
	}

	.trophy-slot:hover:not(.trophy-slot--locked) {
		background: var(--color-surface);
		transform: translateY(-2px);
	}

	.trophy-slot[aria-pressed='true'] {
		background: var(--color-surface);
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.trophy-slot--locked {
		cursor: default;
	}

	.patch-display-btn {
		border: none;
		border-radius: 999px;
		padding: 0.6rem 1.3rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: #fff;
		background: var(--color-accent);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.patch-display-btn:hover {
		background: var(--color-accent-hover);
	}

	.empty-state {
		color: var(--color-text-muted);
		font-size: 0.95rem;
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
		flex-direction: column;
		gap: 0.6rem;
		background-color: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		box-shadow: 0 4px 12px var(--color-shadow);
	}

	.book-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
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
		/* min-width floor keeps the title from being squeezed to an ellipsis on narrow
		   cards; instead the row wraps and the action buttons drop to the next line. */
		flex: 1;
		min-width: 180px;
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

	.book-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.finish-button {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.finish-button:hover {
		background: var(--color-accent-hover);
	}

	.remove-button {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.remove-button:hover {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.setaside-button {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.setaside-button:hover {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}

	.log-progress {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.log-actions {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.checkin-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		cursor: pointer;
		box-shadow: 0 3px 8px var(--color-shadow);
		transition:
			background 0.15s ease,
			transform 0.1s ease;
	}

	.checkin-button:hover {
		background: var(--color-accent-hover);
	}

	.checkin-button:active {
		transform: scale(0.96);
	}

	.checkin-done {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--color-accent);
		padding: 0.5rem 0;
	}

	.log-progress-toggle {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
	}

	.log-progress-toggle:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	.log-progress-form,
	.page-count-form {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.log-progress-form input[type='number'],
	.page-count-form input[type='number'] {
		width: 6rem;
		font-size: 1rem;
		padding: 0.5rem 0.65rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.page-count-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.position-type-toggle {
		display: flex;
		background: var(--color-bg-alt);
		border-radius: var(--radius-sm);
		padding: 0.2rem;
	}

	.position-type-toggle button {
		border: none;
		background: transparent;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.position-type-toggle button.active {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 2px 6px var(--color-shadow);
	}

	/* "When did you read this?" — each takes its own full-width row above the position input. */
	.log-when,
	.log-when-earlier {
		flex-basis: 100%;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.log-when-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.log-when-chips,
	.log-bucket-toggle {
		display: flex;
		flex-wrap: wrap;
		background: var(--color-bg-alt);
		border-radius: var(--radius-sm);
		padding: 0.2rem;
		gap: 0.1rem;
	}

	.log-when-chips button,
	.log-bucket-toggle button {
		border: none;
		background: transparent;
		padding: 0.4rem 0.65rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.log-when-chips button.active,
	.log-bucket-toggle button.active {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 2px 6px var(--color-shadow);
	}

	.log-when-earlier input[type='date'] {
		font-size: 0.9rem;
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.log-progress-save,
	.page-count-save {
		background: var(--color-accent);
		color: #fff;
		border: none;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.log-progress-save:hover,
	.page-count-save:hover {
		background: var(--color-accent-hover);
	}

	/* ---- Reaction prompt (shown right after finishing) ---- */
	.reaction-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1.5rem;
		animation: reaction-fade 0.15s ease;
	}

	.reaction-card {
		background: var(--color-surface);
		border: 3px solid var(--color-accent);
		border-radius: var(--radius-lg);
		padding: 2rem 1.75rem 1.5rem;
		max-width: 360px;
		width: 100%;
		text-align: center;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
		animation: reaction-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.reaction-tick {
		font-size: 2.4rem;
	}

	.reaction-q {
		margin: 0.5rem 0 1.25rem;
		font-family: var(--font-heading);
		font-size: 1.15rem;
		color: var(--color-wood-dark);
	}

	.reaction-options {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
	}

	.reaction-option {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		background: var(--color-bg-alt);
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		padding: 0.85rem 0.4rem;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			background 0.12s ease;
	}

	.reaction-option:hover {
		transform: translateY(-3px);
		border-color: var(--color-accent);
		background: var(--color-surface);
	}

	.reaction-option-emoji {
		font-size: 1.9rem;
	}

	.reaction-option-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.reaction-skip {
		margin-top: 1rem;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.35rem 0.5rem;
	}

	.reaction-skip:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	@keyframes reaction-pop {
		0% {
			transform: scale(0.8);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes reaction-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Reaction badge on a finished cover, and the picker inside the shelf tap-panel */
	.reaction-badge {
		position: absolute;
		top: -6px;
		right: -6px;
		font-size: 1rem;
		background: var(--color-surface);
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 5px var(--color-shadow);
	}

	.shelf-book {
		position: relative;
	}

	.reaction-picker {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.reaction-picker-label {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		margin-right: 0.15rem;
	}

	.reaction-pick {
		background: var(--color-bg-alt);
		border: 2px solid transparent;
		border-radius: 999px;
		width: 38px;
		height: 38px;
		font-size: 1.15rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			border-color 0.12s ease,
			transform 0.12s ease;
	}

	.reaction-pick:hover {
		transform: translateY(-2px);
	}

	.reaction-pick.active {
		border-color: var(--color-accent);
		background: var(--color-surface);
	}
</style>
