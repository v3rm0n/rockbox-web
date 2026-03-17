<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface Album {
		album: string;
		artist: string;
		year: number | null;
		track_count: number;
		synced_count: number;
		total_size: number;
		first_track_id: number;
	}

	let albums = $state<Album[]>([]);
	let searchQuery = $state(page.url.searchParams.get('q') || '');
	let syncFilter = $state(page.url.searchParams.get('sync') || 'all');
	let artistFilter = $state(page.url.searchParams.get('artist') || '');
	let currentPage = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let loading = $state(true);
	let syncing = $state<Set<string>>(new Set());

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function syncStatus(album: Album): 'synced' | 'partial' | 'unsynced' {
		if (album.synced_count === 0) return 'unsynced';
		if (album.synced_count >= album.track_count) return 'synced';
		return 'partial';
	}

	async function loadAlbums() {
		loading = true;
		const params = new URLSearchParams();
		params.set('page', String(currentPage));
		params.set('limit', '50');
		if (searchQuery) params.set('q', searchQuery);
		if (syncFilter !== 'all') params.set('sync', syncFilter);
		if (artistFilter) params.set('artist', artistFilter);

		const res = await fetch(`/api/library/albums?${params}`);
		const data = await res.json();
		albums = data.albums;
		totalPages = data.pagination.pages;
		total = data.pagination.total;
		loading = false;
	}

	async function syncAlbum(album: Album) {
		const key = `${album.artist}|${album.album}`;
		syncing = new Set([...syncing, key]);

		// Get all unsynced tracks for this album
		const params = new URLSearchParams({ album: album.album, artist: album.artist });
		const res = await fetch(`/api/library/tracks?${params}`);
		const data = await res.json();

		const unsyncedIds = data.tracks
			.filter((t: { is_synced: number }) => !t.is_synced)
			.map((t: { id: number }) => t.id);

		if (unsyncedIds.length > 0) {
			await fetch('/api/sync/copy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trackIds: unsyncedIds })
			});
		}

		syncing = new Set([...syncing].filter(k => k !== key));
		await loadAlbums();
	}

	function setFilter(filter: string) {
		syncFilter = filter;
		currentPage = 1;
		loadAlbums();
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			currentPage = 1;
			loadAlbums();
		}, 300);
	}

	onMount(loadAlbums);
</script>

