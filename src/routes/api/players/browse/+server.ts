import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types.js';

// POST /api/players/browse - Browse directories by absolute path
// Used during player setup wizard before a player exists
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const targetPath = body.path;

	if (!targetPath || typeof targetPath !== 'string') {
		return json({ error: 'path is required' }, { status: 400 });
	}

	if (!fs.existsSync(targetPath)) {
		return json({ directories: [] });
	}

	try {
		const entries = fs.readdirSync(targetPath, { withFileTypes: true });
		const directories = entries
			.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
			.map((e) => ({
				name: e.name,
				path: path.join(targetPath, e.name)
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return json({ directories });
	} catch {
		return json({ directories: [] });
	}
};

// PUT /api/players/browse - Create a new directory
export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const parentPath = body.path;
	const dirName = body.name;

	if (!parentPath || typeof parentPath !== 'string') {
		return json({ error: 'path is required' }, { status: 400 });
	}
	if (!dirName || typeof dirName !== 'string') {
		return json({ error: 'name is required' }, { status: 400 });
	}

	// Prevent path traversal
	if (dirName.includes('/') || dirName.includes('\\') || dirName === '..' || dirName === '.') {
		return json({ error: 'Invalid directory name' }, { status: 400 });
	}

	const newPath = path.join(parentPath, dirName);

	try {
		fs.mkdirSync(newPath, { recursive: true });
		return json({ success: true, path: newPath });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: msg }, { status: 500 });
	}
};
