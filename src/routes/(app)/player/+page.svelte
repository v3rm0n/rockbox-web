<script lang="ts">
	import { onMount } from 'svelte';
	import { addToast } from '$lib/stores/toast.svelte.js';

	interface PlayerTrack {
		id: number;
		relative_path: string;
		library_track_id: number | null;
		file_size: number;
		is_orphan: number;
		title: string | null;
		artist: string | null;
		album: string | null;
		duration: number | null;
		format: string | null;
	}

	interface Storage {
		storage: { total: number; used: number; free: number; managedSize: number };
	}

	let tracks = $state<PlayerTrack[]>([]);
	let totalTracks = $state(0);
	let storage = $state<Storage | null>(null);
	let orphans = $state<{ id: number; relative_path: string; file_size: number }[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let selectedIds = $state<Set<number>>(new Set());
	let removing = $state(false);
	let removingAll = $state(false);
	let showDeleteAllConfirm = $state(false);
	let deleteConfirmText = $state('');
	let currentPage = $state(1);
	let totalPages = $state(1);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '--:--';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function loadData() {
		loading = true;
		const params = new URLSearchParams({
			page: String(currentPage),
			limit: '100'
		});
		if (searchQuery) params.set('q', searchQuery);

		const [tracksRes, storageRes, orphansRes] = await Promise.all([
			fetch(`/api/player/tracks?${params}`),
			fetch('/api/player/storage'),
			fetch('/api/player/orphans')
		]);

		const tracksData = await tracksRes.json();
		tracks = tracksData.tracks;
		totalPages = tracksData.pagination.pages;
		totalTracks = tracksData.pagination.total;
		storage = await storageRes.json();
		const orphansData = await orphansRes.json();
		orphans = orphansData.orphans;
		loading = false;
	}

	function toggleTrack(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	async function removeSelected() {
		if (selectedIds.size === 0) return;
		const ids = [...selectedIds];
		removing = true;

		try {
			const res = await fetch('/api/sync/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trackIds: ids })
			});
			const result = await res.json();

			if (result.failed > 0) {
				const detail = result.errors?.[0] || 'Unknown error';
				addToast('error', `Failed to remove ${result.failed} of ${ids.length} tracks`, detail, 10000);
			}
			if (result.removed > 0) {
				addToast('success', `Removed ${result.removed} track${result.removed > 1 ? 's' : ''} from player`);
			}
		} catch {
			addToast('error', 'Remove request failed', 'Could not connect to the server');
		}

		selectedIds = new Set();
		removing = false;
		await loadData();
	}

	async function removeAll() {
		removingAll = true;

		try {
			const res = await fetch('/api/sync/remove-all', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			const result = await res.json();

			if (result.failed > 0) {
				const detail = result.errors?.[0] || 'Unknown error';
				addToast('error', `Failed to remove ${result.failed} tracks`, detail, 10000);
			}
			if (result.removed > 0) {
				addToast('success', `Removed all ${result.removed} tracks from player`);
			}
		} catch {
			addToast('error', 'Remove all request failed', 'Could not connect to the server');
		}

		removingAll = false;
		showDeleteAllConfirm = false;
		deleteConfirmText = '';
		await loadData();
	}

	let deleteConfirmValid = $derived(deleteConfirmText === 'DELETE ALL');

	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			currentPage = 1;
			loadData();
		}, 300);
	}

	onMount(loadData);
</script>

