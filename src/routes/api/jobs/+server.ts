import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '20');

	const jobs = db.prepare(`
		SELECT * FROM jobs
		ORDER BY started_at DESC
		LIMIT ?
	`).all(limit);

	return json({ jobs });
};
