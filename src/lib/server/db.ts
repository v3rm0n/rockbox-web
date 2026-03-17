import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
	if (_db) return _db;

	const dataDir = process.env.DATA_DIR || '/data';

	// Ensure data directory exists
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	const dbPath = path.join(dataDir, 'rockbox.db');

	_db = new Database(dbPath);

	// Enable WAL mode for better concurrent read performance
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');

	// Run migrations
	migrate(_db);

	return _db;
}

function migrate(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS library_tracks (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			relative_path TEXT NOT NULL UNIQUE,
			title         TEXT,
			artist        TEXT,
			album         TEXT,
			album_artist  TEXT,
			genre         TEXT,
			track_number  INTEGER,
			disc_number   INTEGER,
			year          INTEGER,
			duration      REAL,
			format        TEXT,
			bitrate       INTEGER,
			sample_rate   INTEGER,
			file_size     INTEGER,
			last_modified INTEGER,
			scanned_at    TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS player_tracks (
			id               INTEGER PRIMARY KEY AUTOINCREMENT,
			relative_path    TEXT NOT NULL UNIQUE,
			library_track_id INTEGER REFERENCES library_tracks(id) ON DELETE SET NULL,
			file_size        INTEGER,
			is_orphan        INTEGER NOT NULL DEFAULT 0,
			synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS jobs (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			type        TEXT NOT NULL,
			status      TEXT NOT NULL DEFAULT 'running',
			progress    INTEGER NOT NULL DEFAULT 0,
			total       INTEGER NOT NULL DEFAULT 0,
			started_at  TEXT NOT NULL DEFAULT (datetime('now')),
			finished_at TEXT,
			error       TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_library_tracks_artist ON library_tracks(artist);
		CREATE INDEX IF NOT EXISTS idx_library_tracks_album ON library_tracks(album);
		CREATE INDEX IF NOT EXISTS idx_library_tracks_album_artist ON library_tracks(album_artist);
		CREATE INDEX IF NOT EXISTS idx_library_tracks_genre ON library_tracks(genre);
		CREATE INDEX IF NOT EXISTS idx_player_tracks_library_track_id ON player_tracks(library_track_id);
	`);
}

// Proxy that lazily initializes the database on first access
const db = new Proxy({} as Database.Database, {
	get(_target, prop: string | symbol) {
		const instance = getDb();
		const value = instance[prop as keyof Database.Database];
		if (typeof value === 'function') {
			return value.bind(instance);
		}
		return value;
	}
});

export default db;
