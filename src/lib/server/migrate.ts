import { extractMetadata, isSupportedAudioFile } from './metadata.js';
import fs from 'node:fs';
import path from 'node:path';

export interface MigrationPlan {
	moves: { from: string; to: string }[];
	unsorted: string[];
	alreadyCorrect: string[];
}

export interface MigrationProgress {
	phase: 'planning' | 'migrating' | 'complete' | 'error';
	current: number;
	total: number;
	currentFile?: string;
	error?: string;
}

type ProgressCallback = (progress: MigrationProgress) => void;

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
 * Build a target path based on metadata, mirroring Lidarr-style structure:
 * Artist/Album (Year)/01 - Title.ext
 */
function buildTargetPath(metadata: NonNullable<Awaited<ReturnType<typeof extractMetadata>>>, originalFilename: string): string {
	const artist = sanitizePath(metadata.albumArtist || metadata.artist || 'Unknown Artist');
	const album = metadata.album || 'Unknown Album';
	const year = metadata.year ? ` (${metadata.year})` : '';
	const albumFolder = sanitizePath(`${album}${year}`);

	return path.join(artist, albumFolder, path.basename(originalFilename));
}

/**
 * Sanitize a string for use as a directory/file name.
 */
function sanitizePath(input: string): string {
	return input
		.replace(/[<>:"/\\|?*]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
}

/**
 * Analyze existing files in the managed directory and create a migration plan.
 */
export async function planMigration(
	managedPath: string,
	onProgress?: ProgressCallback
): Promise<MigrationPlan> {
	const plan: MigrationPlan = {
		moves: [],
		unsorted: [],
		alreadyCorrect: []
	};

	onProgress?.({ phase: 'planning', current: 0, total: 0 });

	const files = walkDir(managedPath);
	const total = files.length;

	for (let i = 0; i < files.length; i++) {
		const filePath = files[i];
		const relativePath = path.relative(managedPath, filePath);

		onProgress?.({
			phase: 'planning',
			current: i + 1,
			total,
			currentFile: relativePath
		});

		const metadata = await extractMetadata(filePath);

		if (!metadata || (!metadata.artist && !metadata.albumArtist)) {
			plan.unsorted.push(relativePath);
			continue;
		}

		const targetRelative = buildTargetPath(metadata, filePath);

		if (relativePath === targetRelative) {
			plan.alreadyCorrect.push(relativePath);
		} else {
			plan.moves.push({ from: relativePath, to: targetRelative });
		}
	}

	return plan;
}

/**
 * Execute a migration plan — move files to their target locations.
 */
export async function executeMigration(
	managedPath: string,
	plan: MigrationPlan,
	onProgress?: ProgressCallback
): Promise<{ moved: number; unsorted: number; errors: string[] }> {
	const errors: string[] = [];
	let moved = 0;
	const total = plan.moves.length + plan.unsorted.length;

	// Move files to correct locations
	for (let i = 0; i < plan.moves.length; i++) {
		const { from, to } = plan.moves[i];
		const srcPath = path.join(managedPath, from);
		const destPath = path.join(managedPath, to);

		onProgress?.({
			phase: 'migrating',
			current: i + 1,
			total,
			currentFile: from
		});

		try {
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.renameSync(srcPath, destPath);
			moved++;

			// Clean up empty source directories
			let dir = path.dirname(srcPath);
			while (dir !== managedPath) {
				try {
					const entries = fs.readdirSync(dir);
					if (entries.length === 0) {
						fs.rmdirSync(dir);
						dir = path.dirname(dir);
					} else {
						break;
					}
				} catch {
					break;
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			errors.push(`Failed to move ${from}: ${msg}`);
		}
	}

	// Move unsorted files to Unsorted directory
	const unsortedDir = path.join(managedPath, 'Unsorted');
	let unsortedCount = 0;

	for (let i = 0; i < plan.unsorted.length; i++) {
		const filePath = plan.unsorted[i];
		const srcPath = path.join(managedPath, filePath);
		const destPath = path.join(unsortedDir, path.basename(filePath));

		onProgress?.({
			phase: 'migrating',
			current: plan.moves.length + i + 1,
			total,
			currentFile: filePath
		});

		try {
			fs.mkdirSync(unsortedDir, { recursive: true });

			// Handle filename conflicts in Unsorted
			let finalDest = destPath;
			let counter = 1;
			while (fs.existsSync(finalDest)) {
				const ext = path.extname(destPath);
				const base = path.basename(destPath, ext);
				finalDest = path.join(unsortedDir, `${base} (${counter})${ext}`);
				counter++;
			}

			fs.renameSync(srcPath, finalDest);
			unsortedCount++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			errors.push(`Failed to move ${filePath} to Unsorted: ${msg}`);
		}
	}

	onProgress?.({ phase: 'complete', current: total, total });

	return { moved, unsorted: unsortedCount, errors };
}
