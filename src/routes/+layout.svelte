<script lang="ts">
	import '$lib/styles/global.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import SoundToggle from '$lib/components/SoundToggle.svelte';
	import { onNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { neighborPage, type SwipeDirection } from '$lib/nav';
	import { playClick, playPageTurn } from '$lib/sound.svelte';

	let { children } = $props();

	// Set by a swipe just before it navigates, so the page transition slides in that direction
	// (link/back navigations leave it null and get the default cross-fade).
	let swipeDirection: SwipeDirection | null = null;

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		const direction = swipeDirection;
		swipeDirection = null;
		if (direction) document.documentElement.dataset.vt = direction;
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			transition.finished.finally(() => {
				if (direction) delete document.documentElement.dataset.vt;
			});
		});
	});

	// --- Swipe navigation between the peer pages (My Shelf / Family / My Year) ---
	let startX = 0;
	let startY = 0;
	let axis: 'h' | 'v' | null = null;
	let tracking = false;

	function onTouchStart(event: TouchEvent) {
		if (event.touches.length !== 1) {
			tracking = false;
			return;
		}
		const touch = event.touches[0];
		// Leave the very screen edges to iOS's own back/forward swipe.
		if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) {
			tracking = false;
			return;
		}
		startX = touch.clientX;
		startY = touch.clientY;
		axis = null;
		tracking = true;
	}

	function onTouchMove(event: TouchEvent) {
		if (!tracking) return;
		const touch = event.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		if (axis === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
			axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
		}
		// A vertical gesture is a scroll — bow out and let the page scroll normally.
		if (axis === 'v') tracking = false;
	}

	function onTouchEnd(event: TouchEvent) {
		if (!tracking || axis !== 'h') {
			tracking = false;
			return;
		}
		tracking = false;
		const dx = event.changedTouches[0].clientX - startX;
		const threshold = Math.min(120, window.innerWidth * 0.25);
		if (Math.abs(dx) < threshold) return;
		const direction = dx < 0 ? 1 : -1; // swipe left → next page, swipe right → previous
		const target = neighborPage(page.url.pathname, direction);
		if (!target) return;
		swipeDirection = direction === 1 ? 'forward' : 'back';
		playPageTurn();
		goto(target);
	}

	// Soft click on any button press (also serves as the first-gesture audio unlock on iOS).
	function onPointerDown(event: PointerEvent) {
		if ((event.target as Element | null)?.closest('button')) playClick();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
	onpointerdown={onPointerDown}
/>

<SoundToggle />
<ThemeToggle />
{@render children()}
