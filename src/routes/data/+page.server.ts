import { fail } from '@sveltejs/kit';
import {
	BackupRestoreError,
	getBackupSummary,
	isValidBackup,
	restoreBackup
} from '$lib/server/db/backup';
import { requireProfile } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const user = requireProfile(event);
	return { summary: getBackupSummary(user.household_id) };
};

export const actions: Actions = {
	/**
	 * Restores this family's data from an uploaded backup. Previously this cleared every table in the
	 * database — with a second family present that made an unauthenticated POST able to destroy
	 * everyone's data. It now replaces only the requesting household's rows.
	 */
	restore: async (event) => {
		const user = requireProfile(event);
		const data = await event.request.formData();
		const file = data.get('backup');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { restoreError: 'Choose a backup file to restore.' });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			return fail(400, {
				restoreError: "That file isn't valid JSON — pick a .json backup exported from this app."
			});
		}

		if (!isValidBackup(parsed)) {
			return fail(400, {
				restoreError:
					"That doesn't look like a Family Reading Tracker backup (or it's from a newer version)."
			});
		}

		try {
			restoreBackup(user.household_id, parsed);
		} catch (restoreFailure) {
			if (restoreFailure instanceof BackupRestoreError) {
				return fail(409, { restoreError: restoreFailure.message });
			}
			throw restoreFailure;
		}
		return { restored: true, summary: getBackupSummary(user.household_id) };
	}
};
