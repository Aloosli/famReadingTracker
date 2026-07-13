export interface HouseholdRow {
	id: number;
	name: string;
	created_at: string;
}

export interface UserRow {
	id: number;
	household_id: number;
	name: string;
	avatar_emoji: string;
	avatar_color: string;
	reading_source: 'manual' | 'bookorbit';
	monthly_goal: number;
	created_at: string;
}

export interface BookRow {
	id: number;
	household_id: number;
	title: string;
	author: string | null;
	cover_url: string | null;
	google_books_id: string | null;
	isbn: string | null;
	page_count: number | null;
	created_at: string;
}

export type ReadingStatus = 'reading' | 'finished';

export interface ReadingEntryRow {
	id: number;
	user_id: number;
	book_id: number;
	status: ReadingStatus;
	started_at: string;
	finished_at: string | null;
	reaction: 'loved' | 'liked' | 'meh' | null;
	set_aside_at: string | null;
	created_at: string;
}

export type PositionType = 'page' | 'percent';

export interface ReadingSessionRow {
	id: number;
	user_id: number;
	book_id: number;
	position: number;
	position_type: PositionType;
	created_at: string;
}
