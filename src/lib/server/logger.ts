/**
 * Simple structured logger for server-side code.
 * Outputs to stdout/stderr so Docker captures it via `docker compose logs`.
 */

function timestamp(): string {
	return new Date().toISOString();
}

function formatMessage(level: string, module: string, message: string, data?: Record<string, unknown>): string {
	const parts = [`[${timestamp()}]`, `[${level}]`, `[${module}]`, message];
	if (data && Object.keys(data).length > 0) {
		parts.push(JSON.stringify(data));
	}
	return parts.join(' ');
}

export function createLogger(module: string) {
	return {
		info(message: string, data?: Record<string, unknown>) {
			console.log(formatMessage('INFO', module, message, data));
		},
		warn(message: string, data?: Record<string, unknown>) {
			console.warn(formatMessage('WARN', module, message, data));
		},
		error(message: string, data?: Record<string, unknown>) {
			console.error(formatMessage('ERROR', module, message, data));
		},
		debug(message: string, data?: Record<string, unknown>) {
			if (process.env.LOG_LEVEL === 'debug') {
				console.log(formatMessage('DEBUG', module, message, data));
			}
		}
	};
}
