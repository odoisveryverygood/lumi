import { getAIStatus } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getAIStatus(), { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
