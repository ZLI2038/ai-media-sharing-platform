import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100_000;

export type PostRecord = {
  id: string;
  user: string;
  message: string;
  type: 'image' | 'video';
  url: string;
  createdAt: string;
};

type StoredPost = {
  id: string;
  user: string;
  message: string;
  media_type: 'image' | 'video';
  object_key: string;
  content_type: string;
  created_at: string;
};

export function database(): D1Database {
  if (!env.DB) throw new Error('Database binding is unavailable.');
  return env.DB;
}

export function files(): R2Bucket {
  if (!env.FILES) throw new Error('Object storage binding is unavailable.');
  return env.FILES;
}

export async function ensureSchema() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      user TEXT NOT NULL,
      message TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts (user, created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC)'),
  ]);
  await db.prepare('PRAGMA optimize').run();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function tokenSecret(): string {
  return env.TOKEN_SECRET || 'socialai-local-development-secret-change-me';
}

async function hmac(value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(tokenSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function createToken(username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = stringToBase64Url(JSON.stringify({ username, exp: now + TOKEN_TTL_SECONDS }));
  const value = `${header}.${payload}`;
  return `${value}.${bytesToBase64Url(await hmac(value))}`;
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra) return null;
    const expected = await hmac(`${header}.${payload}`);
    const received = base64UrlToBytes(signature);
    if (expected.length !== received.length) return null;
    let mismatch = 0;
    for (let index = 0; index < expected.length; index += 1) mismatch |= expected[index] ^ received[index];
    if (mismatch !== 0) return null;
    const body = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { username?: string; exp?: number };
    if (!body.username || !body.exp || body.exp <= Math.floor(Date.now() / 1000)) return null;
    return body.username;
  } catch {
    return null;
  }
}

export async function bearerUser(request: Request): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return verifyToken(authorization.slice(7));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
    material,
    256,
  ));
  return `${bytesToBase64Url(salt)}.${bytesToBase64Url(derived)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [saltValue, hashValue] = encoded.split('.');
    const saltBytes = base64UrlToBytes(saltValue);
    const salt = saltBytes.buffer.slice(
      saltBytes.byteOffset,
      saltBytes.byteOffset + saltBytes.byteLength,
    ) as ArrayBuffer;
    const expected = base64UrlToBytes(hashValue);
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
      material,
      256,
    ));
    if (derived.length !== expected.length) return false;
    let mismatch = 0;
    for (let index = 0; index < derived.length; index += 1) mismatch |= derived[index] ^ expected[index];
    return mismatch === 0;
  } catch {
    return false;
  }
}

export function postFromRow(row: StoredPost): PostRecord {
  return {
    id: row.id,
    user: row.user,
    message: row.message,
    type: row.media_type,
    url: `/api/media/${encodeURIComponent(row.id)}`,
    createdAt: row.created_at,
  };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
