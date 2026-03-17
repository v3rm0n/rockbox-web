import { json } from '@sveltejs/kit';
import { isSetupComplete, getManagedDir } from '$lib/server/settings.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	return json({
		setupComplete: isSetupComplete(),
		managedDir: getManagedDir() || null
	});
};
