export interface TitleCatalogEntry {
	key: string;
	label: string;
	emoji: string;
	/** The patch's own colour — distinct from any user's accent colour, for a varied collection. */
	color: string;
	/**
	 * Friendly, spoiler-safe blurb shown when a reader taps one of their EARNED patches. Describes
	 * the feat in plain language to celebrate (and gently motivate) — deliberately never states the
	 * exact numeric threshold (those stay hidden in THRESHOLDS).
	 */
	description: string;
	isTemporary: boolean;
	durationDays: number | null;
}

/**
 * The full set of grantable titles. Labels/emoji/colour/description can be freely edited — user_titles
 * only stores the key, and the display row is looked up (and re-upserted here on every server
 * start) from this catalog.
 */
export const TITLE_CATALOG: TitleCatalogEntry[] = [
	{
		key: 'it_begins',
		label: 'First of Many',
		emoji: '🌱',
		color: '#1f8f9e',
		description: "Your very first finished book. Something tells us it won't be the last.",
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'certified_bookworm',
		label: 'Certified Bookworm',
		emoji: '🐛',
		color: '#4a9d5f',
		description: "A whole stack of books finished. You're officially certified.",
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'speed_demon',
		label: 'Speed Demon',
		emoji: '🏎️',
		color: '#d64545',
		description: 'You tore through those pages like they owed you money.',
		isTemporary: true,
		durationDays: 7
	},
	{
		key: 'unstoppable',
		label: 'Unstoppable',
		emoji: '🔥',
		color: '#e0762f',
		description: "Day after day, you keep showing up. The books don't stand a chance.",
		isTemporary: true,
		durationDays: 7
	},
	{
		key: 'big_book',
		label: 'Big Book Energy',
		emoji: '😎',
		color: '#b8860b',
		description: 'You finished a proper chunky book. That is Big Book Energy.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'absolute_unit',
		label: 'Tome Raider',
		emoji: '📚',
		color: '#6b4c9a',
		description: 'You took on a book thick enough to prop a door — and won.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'comeback_kid',
		label: 'The Comeback Kid',
		emoji: '🎬',
		color: '#2f9e8f',
		description: 'Left it to gather dust, then came back for the redemption arc. Cinematic.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'weekend_warrior',
		label: 'Weekend Warrior',
		emoji: '🛡️',
		color: '#3f7fbf',
		description: 'Saturday and Sunday, book in hand. You defended the whole weekend.',
		isTemporary: true,
		durationDays: 3
	},
	{
		key: 'on_a_roll',
		label: 'On A Roll',
		emoji: '🎲',
		color: '#c2478a',
		description: 'Book after book this month. Somebody stop you — actually, don\'t.',
		isTemporary: true,
		durationDays: 30
	},
	{
		key: 'finisher',
		label: 'The Finisher',
		emoji: '🏁',
		color: '#c0392b',
		description: 'Start to finish in one day. That book never saw the sunset coming.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'double_feature',
		label: 'Double Feature',
		emoji: '🎭',
		color: '#8e44ad',
		description: 'Two books finished back-to-back. What a double bill.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'night_owl',
		label: 'Night Owl',
		emoji: '🦉',
		color: '#3b3b6d',
		description: "Everyone else is asleep. You're three chapters deep.",
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'early_bird',
		label: 'Early Bird',
		emoji: '🐦',
		color: '#e08a3c',
		description: "The sun's barely up and you're already turning pages. Show-off.",
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'iron_streak',
		label: 'Iron Streak',
		emoji: '🔗',
		color: '#5d6d7e',
		description: 'Not a single day missed for ages. This streak is forged from iron.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'page_mountain',
		label: 'Page Mountain',
		emoji: '⛰️',
		color: '#417a5a',
		description: "You've stacked up a mountain of pages. Take a second — enjoy the view.",
		isTemporary: false,
		durationDays: null
	},
	// Seasonal patches — earned once, by reading during a calendar window (see SEASONAL_WINDOWS).
	{
		key: 'summer_reader',
		label: 'Sunshine Reader',
		emoji: '☀️',
		color: '#e0a520',
		description: "Sun's out, book's out. You read straight through the summer.",
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'spooky_reader',
		label: 'Spooky Season',
		emoji: '🎃',
		color: '#d2691e',
		description: 'You kept reading through the spookiest month of all. Brave soul.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'festive_reader',
		label: 'Cosy Reader',
		emoji: '🎄',
		color: '#1f7a4d',
		description: 'Blanket, warm drink, good book. You did December exactly right.',
		isTemporary: false,
		durationDays: null
	},
	{
		key: 'new_year_reader',
		label: 'New Chapter',
		emoji: '🎆',
		color: '#4457a8',
		description: "New year, first book already open. Now that's a resolution kept.",
		isTemporary: false,
		durationDays: null
	}
];

/**
 * Hidden calendar windows (recurring each year, [month, day] inclusive) for the seasonal
 * patches above. A patch is granted the first time a reader logs any reading activity — a
 * progress log or a finish — whose date falls inside its window. Tune the dates privately here.
 */
export const SEASONAL_WINDOWS: Record<string, { start: [number, number]; end: [number, number] }> =
	{
		summer_reader: { start: [7, 1], end: [8, 31] },
		spooky_reader: { start: [10, 1], end: [10, 31] },
		festive_reader: { start: [12, 1], end: [12, 31] },
		new_year_reader: { start: [1, 1], end: [1, 14] }
	};

/**
 * Hidden trigger thresholds — the actual bar for each title. Never surfaced in the UI;
 * tune freely without touching any client code.
 */
export const THRESHOLDS = {
	/** certified_bookworm: total finished books that make you "certified". */
	certifiedBookwormBooks: 5,
	/** big_book: page count for a "chunky" book (Big Book Energy). */
	bigBookPages: 400,
	/** absolute_unit: page count that counts as a full doorstop (Tome Raider) — the tier above. */
	longBookPages: 650,
	/** on_a_roll: books finished within the current calendar month. */
	onARollBooksPerMonth: 3,
	/** double_feature: two books finished within this many days of each other (back-to-back). */
	doubleFeatureWindowDays: 3,
	/**
	 * finisher: a same-day finish only counts if this many minutes passed between adding the book
	 * and finishing it. started_at records when a book reached the shelf, not when reading began,
	 * so marking one finished moments after adding it is someone recording a book they'd already
	 * read. The trade: a genuinely quick read (a short picture book) won't earn it either.
	 */
	sameDayFinishMinMinutes: 5,
	/** speed_demon: this many progress logs within the window below. */
	speedDemonMinLogs: 5,
	speedDemonWindowHours: 24,
	/** unstoppable: consecutive days (ending today) with at least one progress log. */
	unstoppableDays: 4,
	/** comeback_kid: gap between two sessions on the same book that counts as "untouched for weeks". */
	comebackGapDays: 21,
	/** iron_streak: a longer consecutive-day streak — the aspirational tier above unstoppable. */
	ironStreakDays: 14,
	/** page_mountain: total pages summed across finished books. */
	pageMountainTotal: 5000,
	/** night_owl: reading logged within [start, end) UTC hours, wrapping past midnight. */
	nightOwlStartHour: 22,
	nightOwlEndHour: 5,
	/** early_bird: reading logged within [start, end) UTC hours in the early morning. */
	earlyBirdStartHour: 5,
	earlyBirdEndHour: 8
} as const;
