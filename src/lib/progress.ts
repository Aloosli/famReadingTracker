import type { PositionType } from './server/db/types';

export interface ProgressInfo {
	/** 0-100, or null when we can't express this as a fraction of the whole book. */
	percent: number | null;
	/** e.g. "62%" or "page 84" — null when nothing has been logged yet. */
	label: string | null;
}

export function computeProgress(
	positionType: PositionType | null,
	position: number | null,
	pageCount: number | null
): ProgressInfo {
	if (position == null || positionType == null) {
		return { percent: null, label: null };
	}
	if (positionType === 'percent') {
		const percent = Math.max(0, Math.min(100, position));
		return { percent, label: `${percent}%` };
	}
	const label = `page ${position}`;
	if (pageCount && pageCount > 0) {
		const percent = Math.max(0, Math.min(100, Math.round((position / pageCount) * 100)));
		return { percent, label };
	}
	return { percent: null, label };
}

/**
 * A left-to-right tinted fill for a card's background-image: a subtle flat tint up to
 * `percent`, with a slightly stronger sliver right at the boundary so the fill point reads
 * clearly, then transparent (letting the card's own background-color show through).
 */
export function progressFillBackground(accentColor: string, percent: number): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const edgeStart = Math.max(0, clamped - 1.2);
	return (
		`linear-gradient(to right, transparent ${edgeStart}%, ${accentColor}59 ${edgeStart}%, ${accentColor}59 ${clamped}%, transparent ${clamped}%), ` +
		`linear-gradient(to right, ${accentColor}22 0%, ${accentColor}22 ${clamped}%, transparent ${clamped}%, transparent 100%)`
	);
}
