import { bearerUser, database, ensureSchema, files, jsonError } from '@/lib/server';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const username = await bearerUser(request);
  if (!username) return jsonError('Please sign in again.', 401);
  const { id } = await context.params;
  await ensureSchema();

  const post = await database()
    .prepare('SELECT object_key FROM posts WHERE id = ? AND user = ?')
    .bind(id, username)
    .first<{ object_key: string }>();
  if (!post) return jsonError('Post not found or you do not own it.', 404);

  await database().prepare('DELETE FROM posts WHERE id = ? AND user = ?').bind(id, username).run();
  await files().delete(post.object_key).catch(() => undefined);
  return Response.json({ ok: true });
}
