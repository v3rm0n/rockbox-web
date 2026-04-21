import { json } from '@sveltejs/kit';
import { resetDb } from '$lib/server/db.js';
import { createLogger } from '$lib/server/logger.js';
import type { RequestHandler } from './$types.js';

const log = createLogger('api:settings:reset');

export const POST: RequestHandler = async () => {
	log.warn('Application reset requested via API');
	try {
		resetDb();
		return json({ success: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		log.error('Reset failed', { error: msg });
		return json({ error: msg }, { status: 500 });
	}
};
