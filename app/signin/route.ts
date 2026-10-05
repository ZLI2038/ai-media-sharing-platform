import { POST as signin } from '@/app/api/auth/signin/route';
import { legacyOptions, withLegacyCors } from '@/lib/legacy';

export async function POST(request: Request) {
  const response = await signin(request);
  if (!response.ok) return withLegacyCors(response);
  const result = await response.json() as { token: string };
  return withLegacyCors(new Response(result.token, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
}

export const OPTIONS = legacyOptions;
