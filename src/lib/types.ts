export interface GoogleBookResult {
	googleBooksId: string;
	title: string;
	author: string | null;
	coverUrl: string | null;
	isbn: string | null;
	pageCount: number | null;
}

export interface TitleGrant {
	key: string;
	label: string;
	emoji: string;
	color: string;
}
