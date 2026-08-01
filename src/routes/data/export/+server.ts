import { readFileSync } from 'node:fs';
import { error } from '@sveltejs/kit';
import { db, dbPath } from '$lib/server/db/index';
import { buildBackup } from '$lib/server/db/backup';
import { countHouseholds } from '$lib/server/db/households';
import { requireProfile } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/** YYYY-MM-DD, so downloaded backups sort chronologically in a folder. */
function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Hands back a backup of the requesting family's data.
 *
 * This endpoint used to be open: no profile check, and both formats read the whole database. On a
 * single-family box on a home network that was merely untidy; the moment a second family's rows
 * live here it is a full data breach over a plain GET, so both holes are closed here.
 */
export const GET: RequestHandler = (event) => {
	// A backup is the most sensitive thing the app can emit — never serve one to a bare GET from
	// someone with no profile at all.
	const user = requireProfile(event);
	const format = event.url.searchParams.get('format') === 'db' ? 'db' : 'json';

	if (format === 'db') {
		// The raw SQLite file is the entire database and cannot be filtered — it is every household or
		// nothing. So it stays available only while "every household" means "this one". As soon as a
		// second family exists this turns itself off, and no future change can quietly re-expose it.
		if (countHouseholds() > 1) {
			error(
				403,
				'The full database download is only available while this server hosts a single family. Use the JSON export instead.'
			);
		}
		// Fold the write-ahead log back into the main file so the copy we hand out is fully current.
		db.pragma('wal_checkpoint(TRUNCATE)');
		const bytes = new Uint8Array(readFileSync(dbPath));
		return new Response(bytes, {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="reading-tracker-backup-${today()}.db"`,
				'Cache-Control': 'no-store'
			}
		});
	}

	const json = JSON.stringify(buildBackup(user.household_id), null, 2);
	return new Response(json, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="reading-tracker-backup-${today()}.json"`,
			'Cache-Control': 'no-store'
		}
	});
};
