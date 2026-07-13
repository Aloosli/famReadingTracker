/**
 * A tiny synthesized sound kit — every sound is generated with the Web Audio API, so there are no
 * audio files to ship. Warm and soft to match the app's cosy feel. Muteable (persisted), and the
 * AudioContext is created lazily on the first sound so it satisfies iOS's "audio needs a gesture"
 * rule (all our triggers are taps/swipes).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

let muted = $state(false);
if (typeof localStorage !== 'undefined') {
	muted = localStorage.getItem('sound-muted') === 'true';
}

/** Reactive mute state for the toggle UI. */
export const sound = {
	get muted() {
		return muted;
	},
	toggle() {
		muted = !muted;
		try {
			localStorage.setItem('sound-muted', String(muted));
		} catch {
			// localStorage unavailable — mute still applies for this session.
		}
		if (!muted) ensureContext(); // warm up (and unlock) so the next sound is instant
	}
};

function ensureContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AudioCtor =
			window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioCtor) return null;
		ctx = new AudioCtor();
		master = ctx.createGain();
		master.gain.value = 0.4;
		master.connect(ctx.destination);
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** One decaying oscillator note. */
function blip(freq: number, delay: number, dur: number, type: OscillatorType, peak: number): void {
	if (!ctx || !master) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	osc.connect(gain);
	gain.connect(master);
	const t = ctx.currentTime + delay;
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.linearRampToValueAtTime(peak, t + 0.006);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** A short filtered-noise "shhk", sweeping the band — used for the page turn. */
function noiseSweep(dur: number, fromHz: number, toHz: number, peak: number): void {
	if (!ctx || !master) return;
	const frames = Math.floor(ctx.sampleRate * dur);
	const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.Q.value = 0.7;
	const gain = ctx.createGain();
	src.connect(filter);
	filter.connect(gain);
	gain.connect(master);
	const t = ctx.currentTime;
	filter.frequency.setValueAtTime(fromHz, t);
	filter.frequency.exponentialRampToValueAtTime(toHz, t + dur);
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.linearRampToValueAtTime(peak, t + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.start(t);
	src.stop(t + dur + 0.02);
}

function play(effect: () => void): void {
	if (muted) return;
	if (!ensureContext()) return;
	effect();
}

/** Soft wooden tap for button presses. */
export function playClick(): void {
	play(() => blip(230, 0, 0.055, 'triangle', 0.13));
}

/** A gentle page-flip "shhk" for swiping between shelves. */
export function playPageTurn(): void {
	play(() => noiseSweep(0.17, 1100, 420, 0.09));
}

/** Warm rising chime — a book finished. */
export function playChime(): void {
	play(() => {
		blip(523.25, 0, 0.5, 'sine', 0.16); // C5
		blip(659.25, 0.08, 0.5, 'sine', 0.15); // E5
		blip(783.99, 0.16, 0.6, 'sine', 0.15); // G5
		blip(1046.5, 0.26, 0.7, 'sine', 0.12); // C6
	});
}

/** Ascending shimmer — a patch was unlocked. */
export function playSparkle(): void {
	play(() => {
		[880, 1174.66, 1567.98, 2093].forEach((freq, i) => blip(freq, i * 0.05, 0.28, 'sine', 0.09));
	});
}
