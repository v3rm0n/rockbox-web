import { json } from '@sveltejs/kit';
import { setSetting, getPlayerPath } from '$lib/server/settings.js';
import { planMigration, executeMigration } from '$lib/server/migrate.js';
import { scanLibrary } from '$lib/server/scanner.js';
import { scanPlayer } from '$lib/server/player.js';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const { managedDir } = await request.json();

	if (!managedDir) {
		return json({ error: 'Managed directory is required' }, { status: 400 });
	}

	const fullPath = path.join(getPlayerPath(), managedDir);

	if (!fs.existsSync(fullPath)) {
		fs.mkdirSync(fullPath, { recursive: true });
	}

	setSetting('managed_dir', managedDir);

	const plan = await planMigration(fullPath);

	let migrationResult = null;
	if (plan.moves.length > 0 || plan.unsorted.length > 0) {
		migrationResult = await executeMigration(fullPath, plan);
	}

	await scanLibrary();
	await scanPlayer();

	setSetting('setup_completed', 'true');

	return json({
		success: true,
		migration: migrationResult
			? {
					moved: migrationResult.moved,
					unsorted: migrationResult.unsorted,
					errors: migrationResult.errors
				}
			: null
	});
};