<div class="player-page">
	<header class="page-header">
		<h1>Player</h1>
	</header>

	{#if loading}
		<div class="loading-state"><div class="spinner"></div></div>
	{:else}
		<!-- Storage overview -->
		{#if storage}
			<section class="section">
				<div class="section-header">
					<h2 class="section-title">Storage</h2>
					{#if totalTracks > 0}
						<button class="btn-delete-all" onclick={() => { showDeleteAllConfirm = true; deleteConfirmText = ''; }}>
							Delete all files
						</button>
					{/if}
				</div>
				<div class="storage-card">
					<div class="storage-bar">
						{#if storage}
							{@const pct = storage.storage.total > 0 ? (storage.storage.used / storage.storage.total) * 100 : 0}
							<div class="storage-fill" style="width: {pct}%"></div>
						{/if}
					</div>
					<div class="storage-stats">
						<span>{formatBytes(storage.storage.used)} used</span>
						<span>{formatBytes(storage.storage.free)} free</span>
						<span>{formatBytes(storage.storage.total)} total</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- Orphan warning -->
		{#if orphans.length > 0}
			<div class="orphan-warning">
				<strong>{orphans.length} orphaned files</strong> on player not found in library.
				These may have been removed from the library or don't match any known tracks.
			</div>
		{/if}

		<!-- Track list -->
		<section class="section">
			<div class="list-header">
				<h2 class="section-title">Tracks on player</h2>
				<div class="list-controls">
					<input
						type="text"
						class="search-input"
						placeholder="Search..."
						bind:value={searchQuery}
						oninput={onSearchInput}
					/>
					{#if selectedIds.size > 0}
						<button class="btn-remove" onclick={removeSelected} disabled={removing}>
							{removing ? 'Removing...' : `Remove ${selectedIds.size}`}
						</button>
						<button class="btn-ghost" onclick={() => selectedIds = new Set()}>Clear</button>
					{/if}
				</div>
			</div>

			{#if tracks.length === 0}
				<div class="empty-state">
					<p>No tracks on player</p>
				</div>
			{:else}
				<div class="track-list">
					{#each tracks as track}
						<div
							class="track-row"
							class:orphan={track.is_orphan}
							class:selected={selectedIds.has(track.id)}
						>
							<button
								class="track-select"
								class:checked={selectedIds.has(track.id)}
								onclick={() => toggleTrack(track.id)}
							>
								{#if selectedIds.has(track.id)}
									<span class="check-on">✓</span>
								{:else}
									<span class="check-off"></span>
								{/if}
							</button>

							<div class="track-info">
								<span class="track-title">
									{track.title || track.relative_path.split('/').pop() || 'Unknown'}
									{#if track.is_orphan}
										<span class="orphan-tag">orphan</span>
									{/if}
								</span>
								<span class="track-meta">
									{#if track.artist}{track.artist}{/if}
									{#if track.album} · {track.album}{/if}
								</span>
							</div>

							<span class="track-duration">{formatDuration(track.duration)}</span>
							<span class="track-size">{formatBytes(track.file_size)}</span>
						</div>
					{/each}
				</div>

				{#if totalPages > 1}
					<div class="pagination">
						<button class="page-btn" disabled={currentPage <= 1} onclick={() => { currentPage--; loadData(); }}>←</button>
						<span class="page-info">{currentPage}/{totalPages}</span>
						<button class="page-btn" disabled={currentPage >= totalPages} onclick={() => { currentPage++; loadData(); }}>→</button>
					</div>
				{/if}
			{/if}
		</section>
	{/if}
</div>

<!-- Delete all confirmation modal -->
{#if showDeleteAllConfirm}
	<div class="modal-backdrop" onclick={() => { showDeleteAllConfirm = false; deleteConfirmText = ''; }}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h3 class="modal-title">Delete all files from player</h3>
			<p class="modal-warning">
				This will permanently delete <strong>{totalTracks} tracks</strong>
				{#if storage}({formatBytes(storage.storage.managedSize)}){/if}
				from the player's managed directory. This cannot be undone.
			</p>
			<p class="modal-instruction">
				Type <code>DELETE ALL</code> to confirm:
			</p>
			<input
				type="text"
				class="modal-input"
				placeholder="DELETE ALL"
				bind:value={deleteConfirmText}
				autocomplete="off"
				spellcheck="false"
			/>
			<div class="modal-actions">
				<button
					class="btn-cancel"
					onclick={() => { showDeleteAllConfirm = false; deleteConfirmText = ''; }}
					disabled={removingAll}
				>
					Cancel
				</button>
				<button
					class="btn-confirm-delete"
					onclick={removeAll}
					disabled={!deleteConfirmValid || removingAll}
				>
					{removingAll ? 'Deleting...' : 'Delete all files'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.player-page { max-width: 900px; }

	.page-header h1 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0 0 2rem;
	}

	.section { margin-bottom: 2rem; }

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		margin: 0 0 0.75rem;
	}

	/* Storage */
	.storage-card {
		background: var(--color-surface);
		padding: 1rem 1.25rem;
		border-radius: 8px;
	}

	.storage-bar {
		height: 8px;
		background: var(--color-surface-raised);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.625rem;
	}

	.storage-fill {
		height: 100%;
		background: var(--color-accent);
		border-radius: 4px;
		transition: width 0.3s;
	}

	.storage-stats {
		display: flex;
		gap: 1.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* Orphan warning */
	.orphan-warning {
		background: rgba(212, 168, 67, 0.08);
		border: 1px solid rgba(212, 168, 67, 0.2);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-bottom: 2rem;
	}

	.orphan-warning strong {
		color: var(--color-accent);
	}

	/* List header */
	.list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.list-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.search-input {
		padding: 0.375rem 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border-subtle);
		border-radius: 5px;
		color: var(--color-text);
		font-size: 0.8125rem;
		font-family: inherit;
		outline: none;
		width: 180px;
	}

	.search-input:focus {
		border-color: var(--color-accent-muted);
	}

	.search-input::placeholder {
		color: var(--color-text-faint);
	}

	.btn-remove {
		padding: 0.3rem 0.625rem;
		border-radius: 4px;
		border: 1px solid var(--color-danger);
		background: rgba(212, 80, 80, 0.1);
		color: var(--color-danger);
		font-size: 0.75rem;
		cursor: pointer;
		font-family: inherit;
	}

	.btn-remove:hover:not(:disabled) { background: rgba(212, 80, 80, 0.2); }
	.btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }

	.btn-ghost {
		padding: 0.3rem 0.625rem;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		cursor: pointer;
		font-family: inherit;
	}

	/* Track list */
	.track-list {
		background: var(--color-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.track-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--color-border-subtle);
		transition: background 0.1s;
	}

	.track-row:last-child { border-bottom: none; }
	.track-row:hover { background: var(--color-surface-raised); }
	.track-row.selected { background: rgba(212, 80, 80, 0.06); }
	.track-row.orphan { opacity: 0.65; }

	.track-select {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.check-off {
		width: 16px; height: 16px;
		border: 1.5px solid var(--color-border);
		border-radius: 3px;
		display: block;
	}

	.check-on {
		width: 16px; height: 16px;
		background: var(--color-danger);
		border-radius: 3px;
		color: white;
		font-size: 0.625rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}

	.track-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.track-title {
		font-size: 0.875rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.orphan-tag {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-partial);
		background: rgba(212, 168, 67, 0.12);
		padding: 0.0625rem 0.375rem;
		border-radius: 2px;
		margin-left: 0.5rem;
		vertical-align: middle;
	}

	.track-meta {
		font-size: 0.8125rem;
		color: var(--color-text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-duration {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		width: 48px;
		text-align: right;
		flex-shrink: 0;
	}

	.track-size {
		color: var(--color-text-faint);
		font-size: 0.75rem;
		width: 56px;
		text-align: right;
		flex-shrink: 0;
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 0;
	}

	.page-btn {
		padding: 0.25rem 0.625rem;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
	}

	.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
	.page-info { font-size: 0.8125rem; color: var(--color-text-faint); }

	.loading-state, .empty-state {
		text-align: center;
		padding: 3rem 0;
		color: var(--color-text-muted);
	}

	.spinner {
		width: 24px; height: 24px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* Section header with action */
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.section-header .section-title {
		margin: 0;
	}

	.btn-delete-all {
		padding: 0.25rem 0.625rem;
		border-radius: 4px;
		border: 1px solid var(--color-danger);
		background: transparent;
		color: var(--color-danger);
		font-size: 0.75rem;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.btn-delete-all:hover {
		background: rgba(212, 80, 80, 0.1);
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 1.75rem;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
	}

	.modal-title {
		font-family: var(--font-display);
		font-size: 1.125rem;
		font-weight: 400;
		color: var(--color-danger);
		margin: 0 0 1rem;
	}

	.modal-warning {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		margin: 0 0 1rem;
	}

	.modal-warning strong {
		color: var(--color-text);
	}

	.modal-instruction {
		font-size: 0.8125rem;
		color: var(--color-text-faint);
		margin: 0 0 0.5rem;
	}

	.modal-instruction code {
		color: var(--color-danger);
		font-weight: 600;
		background: rgba(212, 80, 80, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.modal-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
		margin-bottom: 1.25rem;
	}

	.modal-input:focus {
		border-color: var(--color-danger);
	}

	.modal-actions {
		display: flex;
		gap: 0.625rem;
		justify-content: flex-end;
	}

	.btn-cancel {
		padding: 0.4375rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
	}

	.btn-cancel:hover:not(:disabled) {
		border-color: var(--color-text-faint);
		color: var(--color-text);
	}

	.btn-confirm-delete {
		padding: 0.4375rem 1rem;
		border-radius: 6px;
		border: none;
		background: var(--color-danger);
		color: white;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.btn-confirm-delete:hover:not(:disabled) {
		background: var(--color-danger-hover);
	}

	.btn-confirm-delete:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