<div class="library-page">
	<header class="page-header">
		<div class="header-row">
			<h1>Library</h1>
			{#if !loading}
				<span class="header-count">{total.toLocaleString()} albums</span>
			{/if}
		</div>

		{#if artistFilter}
			<div class="artist-filter-bar">
				<span>Filtered by artist: <strong>{artistFilter}</strong></span>
				<button class="btn-text" onclick={() => { artistFilter = ''; loadAlbums(); }}>Clear</button>
			</div>
		{/if}
	</header>

	<!-- Search and filters -->
	<div class="controls">
		<div class="search-box">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
			<input
				type="text"
				placeholder="Search albums, artists..."
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</div>

		<div class="filter-tabs">
			<button class="tab" class:active={syncFilter === 'all'} onclick={() => setFilter('all')}>
				All
			</button>
			<button class="tab" class:active={syncFilter === 'synced'} onclick={() => setFilter('synced')}>
				<span class="tab-dot synced"></span> Synced
			</button>
			<button class="tab" class:active={syncFilter === 'partial'} onclick={() => setFilter('partial')}>
				<span class="tab-dot partial"></span> Partial
			</button>
			<button class="tab" class:active={syncFilter === 'unsynced'} onclick={() => setFilter('unsynced')}>
				<span class="tab-dot unsynced"></span> Not synced
			</button>
		</div>
	</div>

	<!-- Album grid -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
		</div>
	{:else if albums.length === 0}
		<div class="empty-state">
			<p>No albums found</p>
			{#if searchQuery || syncFilter !== 'all'}
				<button class="btn-text" onclick={() => { searchQuery = ''; syncFilter = 'all'; loadAlbums(); }}>
					Clear filters
				</button>
			{:else}
				<p class="hint">Scan your library from Settings to populate this view.</p>
			{/if}
		</div>
	{:else}
		<div class="album-grid">
			{#each albums as album}
				{@const status = syncStatus(album)}
				{@const key = `${album.artist}|${album.album}`}
				<div class="album-card" class:synced={status === 'synced'} class:partial={status === 'partial'}>
					<a
						href="/library/album/{encodeURIComponent(album.artist)}:{encodeURIComponent(album.album)}"
						class="album-link"
					>
						<div class="album-art">
							<span class="album-art-text">{album.album?.charAt(0) || '?'}</span>
						</div>
						<div class="album-info">
							<span class="album-title">{album.album || 'Unknown Album'}</span>
							<button
								class="album-artist"
								onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); artistFilter = album.artist; currentPage = 1; loadAlbums(); }}
							>
								{album.artist || 'Unknown Artist'}
							</button>
							<div class="album-meta">
								{#if album.year}<span>{album.year}</span>{/if}
								<span>{album.track_count} tracks</span>
								<span>{formatBytes(album.total_size)}</span>
							</div>
						</div>
					</a>

					<div class="album-sync">
						{#if status === 'synced'}
							<span class="sync-badge synced" title="Fully synced">
								✓ {album.synced_count}/{album.track_count}
							</span>
						{:else if status === 'partial'}
							<span class="sync-badge partial" title="Partially synced">
								◐ {album.synced_count}/{album.track_count}
							</span>
							<button
								class="btn-sync"
								disabled={syncing.has(key)}
								onclick={() => syncAlbum(album)}
							>
								{syncing.has(key) ? 'Syncing...' : 'Sync remaining'}
							</button>
						{:else}
							<span class="sync-badge unsynced">
								{album.synced_count}/{album.track_count}
							</span>
							<button
								class="btn-sync"
								disabled={syncing.has(key)}
								onclick={() => syncAlbum(album)}
							>
								{syncing.has(key) ? 'Syncing...' : 'Sync'}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination">
				<button
					class="page-btn"
					disabled={currentPage <= 1}
					onclick={() => { currentPage--; loadAlbums(); }}
				>
					← Previous
				</button>
				<span class="page-info">Page {currentPage} of {totalPages}</span>
				<button
					class="page-btn"
					disabled={currentPage >= totalPages}
					onclick={() => { currentPage++; loadAlbums(); }}
				>
					Next →
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.library-page {
		max-width: 1000px;
	}

	.page-header h1 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0;
	}

	.header-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.header-count {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.artist-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.875rem;
		background: rgba(212, 168, 67, 0.08);
		border-radius: 6px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-bottom: 0.25rem;
	}

	.artist-filter-bar strong {
		color: var(--color-accent);
	}

	.btn-text {
		background: none;
		border: none;
		color: var(--color-accent);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
	}

	.btn-text:hover {
		text-decoration: underline;
	}

	/* Controls */
	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.25rem 0 1.5rem;
	}

	.search-box {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		color: var(--color-text-faint);
	}

	.search-box input {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border-subtle);
		border-radius: 6px;
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.search-box input::placeholder {
		color: var(--color-text-faint);
	}

	.search-box input:focus {
		border-color: var(--color-accent-muted);
	}

	/* Filter tabs */
	.filter-tabs {
		display: flex;
		gap: 2px;
		background: var(--color-surface);
		border-radius: 6px;
		padding: 3px;
		width: fit-content;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	.tab-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.tab-dot.synced { background: var(--color-synced); }
	.tab-dot.partial { background: var(--color-partial); }
	.tab-dot.unsynced { background: var(--color-unsynced); }

	/* Album grid */
	.album-grid {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--color-border-subtle);
		border-radius: 8px;
		overflow: hidden;
	}

	.album-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-surface);
		transition: background 0.15s;
	}

	.album-card:hover {
		background: var(--color-surface-raised);
	}

	.album-link {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		flex: 1;
		min-width: 0;
		padding: 0.75rem 1rem;
		text-decoration: none;
		color: inherit;
	}

	.album-art {
		width: 44px;
		height: 44px;
		border-radius: 4px;
		background: var(--color-surface-raised);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.album-art-text {
		font-family: var(--font-display);
		font-size: 1.125rem;
		color: var(--color-text-faint);
	}

	.album-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.album-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-artist {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-artist:hover {
		color: var(--color-accent);
	}

	.album-meta {
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-faint);
	}

	.album-meta span::after {
		content: '·';
		margin-left: 0.5rem;
	}

	.album-meta span:last-child::after {
		content: '';
	}

	/* Sync status */
	.album-sync {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding-right: 1rem;
		flex-shrink: 0;
	}

	.sync-badge {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.1875rem 0.5rem;
		border-radius: 3px;
		white-space: nowrap;
	}

	.sync-badge.synced {
		color: var(--color-synced);
		background: rgba(76, 175, 106, 0.1);
	}

	.sync-badge.partial {
		color: var(--color-partial);
		background: rgba(212, 168, 67, 0.1);
	}

	.sync-badge.unsynced {
		color: var(--color-text-faint);
		background: var(--color-surface-raised);
	}

	.btn-sync {
		padding: 0.25rem 0.625rem;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
		white-space: nowrap;
	}

	.btn-sync:hover:not(:disabled) {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.btn-sync:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Loading / empty */
	.loading-state, .empty-state {
		text-align: center;
		padding: 4rem 0;
		color: var(--color-text-muted);
	}

	.empty-state p {
		margin: 0 0 0.5rem;
	}

	.hint {
		color: var(--color-text-faint);
		font-size: 0.875rem;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1.5rem 0;
	}

	.page-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
	}

	.page-btn:hover:not(:disabled) {
		border-color: var(--color-accent-muted);
		color: var(--color-text);
	}

	.page-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.8125rem;
		color: var(--color-text-faint);
	}

	@media (max-width: 640px) {
		.album-sync {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.25rem;
		}
	}
</style>
