import { scanLibrary } from '$lib/server/scanner.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			scanLibrary((progress) => {
				const data = `data: ${JSON.stringify(progress)}\n\n`;
				controller.enqueue(encoder.encode(data));
				if (progress.phase === 'complete' || progress.phase === 'error') {
					controller.close();
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
