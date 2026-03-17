<script lang="ts">
	import { onMount } from 'svelte';

	interface Settings {
		setupComplete: boolean;
		managedDir: string | null;
		libraryPath: string;
		playerPath: string;
	}

	interface Job {
		id: number;
		type: string;
		status: string;
		progress: number;
		total: number;
		started_at: string;
		finished_at: string | null;
		error: string | null;
	}

	let settings = $state<Settings | null>(null);
	let jobs = $state<Job[]>([]);
	let scanning = $state<'library' | 'player' | null>(null);
	let scanProgress = $state('');

	async function loadData() {
		const [settingsRes, jobsRes] = await Promise.all([
			fetch('/api/settings'),
			fetch('/api/jobs')
		]);
		settings = await settingsRes.json();
		const jobsData = await jobsRes.json();
		jobs = jobsData.jobs;
	}

	async function triggerScan(type: 'library' | 'player') {
		scanning = type;
		scanProgress = 'Starting scan...';

		const eventSource = new EventSource(`/api/scan/${type}`);

		eventSource.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.phase === 'discovering') {
				scanProgress = 'Discovering files...';
			} else if (data.phase === 'scanning') {
				scanProgress = `Scanning: ${data.current}/${data.total}`;
			} else if (data.phase === 'complete') {
				scanProgress = `Complete: ${data.total} files processed`;
				scanning = null;
				eventSource.close();
				loadData();
			} else if (data.phase === 'error') {
				scanProgress = `Error: ${data.error}`;
				scanning = null;
				eventSource.close();
			}
		};

		eventSource.onerror = () => {
			scanProgress = 'Connection lost';
			scanning = null;
			eventSource.close();
		};
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		const d = new Date(dateStr + 'Z');
		return d.toLocaleString();
	}

	function jobTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			library_scan: 'Library scan',
			player_scan: 'Player scan',
			sync: 'Sync',
			migrate: 'Migration'
		};
		return labels[type] || type;
	}

	onMount(loadData);
</script>

<div class="settings-page">
	<header class="page-header">
		<h1>Settings</h1>
	</header>

	{#if settings}
		<!-- Configuration -->
		<section class="section">
			<h2 class="section-title">Configuration</h2>
			<div class="settings-list">
				<div class="setting-row">
					<span class="setting-label">Library path</span>
					<code class="setting-value">{settings.libraryPath}</code>
				</div>
				<div class="setting-row">
					<span class="setting-label">Player path</span>
					<code class="setting-value">{settings.playerPath}</code>
				</div>
				<div class="setting-row">
					<span class="setting-label">Managed directory</span>
					<code class="setting-value">{settings.managedDir || 'Not set'}</code>
				</div>
			</div>
		</section>

		<!-- Scanning -->
		<section class="section">
			<h2 class="section-title">Scanning</h2>

			{#if scanning}
				<div class="scan-progress">
					<div class="spinner-small"></div>
					<span>{scanProgress}</span>
				</div>
			{/if}

			<div class="scan-actions">
				<button
					class="scan-btn"
					disabled={scanning !== null}
					onclick={() => triggerScan('library')}
				>
					<strong>Rescan library</strong>
					<span>Index new/changed files in the music library</span>
				</button>
				<button
					class="scan-btn"
					disabled={scanning !== null}
					onclick={() => triggerScan('player')}
				>
					<strong>Rescan player</strong>
					<span>Re-index files on the player and update sync status</span>
				</button>
			</div>
		</section>
	{/if}

	<!-- Job history -->
	<section class="section">
		<h2 class="section-title">Recent jobs</h2>
		{#if jobs.length === 0}
			<p class="empty-text">No jobs yet</p>
		{:else}
			<div class="job-list">
				{#each jobs as job}
					<div class="job-row">
						<div class="job-info">
							<span class="job-type">{jobTypeLabel(job.type)}</span>
							<span class="job-time">{formatDate(job.started_at)}</span>
						</div>
						<div class="job-status-row">
							<span
								class="job-status"
								class:running={job.status === 'running'}
								class:completed={job.status === 'completed'}
								class:failed={job.status === 'failed'}
							>
								{job.status}
							</span>
							{#if job.total > 0}
								<span class="job-progress">{job.progress}/{job.total}</span>
							{/if}
						</div>
						{#if job.error}
							<span class="job-error">{job.error}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.settings-page { max-width: 700px; }

	.page-header h1 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0 0 2rem;
	}

	.section { margin-bottom: 2.5rem; }

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		margin: 0 0 0.75rem;
	}

	/* Settings */
	.settings-list {
		background: var(--color-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.setting-row:last-child { border-bottom: none; }

	.setting-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.setting-value {
		font-size: 0.8125rem;
		background: var(--color-bg);
		padding: 0.1875rem 0.5rem;
		border-radius: 3px;
		color: var(--color-text);
	}

	/* Scan */
	.scan-progress {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 0;
		font-size: 0.875rem;
		color: var(--color-accent);
		margin-bottom: 0.75rem;
	}

	.spinner-small {
		width: 16px;
		height: 16px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	.scan-actions {
		display: flex;
		gap: 0.75rem;
	}

	.scan-btn {
		flex: 1;
		padding: 1rem 1.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border-subtle);
		border-radius: 8px;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s;
		font-family: inherit;
	}

	.scan-btn:hover:not(:disabled) {
		border-color: var(--color-accent-muted);
	}

	.scan-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.scan-btn strong {
		display: block;
		font-size: 0.875rem;
		color: var(--color-text);
		margin-bottom: 0.25rem;
		font-weight: 500;
	}

	.scan-btn span {
		font-size: 0.8125rem;
		color: var(--color-text-faint);
	}

	/* Jobs */
	.empty-text {
		color: var(--color-text-faint);
		font-size: 0.875rem;
	}

	.job-list {
		background: var(--color-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.job-row {
		padding: 0.625rem 1.25rem;
		border-bottom: 1px solid var(--color-border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.job-row:last-child { border-bottom: none; }

	.job-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.job-type {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.job-time {
		font-size: 0.75rem;
		color: var(--color-text-faint);
	}

	.job-status-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.job-status {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.125rem 0.5rem;
		border-radius: 3px;
	}

	.job-status.running {
		color: var(--color-accent);
		background: rgba(212, 168, 67, 0.1);
	}

	.job-status.completed {
		color: var(--color-synced);
		background: rgba(76, 175, 106, 0.1);
	}

	.job-status.failed {
		color: var(--color-danger);
		background: rgba(212, 80, 80, 0.1);
	}

	.job-progress {
		font-size: 0.75rem;
		color: var(--color-text-faint);
	}

	.job-error {
		width: 100%;
		font-size: 0.75rem;
		color: var(--color-danger);
	}

	@media (max-width: 640px) {
		.scan-actions { flex-direction: column; }
	}
</style>
