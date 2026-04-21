# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Crate is

A SvelteKit + SQLite web app (shipped as a Docker container) for syncing music from a library (e.g. Lidarr-managed) to portable audio players that present themselves as USB drives. Library is source of truth and read-only; the player is read-write. File matching is by **relative path**, not hash: `/library/Artist/Album/Track.flac` must equal the path under the player's managed directory to be considered synced.

## Commands

```sh
npm run dev         # Vite dev server (see "Local dev" below for required env vars)
npm run build       # Production build (outputs to build/ via adapter-node)
node build          # Run the production server
npm run check       # svelte-check typecheck (there is no separate `lint` or test suite)
```

### Local dev

The app expects real directories at `LIBRARY_PATH`, `PLAYER_MOUNT_BASE`, and `DATA_DIR`. For local work, create tmp dirs and point env vars at them:

```sh
mkdir -p /tmp/crate-test/{library,data,players/player1,players/player2}
DATA_DIR=/tmp/crate-test/data \
LIBRARY_PATH=/tmp/crate-test/library \
PLAYER_MOUNT_BASE=/tmp/crate-test/players \
npm run dev
```

Set `LOG_LEVEL=debug` for verbose server logs. Set `SCAN_INTERVAL=<minutes>` to enable the periodic scan cron (default 0 = disabled).

### Tunnels / previewing on a phone

Vite's dev server does **not** work through tunnels — HMR uses a localhost WebSocket and CSS is injected via JS, so styles flash then vanish when the socket fails. For tunnel preview always use the production build (`npm run build && node build`) and set `ORIGIN` to the tunnel URL.

## Architecture

### Mount model

```
/library (RO, LIBRARY_PATH)  ──►  SvelteKit + SQLite  ──►  /player/<device>/<managed_dir> (RW)
                                         /data (DATA_DIR, crate.db)
```

`PLAYER_MOUNT_BASE` (default `/player`) is the parent directory in which each subdirectory is treated as a candidate player. A player is only considered "mounted" when `statSync(mountPath).dev !== statSync(dirname(mountPath)).dev` — i.e. the mountpoint sits on a different device than its parent. See `isPlayerMounted` in `src/lib/server/players.ts`.

### Server module layout (`src/lib/server/`)

- `db.ts` — better-sqlite3 connection, WAL mode, schema + inline migrations. **The default export is a Proxy that lazy-initializes on first access** so the DB never opens during `vite build`. Schema changes go in `migrate()` / `migrateData()` here; add idempotent `pragma_table_info`-style guards before any `ALTER TABLE`.
- `settings.ts` — key/value store in the `settings` table; also exposes `getLibraryPath()` and `isSetupComplete()`.
- `players.ts` — multi-player CRUD. Exactly one player has `is_active = 1`; `setActivePlayer` runs in a transaction that clears all others first.
- `scanner.ts` — walks `LIBRARY_PATH`, extracts metadata via `music-metadata`, upserts into `library_tracks`. Incremental: rows with matching `last_modified` are skipped. Also extracts album art keyed by `"<albumArtist|artist>:<album>"` into the `album_art` table.
- `player.ts` — scans a player's managed dir into `player_tracks` and matches each file back to `library_tracks.relative_path`. Matching tries (in order): literal path → NFC-normalized → Latin-1→UTF-8 mojibake fix → stripping disc/media subdirs like `CD 01/`, `Vinyl 02/`. Unmatched rows get `is_orphan = 1`.
- `sync.ts` — `startCopyToPlayer` / `startRemoveFromPlayer` create a `jobs` row and return the job id immediately; the actual work runs in a fire-and-forget async function. **Use the level-by-level `ensureDir` helper here — not `mkdir({ recursive: true })`.** The vfat driver through Docker bind mounts can fail with ENOENT on recursive mkdir against FAT32 players.
- `migrate.ts` — first-run migration: reorganizes existing files on the player into Artist/Album (Year)/Track layout; files with unreadable metadata go to `Unsorted/`.
- `cron.ts` — optional periodic library+player scan, gated by `SCAN_INTERVAL`. Started from `hooks.server.ts`.

### Routing

- `src/hooks.server.ts` — logs startup config, checks mount-point health, starts the cron, and redirects to `/setup` until `settings.setup_completed = 'true'`.
- `src/routes/(app)/` — authenticated app shell (library, player, settings). `AppShell.svelte` is the persistent sidebar layout.
- `src/routes/setup/` — first-run wizard.
- `src/routes/api/` — JSON endpoints. Long-running operations (library scan, player scan, sync copy/remove) return `{ jobId }` and are polled via `GET /api/jobs/:id`. The client side of this is `src/lib/stores/sync.svelte.ts` (`trackJob`, `recoverRunningJobs`).

### Jobs

All background work writes to the `jobs` table (`type`, `status`, `progress`, `total`, optional `player_id`, optional JSON `result`). The UI polls `/api/jobs/:id` every ~800ms until `status !== 'running'`, then keeps the row visible for 3s before dropping it. `recoverRunningJobs()` rehydrates in-flight jobs on page load so a refresh doesn't lose progress.

## Conventions and gotchas

### Svelte 5 runes mode

- Use `$state` / `$derived` / `$effect` — not `$:`.
- `onclick|stopPropagation` modifier syntax does not work in Svelte 5. Inline it: `onclick={(e) => { e.stopPropagation(); ... }}`.
- `{@const}` must live inside `{#if}`, `{#each}`, etc. — not as a direct child of an HTML element.

### Styling

Plain CSS only. **Do not add Tailwind** — Tailwind v4's Vite plugin collides with Svelte's CSS extraction (produces `Invalid declaration: goto`). Global tokens are hex CSS custom properties in `src/app.css`. Avoid `oklch()`, `@layer`, and `@property` — they break in some in-app browsers (Discord, Reddit).

### FAT32 / portable players

Most target devices are FAT32. When writing files to a player's managed directory always use the `ensureDir` helper in `sync.ts` (level-by-level mkdir). Filenames coming back from vfat may be NFD-normalized or arrive as UTF-8-bytes-as-Latin-1 — the matching ladder in `player.ts` handles this; extend it there rather than in callers.

### Docker on macOS

Network-share bind mounts (NAS/SMB/NFS) do not propagate into Docker Desktop containers — the mount succeeds but the dir appears empty. `/tmp` is a symlink to `/private/tmp` and can also fail. Use paths under `~/` for local Docker testing. This is fine on native Linux (the production target is Unraid).

For multi-player mount propagation inside Docker, the compose file must use `:slave` on the player mount base (e.g. `/mnt/disks:/mnt/disks:slave`) so host plug/unplug events reach the container.

### Database migrations

Add DDL changes to `migrate()` in `src/lib/server/db.ts` as idempotent blocks (check `pragma_table_info` or a sentinel row in `settings` before running). Data backfills go in `migrateData()`. Migrations run inside `getDb()` on first access, so they must be fast and must not depend on app state.
