import { json } from '@sveltejs/kit';
import { setSetting, getPlayerPath } from '$lib/server/settings.js';
import { planMigration, executeMigration } from '$lib/server/migrate.js';
import { scanLibrary } from '$lib/server/scanner.js';
import { scanPlayer } from '$lib/server/player.js';
import { createLogger } from '$lib/server/logger.js';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types.js';

const log = createLogger('setup');

export const POST: RequestHandler = async ({ request }) => {
	const { managedDir } = await request.json();
	log.info('Setup initialization started', { managedDir });

	if (!managedDir) {
		log.error('Setup failed: managed directory not provided');
		return json({ error: 'Managed directory is required' }, { status: 400 });
	}

	const fullPath = path.join(getPlayerPath(), managedDir);

	if (!fs.existsSync(fullPath)) {
		log.info('Creating managed directory', { fullPath });
		fs.mkdirSync(fullPath, { recursive: true });
	}

	setSetting('managed_dir', managedDir);

	log.info('Planning migration', { fullPath });
	const plan = await planMigration(fullPath);
	log.info('Migration plan created', {
		moves: plan.moves.length,
		unsorted: plan.unsorted.length,
		alreadyCorrect: plan.alreadyCorrect.length
	});

	let migrationResult = null;
	if (plan.moves.length > 0 || plan.unsorted.length > 0) {
		log.info('Executing migration');
		migrationResult = await executeMigration(fullPath, plan);
		log.info('Migration completed', {
			moved: migrationResult.moved,
			unsorted: migrationResult.unsorted,
			errors: migrationResult.errors.length
		});
	} else {
		log.info('No migration needed');
	}

	log.info('Running initial library scan');
	await scanLibrary();

	log.info('Running initial player scan');
	await scanPlayer();

	setSetting('setup_completed', 'true');
	log.info('Setup completed successfully');

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
