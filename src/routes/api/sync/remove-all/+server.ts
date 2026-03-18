import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { removeFromPlayer } from '$lib/server/sync.js';
import { createLogger } from '$lib/server/logger.js';
import type { RequestHandler } from './$types.js';

const log = createLogger('api:sync:remove-all');

export const POST: RequestHandler = async () => {
	const allTracks = db.prepare('SELECT id FROM player_tracks').all() as { id: number }[];
	const trackIds = allTracks.map(t => t.id);

	if (trackIds.length === 0) {
		log.info('Remove all requested but no tracks on player');
		return json({ removed: 0, failed: 0, errors: [] });
	}

	log.info('Remove ALL tracks from player requested', { trackCount: trackIds.length });
	const result = await removeFromPlayer(trackIds);
	log.info('Remove all result', { removed: result.removed, failed: result.failed });
	return json(result);
};
