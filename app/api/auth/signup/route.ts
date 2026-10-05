import { database, ensureSchema, hashPassword, jsonError } from '@/lib/server';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Please provide a valid username and password.', 400);
  }

  const username = body.username?.trim() || '';
  const password = body.password || '';
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return jsonError('Invalid username or password', 400);
  }
  if (!password) {
    return jsonError('Invalid username or password', 400);
  }

  await ensureSchema();
  const existing = await database().prepare('SELECT username FROM users WHERE username = ?').bind(username).first();
  if (existing) return jsonError('User already exists', 409);

  try {
    await database()
      .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .bind(username, await hashPassword(password), new Date().toISOString())
      .run();
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return jsonError('Failed to save user to Elasticsearch', 500);
  }
}
