// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AccountRow } from '$lib/server/db/accounts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/**
			 * The household (family/tenant) this request is scoped to, taken from the signed-in
			 * account's session in hooks.server.ts.
			 *
			 * Non-null by construction: hooks redirects unauthenticated requests to /login before any
			 * route runs, so a handler never has to consider the "no household" case. Keep the gate
			 * there rather than defending in individual routes — one place to get right.
			 */
			householdId: number;
			/**
			 * The signed-in grown-up. Readers are profiles inside their household, not accounts.
			 *
			 * Optional unlike householdId, because /login and /signup are reachable without one and need
			 * to check honestly whether someone is already signed in.
			 */
			account?: AccountRow;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
