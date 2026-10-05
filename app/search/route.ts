import { GET as search } from '@/app/api/posts/route';
import { legacyOptions, withLegacyCors } from '@/lib/legacy';

export async function GET(request: Request) {
  return withLegacyCors(await search(request));
}

export const OPTIONS = legacyOptions;
