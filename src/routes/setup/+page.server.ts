import { fail, redirect } from '@sveltejs/kit';
import { createUser, getAllUsers } from '$lib/server/db/users';
import { isAvatarColor, isAvatarEmoji, AVATAR_EMOJI, AVATAR_COLORS } from '$lib/avatars';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	// Reachable any time (also to add readers later), but the copy adapts for a fresh start.
	return { existingCount: getAllUsers(locals.householdId).length };
};

interface ReaderInput {
	name?: unknown;
	emoji?: unknown;
	color?: unknown;
	goal?: unknown;
}

export const actions: Actions = {
	createFamily: async ({ request, locals }) => {
		const data = await request.formData();
		let readers: ReaderInput[];
		try {
			readers = JSON.parse(data.get('readers')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Something went wrong reading the form — please try again.' });
		}

		if (!Array.isArray(readers) || readers.length === 0) {
			return fail(400, { message: 'Add at least one reader to get started.' });
		}

		const cleaned = readers.map((reader) => {
			const name = typeof reader.name === 'string' ? reader.name.trim() : '';
			const goalNumber = Number(reader.goal);
			return {
				name,
				avatarEmoji: isAvatarEmoji(reader.emoji) ? reader.emoji : AVATAR_EMOJI[0],
				avatarColor: isAvatarColor(reader.color) ? reader.color : AVATAR_COLORS[0],
				monthlyGoal: Number.isFinite(goalNumber) && goalNumber >= 1 ? Math.round(goalNumber) : 4
			};
		});

		if (cleaned.some((reader) => !reader.name)) {
			return fail(400, { message: 'Give every reader a name before finishing.' });
		}

		for (const reader of cleaned) {
			createUser({ ...reader, householdId: locals.householdId });
		}

		redirect(303, '/');
	}
};
