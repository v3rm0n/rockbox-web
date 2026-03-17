import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const stats = db.prepare(`
		SELECT
			COUNT(*) as total_tracks,
			COUNT(DISTINCT COALESCE(album_artist, artist)) as total_artists,
			COUNT(DISTINCT album) as total_albums,
			COALESCE(SUM(file_size), 0) as total_size,
			COALESCE(SUM(duration), 0) as total_duration
		FROM library_tracks
	`).get() as Record<string, number>;

	const syncStats = db.prepare(`
		SELECT COUNT(DISTINCT pt.library_track_id) as synced_tracks
		FROM player_tracks pt
		WHERE pt.library_track_id IS NOT NULL
	`).get() as { synced_tracks: number };

	const formatBreakdown = db.prepare(`
		SELECT format, COUNT(*) as count, SUM(file_size) as total_size
		FROM library_tracks
		GROUP BY format
		ORDER BY count DESC
	`).all();

	return json({
		...stats,
		synced_tracks: syncStats.synced_tracks,
		format_breakdown: formatBreakdown
	});
};
