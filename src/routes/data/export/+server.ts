import { readFileSync } from 'node:fs';
import { db, dbPath } from '$lib/server/db/index';
import { buildBackup } from '$lib/server/db/backup';
import type { RequestHandler } from './$types';

/** YYYY-MM-DD, so downloaded backups sort chronologically in a folder. */
function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export const GET: RequestHandler = ({ url }) => {
	const format = url.searchParams.get('format') === 'db' ? 'db' : 'json';

	if (format === 'db') {
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

	const json = JSON.stringify(buildBackup(), null, 2);
	return new Response(json, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="reading-tracker-backup-${today()}.json"`,
			'Cache-Control': 'no-store'
		}
	});
};
