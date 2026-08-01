<!--
  Persistent bottom navigation.

  Before this, moving between pages meant finding a link inside the page. On /home those links sat
  above five long sections (currently reading, Up Next, set aside, bookshelf, trophies), so anyone
  looking at their trophy case had to scroll the whole page back up to leave it. /family and /year
  had a single "← Back" at the very top, with the same problem in reverse.

  The first three tabs are SWIPE_PAGES in order, deliberately: the app already supported swiping
  between those pages, but nothing on screen said so. Now the bar shows where you are in that
  sequence, so the gesture becomes discoverable instead of secret.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { SWIPE_PAGES } from '$lib/nav';
	import { playPageTurn } from '$lib/sound.svelte';

	interface Tab {
		href: string;
		label: string;
		emoji: string;
		/** The primary action, styled as an accent rather than a peer destination. */
		action?: boolean;
	}

	const TABS: Tab[] = [
		{ href: '/home', label: 'My shelf', emoji: '📚' },
		{ href: '/family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
		{ href: '/year', label: 'My year', emoji: '📖' },
		{ href: '/add', label: 'Add', emoji: '➕', action: true }
	];

	// Only where a reader is already chosen. The profile picker and setup wizard have no "current
	// reader" for these destinations to mean anything, and Data & backup is reached from the picker.
	const SHOWN_ON = [...SWIPE_PAGES, '/add'] as readonly string[];
	const visible = $derived(SHOWN_ON.includes(page.url.pathname));
	const current = $derived(page.url.pathname);
</script>

{#if visible}
	<nav class="tabbar" aria-label="Main">
		{#each TABS as tab (tab.href)}
			<a
				href={tab.href}
				class="tab"
				class:active={current === tab.href}
				class:action={tab.action}
				aria-current={current === tab.href ? 'page' : undefined}
				onclick={() => {
					if (current !== tab.href) playPageTurn();
				}}
			>
				<span class="emoji" aria-hidden="true">{tab.emoji}</span>
				<span class="label">{tab.label}</span>
			</a>
		{/each}
	</nav>
	<!-- Fixed bars sit outside the flow, so without this the last section of every page hides behind
	     it — worst on the trophy case, which is the bottom of the longest page. -->
	<div class="tabbar-spacer" aria-hidden="true"></div>
{/if}

<style>
	.tabbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 40;
		display: flex;
		justify-content: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-xs);
		/* Clears the iPad/iPhone home indicator; resolves to 0 everywhere else. */
		padding-bottom: calc(var(--space-2xs) + env(safe-area-inset-bottom, 0px));
		background: color-mix(in srgb, var(--color-surface) 88%, transparent);
		backdrop-filter: blur(12px);
		border-top: 1px solid var(--color-border);
		box-shadow: 0 -4px 20px var(--color-shadow);
	}

	.tabbar-spacer {
		height: calc(4.25rem + env(safe-area-inset-bottom, 0px));
	}

	.tab {
		flex: 1 1 0;
		max-width: 7rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3xs);
		padding: var(--space-xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--color-text-muted);
		/* Tap targets, not text: keep them compact regardless of body leading. */
		line-height: var(--leading-none);
	}

	.emoji {
		font-size: var(--text-md);
		line-height: var(--leading-none);
	}

	.label {
		font-size: var(--text-2xs);
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.tab.active {
		color: var(--color-wood-dark);
		background: var(--color-bg-alt);
	}

	.tab.action {
		color: var(--color-accent);
	}

	.tab.action.active {
		color: var(--color-surface);
		background: var(--color-accent);
	}

	@media (prefers-reduced-motion: no-preference) {
		.tab {
			transition:
				background-color 0.2s ease,
				color 0.2s ease,
				scale 0.32s var(--spring);
		}
		.tab:active {
			scale: 0.94;
			transition-duration: 0.09s;
		}
	}

	/* The blur is decorative; without support, fall back to an opaque bar so labels stay legible. */
	@supports not (backdrop-filter: blur(12px)) {
		.tabbar {
			background: var(--color-surface);
		}
	}
</style>
