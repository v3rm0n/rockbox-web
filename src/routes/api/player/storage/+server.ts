import { json } from '@sveltejs/kit';
import { getPlayerStorage } from '$lib/server/player.js';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const storage = getPlayerStorage();

	const topArtists = db.prepare(`
		SELECT
			COALESCE(lt.album_artist, lt.artist) as artist,
			COUNT(*) as track_count,
			COALESCE(SUM(pt.file_size), 0) as total_size
		FROM player_tracks pt
		LEFT JOIN library_tracks lt ON lt.id = pt.library_track_id
		WHERE lt.id IS NOT NULL
		GROUP BY COALESCE(lt.album_artist, lt.artist)
		ORDER BY total_size DESC
		LIMIT 10
	`).all();

	return json({ storage, topArtists });
};
