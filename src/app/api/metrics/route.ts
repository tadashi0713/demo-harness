import { metrics } from '@/server/metrics';

export const dynamic = 'force-dynamic';

// Prometheus のスクレイプ自体は計測しないよう route() で包まない
export async function GET(): Promise<Response> {
  return new Response(await metrics.registry.metrics(), {
    headers: { 'Content-Type': metrics.registry.contentType },
  });
}
