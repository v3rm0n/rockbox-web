import db from './db.js';
import { getManagedDir, getPlayerPath } from './settings.js';
import { isSupportedAudioFile } from './metadata.js';
import fs from 'node:fs';
import path from 'node:path';
import type { ScanProgress } from './scanner.js';

type ProgressCallback = (progress: ScanProgress) => void;

/**
 * Get the full path to the managed directory on the player.
 */
export function getPlayerManagedPath(): string | null {
	const playerPath = getPlayerPath();
	const managedDir = getManagedDir();
	if (!managedDir) return null;
	return path.join(playerPath, managedDir);
}

/**
 * Recursively walk a directory and return all file paths.
 */
function walkDir(dir: string): string[] {
	const results: string[] = [];
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...walkDir(fullPath));
			} else if (entry.isFile() && isSupportedAudioFile(entry.name)) {
				results.push(fullPath);
			}
		}
	} catch {
		// Skip directories we can't read
	}
	return results;
}

/**
 * List top-level directories in the player mount.
 * Used by the setup wizard to let the user pick the managed directory.
 */
export function listPlayerDirectories(subPath?: string): { name: string; path: string; isDir: boolean }[] {
	const playerPath = getPlayerPath();
	const targetPath = subPath ? path.join(playerPath, subPath) : playerPath;

	if (!fs.existsSync(targetPath)) return [];

	try {
		const entries = fs.readdirSync(targetPath, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory())
			.map((e) => ({
				name: e.name,
				path: subPath ? path.join(subPath, e.name) : e.name,
				isDir: true
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch {
		return [];
	}
}

/**
 * Scan the player's managed directory and cross-reference with library.
 */
export async function scanPlayer(onProgress?: ProgressCallback): Promise<void> {
	const managedPath = getPlayerManagedPath();
	if (!managedPath) {
		onProgress?.({
			phase: 'error',
			current: 0,
			total: 0,
			error: 'Managed directory not configured'
		});
		return;
	}

	if (!fs.existsSync(managedPath)) {
		onProgress?.({
			phase: 'error',
			current: 0,
			total: 0,
			error: 'Managed directory does not exist on player'
		});
		return;
	}

	const job = db
		.prepare("INSERT INTO jobs (type, status) VALUES ('player_scan', 'running')")
		.run();
	const jobId = job.lastInsertRowid;

	try {
		onProgress?.({ phase: 'discovering', current: 0, total: 0 });
		const files = walkDir(managedPath);
		const total = files.length;

		db.prepare('UPDATE jobs SET total = ? WHERE id = ?').run(total, jobId);
		onProgress?.({ phase: 'scanning', current: 0, total });

		// Clear existing player tracks and re-index
		db.prepare('DELETE FROM player_tracks').run();

		const findLibraryTrack = db.prepare(
			'SELECT id FROM library_tracks WHERE relative_path = ?'
		);
		const insertStmt = db.prepare(`
			INSERT INTO player_tracks (relative_path, library_track_id, file_size, is_orphan, synced_at)
			VALUES (?, ?, ?, ?, datetime('now'))
		`);

		for (let i = 0; i < files.length; i++) {
			const filePath = files[i];
			const relativePath = path.relative(managedPath, filePath);
			const stat = fs.statSync(filePath);

			// Try to match with library by relative path
			const libraryTrack = findLibraryTrack.get(relativePath) as { id: number } | undefined;

			insertStmt.run(
				relativePath,
				libraryTrack?.id || null,
				stat.size,
				libraryTrack ? 0 : 1 // orphan if not in library
			);

			if (i % 10 === 0) {
				onProgress?.({ phase: 'scanning', current: i + 1, total, currentFile: relativePath });
				db.prepare('UPDATE jobs SET progress = ? WHERE id = ?').run(i + 1, jobId);
			}
		}

		db.prepare(
			"UPDATE jobs SET status = 'completed', progress = total, finished_at = datetime('now') WHERE id = ?"
		).run(jobId);
		onProgress?.({ phase: 'complete', current: total, total });
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Unknown error';
		db.prepare(
			"UPDATE jobs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?"
		).run(errorMsg, jobId);
		onProgress?.({ phase: 'error', current: 0, total: 0, error: errorMsg });
	}
}

/**
 * Get storage information for the player mount.
 */
export function getPlayerStorage(): {
	total: number;
	used: number;
	free: number;
	managedSize: number;
} {
	const playerPath = getPlayerPath();

	try {
		const stats = fs.statfsSync(playerPath);
		const blockSize = stats.bsize;
		const total = stats.blocks * blockSize;
		const free = stats.bavail * blockSize;
		const used = total - free;

		// Calculate size of managed directory
		const managedPath = getPlayerManagedPath();
		let managedSize = 0;
		if (managedPath && fs.existsSync(managedPath)) {
			const playerTracks = db
				.prepare('SELECT COALESCE(SUM(file_size), 0) as total FROM player_tracks')
				.get() as { total: number };
			managedSize = playerTracks.total;
		}

		return { total, used, free, managedSize };
	} catch {
		return { total: 0, used: 0, free: 0, managedSize: 0 };
	}
}
