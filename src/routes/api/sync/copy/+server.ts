import { json } from '@sveltejs/kit';
import { copyToPlayer } from '$lib/server/sync.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const { trackIds } = await request.json();

	if (!Array.isArray(trackIds) || trackIds.length === 0) {
		return json({ error: 'trackIds array is required' }, { status: 400 });
	}

	const result = await copyToPlayer(trackIds);
	return json(result);
};
