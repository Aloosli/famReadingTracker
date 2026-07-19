// One tri-state theme value drives the whole look: 'light' | 'dark' | 'sonic'.
// It's persisted in localStorage under 'theme' and mirrored onto the document's
// data-theme attribute. The same resolution logic runs in the inline boot script
// in app.html so the right theme is painted before hydration (no flash) — keep
// the two in sync if you touch either.

export type Theme = 'light' | 'dark' | 'sonic';

const THEME_COLORS: Record<Theme, string> = {
	light: '#f5ead9',
	dark: '#1c1611',
	sonic: '#1573e6'
};

export function getTheme(): Theme {
	try {
		const t = localStorage.getItem('theme');
		if (t === 'light' || t === 'dark' || t === 'sonic') return t;
	} catch {
		// localStorage unavailable (private browsing) — fall through to system preference.
	}
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme): Theme {
	try {
		localStorage.setItem('theme', theme);
	} catch {
		// Still applies for this load even if it can't be persisted.
	}
	document.documentElement.dataset.theme = theme;
	document.getElementById('theme-color-meta')?.setAttribute('content', THEME_COLORS[theme]);
	return theme;
}
