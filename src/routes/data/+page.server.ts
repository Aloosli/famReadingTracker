import { fail } from '@sveltejs/kit';
import { getBackupSummary, isValidBackup, restoreBackup } from '$lib/server/db/backup';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { summary: getBackupSummary() };
};

export const actions: Actions = {
	restore: async ({ request }) => {
		const data = await request.formData();
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

		restoreBackup(parsed);
		return { restored: true, summary: getBackupSummary() };
	}
};
