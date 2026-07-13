export type Reaction = 'loved' | 'liked' | 'meh';

export const REACTIONS: { key: Reaction; emoji: string; label: string }[] = [
	{ key: 'loved', emoji: '😍', label: 'Loved it' },
	{ key: 'liked', emoji: '🙂', label: 'Liked it' },
	{ key: 'meh', emoji: '😕', label: 'Not for me' }
];

export function isReaction(value: unknown): value is Reaction {
	return value === 'loved' || value === 'liked' || value === 'meh';
}

export function reactionEmoji(reaction: string | null | undefined): string | null {
	return REACTIONS.find((r) => r.key === reaction)?.emoji ?? null;
}
