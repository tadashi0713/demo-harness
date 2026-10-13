import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

type Metrics = {
  registry: Registry;
  httpRequests: Counter<'method' | 'status'>;
  httpRequestDuration: Histogram<'method' | 'status'>;
};

function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  return {
    registry,
    httpRequests: new Counter({
      name: 'http_requests_total',
      help: 'API リクエスト数',
      labelNames: ['method', 'status'],
      registers: [registry],
    }),
    httpRequestDuration: new Histogram({
      name: 'http_request_duration_seconds',
      help: 'API リクエストの処理時間（秒）',
      labelNames: ['method', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [registry],
    }),
  };
}

// Route Handler はルートごとに別々にバンドルされるため、globalThis で 1 つのレジストリを共有する
const globalForMetrics = globalThis as typeof globalThis & { atlasbankMetrics?: Metrics };

export const metrics = (globalForMetrics.atlasbankMetrics ??= createMetrics());

export function recordRequest(method: string, status: number, durationSeconds: number): void {
  const labels = { method, status: String(status) };
  metrics.httpRequests.inc(labels);
  metrics.httpRequestDuration.observe(labels, durationSeconds);
}
