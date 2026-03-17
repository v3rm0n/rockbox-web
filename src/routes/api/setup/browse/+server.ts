import { json } from '@sveltejs/kit';
import { listPlayerDirectories } from '$lib/server/player.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const { path } = await request.json();
	const directories = listPlayerDirectories(path || undefined);
	return json({ directories });
};
