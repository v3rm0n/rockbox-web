# Crate

[![Build](https://github.com/v3rm0n/crate/actions/workflows/build.yml/badge.svg)](https://github.com/v3rm0n/crate/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker Image](https://img.shields.io/badge/ghcr.io-v3rm0n%2Fcrate-blue)](https://github.com/v3rm0n/crate/pkgs/container/crate)

A web application for managing music on portable audio players. Runs as a Docker container on your NAS (Unraid, Synology, etc.), mounts your music library and player storage, and lets you browse, search, and sync music through a clean web interface.

Works with any DAP (digital audio player) that presents itself as a USB drive — Rockbox players, iPods, Sony Walkmans, FiiO, Shanling, and more.

## Features

- **Library browser** — browse your music library by artist and album with search
- **Sync status tracking** — instantly see which albums are fully synced, partially synced, or not on the player
- **Manual sync** — copy individual tracks or entire albums to the player with one click
- **Player browser** — view and manage what's on the player, remove tracks
- **Storage dashboard** — monitor player storage usage, top artists by size
- **First-run setup wizard** — pick or create a managed directory on the player, auto-migrate existing files
- **Incremental scanning** — only re-processes changed files on rescan
- **Orphan detection** — flags files on the player that don't match anything in the library

## How it works

```
NAS                                Docker Container                    Player
┌────────────────┐                ┌────────────────────┐             ┌──────────┐
│ Music Library  │──── /library ──│       Crate        │── /player ──│   DAP    │
│ (Lidarr, etc.) │   (read-only)  │  SvelteKit + SQLite│ (read-write)│  Device  │
└────────────────┘                └────────────────────┘             └──────────┘
```

The app expects a well-structured music library (e.g. managed by [Lidarr](https://lidarr.audio/)) and mirrors that structure on the player. File matching is done by relative path — if `/library/Artist/Album/01 - Song.flac` exists and the same path exists under the managed directory on the player, it's considered synced.

## Quick start

Pull the image from GitHub Container Registry:

```sh
docker pull ghcr.io/v3rm0n/crate:latest
```

### Docker Compose

```yaml
services:
  crate:
    image: ghcr.io/v3rm0n/crate:latest
    container_name: crate
    ports:
      - "3000:3000"
    volumes:
      - crate-data:/data
      - /path/to/your/music/library:/library:ro
      - /path/to/your/player:/player
    environment:
      - ORIGIN=http://localhost:3000
    restart: unless-stopped

volumes:
  crate-data:
```

Replace `/path/to/your/music/library` with your NAS music share and `/path/to/your/player` with the mounted player storage.

```sh
docker compose up -d
```

Open `http://your-nas-ip:3000` and follow the setup wizard.

### Docker run

```sh
docker run -d \
  --name crate \
  -p 3000:3000 \
  -v crate-data:/data \
  -v /path/to/your/music/library:/library:ro \
  -v /path/to/your/player:/player \
  -e ORIGIN=http://localhost:3000 \
  ghcr.io/v3rm0n/crate:latest
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ORIGIN` | `http://localhost:3000` | The public URL of the app (required for CSRF protection) |
| `DATA_DIR` | `/data` | Where the SQLite database is stored |
| `LIBRARY_PATH` | `/library` | Mount point for the music library |
| `PLAYER_PATH` | `/player` | Mount point for the player storage |
| `PORT` | `3000` | HTTP server port |
| `SCAN_INTERVAL` | `0` (disabled) | Auto-scan interval in minutes (e.g. `60` = rescan every hour) |

## Supported audio formats

FLAC, MP3, OGG, AAC, WAV

## First-run setup

On first launch, the setup wizard will:

1. Let you choose or create a directory on the player to manage (e.g. `Music`)
2. Scan existing files in that directory and reorganize them to match your library's folder structure (Artist/Album/Track)
3. Move files with unreadable metadata to an `Unsorted` folder
4. Scan your music library and index all tracks

## Development

```sh
npm install
npm run dev
```

Requires local directories for testing:

```sh
mkdir -p /tmp/crate-test/{library,player,data}

DATA_DIR=/tmp/crate-test/data \
LIBRARY_PATH=/tmp/crate-test/library \
PLAYER_PATH=/tmp/crate-test/player \
npm run dev
```

### Production build

```sh
npm run build
node build
```

## Tech stack

- [SvelteKit](https://svelte.dev/) — full-stack framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — embedded database
- [music-metadata](https://github.com/borewit/music-metadata) — audio file metadata parsing
- Node.js 22 Alpine — Docker base image

## License

[MIT](LICENSE)
