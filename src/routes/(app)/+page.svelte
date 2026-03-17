<script lang="ts">
	import { onMount } from 'svelte';

	interface Stats {
		total_tracks: number;
		total_artists: number;
		total_albums: number;
		total_size: number;
		total_duration: number;
		synced_tracks: number;
		format_breakdown: { format: string; count: number; total_size: number }[];
	}

	interface Storage {
		storage: { total: number; used: number; free: number; managedSize: number };
		topArtists: { artist: string; track_count: number; total_size: number }[];
	}

	let stats = $state<Stats | null>(null);
	let storage = $state<Storage | null>(null);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDuration(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		if (days > 0) return `${days}d ${hours}h`;
		const mins = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${mins}m`;
	}

	onMount(async () => {
		const [statsRes, storageRes] = await Promise.all([
			fetch('/api/library/stats'),
			fetch('/api/player/storage')
		]);
		stats = await statsRes.json();
		storage = await storageRes.json();
	});
</script>

<div class="dashboard">
	<header class="page-header">
		<h1>Dashboard</h1>
	</header>

	{#if stats && storage}
		<!-- Library overview -->
		<section class="section">
			<h2 class="section-title">Library</h2>
			<div class="stat-grid">
				<div class="stat">
					<span class="stat-value">{stats.total_tracks.toLocaleString()}</span>
					<span class="stat-label">Tracks</span>
				</div>
				<div class="stat">
					<span class="stat-value">{stats.total_albums.toLocaleString()}</span>
					<span class="stat-label">Albums</span>
				</div>
				<div class="stat">
					<span class="stat-value">{stats.total_artists.toLocaleString()}</span>
					<span class="stat-label">Artists</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatBytes(stats.total_size)}</span>
					<span class="stat-label">Total size</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatDuration(stats.total_duration)}</span>
					<span class="stat-label">Play time</span>
				</div>
				<div class="stat">
					<span class="stat-value accent">{stats.synced_tracks.toLocaleString()}</span>
					<span class="stat-label">On player</span>
				</div>
			</div>
		</section>

		<!-- Player storage -->
		<section class="section">
			<h2 class="section-title">Player storage</h2>
			<div class="storage-bar-container">
				<div class="storage-bar">
					{#if storage}
						{@const usedPct = storage.storage.total > 0 ? (storage.storage.used / storage.storage.total) * 100 : 0}
						{@const managedPct = storage.storage.total > 0 ? (storage.storage.managedSize / storage.storage.total) * 100 : 0}
						<div class="storage-used" style="width: {usedPct}%">
							<div class="storage-managed" style="width: {usedPct > 0 ? (managedPct / usedPct) * 100 : 0}%"></div>
						</div>
					{/if}
				</div>
				<div class="storage-legend">
					<span class="legend-item">
						<span class="legend-dot managed"></span>
						Managed music: {formatBytes(storage.storage.managedSize)}
					</span>
					<span class="legend-item">
						<span class="legend-dot used"></span>
						Other used: {formatBytes(storage.storage.used - storage.storage.managedSize)}
					</span>
					<span class="legend-item">
						<span class="legend-dot free"></span>
						Free: {formatBytes(storage.storage.free)}
					</span>
				</div>
			</div>
		</section>

		<!-- Format breakdown -->
		{#if stats.format_breakdown.length > 0}
			<section class="section">
				<h2 class="section-title">Formats in library</h2>
				<div class="format-list">
					{#each stats.format_breakdown as fmt}
						<div class="format-item">
							<span class="format-name">{fmt.format}</span>
							<span class="format-count">{fmt.count.toLocaleString()} tracks</span>
							<span class="format-size">{formatBytes(fmt.total_size)}</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Top artists on player -->
		{#if storage.topArtists && storage.topArtists.length > 0}
			<section class="section">
				<h2 class="section-title">Top artists on player</h2>
				<div class="artist-list">
					{#each storage.topArtists as artist}
						<div class="artist-item">
							<span class="artist-name">{artist.artist || 'Unknown'}</span>
							<span class="artist-detail">{artist.track_count} tracks · {formatBytes(artist.total_size)}</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading dashboard...</p>
		</div>
	{/if}
</div>

<style>
	.dashboard {
		max-width: 900px;
	}

	.page-header h1 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0 0 2rem;
	}

	.section {
		margin-bottom: 2.5rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		margin: 0 0 1rem;
	}

	/* Stats grid */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 1px;
		background: var(--color-border-subtle);
		border-radius: 8px;
		overflow: hidden;
	}

	.stat {
		background: var(--color-surface);
		padding: 1.125rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--color-text);
	}

	.stat-value.accent {
		color: var(--color-accent);
	}

	.stat-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* Storage bar */
	.storage-bar-container {
		background: var(--color-surface);
		border-radius: 8px;
		padding: 1.25rem;
	}

	.storage-bar {
		height: 10px;
		background: var(--color-surface-raised);
		border-radius: 5px;
		overflow: hidden;
		margin-bottom: 0.875rem;
	}

	.storage-used {
		height: 100%;
		background: var(--color-text-faint);
		border-radius: 5px;
		position: relative;
	}

	.storage-managed {
		height: 100%;
		background: var(--color-accent);
		border-radius: 5px;
	}

	.storage-legend {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.legend-dot.managed {
		background: var(--color-accent);
	}

	.legend-dot.used {
		background: var(--color-text-faint);
	}

	.legend-dot.free {
		background: var(--color-surface-raised);
	}

	/* Format list */
	.format-list {
		background: var(--color-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.format-item {
		display: flex;
		align-items: center;
		padding: 0.625rem 1.25rem;
		border-bottom: 1px solid var(--color-border-subtle);
		font-size: 0.875rem;
	}

	.format-item:last-child {
		border-bottom: none;
	}

	.format-name {
		font-weight: 600;
		width: 60px;
		color: var(--color-text);
	}

	.format-count {
		color: var(--color-text-muted);
		flex: 1;
	}

	.format-size {
		color: var(--color-text-faint);
		font-size: 0.8125rem;
	}

	/* Artist list */
	.artist-list {
		background: var(--color-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.artist-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 1.25rem;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.artist-item:last-child {
		border-bottom: none;
	}

	.artist-name {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.artist-detail {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* Loading */
	.loading-state {
		text-align: center;
		padding: 4rem 0;
		color: var(--color-text-muted);
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
