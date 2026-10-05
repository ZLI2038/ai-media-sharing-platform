import { database, ensureSchema, files, jsonError } from '@/lib/server';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await ensureSchema();
  const post = await database()
    .prepare('SELECT object_key, content_type FROM posts WHERE id = ?')
    .bind(id)
    .first<{ object_key: string; content_type: string }>();
  if (!post) return jsonError('Media not found.', 404);

  const object = await files().get(post.object_key);
  if (!object?.body) return jsonError('Media not found.', 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': post.content_type,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: object.httpEtag,
    },
  });
}
