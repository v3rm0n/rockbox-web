import { scanLibrary } from '$lib/server/scanner.js';
import { createLogger } from '$lib/server/logger.js';
import type { RequestHandler } from './$types.js';

const log = createLogger('api:scan:library');

export const GET: RequestHandler = async () => {
	log.info('Library scan requested via API');

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			scanLibrary((progress) => {
				const data = `data: ${JSON.stringify(progress)}\n\n`;
				try {
					controller.enqueue(encoder.encode(data));
				} catch (err) {
					log.warn('Failed to enqueue SSE data (client may have disconnected)', {
						phase: progress.phase,
						error: err instanceof Error ? err.message : String(err)
					});
					return;
				}
				if (progress.phase === 'complete' || progress.phase === 'error') {
					log.info('Library scan SSE stream closing', { phase: progress.phase, total: progress.total });
					try {
						controller.close();
					} catch {
						// Stream already closed
					}
				}
			}).catch((err) => {
				log.error('Library scan threw unhandled error', { error: err instanceof Error ? err.message : String(err) });
				try {
					const errorData = `data: ${JSON.stringify({ phase: 'error', current: 0, total: 0, error: 'Internal scan error' })}\n\n`;
					controller.enqueue(encoder.encode(errorData));
					controller.close();
				} catch {
					// Stream already closed
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
