<script lang="ts">
	import { onMount } from 'svelte';
	import type { IScannerControls } from '@zxing/browser';

	let { ondetected, onmanual }: { ondetected: (isbn: string) => void; onmanual?: () => void } =
		$props();

	let videoEl: HTMLVideoElement | undefined = $state();
	let status: 'starting' | 'scanning' | 'error' = $state('starting');
	let errorMessage = $state('');

	/** Turns a raw getUserMedia failure into something a parent can actually act on. */
	function friendlyCameraError(err: unknown): string {
		const name = err instanceof Error ? err.name : '';
		switch (name) {
			case 'NotAllowedError':
			case 'PermissionDeniedError':
				return 'Camera permission is blocked. Allow it in your browser settings, or add the book by hand.';
			case 'NotFoundError':
			case 'DevicesNotFoundError':
				return "No camera found on this device — you can add the book by hand instead.";
			case 'NotReadableError':
			case 'TrackStartError':
				return 'The camera is being used by another app. Close it and try again, or add by hand.';
			default:
				return "Couldn't start the camera. You can add the book by hand instead.";
		}
	}

	onMount(() => {
		let controls: IScannerControls | undefined;
		let cancelled = false;
		let hasDetected = false;

		async function start() {
			if (!navigator.mediaDevices?.getUserMedia) {
				status = 'error';
				errorMessage = 'Scanning needs a secure (HTTPS) connection. Add the book by hand instead.';
				return;
			}

			// Loaded dynamically so these CommonJS packages are never touched during SSR.
			const { BrowserMultiFormatReader } = await import('@zxing/browser');
			const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

			const hints = new Map();
			hints.set(DecodeHintType.POSSIBLE_FORMATS, [
				BarcodeFormat.EAN_13,
				BarcodeFormat.EAN_8,
				BarcodeFormat.UPC_A
			]);
			const reader = new BrowserMultiFormatReader(hints);

			try {
				const scannerControls = await reader.decodeFromConstraints(
					{ video: { facingMode: 'environment' } },
					videoEl,
					(result) => {
						// The callback fires on every frame; a frame that fails to decode passes an error
						// we deliberately ignore (it's normal while aiming). Only a successful read matters —
						// real, fatal failures (no permission, no camera) are thrown from decodeFromConstraints
						// and handled below.
						if (result && !hasDetected) {
							hasDetected = true;
							ondetected(result.getText());
						}
					}
				);
				if (cancelled) {
					scannerControls.stop();
					return;
				}
				controls = scannerControls;
				status = 'scanning';
			} catch (err) {
				status = 'error';
				errorMessage = friendlyCameraError(err);
			}
		}

		start();

		return () => {
			cancelled = true;
			controls?.stop();
		};
	});
</script>

<div class="scanner">
	<video bind:this={videoEl} muted playsinline autoplay></video>
	<div class="frame" aria-hidden="true"></div>
	{#if status === 'error'}
		<p class="hint hint-error">{errorMessage}</p>
		{#if onmanual}
			<button type="button" class="manual-button" onclick={onmanual}>Type it in instead</button>
		{/if}
	{:else if status === 'starting'}
		<p class="hint">Starting camera…</p>
	{:else}
		<p class="hint">Point the camera at the barcode on the back of the book</p>
	{/if}
</div>

<style>
	.scanner {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	video {
		width: 100%;
		max-width: 420px;
		aspect-ratio: 4 / 3;
		border-radius: var(--radius-md);
		background: #1a1a1a;
		object-fit: cover;
	}

	.frame {
		position: absolute;
		top: 30%;
		width: min(80%, 340px);
		height: 22%;
		border: 3px solid var(--color-accent);
		border-radius: var(--radius-sm);
		box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.25);
		pointer-events: none;
	}

	.hint {
		color: var(--color-text-muted);
		font-size: 0.95rem;
		text-align: center;
		margin: 0;
	}

	.hint-error {
		color: var(--color-error);
		font-weight: 600;
	}

	.manual-button {
		background: var(--color-accent);
		color: #fff;
		border: none;
		padding: 0.7rem 1.1rem;
		border-radius: var(--radius-sm);
		font-weight: 700;
		font-size: 0.95rem;
		cursor: pointer;
	}
</style>
