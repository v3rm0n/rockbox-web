import { redirect } from '@sveltejs/kit';
import { isSetupComplete } from '$lib/server/settings.js';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Redirect to setup if not completed (except for setup routes and API)
	if (
		!event.url.pathname.startsWith('/setup') &&
		!event.url.pathname.startsWith('/api') &&
		!isSetupComplete()
	) {
		throw redirect(302, '/setup');
	}

	return resolve(event);
};
