import {
  bearerUser,
  database,
  ensureSchema,
  files,
  jsonError,
  postFromRow,
  type PostRecord,
} from '@/lib/server';

type StoredPost = {
  id: string;
  user: string;
  message: string;
  media_type: 'image' | 'video';
  object_key: string;
  content_type: string;
  created_at: string;
};

export async function GET(request: Request) {
  if (!(await bearerUser(request))) return jsonError('Please sign in again.', 401);
  await ensureSchema();

  const url = new URL(request.url);
  const user = url.searchParams.get('user')?.trim().toLowerCase();
  const keywords = url.searchParams.get('keywords')?.trim().toLowerCase();
  let statement = 'SELECT id, user, message, media_type, object_key, content_type, created_at FROM posts';
  const bindings: string[] = [];

  if (user) {
    statement += ' WHERE user = ?';
    bindings.push(user);
  } else if (keywords) {
    const terms = keywords.split(/\s+/).filter(Boolean).slice(0, 8);
    if (terms.length) {
      statement += ` WHERE ${terms.map(() => 'instr(lower(message), ?) > 0').join(' AND ')}`;
      bindings.push(...terms);
    }
  }

  statement += ' ORDER BY created_at DESC LIMIT 100';
  try {
    const query = database().prepare(statement);
    const result = bindings.length
      ? await query.bind(...bindings).all<StoredPost>()
      : await query.all<StoredPost>();
    const posts: PostRecord[] = (result.results || []).map(postFromRow);
    return Response.json(posts);
  } catch {
    return jsonError('Failed to read posts from storage.', 500);
  }
}

export async function POST(request: Request) {
  const username = await bearerUser(request);
  if (!username) return jsonError('Please sign in again.', 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('The upload form could not be read.', 400);
  }

  const message = String(form.get('message') || '').trim();
  const file = form.get('media_file');
  if (!message) return jsonError('Please add a message.', 400);
  if (message.length > 500) return jsonError('Messages can be up to 500 characters.', 400);
  if (!(file instanceof File)) return jsonError('Please choose an image or video.', 400);
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) return jsonError('Files must be between 1 byte and 25 MB.', 400);

  const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
  if (!mediaType) return jsonError('Only image and video files are supported.', 400);

  await ensureSchema();
  const id = crypto.randomUUID();
  const safeName = (file.name || `${mediaType}.bin`).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-90);
  const objectKey = `${username}/${id}/${safeName}`;
  const createdAt = new Date().toISOString();

  try {
    await files().put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { owner: username, postId: id },
    });
    await database()
      .prepare(`INSERT INTO posts
        (id, user, message, media_type, object_key, content_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, username, message, mediaType, objectKey, file.type || 'application/octet-stream', createdAt)
      .run();
  } catch {
    await files().delete(objectKey).catch(() => undefined);
    return jsonError('The post could not be saved.', 500);
  }

  return Response.json({
    id,
    user: username,
    message,
    type: mediaType,
    url: `/api/media/${id}`,
    createdAt,
  } satisfies PostRecord, { status: 201 });
}
