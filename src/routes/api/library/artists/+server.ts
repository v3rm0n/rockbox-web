import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const syncFilter = url.searchParams.get('sync');

	let query = `
		SELECT
			COALESCE(lt.album_artist, lt.artist) as name,
			COUNT(DISTINCT lt.album) as album_count,
			COUNT(lt.id) as track_count,
			COUNT(pt.id) as synced_count
		FROM library_tracks lt
		LEFT JOIN player_tracks pt ON pt.library_track_id = lt.id
		GROUP BY COALESCE(lt.album_artist, lt.artist)
	`;

	if (syncFilter === 'synced') {
		query += ' HAVING synced_count = track_count';
	} else if (syncFilter === 'partial') {
		query += ' HAVING synced_count > 0 AND synced_count < track_count';
	} else if (syncFilter === 'unsynced') {
		query += ' HAVING synced_count = 0';
	}

	query += ' ORDER BY name COLLATE NOCASE';

	const artists = db.prepare(query).all();
	return json({ artists });
};
