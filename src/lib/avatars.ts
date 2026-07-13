/** Curated, kid-friendly avatar options shared by the setup wizard and profile editing. */
export const AVATAR_EMOJI = [
	'📖',
	'🐉',
	'🦉',
	'🌿',
	'🦊',
	'🐱',
	'🐶',
	'🦄',
	'🐢',
	'🦖',
	'🐙',
	'🦋',
	'🐧',
	'🐼',
	'🦁',
	'🐨',
	'🍄',
	'🌈',
	'🚀',
	'⚡',
	'🎨',
	'🐝',
	'⭐',
	'🦕'
];

export const AVATAR_COLORS = [
	'#c97b4a',
	'#7a9d54',
	'#4a7c9d',
	'#9d5a7c',
	'#d2691e',
	'#4a9d5f',
	'#6b5b95',
	'#c2478a',
	'#3f8f8a',
	'#b5623a'
];

export function isAvatarEmoji(value: unknown): value is string {
	return typeof value === 'string' && AVATAR_EMOJI.includes(value);
}

export function isAvatarColor(value: unknown): value is string {
	return typeof value === 'string' && AVATAR_COLORS.includes(value);
}
