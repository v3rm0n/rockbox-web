import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const album = url.searchParams.get('album');
	const artist = url.searchParams.get('artist');
	const search = url.searchParams.get('q');
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '100');
	const offset = (page - 1) * limit;

	let whereClause = 'WHERE 1=1';
	const params: (string | number)[] = [];

	if (album) {
		whereClause += ' AND lt.album = ?';
		params.push(album);
	}

	if (artist) {
		whereClause += ' AND (lt.album_artist = ? OR lt.artist = ?)';
		params.push(artist, artist);
	}

	if (search) {
		whereClause += ' AND (lt.title LIKE ? OR lt.artist LIKE ? OR lt.album LIKE ?)';
		const searchTerm = `%${search}%`;
		params.push(searchTerm, searchTerm, searchTerm);
	}

	const countQuery = `SELECT COUNT(*) as total FROM library_tracks lt ${whereClause}`;
	const total = (db.prepare(countQuery).get(...params) as { total: number }).total;

	const query = `
		SELECT
			lt.*,
			CASE WHEN pt.id IS NOT NULL THEN 1 ELSE 0 END as is_synced,
			pt.id as player_track_id
		FROM library_tracks lt
		LEFT JOIN player_tracks pt ON pt.library_track_id = lt.id
		${whereClause}
		ORDER BY lt.disc_number, lt.track_number, lt.title
		LIMIT ? OFFSET ?
	`;

	const tracks = db.prepare(query).all(...params, limit, offset);
	return json({ tracks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};
