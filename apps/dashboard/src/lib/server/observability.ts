type SpanAttributes = Record<string, string | number | boolean | undefined>;

type TraceSpan = {
	setAttribute(key: string, value: string | number | boolean | undefined): void;
};

type TracingApi = {
	enterSpan<T>(name: string, callback: (span: TraceSpan) => T): T;
};

let tracingLoader: Promise<TracingApi | null> | undefined;

function loadTracing(): Promise<TracingApi | null> {
	if (tracingLoader === undefined) {
		const moduleName: string = 'cloudflare:workers';
		tracingLoader = import(moduleName)
			.then((module) => (module as { tracing?: TracingApi }).tracing ?? null)
			.catch(() => null);
	}
	return tracingLoader;
}

function applyAttributes(span: TraceSpan, attributes?: SpanAttributes) {
	if (!attributes) return;
	for (const [key, value] of Object.entries(attributes)) {
		span.setAttribute(key, value);
	}
}

export async function instrument<T>(
	name: string,
	operation: () => Promise<T>,
	attributes?: SpanAttributes
): Promise<T> {
	const tracing = await loadTracing();
	if (!tracing) return operation();

	return tracing.enterSpan(name, (span) => {
		applyAttributes(span, attributes);
		return operation();
	});
}

export function summarizeStatement(statement: string | undefined): string | undefined {
	if (!statement) return undefined;
	return statement.replace(/\s+/g, ' ').trim().slice(0, 120);
}
