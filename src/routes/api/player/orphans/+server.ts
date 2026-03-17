import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const orphans = db.prepare(`
		SELECT id, relative_path, file_size, synced_at
		FROM player_tracks
		WHERE is_orphan = 1
		ORDER BY relative_path
	`).all();

	return json({ orphans });
};
