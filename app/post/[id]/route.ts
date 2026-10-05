import { DELETE as remove } from '@/app/api/posts/[id]/route';
import { legacyOptions, withLegacyCors } from '@/lib/legacy';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await remove(request, context);
  if (!response.ok) return withLegacyCors(response);
  return withLegacyCors(new Response(null, { status: 200 }));
}

export const OPTIONS = legacyOptions;
