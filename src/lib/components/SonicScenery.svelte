<!-- Decorative Green Hill Zone backdrop: checkerboard hills along the bottom and
     a few spinning gold rings. Always in the DOM but hidden unless the sonic
     theme is active, so no reactive wiring is needed. Purely decorative and
     never interactive (pointer-events: none), sitting behind all content. -->
<div class="scenery" aria-hidden="true">
	<span class="ring" style="--x: 14%; --b: 150px; --d: 0s"><span class="coin"></span></span>
	<span class="ring" style="--x: 44%; --b: 210px; --d: -0.6s"><span class="coin"></span></span>
	<span class="ring" style="--x: 74%; --b: 165px; --d: -1.1s"><span class="coin"></span></span>
	<span class="ring" style="--x: 88%; --b: 235px; --d: -0.3s"><span class="coin"></span></span>
	<div class="hills">
		<div class="grass"></div>
	</div>
</div>

<style>
	.scenery {
		display: none;
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		overflow: hidden;
	}
	/* Only shown under the sonic theme. */
	:global(html[data-theme='sonic']) .scenery {
		display: block;
	}

	/* Checkerboard dirt band with a green grass cap — classic Green Hill Zone. */
	.hills {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 130px;
		background-color: #b06a2c;
		background-image:
			linear-gradient(45deg, #8a4f1e 25%, transparent 25% 75%, #8a4f1e 75%),
			linear-gradient(45deg, #8a4f1e 25%, transparent 25% 75%, #8a4f1e 75%);
		background-size: 44px 44px;
		background-position:
			0 0,
			22px 22px;
	}
	.grass {
		position: absolute;
		left: -2%;
		right: -2%;
		top: -26px;
		height: 44px;
		background: linear-gradient(#5fce3a, #46a828);
		border-radius: 50% 50% 0 0 / 100% 100% 0 0;
		box-shadow: inset 0 6px 0 rgba(255, 255, 255, 0.18);
	}

	/* Gold rings that bob and spin like the collectible coins. */
	.ring {
		position: absolute;
		left: var(--x);
		bottom: var(--b);
		width: 34px;
		height: 34px;
	}
	.coin {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 7px solid #f7c400;
		box-shadow:
			inset 0 0 0 2px #c78b00,
			0 0 0 2px #c78b00,
			0 6px 12px rgba(0, 0, 0, 0.25);
	}

	@media (prefers-reduced-motion: no-preference) {
		.ring {
			animation: ring-bob 3s ease-in-out infinite;
			animation-delay: var(--d);
		}
		.coin {
			animation: coin-spin 1.5s linear infinite;
			animation-delay: var(--d);
		}
	}

	@keyframes ring-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-14px);
		}
	}
	/* Squash horizontally to fake the coin turning edge-on. */
	@keyframes coin-spin {
		0%,
		100% {
			transform: scaleX(1);
		}
		50% {
			transform: scaleX(0.12);
		}
	}
</style>
