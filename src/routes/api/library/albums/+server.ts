import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const artist = url.searchParams.get('artist');
	const search = url.searchParams.get('q');
	const syncFilter = url.searchParams.get('sync');
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = (page - 1) * limit;

	let whereClause = 'WHERE 1=1';
	const params: (string | number)[] = [];

	if (artist) {
		whereClause += ' AND (lt.album_artist = ? OR lt.artist = ?)';
		params.push(artist, artist);
	}

	if (search) {
		whereClause += ' AND (lt.album LIKE ? OR lt.artist LIKE ? OR lt.album_artist LIKE ?)';
		const searchTerm = `%${search}%`;
		params.push(searchTerm, searchTerm, searchTerm);
	}

	let havingClause = '';
	if (syncFilter === 'synced') {
		havingClause = 'HAVING synced_count = track_count';
	} else if (syncFilter === 'partial') {
		havingClause = 'HAVING synced_count > 0 AND synced_count < track_count';
	} else if (syncFilter === 'unsynced') {
		havingClause = 'HAVING synced_count = 0';
	}

	const countQuery = `
		SELECT COUNT(*) as total FROM (
			SELECT lt.album
			FROM library_tracks lt
			LEFT JOIN player_tracks pt ON pt.library_track_id = lt.id
			${whereClause}
			GROUP BY lt.album, COALESCE(lt.album_artist, lt.artist)
			${havingClause}
		)
	`;

	const total = (db.prepare(countQuery).get(...params) as { total: number }).total;

	const query = `
		SELECT
			lt.album,
			COALESCE(lt.album_artist, lt.artist) as artist,
			MIN(lt.year) as year,
			COUNT(lt.id) as track_count,
			COUNT(pt.id) as synced_count,
			SUM(lt.file_size) as total_size,
			MIN(lt.id) as first_track_id
		FROM library_tracks lt
		LEFT JOIN player_tracks pt ON pt.library_track_id = lt.id
		${whereClause}
		GROUP BY lt.album, COALESCE(lt.album_artist, lt.artist)
		${havingClause}
		ORDER BY artist COLLATE NOCASE, lt.year, lt.album COLLATE NOCASE
		LIMIT ? OFFSET ?
	`;

	const albums = db.prepare(query).all(...params, limit, offset);

	return json({
		albums,
		pagination: { page, limit, total, pages: Math.ceil(total / limit) }
	});
};
