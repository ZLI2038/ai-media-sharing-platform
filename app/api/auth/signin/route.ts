import { createToken, database, ensureSchema, jsonError, verifyPassword } from '@/lib/server';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Please provide a valid username and password.', 400);
  }

  const username = body.username?.trim() || '';
  const password = body.password || '';
  if (!username || !password) return jsonError('Username and password are required.', 400);

  await ensureSchema();
  const user = await database()
    .prepare('SELECT password_hash FROM users WHERE username = ?')
    .bind(username)
    .first<{ password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return jsonError("User doesn't exists or wrong password", 401);
  }

  return Response.json({ token: await createToken(username), username });
}
