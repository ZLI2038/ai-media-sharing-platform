import { POST as upload } from '@/app/api/posts/route';
import { legacyOptions, withLegacyCors } from '@/lib/legacy';

export async function POST(request: Request) {
  const response = await upload(request);
  if (!response.ok) return withLegacyCors(response);
  return withLegacyCors(new Response(null, { status: 200 }));
}

export const OPTIONS = legacyOptions;
